
from pathlib import Path
import yaml

ROOT = Path("datasets/source_downloads")

print("Searching for dataset YAML files...\n")

yaml_files = list(ROOT.rglob("data.yaml")) + list(ROOT.rglob("dataset.yaml"))

if not yaml_files:
    print("No dataset YAML found.")
    print("Check whether the ZIP was extracted correctly.")
else:
    for yaml_path in yaml_files:
        print("=" * 55)
        print("Dataset config:", yaml_path)

        try:
            with yaml_path.open("r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            print("Classes:", data.get("names"))
            print("Number of classes:", data.get("nc", "not specified"))

            for split in ("train", "val", "test"):
                folder = data.get(split)
                if folder:
                    print(f"{split} path:", folder)

        except Exception as exc:
            print("Could not read YAML:", exc)

print("\nImage and label file counts:")
for folder in sorted(ROOT.rglob("*")):
    if folder.is_dir() and folder.name in {
        "train", "valid", "val", "test"
    }:
        images = sum(
            1 for p in folder.rglob("*")
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        )
        labels = sum(1 for p in folder.rglob("*.txt"))
        if images or labels:
            print(f"{folder}: images={images}, text_labels={labels}")
