import os
import shutil
import random
from collections import defaultdict

# CONFIG
SOURCE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "original")
DEST_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "splits")
TRAIN_RATIO = 0.70
VAL_RATIO = 0.15
# TEST_RATIO = 0.15 (remainder)
SUPPORTED_EXT = (".jpg", ".jpeg", ".png", ".bmp", ".tiff")

random.seed(42)  # reproducibility


def make_dir(path):
    os.makedirs(path, exist_ok=True)


def split_class(class_name):
    class_path = os.path.join(SOURCE_DIR, class_name)
    images = [f for f in os.listdir(class_path) if f.lower().endswith(SUPPORTED_EXT)]

    if len(images) < 3:
        raise RuntimeError(f"❌ Not enough images in class '{class_name}' (need at least 3)")

    random.shuffle(images)

    n = len(images)
    train_end = int(n * TRAIN_RATIO)
    val_end = train_end + int(n * VAL_RATIO)

    train_imgs = images[:train_end]
    val_imgs = images[train_end:val_end]
    test_imgs = images[val_end:]

    for split_name, split_imgs in [("train", train_imgs), ("val", val_imgs), ("test", test_imgs)]:
        split_dir = os.path.join(DEST_DIR, split_name, class_name)
        make_dir(split_dir)
        for img in split_imgs:
            shutil.copy(
                os.path.join(class_path, img),
                os.path.join(split_dir, img)
            )

    print(f"✅ {class_name}: {len(train_imgs)} train | {len(val_imgs)} val | {len(test_imgs)} test")


def main():
    make_dir(DEST_DIR)

    classes = [d for d in os.listdir(SOURCE_DIR) if os.path.isdir(os.path.join(SOURCE_DIR, d))]
    print(f"Found {len(classes)} classes: {classes}\n")

    for cls in sorted(classes):
        split_class(cls)

    print("\n🎉 Dataset split completed successfully! (70% train / 15% val / 15% test)")


if __name__ == "__main__":
    main()
