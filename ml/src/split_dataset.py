import os
import shutil
import random

# CONFIG
SOURCE_DIR = os.path.join("..", "data", "original")
DEST_DIR = os.path.join("..", "data", "splits")
TRAIN_RATIO = 0.8
SUPPORTED_EXT = (".jpg", ".jpeg", ".png", ".bmp", ".tiff")

random.seed(42)  # reproducibility

def make_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def split_class(class_name):
    class_path = os.path.join(SOURCE_DIR, class_name)
    images = [f for f in os.listdir(class_path) if f.lower().endswith(SUPPORTED_EXT)]

    if len(images) < 2:
        raise RuntimeError(f"❌ Not enough images in class '{class_name}'")

    random.shuffle(images)

    split_idx = int(len(images) * TRAIN_RATIO)
    train_imgs = images[:split_idx]
    val_imgs = images[split_idx:]

    train_dir = os.path.join(DEST_DIR, "train", class_name)
    val_dir = os.path.join(DEST_DIR, "val", class_name)

    make_dir(train_dir)
    make_dir(val_dir)

    for img in train_imgs:
        shutil.copy(
            os.path.join(class_path, img),
            os.path.join(train_dir, img)
        )

    for img in val_imgs:
        shutil.copy(
            os.path.join(class_path, img),
            os.path.join(val_dir, img)
        )

    print(f"✅ {class_name}: {len(train_imgs)} train | {len(val_imgs)} val")

def main():
    make_dir(DEST_DIR)
    make_dir(os.path.join(DEST_DIR, "train"))
    make_dir(os.path.join(DEST_DIR, "val"))

    classes = os.listdir(SOURCE_DIR)

    for cls in classes:
        cls_path = os.path.join(SOURCE_DIR, cls)
        if os.path.isdir(cls_path):
            split_class(cls)

    print("\n🎉 Dataset split completed successfully!")

if __name__ == "__main__":
    main()
