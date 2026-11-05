import cv2
from ultralytics import YOLO
import pyttsx3
import threading
import time
from collections import Counter, deque
from queue import Queue, Empty

# ============================================================
# DRISHTI - YOLOv8m REAL-TIME SCENE DESCRIPTION
# ============================================================

MODEL_PATH = "best.pt"
CAMERA_INDEX = 0

CONFIDENCE_THRESHOLD = 0.55
HISTORY_SIZE = 6
MIN_FRAME_COUNT = 4
MAX_MISSED_FRAMES = 8
IOU_MATCH_THRESHOLD = 0.30
TTS_COOLDOWN = 4.0
IMAGE_SIZE = 640

print("=" * 40)
print("          DRISHTI STARTING")
print("=" * 40)

# ============================================================
# LOAD YOLOv8m MODEL
# ============================================================

print("1. Loading YOLOv8m model...")

model = YOLO(MODEL_PATH)

print("2. YOLOv8m model loaded successfully.")

# ============================================================
# TEXT-TO-SPEECH
# ============================================================

speech_queue = Queue(maxsize=1)

try:
    tts_engine = pyttsx3.init()
    tts_engine.setProperty("rate", 165)
    tts_engine.setProperty("volume", 1.0)
    tts_available = True
    print("3. Text-to-Speech initialized.")

except Exception as exc:
    tts_engine = None
    tts_available = False
    print(f"WARNING: Text-to-Speech unavailable: {exc}")


def speech_worker():
    """Run speech sequentially on one thread."""
    while True:
        text = speech_queue.get()

        if text is None:
            break

        try:
            tts_engine.say(text)
            tts_engine.runAndWait()

        except Exception as exc:
            print(f"TTS error: {exc}")


if tts_available:
    threading.Thread(
        target=speech_worker,
        daemon=True
    ).start()


last_speech_time = 0.0


def speak_async(text):
    """Speak changed descriptions with a cooldown."""
    global last_speech_time

    if not tts_available:
        return

    current_time = time.time()

    if current_time - last_speech_time < TTS_COOLDOWN:
        return

    last_speech_time = current_time

    # Discard outdated queued descriptions.
    try:
        while True:
            speech_queue.get_nowait()
    except Empty:
        pass

    try:
        speech_queue.put_nowait(text)
    except Exception:
        pass


# ============================================================
# POSITION DETECTION
# ============================================================

def get_position(center_x, frame_width):

    left_boundary = frame_width // 3
    right_boundary = 2 * frame_width // 3

    if center_x < left_boundary:
        return "left"

    if center_x > right_boundary:
        return "right"

    return "center"


# ============================================================
# INTERSECTION OVER UNION
# ============================================================

def calculate_iou(box_a, box_b):

    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)

    intersection = (
        max(0, ix2 - ix1) *
        max(0, iy2 - iy1)
    )

    area_a = (
        max(0, ax2 - ax1) *
        max(0, ay2 - ay1)
    )

    area_b = (
        max(0, bx2 - bx1) *
        max(0, by2 - by1)
    )

    union = area_a + area_b - intersection

    if union <= 0:
        return 0.0

    return intersection / union


# ============================================================
# INTERNAL TEMPORAL OBJECT RECORDS
# These are NOT YOLO tracking IDs.
# ============================================================

object_tracks = []
next_internal_id = 0


def create_track(detection):

    global next_internal_id

    track = {
        "internal_id": next_internal_id,
        "class": detection["class"],
        "box": detection["box"],
        "confidence": detection["confidence"],
        "positions": deque(
            [detection["position"]],
            maxlen=HISTORY_SIZE
        ),
        "frames": 1,
        "missed": 0
    }

    next_internal_id += 1

    return track


# ============================================================
# UPDATE TEMPORAL OBJECT RECORDS
# ============================================================

