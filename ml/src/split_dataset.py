import os
import shutil
import random
from collections import defaultdict
from PIL import Image

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


def verify_image(path):
    """Return True if the image can be opened successfully."""
    try:
        with Image.open(path) as img:
            img.verify()
        return True
    except Exception:
        return False


def split_class(class_name):
    class_path = os.path.join(SOURCE_DIR, class_name)
    all_files = [f for f in os.listdir(class_path) if f.lower().endswith(SUPPORTED_EXT)]

    # Verify images are not corrupt
    images = []
    corrupt = 0
    for f in all_files:
        fpath = os.path.join(class_path, f)
        if verify_image(fpath):
            images.append(f)
        else:
            corrupt += 1
            print(f"  [WARN] Skipping corrupt image: {fpath}")

    if corrupt > 0:
        print(f"  [WARN] {corrupt} corrupt images removed from '{class_name}'")

    if len(images) < 3:
        raise RuntimeError(f"[ERROR] Not enough valid images in class '{class_name}' (need at least 3, got {len(images)})")

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

    return {
        "class": class_name,
        "total": len(images),
        "train": len(train_imgs),
        "val": len(val_imgs),
        "test": len(test_imgs),
        "corrupt": corrupt,
    }


def main():
    make_dir(DEST_DIR)

    # Clean existing splits if present
    for split in ("train", "val", "test"):
        split_path = os.path.join(DEST_DIR, split)
        if os.path.exists(split_path):
            shutil.rmtree(split_path)
            print(f"[INFO] Cleaned existing {split}/ split")

    classes = [d for d in os.listdir(SOURCE_DIR) if os.path.isdir(os.path.join(SOURCE_DIR, d))]
    print(f"Found {len(classes)} classes: {classes}\n")

    stats = []
    for cls in sorted(classes):
        info = split_class(cls)
        stats.append(info)
        print(f"[OK] {info['class']:30s}: {info['train']:4d} train | {info['val']:4d} val | {info['test']:4d} test  (total: {info['total']})")

    # Summary
    total_train = sum(s['train'] for s in stats)
    total_val = sum(s['val'] for s in stats)
    total_test = sum(s['test'] for s in stats)
    total_all = sum(s['total'] for s in stats)
    total_corrupt = sum(s['corrupt'] for s in stats)

    print(f"\n{'='*70}")
    print(f"Dataset Split Summary:")
    print(f"   Total valid images : {total_all}")
    print(f"   Corrupt removed   : {total_corrupt}")
    print(f"   Train             : {total_train} ({total_train/total_all*100:.1f}%)")
    print(f"   Validation        : {total_val} ({total_val/total_all*100:.1f}%)")
    print(f"   Test              : {total_test} ({total_test/total_all*100:.1f}%)")
    print(f"{'='*70}")

    # Class balance warning
    counts = [s['total'] for s in stats]
    max_c, min_c = max(counts), min(counts)
    if max_c / max(min_c, 1) > 10:
        print(f"\n[WARNING] Severe class imbalance detected!")
        print(f"   Largest class : {max_c} images")
        print(f"   Smallest class: {min_c} images ({max_c/max(min_c,1):.1f}x ratio)")
        print(f"   -> WeightedRandomSampler and class-weighted loss will compensate during training.")

    print("\n[DONE] Dataset split completed successfully! (70% train / 15% val / 15% test)")


if __name__ == "__main__":
    main()
