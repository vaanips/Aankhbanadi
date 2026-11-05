
from pathlib import Path
import json
import torch
import numpy as np
from ultralytics import YOLO
from pycocotools.coco import COCO
from pycocotools.cocoeval import COCOeval


# ============================================================
# DRISHTI - GROUPED COCO EVALUATION WITH TEST-TIME AUGMENTATION
# ============================================================

MODEL_PATH = "yolo26x.pt"
COCO_ROOT = Path(
    r"C:\Users\srane\OneDrive\Desktop\datasets\coco"
)

IMAGE_SIZE = 640
BATCH_SIZE = 2
CONFIDENCE = 0.001
DEVICE = 0 if torch.cuda.is_available() else "cpu"

OUTPUT_DIR = Path(
    "runs/evaluation/yolo26x_grouped_coco_tta"
)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# GROUPS - MATCHING YOUR DRISHTI APPLICATION
# ============================================================

VEHICLES = {
    "bicycle", "car", "motorcycle", "bus", "train", "truck"
}

ANIMALS = {
    "bird", "cat", "dog", "horse", "sheep", "cow",
    "elephant", "bear", "zebra", "giraffe"
}

FURNITURE = {
    "chair", "couch", "bed", "dining table", "toilet", "bench"
}

ROAD_SIGNALS = {"traffic light", "stop sign"}

ELECTRONICS = {
    "tv", "laptop", "mouse", "remote", "keyboard", "cell phone"
}

KITCHEN_ITEMS = {
    "bottle", "wine glass", "cup", "fork", "knife", "spoon",
    "bowl", "microwave", "oven", "toaster", "sink", "refrigerator"
}

SPORTS_ITEMS = {
    "sports ball", "baseball bat", "baseball glove",
    "skateboard", "surfboard", "tennis racket", "frisbee",
    "skis", "snowboard"
}

OBSTACLES = {
    "fire hydrant", "parking meter", "potted plant",
    "suitcase", "backpack", "handbag", "umbrella"
}

GROUP_NAMES = [
    "Person",
    "Vehicle",
    "Animal",
    "Road signal",
    "Furniture",
    "Electronics",
    "Kitchen item",
    "Sports equipment",
    "Obstacle",
    "Object",
]

GROUP_TO_ID = {
    name: index + 1
    for index, name in enumerate(GROUP_NAMES)
}


def get_group(name):
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
        return "Electronics"
    if name in KITCHEN_ITEMS:
        return "Kitchen item"
    if name in SPORTS_ITEMS:
        return "Sports equipment"
    if name in OBSTACLES:
        return "Obstacle"
    return "Object"


# ============================================================
# LOCATE COCO VALIDATION FILES
# ============================================================

def find_coco_files():
    annotation_candidates = [
        COCO_ROOT / "annotations" / "instances_val2017.json",
        COCO_ROOT / "annotations" / "instances_val.json",
    ]

    image_candidates = [
        COCO_ROOT / "images" / "val2017",
        COCO_ROOT / "val2017",
    ]

    annotation_file = next(
        (p for p in annotation_candidates if p.is_file()),
        None,
    )
    image_dir = next(
        (p for p in image_candidates if p.is_dir()),
        None,
    )

    if annotation_file is None:
        raise FileNotFoundError(
            "COCO validation annotation JSON was not found. "
            f"Check COCO_ROOT: {COCO_ROOT}"
        )

    if image_dir is None:
        raise FileNotFoundError(
            "COCO validation images were not found. "
            f"Check COCO_ROOT: {COCO_ROOT}"
        )

    return annotation_file, image_dir


# ============================================================
# GROUP GROUND-TRUTH ANNOTATIONS
# ============================================================

def create_grouped_ground_truth(annotation_file, output_file):
    with open(annotation_file, "r", encoding="utf-8") as file:
        original = json.load(file)

    category_names = {
        category["id"]: category["name"]
        for category in original["categories"]
    }

    annotations = []

    for annotation in original["annotations"]:
        name = category_names.get(annotation["category_id"])
        if name is None:
            continue

        grouped_annotation = dict(annotation)
        grouped_annotation["category_id"] = GROUP_TO_ID[
            get_group(name)
        ]
        annotations.append(grouped_annotation)

    grouped = {
        "info": original.get("info", {}),
        "licenses": original.get("licenses", []),
        "images": original["images"],
        "annotations": annotations,
        "categories": [
            {
                "id": GROUP_TO_ID[name],
                "name": name,
                "supercategory": "drishti_group",
            }
            for name in GROUP_NAMES
        ],
    }

    with open(output_file, "w", encoding="utf-8") as file:
        json.dump(grouped, file)

    print(f"Validation images: {len(grouped['images']):,}")
    print(f"Grouped ground-truth boxes: {len(annotations):,}")

    return grouped


