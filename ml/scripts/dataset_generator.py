import os
import shutil
import random
import argparse
from pathlib import Path

def create_dataset_splits(input_img_dir, input_lbl_dir, output_dir, train_ratio=0.8):
    """
    Takes a folder of images and a folder of YOLO .txt annotations (like from Roboflow/CVAT)
    and splits them into train/val directories according to Ultralytics expected format.
    """
    input_img_dir = Path(input_img_dir)
    input_lbl_dir = Path(input_lbl_dir)
    output_dir = Path(output_dir)
    
    for split in ['train', 'val']:
        (output_dir / 'images' / split).mkdir(parents=True, exist_ok=True)
        (output_dir / 'labels' / split).mkdir(parents=True, exist_ok=True)
        
    valid_exts = {'.png', '.jpg', '.jpeg'}
    images = [f for f in input_img_dir.iterdir() if f.is_file() and f.suffix.lower() in valid_exts]
    
    paired = []
    for img_path in images:
        lbl_path = input_lbl_dir / f"{img_path.stem}.txt"
        if lbl_path.exists():
            paired.append((img_path, lbl_path))

    if not paired:
        print(f"Error: No image-label pairs found in {input_img_dir} and {input_lbl_dir}.")
        print("Ensure YOLO .txt labels have exactly the same names as the images.")
        return
        
    print(f"Found {len(paired)} annotated image/label pairs.")
    random.seed(42)
    random.shuffle(paired)
    
    split_idx = int(len(paired) * train_ratio)
    train_pairs = paired[:split_idx]
    val_pairs = paired[split_idx:]
    
    def copy_pairs(pairs, split_name):
        for img_p, lbl_p in pairs:
            shutil.copy(img_p, output_dir / 'images' / split_name / img_p.name)
            shutil.copy(lbl_p, output_dir / 'labels' / split_name / lbl_p.name)
            
    copy_pairs(train_pairs, 'train')
    copy_pairs(val_pairs, 'val')
    print(f"\nDataset fully generated for YOLO training!")
    print(f"Train set: {len(train_pairs)} images.")
    print(f"Val set:   {len(val_pairs)} images.")
    print(f"\nYou can now run: yolo segment train data=../coconut_dataset/dataset.yaml model=yolov8n-seg.pt epochs=100 imgsz=1024")

def main():
    parser = argparse.ArgumentParser(description="Dataset Generator for YOLO Segmentation")
    parser.add_argument("--images", default="../data/raw/annotated_images", help="Path to annotated raw images")
    parser.add_argument("--labels", default="../data/raw/annotated_labels", help="Path to YOLO .txt labels")
    parser.add_argument("--output", default="../coconut_dataset", help="Output dataset directory structure")
    parser.add_argument("--train-ratio", type=float, default=0.8, help="Ratio for train split (default: 0.8)")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.images) or not os.path.exists(args.labels):
        print("Please provide the correct paths to your images and annotations. You can create the folders and place your data there.")
        print(f"Expected Images: {args.images}")
        print(f"Expected Labels: {args.labels}")
        return
        
    create_dataset_splits(args.images, args.labels, args.output, args.train_ratio)

if __name__ == "__main__":
    main()