def update_tracks(detections):

    global object_tracks

    candidates = []
    matched_tracks = set()
    matched_detections = set()

    # Find matching objects between frames.
    for track_index, track in enumerate(object_tracks):

        for detection_index, detection in enumerate(detections):

            if track["class"] != detection["class"]:
                continue

            overlap = calculate_iou(
                track["box"],
                detection["box"]
            )

            if overlap >= IOU_MATCH_THRESHOLD:
                candidates.append(
                    (overlap, track_index, detection_index)
                )

    # Process strongest matches first.
    candidates.sort(
        reverse=True,
        key=lambda item: item[0]
    )

    for _, track_index, detection_index in candidates:

        if track_index in matched_tracks:
            continue

        if detection_index in matched_detections:
            continue

        track = object_tracks[track_index]
        detection = detections[detection_index]

        track["box"] = detection["box"]
        track["confidence"] = detection["confidence"]

        track["positions"].append(
            detection["position"]
        )

        track["frames"] += 1
        track["missed"] = 0

        matched_tracks.add(track_index)
        matched_detections.add(detection_index)

    # Count missed frames.
    for track_index, track in enumerate(object_tracks):

        if track_index not in matched_tracks:
            track["missed"] += 1

    # Add newly detected objects.
    for detection_index, detection in enumerate(detections):

        if detection_index not in matched_detections:
            object_tracks.append(
                create_track(detection)
            )

    # Remove old records.
    object_tracks = [
        track for track in object_tracks
        if track["missed"] <= MAX_MISSED_FRAMES
    ]


# ============================================================
# GET STABLE DETECTIONS
# ============================================================

def get_stable_detections():

    stable = []

    for track in object_tracks:

        positions = track["positions"]

        if track["frames"] < MIN_FRAME_COUNT:
            continue

        if len(positions) < MIN_FRAME_COUNT:
            continue

        stable_position, count = (
            Counter(positions).most_common(1)[0]
        )

        if count < MIN_FRAME_COUNT:
            continue

        stable.append(
            (track["class"], stable_position)
        )

    return stable


# ============================================================
# FORMAT OBJECT NAMES
# ============================================================

def format_objects(objects):

    if len(objects) == 1:
        return f"a {objects[0]}"

    if len(objects) == 2:
        return f"a {objects[0]} and a {objects[1]}"

    return (
        ", ".join(
            f"a {obj}" for obj in objects[:-1]
        )
        + f", and a {objects[-1]}"
    )


# ============================================================
# NATURAL SCENE DESCRIPTION
# ============================================================

def create_description(detections):

    if not detections:
        return "No stable objects detected."

    left_objects = []
    center_objects = []
    right_objects = []

    for object_name, position in sorted(set(detections)):

        if position == "left":
            left_objects.append(object_name)

        elif position == "center":
            center_objects.append(object_name)

        else:
            right_objects.append(object_name)

    parts = []

    # Center objects.
    if center_objects:

        center_text = format_objects(center_objects)

        verb = (
            "is" if len(center_objects) == 1
            else "are"
        )

        parts.append(
            f"{center_text} {verb} ahead"
        )

    # Left objects.
    if left_objects:

        parts.append(
            f"{format_objects(left_objects)} on your left"
        )

    # Right objects.
    if right_objects:

        parts.append(
            f"{format_objects(right_objects)} on your right"
        )

    if not parts:
        return "No stable objects detected."

    if len(parts) == 1:
        sentence = parts[0]

    elif len(parts) == 2:
        sentence = parts[0] + ", with " + parts[1]

    else:
        sentence = (
            parts[0]
            + ", with "
            + parts[1]
            + ", and "
            + parts[2]
        )

    return sentence[0].upper() + sentence[1:] + "."


# ============================================================
# CAMERA OPEN / RECOVERY
# ============================================================

def open_camera(index):

    # Keep the camera method consistent with your setup.
    camera = cv2.VideoCapture(index)

    if camera.isOpened():

        ret, frame = camera.read()

        if ret and frame is not None:
            return camera

    camera.release()

    return None


print(f"4. Opening camera index {CAMERA_INDEX}...")

cap = open_camera(CAMERA_INDEX)

