import os
import cv2
import argparse
from pathlib import Path

def split_image(img_path, output_dir, tile_size=1024, overlap=0.2):
    """
    Splits a high-resolution drone image into smaller 1024x1024 tiles 
    with a given overlap proportion to ensure crowns aren't cut perfectly at the edges.
    """
    img = cv2.imread(str(img_path))
    if img is None:
        print(f"Warning: Could not read {img_path}")
        return
        
    h, w = img.shape[:2]
    stride = int(tile_size * (1 - overlap))
    
    base_name = img_path.stem
    os.makedirs(output_dir, exist_ok=True)
    
    tile_count = 0
    # Slide across the image
    for y in range(0, h, stride):
        for x in range(0, w, stride):
            y_end = y + tile_size
            x_end = x + tile_size
            
            # If patch extends beyond original image, we pull it back to the edge
            if y_end > h:
                y_end = h
                y = max(0, h - tile_size)
            if x_end > w:
                x_end = w
                x = max(0, w - tile_size)
                
            tile = img[y:y_end, x:x_end]
            
            out_file = os.path.join(output_dir, f"{base_name}_tile_{x}_{y}.jpg")
            cv2.imwrite(out_file, tile)
            tile_count += 1
            
            # Break if pulled back to avoid infinite loops on exact fits
            if x_end == w:
                break
        if y_end == h:
            break
            
    print(f"Processed {img_path.name} -> {tile_count} tiles generated.")

def main():
    parser = argparse.ArgumentParser(description="Split Drone Images into 1024x1024 Tiles for YOLO Training")
    parser.add_argument("--input", default="../data/raw/drone_images", help="Path to raw drone images")
    parser.add_argument("--output", default="../coconut_dataset/images_to_label", help="Output directory for tiles")
    parser.add_argument("--size", type=int, default=1024, help="Tile size (e.g., 1024)")
    parser.add_argument("--overlap", type=float, default=0.2, help="Overlap percentage (0.0 to 0.9)")
    args = parser.parse_args()
    
    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if not input_dir.exists():
        print(f"Error: Input directory {input_dir} not found.")
        print("Please create the directory and place your JPG or PNG drone images there.")
        return
        
    valid_exts = [".jpg", ".jpeg", ".png"]
    files = [f for f in input_dir.iterdir() if f.is_file() and f.suffix.lower() in valid_exts]
    
    if len(files) == 0:
        print(f"No valid images found in {input_dir}.")
        return
        
    for f in files:
        split_image(f, output_dir, tile_size=args.size, overlap=args.overlap)
        
    print(f"\nDone! Ready for annotation. You can upload {output_dir} to Roboflow or CVAT.")

if __name__ == "__main__":
    main()
