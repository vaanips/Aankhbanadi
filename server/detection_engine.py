"""YOLO detection engine — grouping/distance/direction matched to blind_v1.py.

Phone-path fixes:
- EXIF orientation (VisionCamera JPEGs)
- Wider vertical FOV for phone cameras (distances were overestimated)
- Speak/display Electronics as "Electronic"
"""

from __future__ import annotations

import io
import math
import os
import time
import uuid
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import torch
from ultralytics import YOLO

MODEL_PATH = Path(
    os.environ.get(
        "DRISHTI_MODEL_PATH",
        str(Path(__file__).resolve().parent.parent / "yolo26x.pt"),
    )
)
IMAGE_SIZE = 640
# Slightly lower than blind_v1 so phone JPEG frames keep more detections
CONFIDENCE_THRESHOLD = 0.35
# Phone rear cameras are wider than the laptop webcam blind_v1 used (45°)
VERTICAL_FOV_DEGREES = 58.0
STEP_LENGTH_METERS = 0.65

OBJECT_HEIGHTS = {
    "person": 1.70,
    "bicycle": 1.10,
    "car": 1.50,
    "motorcycle": 1.20,
    "bus": 3.00,
    "truck": 3.00,
    "train": 3.50,
    "bird": 0.25,
    "cat": 0.30,
    "dog": 0.50,
    "horse": 1.50,
    "sheep": 0.80,
    "cow": 1.40,
    "elephant": 2.50,
    "bear": 1.20,
    "zebra": 1.40,
    "giraffe": 4.00,
    "chair": 0.90,
    "couch": 0.90,
    "bed": 0.60,
    "dining table": 0.75,
    "toilet": 0.70,
    "bench": 0.80,
    "tv": 0.60,
    "laptop": 0.25,
    "cell phone": 0.15,
    "remote": 0.18,
    "mouse": 0.04,
    "keyboard": 0.04,
    "bottle": 0.25,
    "wine glass": 0.20,
    "cup": 0.12,
    "fork": 0.18,
    "knife": 0.23,
    "spoon": 0.18,
    "bowl": 0.12,
    "potted plant": 0.70,
    "backpack": 0.50,
    "suitcase": 0.60,
    "handbag": 0.30,
    "umbrella": 0.90,
    "traffic light": 0.80,
    "stop sign": 0.75,
    "fire hydrant": 0.75,
    "parking meter": 1.50,
    "microwave": 0.35,
    "oven": 0.85,
    "toaster": 0.25,
    "sink": 0.40,
    "refrigerator": 1.70,
    "sports ball": 0.22,
    "baseball bat": 0.85,
    "baseball glove": 0.30,
    "skateboard": 0.15,
    "surfboard": 0.30,
    "tennis racket": 0.70,
    "frisbee": 0.03,
    "skis": 0.20,
    "snowboard": 0.20,
}

VEHICLES = {"bicycle", "car", "motorcycle", "bus", "train", "truck"}
ANIMALS = {
    "bird", "cat", "dog", "horse", "sheep", "cow",
    "elephant", "bear", "zebra", "giraffe",
}
FURNITURE = {"chair", "couch", "bed", "dining table", "toilet", "bench"}
ROAD_SIGNALS = {"traffic light", "stop sign"}
ELECTRONICS = {"tv", "laptop", "mouse", "remote", "keyboard", "cell phone"}
KITCHEN_ITEMS = {
    "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl",
    "microwave", "oven", "toaster", "sink", "refrigerator",
}
SPORTS_ITEMS = {
    "sports ball", "baseball bat", "baseball glove", "skateboard",
    "surfboard", "tennis racket", "frisbee", "skis", "snowboard",
}
OBSTACLES = {
    "fire hydrant", "parking meter", "potted plant",
    "suitcase", "backpack", "handbag", "umbrella",
}

GROUP_CLASS_NAMES: dict[str, set[str]] = {
    "person": {"person"},
    "vehicle": VEHICLES,
    "animal": ANIMALS,
    "road signal": ROAD_SIGNALS,
    "furniture": FURNITURE,
    "electronic": ELECTRONICS,
    "electronics": ELECTRONICS,
    "kitchen item": KITCHEN_ITEMS,
    "sports equipment": SPORTS_ITEMS,
    "obstacle": OBSTACLES,
}


def get_group(name: str) -> str:
    if name == "person":
        return "Person"
    if name in VEHICLES:
        return "Vehicle"
    if name in ANIMALS:
        return "Animal"
    if name in ROAD_SIGNALS:
        return "Road signal"
    if name in FURNITURE:
        return "Furniture"
    if name in ELECTRONICS:
        return "Electronic"  # user-facing group (not raw "laptop")
    if name in KITCHEN_ITEMS:
        return "Kitchen item"
    if name in SPORTS_ITEMS:
        return "Sports equipment"
    if name in OBSTACLES:
        return "Obstacle"
    return "Object"


def get_group_phrase(group: str) -> str:
    phrases = {
        "Person": "person",
        "Vehicle": "vehicle",
        "Animal": "animal",
        "Road signal": "road signal",
        "Furniture": "furniture",
        "Electronic": "electronic",
        "Electronics": "electronic",
        "Kitchen item": "kitchen item",
        "Sports equipment": "sports equipment",
        "Obstacle": "obstacle",
        "Object": "object",
    }
    return phrases.get(group, "object")


def get_direction(center_x: float, frame_width: int) -> str:
    position = center_x / max(frame_width, 1)
    if position < 0.35:
        return "left"
    if position > 0.65:
        return "right"
    return "ahead"


