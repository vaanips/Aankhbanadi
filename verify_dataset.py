from pathlib import Path
import cv2
import random

DATASET = Path("drishti_dataset")
SPLIT = "train"

CLASS_NAMES = [
    "door",
    "table",
    "traffic_light",
    "truck",
    "auto_rickshaw",
    "bicycle",
    "bus",
    "car",
    "stairs",
    "footpath",
    "motorcycle",
    "chair",
    "person",
    "pothole",
]

image_dir = DATASET / SPLIT / "images"
label_dir = DATASET / SPLIT / "labels"

images = list(image_dir.glob("*"))

# Pick 9 random images
random.seed(42)
selected = random.sample(images, min(9, len(images)))

tiles = []

for image_path in selected:
    img = cv2.imread(str(image_path))

    if img is None:
        continue

    h, w = img.shape[:2]

    label_path = label_dir / f"{image_path.stem}.txt"

    if label_path.exists():
        for line in label_path.read_text().splitlines():
            if not line.strip():
                continue

            parts = line.split()

            cls = int(parts[0])
            x_center = float(parts[1]) * w
            y_center = float(parts[2]) * h
            box_w = float(parts[3]) * w
            box_h = float(parts[4]) * h

            x1 = int(x_center - box_w / 2)
            y1 = int(y_center - box_h / 2)
            x2 = int(x_center + box_w / 2)
            y2 = int(y_center + box_h / 2)

            cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

            label = CLASS_NAMES[cls]

            cv2.putText(
                img,
                label,
                (x1, max(20, y1 - 5)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2,
            )

    # Resize for display
    img = cv2.resize(img, (400, 300))

    tiles.append(img)


# Create 3x3 grid
while len(tiles) < 9:
    tiles.append(
        255 * __import__("numpy").ones((300, 400, 3), dtype="uint8")
    )

rows = []

for i in range(0, 9, 3):
    rows.append(
        cv2.hconcat(tiles[i:i + 3])
    )

grid = cv2.vconcat(rows)

output = "dataset_verification.jpg"
cv2.imwrite(output, grid)

print(f"Saved verification image: {output}")