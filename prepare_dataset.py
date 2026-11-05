from pathlib import Path
import shutil

SOURCE = Path("dataset")
DEST = Path("drishti_dataset")

# Original class ID -> cleaned class ID
# Cleaned classes:
# 0 door
# 1 table
# 2 traffic_light
# 3 truck
# 4 auto_rickshaw
# 5 bicycle
# 6 bus
# 7 car
# 8 stairs
# 9 footpath
# 10 motorcycle
# 11 chair
# 12 person
# 13 pothole

CLASS_MAP = {
    0: 0,   # Door -> door
    1: 1,   # Table -> table
    2: 2,   # Traffic-light -> traffic_light
    3: 3,   # Truck -> truck
    4: 4,   # auto-rikshaw -> auto_rickshaw
    5: 5,   # bicycle -> bicycle
    6: 6,   # bus -> bus
    7: 7,   # car -> car
    8: 8,   # downstair -> stairs
    9: 9,   # footpath -> footpath
    10: 10, # motorbike -> motorcycle
    11: 11, # occupied-chair -> chair
    12: 12, # person -> person
    13: 13, # pothole -> pothole
    14: 4,  # rikshaw -> auto_rickshaw
    15: 3,  # truck -> truck
    16: 11, # unoccupied-chair -> chair
    17: 8,  # upstair -> stairs
}

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


def process_split(split):
    source_images = SOURCE / split / "images"
    source_labels = SOURCE / split / "labels"

    dest_images = DEST / split / "images"
    dest_labels = DEST / split / "labels"

    dest_images.mkdir(parents=True, exist_ok=True)
    dest_labels.mkdir(parents=True, exist_ok=True)

    image_count = 0
    label_count = 0

    for image_path in source_images.iterdir():

        if not image_path.is_file():
            continue

        # Copy image
        shutil.copy2(image_path, dest_images / image_path.name)
        image_count += 1

        # Corresponding label
        label_path = source_labels / f"{image_path.stem}.txt"

        if not label_path.exists():
            continue

        new_lines = []

        for line in label_path.read_text().splitlines():

            if not line.strip():
                continue

            parts = line.split()

            old_class = int(parts[0])

            if old_class not in CLASS_MAP:
                print(
                    f"WARNING: Unknown class {old_class} "
                    f"in {label_path}"
                )
                continue

            new_class = CLASS_MAP[old_class]

            parts[0] = str(new_class)

            new_lines.append(" ".join(parts))

        output_label = dest_labels / label_path.name
        output_label.write_text("\n".join(new_lines))

        label_count += 1

    print(
        f"{split}: {image_count} images, "
        f"{label_count} labels"
    )


# Process train / valid / test
for split in ["train", "valid", "test"]:
    process_split(split)


# Create data.yaml
yaml_text = f"""path: {DEST.resolve().as_posix()}
train: train/images
val: valid/images
test: test/images

nc: {len(CLASS_NAMES)}
names: {CLASS_NAMES}
"""

(DEST / "data.yaml").write_text(yaml_text)

print("\nDataset preparation complete.")
print(f"Output: {DEST.resolve()}")
print(f"Classes: {len(CLASS_NAMES)}")
print(CLASS_NAMES)