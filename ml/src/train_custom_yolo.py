import os
import shutil
import warnings
from pathlib import Path
try:
    from ultralytics import YOLO
except ImportError:
    print("\n[ERROR] Ultralytics is not installed. Please run:")
    print("pip install ultralytics")
    exit(1)

# Ensure paths relative to the script location (ml/src)
BASE_DIR = Path(__file__).parent.parent.absolute() # Should be ml/
ANNOTATED_IMG_DIR = BASE_DIR / "annotated" / "images"
ANNOTATED_LBL_DIR = BASE_DIR / "annotated" / "labels"
DATASET_DIR = BASE_DIR / "coconut_dataset"
WEIGHTS_DIR = BASE_DIR / "weights"

def prepare_dataset():
    """Generates the training dataset folder structure from the annotated folder."""
    import sys
    sys.path.append(str(BASE_DIR / "scripts"))
    try:
        from dataset_generator import create_dataset_splits
    except ImportError:
        print("[ERROR] Could not import dataset_generator.py from ml/scripts/")
        return False
        
    print("\n--- [1] PREPARING DATASET ---")
    if not ANNOTATED_IMG_DIR.exists() or not ANNOTATED_LBL_DIR.exists():
        print(f"[ERROR] Directories missing: {ANNOTATED_IMG_DIR} or {ANNOTATED_LBL_DIR}")
        return False
        
    images = list(ANNOTATED_IMG_DIR.glob("*.jpg")) + list(ANNOTATED_IMG_DIR.glob("*.png"))
    if len(images) == 0:
        print(f"[ERROR] No annotated images found in {ANNOTATED_IMG_DIR} !")
        print("Please place your images in heavily-annotated folders first.")
        return False
        
    print(f"Generating splits for {len(images)} images...")
    
    # Run the generator
    create_dataset_splits(str(ANNOTATED_IMG_DIR), str(ANNOTATED_LBL_DIR), str(DATASET_DIR), train_ratio=0.8)
    return True

def train_model(epochs=50, imgsz=1024, batch=4):
    """Trigger the YOLO training routine."""
    print("\n--- [2] TRAINING YOLO MODEL ---")
    yaml_path = DATASET_DIR / "dataset.yaml"
    if not yaml_path.exists():
        print(f"[ERROR] Dataset configuration {yaml_path} is missing!")
        return False
        
    print(f"Loading base YOLO segmentation model...")
    # Using local pretrained weights if available or downloading new
    model = YOLO("yolov8n-seg.pt")
    
    print(f"Starting training for {epochs} epochs...")
    try:
        results = model.train(
            data=str(yaml_path),
            epochs=epochs,
            imgsz=imgsz,
            batch=batch,
            patience=10,  # stop early if no improvement
            device="0" if __import__('torch').cuda.is_available() else "cpu",
            project=str(BASE_DIR / "runs" / "segment"),
            name="coconut_training",
            exist_ok=True
        )
        print("Training completed successfully!")
        return True
    except Exception as e:
        print(f"\n[ERROR] Training failed: {e}")
        return False

def deploy_model():
    """Copy the best trained model to the project's weights directory."""
    print("\n--- [3] DEPLOYING TRAINED MODEL ---")
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    best_weights_src = BASE_DIR / "runs" / "segment" / "coconut_training" / "weights" / "best.pt"
    best_weights_dst = WEIGHTS_DIR / "best_yolo_seg.pt"
    
    if best_weights_src.exists():
        shutil.copy(best_weights_src, best_weights_dst)
        print(f"✅ Success! Your model weights were successfully deployed to:")
        print(f"   {best_weights_dst}")
        print("\nYour application will now use this NEW model automatically when starting app.py!")
    else:
        print(f"[ERROR] Could not find the resultant weights at {best_weights_src}")

def main():
    print("🥥 Coconut Tree YOLO Auto-Trainer 🥥")
    print("========================================")
    if prepare_dataset():
        if train_model():
            deploy_model()

if __name__ == "__main__":
    main()