# ============================================================
# GROUP PREDICTIONS WITH TEST-TIME AUGMENTATION
# ============================================================

def create_grouped_predictions(model, images, image_dir, output_file):
    predictions = []
    total = len(images)

    for start in range(0, total, BATCH_SIZE):
        batch_images = images[start:start + BATCH_SIZE]

        paths = [
            str(image_dir / image["file_name"])
            for image in batch_images
        ]

        for path in paths:
            if not Path(path).is_file():
                raise FileNotFoundError(f"Missing image: {path}")

        results = model.predict(
            source=paths,
            imgsz=IMAGE_SIZE,
            batch=BATCH_SIZE,
            device=DEVICE,
            conf=CONFIDENCE,
            max_det=300,
            augment=True,
            verbose=False,
            stream=False,
        )

        for image, result in zip(batch_images, results):
            if result.boxes is None:
                continue

            for box in result.boxes:
                class_id = int(box.cls[0].item())
                confidence = float(box.conf[0].item())
                name = str(model.names[class_id]).lower().strip()

                x1, y1, x2, y2 = (
                    box.xyxy[0].detach().cpu().tolist()
                )

                group = get_group(name)

                predictions.append({
                    "image_id": image["id"],
                    "category_id": GROUP_TO_ID[group],
                    "bbox": [
                        float(x1),
                        float(y1),
                        float(x2 - x1),
                        float(y2 - y1),
                    ],
                    "score": confidence,
                })

        processed = min(start + len(batch_images), total)
        print(
            f"\rProcessed {processed}/{total} images",
            end="",
            flush=True,
        )

    print()

    with open(output_file, "w", encoding="utf-8") as file:
        json.dump(predictions, file)

    print(f"Grouped predictions: {len(predictions):,}")
    return predictions


# ============================================================
# EVALUATE GROUPED METRICS
# ============================================================

def evaluate_grouped(gt_file, prediction_file):
    ground_truth = COCO(str(gt_file))

    with open(prediction_file, "r", encoding="utf-8") as file:
        predictions = json.load(file)

    if not predictions:
        raise RuntimeError("No predictions were generated.")

    detections = ground_truth.loadRes(predictions)

    evaluator = COCOeval(
        ground_truth,
        detections,
        iouType="bbox",
    )

    evaluator.params.catIds = list(GROUP_TO_ID.values())
    evaluator.evaluate()
    evaluator.accumulate()
    evaluator.summarize()

    print("\n========== GROUPED TTA RESULTS ==========")
    print(f"mAP@50:    {evaluator.stats[1] * 100:.2f}%")
    print(f"mAP@50-95: {evaluator.stats[0] * 100:.2f}%")
    print(f"AP@75:     {evaluator.stats[2] * 100:.2f}%")

    precision = evaluator.eval["precision"]

    print("\nPer-group scores:")
    print(f"{'Group':<22} {'mAP@50':>10} {'mAP@50-95':>13}")

    for index, group in enumerate(GROUP_NAMES):
        # Precision dimensions:
        # IoU, recall, category, area, max detections
        group_precision = precision[:, :, index, 0, 2]
        valid = group_precision[group_precision > -1]

        if valid.size == 0:
            print(f"{group:<22} {'N/A':>10} {'N/A':>13}")
            continue

        ap_all = float(valid.mean() * 100)

        ap50_values = precision[0, :, index, 0, 2]
        ap50_valid = ap50_values[ap50_values > -1]
        ap50 = (
            float(ap50_valid.mean() * 100)
            if ap50_valid.size else float("nan")
        )

        print(f"{group:<22} {ap50:>9.2f}% {ap_all:>12.2f}%")

    print(f"\nResults saved in: {OUTPUT_DIR.resolve()}")


# ============================================================
# MAIN
# ============================================================

def main():
    print("=" * 60)
    print("DRISHTI - GROUPED COCO EVALUATION WITH TTA")
    print("=" * 60)
    print(f"Device: {DEVICE}")
    print(f"Image size: {IMAGE_SIZE}")
    print("Test-time augmentation: enabled")

    annotation_file, image_dir = find_coco_files()

    print(f"Annotations: {annotation_file}")
    print(f"Images: {image_dir}")

    model = YOLO(MODEL_PATH)

    gt_file = OUTPUT_DIR / "grouped_ground_truth.json"
    prediction_file = OUTPUT_DIR / "grouped_predictions.json"

    grouped = create_grouped_ground_truth(
        annotation_file,
        gt_file,
    )

    create_grouped_predictions(
        model,
        grouped["images"],
        image_dir,
        prediction_file,
    )

    evaluate_grouped(gt_file, prediction_file)


if __name__ == "__main__":
    main()