if cap is None:

    print(
        f"ERROR: Camera {CAMERA_INDEX} could not be opened."
    )

    print(
        "Run python camera/camera_test.py "
        "to find the working camera index."
    )

    raise SystemExit(1)

print("5. Camera opened successfully.")
print("6. Starting YOLOv8m detection.")
print("Press Q to quit.")


# ============================================================
# MAIN LOOP
# ============================================================

last_stable_scene = None
consecutive_camera_failures = 0

try:

    while True:

        # Read camera frame.
        ret, frame = cap.read()

        if not ret or frame is None:

            consecutive_camera_failures += 1

            print(
                "WARNING: Camera frame read failed "
                f"({consecutive_camera_failures}/3)."
            )

            if consecutive_camera_failures >= 3:

                print("Attempting camera recovery...")

                cap.release()
                time.sleep(0.5)

                cap = open_camera(CAMERA_INDEX)

                if cap is None:

                    print("ERROR: Camera recovery failed.")
                    break

                print("Camera recovered.")

                consecutive_camera_failures = 0

            continue

        consecutive_camera_failures = 0

        height, width = frame.shape[:2]

        # ----------------------------------------------------
        # YOLOv8m DETECTION
        # ----------------------------------------------------

        results = model.predict(
            source=frame,
            imgsz=IMAGE_SIZE,
            conf=CONFIDENCE_THRESHOLD,
            device="cpu",
            verbose=False
        )

        current_detections = []

        for result in results:

            if result.boxes is None:
                continue

            for box in result.boxes:

                confidence = float(box.conf[0])
                class_id = int(box.cls[0])

                object_name = model.names[class_id]

                x1, y1, x2, y2 = map(
                    int,
                    box.xyxy[0].tolist()
                )

                center_x = (x1 + x2) // 2
                center_y = (y1 + y2) // 2

                position = get_position(
                    center_x,
                    width
                )

                current_detections.append({
                    "class": object_name,
                    "box": (x1, y1, x2, y2),
                    "confidence": confidence,
                    "position": position
                })

                # Draw bounding box.
                cv2.rectangle(
                    frame,
                    (x1, y1),
                    (x2, y2),
                    (0, 255, 0),
                    2
                )

                # Draw object name, confidence and position.
                label = (
                    f"{object_name} "
                    f"{confidence:.2f} | {position}"
                )

                cv2.putText(
                    frame,
                    label,
                    (x1, max(y1 - 10, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (0, 255, 0),
                    2
                )

                cv2.circle(
                    frame,
                    (center_x, center_y),
                    4,
                    (0, 0, 255),
                    -1
                )

        # ----------------------------------------------------
        # TEMPORAL STABILIZATION
        # ----------------------------------------------------

        update_tracks(current_detections)

        stable_detections = get_stable_detections()

        # ----------------------------------------------------
        # SCENE DESCRIPTION
        # ----------------------------------------------------

        description = create_description(
            stable_detections
        )

        # Display description at bottom of camera window.
        strip_top = max(0, height - 85)

        cv2.rectangle(
            frame,
            (0, strip_top),
            (width, height),
            (0, 0, 0),
            -1
        )

        cv2.putText(
            frame,
            description[:100],
            (10, min(height - 25, strip_top + 45)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2
        )

        # ----------------------------------------------------
        # SPEAK ONLY WHEN DESCRIPTION CHANGES
        # ----------------------------------------------------

        if description != last_stable_scene:

            print("\nDrishti:")
            print(description)

            if description != "No stable objects detected.":

                speak_async(description)

            last_stable_scene = description

        # ----------------------------------------------------
        # DISPLAY CAMERA
        # ----------------------------------------------------

        cv2.imshow(
            "Drishti - YOLOv8m",
            frame
        )

        # Press Q to exit.
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break


finally:

    try:
        cap.release()
    except Exception:
        pass

    cv2.destroyAllWindows()

    if tts_available:

        try:
            speech_queue.put_nowait(None)
        except Exception:
            pass

    print("Drishti stopped.")