def direction_to_contract(direction: str) -> str:
    if direction == "ahead":
        return "center"
    return direction


def _assumed_height(name: str, box_width: float, box_height: float) -> float | None:
    real_height = OBJECT_HEIGHTS.get(name)
    if real_height is None:
        return None
    # Sitting / crouched people → shorter visible height (fixes huge overestimates)
    if name == "person" and box_height > 0 and (box_width / box_height) >= 0.65:
        return 1.05
    return real_height


def estimate_distance(
    name: str,
    box_height: float,
    frame_height: int,
    box_width: float = 0.0,
) -> float | None:
    real_height = _assumed_height(name, box_width, box_height)
    if real_height is None or box_height <= 0 or frame_height <= 0:
        return None

    focal_length_pixels = frame_height / (
        2.0 * math.tan(math.radians(VERTICAL_FOV_DEGREES) / 2.0)
    )
    distance = focal_length_pixels * real_height / box_height

    # Sanity: large boxes cannot be far away
    frac = box_height / float(frame_height)
    if frac >= 0.55:
        distance = min(distance, 1.8)
    elif frac >= 0.40:
        distance = min(distance, 2.6)
    elif frac >= 0.28:
        distance = min(distance, 4.0)

    return max(0.1, float(distance))


def distance_to_steps(distance_m: float | None) -> int | None:
    if distance_m is None or distance_m <= 0:
        return None
    return max(1, int(round(distance_m / STEP_LENGTH_METERS)))


def format_box_label(group: str, distance: float | None, confidence: float) -> str:
    if distance is not None:
        return f"{group} ~{distance:.1f}m {confidence:.2f}"
    return f"{group} {confidence:.2f}"


def decode_image_bytes(image_bytes: bytes) -> np.ndarray:
    """Decode JPEG/PNG and apply EXIF orientation (critical for phone captures)."""
    frame: np.ndarray | None = None
    try:
        from PIL import Image, ImageOps

        pil = Image.open(io.BytesIO(image_bytes))
        pil = ImageOps.exif_transpose(pil)
        if pil.mode != "RGB":
            pil = pil.convert("RGB")
        rgb = np.array(pil)
        frame = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:  # noqa: BLE001
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if frame is None:
        raise ValueError("Could not decode image")
    return frame


class DetectionEngine:
    def __init__(self, model_path: Path | None = None) -> None:
        self.model_path = Path(model_path) if model_path else MODEL_PATH
        self.model: YOLO | None = None
        self.device: str | int = "cpu"

    def load(self) -> dict[str, Any]:
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model not found: {self.model_path}")

        if torch.cuda.is_available():
            self.device = 0
            device_name = torch.cuda.get_device_name(0)
            backend = "cuda"
        else:
            self.device = "cpu"
            device_name = "CPU"
            backend = "cpu"

        self.model = YOLO(str(self.model_path))
        dummy = np.zeros((IMAGE_SIZE, IMAGE_SIZE, 3), dtype=np.uint8)
        self.model.predict(
            source=dummy,
            imgsz=IMAGE_SIZE,
            conf=CONFIDENCE_THRESHOLD,
            device=self.device,
            verbose=False,
        )
        return {
            "model": str(self.model_path.name),
            "backend": backend,
            "device_name": device_name,
            "image_size": IMAGE_SIZE,
            "confidence": CONFIDENCE_THRESHOLD,
            "verticalFovDegrees": VERTICAL_FOV_DEGREES,
        }

    def detect_bgr(self, frame: np.ndarray) -> list[dict[str, Any]]:
        if self.model is None:
            raise RuntimeError("Model not loaded")

        frame_height, frame_width = frame.shape[:2]
        with torch.inference_mode():
            results = self.model.predict(
                source=frame,
                imgsz=IMAGE_SIZE,
                conf=CONFIDENCE_THRESHOLD,
                device=self.device,
                verbose=False,
            )

        now = int(time.time() * 1000)
        detections: list[dict[str, Any]] = []
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                class_id = int(box.cls[0].item())
                confidence = float(box.conf[0].item())
                name = self.model.names[class_id]
                x1, y1, x2, y2 = map(float, box.xyxy[0].tolist())
                box_width = max(0.0, x2 - x1)
                box_height = max(0.0, y2 - y1)
                center_x = (x1 + x2) / 2.0
                group = get_group(name)
                direction_raw = get_direction(center_x, frame_width)
                distance = estimate_distance(name, box_height, frame_height, box_width)
                steps = distance_to_steps(distance)
                phrase = get_group_phrase(group)
                label = format_box_label(group, distance, confidence)

                detections.append(
                    {
                        "id": str(uuid.uuid4()),
                        "className": name,
                        "category": group,
                        "group": group,
                        "groupPhrase": phrase,
                        "label": label,
                        "confidence": confidence,
                        "boundingBox": {
                            "x": x1 / frame_width,
                            "y": y1 / frame_height,
                            "width": box_width / frame_width,
                            "height": box_height / frame_height,
                        },
                        "box": [x1, y1, x2, y2],
                        "direction": direction_to_contract(direction_raw),
                        "direction_raw": direction_raw,
                        "estimatedDistanceMeters": distance,
                        "estimatedSteps": steps,
                        "distance": distance,
                        "name": name,
                        "timestamp": now,
                        "trackingId": None,
                    }
                )
        return detections

    def detect_bytes(self, image_bytes: bytes) -> list[dict[str, Any]]:
        frame = decode_image_bytes(image_bytes)
        return self.detect_bgr(frame)


engine = DetectionEngine()
