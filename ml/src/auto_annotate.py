# auto_annotate.py — Auto-label raw coconut leaf images using trained model
# Place raw images in ml/data/raw/
# Annotated images are saved to ml/data/original/<class_name>/
#
# Workflow:
#   1. Image loads with model prediction shown
#   2. Click & drag to select a region of interest
#   3. Selected region stays bright, rest darkens, green border appears
#   4. Press ENTER to accept prediction, 0-9 to change class, S=Skip, Q=Quit
#   5. Confirmation dialog appears — ENTER=Save, ESC=Re-select

import os
import sys
import json
import shutil
import cv2
import numpy as np
import torch
from torchvision import transforms
from PIL import Image
from yaml import safe_load

# Ensure src/ is on path so we can import model.py
sys.path.insert(0, os.path.dirname(__file__))
from model import MyModel, load_weights

# ---- Paths ----
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ML_DIR = os.path.dirname(SCRIPT_DIR)
RAW_DIR = os.path.join(ML_DIR, "data", "raw")
ORIGINAL_DIR = os.path.join(ML_DIR, "data", "original")
MODEL_PATH = os.path.join(ML_DIR, "weights", "best_model.pth")
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.yaml")

# ---- Load config ----
with open(CONFIG_PATH) as f:
    config = safe_load(f)

CLASSES = config["class_names"]
IMAGE_SIZE = config.get("image_size", 300)
MODEL_NAME = config.get("model_name", "efficientnet_b3")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ---- Build model (same architecture as training) ----
print(f"[INFO] Building {MODEL_NAME} model with {len(CLASSES)} classes...")
model = MyModel(
    num_classes=len(CLASSES),
    model_name=MODEL_NAME,
    pretrained=False,
    dropout=0.3,
)

# ---- Load trained weights ----
print(f"[INFO] Loading trained weights from: {MODEL_PATH}")
model = load_weights(model, MODEL_PATH, map_location=str(DEVICE))
model.to(DEVICE)
model.eval()
print("[INFO] Model ready for inference.")

# ---- Image transform (must match validation transform used in training) ----
inference_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225]),
])

# ---- Global state for mouse callback ----
_drawing = False
_start_pt = None
_end_pt = None
_rect_done = False


def _mouse_cb(event, x, y, flags, param):
    """Mouse callback: left-click drag to draw a selection rectangle."""
    global _drawing, _start_pt, _end_pt, _rect_done

    if event == cv2.EVENT_LBUTTONDOWN:
        _drawing = True
        _rect_done = False
        _start_pt = (x, y)
        _end_pt = (x, y)

    elif event == cv2.EVENT_MOUSEMOVE and _drawing:
        _end_pt = (x, y)

    elif event == cv2.EVENT_LBUTTONUP:
        _drawing = False
        _end_pt = (x, y)
        _rect_done = True


def _draw_overlay(base_img, rect_start, rect_end, status_text="", darken=True):
    """
    Return a copy of base_img with:
      - Dark overlay outside the selected rectangle
      - Bright selected region
      - Green border around selection
      - Status bar at the bottom
    """
    overlay = base_img.copy()
    h, w = overlay.shape[:2]

    if rect_start and rect_end:
        x1, y1 = min(rect_start[0], rect_end[0]), min(rect_start[1], rect_end[1])
        x2, y2 = max(rect_start[0], rect_end[0]), max(rect_start[1], rect_end[1])

        # Clamp to image bounds
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        if darken and (x2 - x1) > 2 and (y2 - y1) > 2:
            # Darken the entire image
            dark = cv2.addWeighted(overlay, 0.3, np.zeros_like(overlay), 0.7, 0)
            # Restore the selected region to full brightness
            dark[y1:y2, x1:x2] = overlay[y1:y2, x1:x2]
            overlay = dark

        # Green border around selection (2px thick)
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 255, 0), 2)

    # Dark status bar at the bottom
    bar_h = 36
    cv2.rectangle(overlay, (0, h - bar_h), (w, h), (30, 30, 30), -1)
    cv2.putText(overlay, status_text, (10, h - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1, cv2.LINE_AA)
    return overlay


def _show_confirmation_dialog(display_img, disease_name, rect, confidence):
    """
    Draw a modal-style confirmation box. Returns True on ENTER, False on ESC.
    """
    WIN = "Auto Annotate"
    h, w = display_img.shape[:2]

    box_w, box_h = 460, 180
    bx = (w - box_w) // 2
    by = (h - box_h) // 2

    while True:
        confirm_img = display_img.copy()
        # Dim background
        dim = np.zeros_like(confirm_img, dtype=np.uint8)
        cv2.addWeighted(dim, 0.55, confirm_img, 0.45, 0, confirm_img)

        # Box background
        cv2.rectangle(confirm_img, (bx, by), (bx + box_w, by + box_h), (50, 50, 50), -1)
        cv2.rectangle(confirm_img, (bx, by), (bx + box_w, by + box_h), (0, 200, 100), 2)

        # Text
        cv2.putText(confirm_img, "Confirm Annotation?",
                    (bx + 15, by + 38), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(confirm_img, f"Class: {disease_name}  (conf: {confidence:.2f})",
                    (bx + 15, by + 72), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (0, 220, 120), 1, cv2.LINE_AA)
        rx1, ry1, rx2, ry2 = rect
        cv2.putText(confirm_img, f"Region: ({rx1},{ry1}) -> ({rx2},{ry2})",
                    (bx + 15, by + 100), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (180, 180, 180), 1, cv2.LINE_AA)
        cv2.putText(confirm_img, "ENTER = Save    ESC = Re-select",
                    (bx + 15, by + 140), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (100, 200, 255), 1, cv2.LINE_AA)

        cv2.imshow(WIN, confirm_img)
        key = cv2.waitKey(30) & 0xFF

        if key in (13, 10):   # ENTER
            return True
        elif key == 27:       # ESC
            return False


def _save_annotation(img_path, img_file, disease_name, rect, scale, confidence):
    """
    Copy the image with bounding box to the destination folder and
    update annotation.json in that folder.
    """
    x1, y1, x2, y2 = rect

    # Scale coordinates back to original image space
    rx1 = int(min(x1, x2) / scale)
    ry1 = int(min(y1, y2) / scale)
    rx2 = int(max(x1, x2) / scale)
    ry2 = int(max(y1, y2) / scale)

    dest_dir = os.path.join(ORIGINAL_DIR, disease_name)
    os.makedirs(dest_dir, exist_ok=True)

    # Avoid overwriting existing files
    dest_path = os.path.join(dest_dir, img_file)
    if os.path.exists(dest_path):
        name, ext = os.path.splitext(img_file)
        counter = 1
        while os.path.exists(dest_path):
            dest_path = os.path.join(dest_dir, f"{name}_{counter}{ext}")
            counter += 1

    saved_name = os.path.basename(dest_path)

    # Draw bounding box on original image and save
    orig_img = cv2.imread(img_path)
    cv2.rectangle(orig_img, (rx1, ry1), (rx2, ry2), (0, 0, 255), 3)
    label = f"{disease_name}"
    (lw, lh), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
    cv2.rectangle(orig_img, (rx1, ry1 - lh - baseline - 4), (rx1 + lw + 4, ry1), (0, 0, 200), -1)
    cv2.putText(orig_img, label, (rx1 + 2, ry1 - baseline - 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.imwrite(dest_path, orig_img)

    # Update annotation.json
    json_path = os.path.join(dest_dir, "annotation.json")
    if os.path.exists(json_path):
        with open(json_path, "r") as f:
            annotations = json.load(f)
    else:
        annotations = []

    annotations.append({
        "filename": saved_name,
        "disease": disease_name,
        "confidence": round(confidence, 4),
        "bbox": {"x1": rx1, "y1": ry1, "x2": rx2, "y2": ry2},
        "width": orig_img.shape[1],
        "height": orig_img.shape[0],
    })

    with open(json_path, "w") as f:
        json.dump(annotations, f, indent=2)

    return dest_path, json_path


# ---- Prediction function ----
def predict_image(img_path):
    img = Image.open(img_path).convert("RGB")
    input_tensor = inference_transform(img).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        output = model(input_tensor)
        probs = torch.softmax(output, dim=1)
        conf, pred = torch.max(probs, 1)
    return CLASSES[pred.item()], conf.item()


# ---- Main annotation loop ----
def auto_annotate():
    global _drawing, _start_pt, _end_pt, _rect_done

    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(ORIGINAL_DIR, exist_ok=True)

    img_files = sorted([
        f for f in os.listdir(RAW_DIR)
        if f.lower().endswith((".jpg", ".png", ".jpeg", ".bmp", ".tiff"))
    ])

    if not img_files:
        print(f"[INFO] No images found in {RAW_DIR}. Place images there and rerun.")
        return

    print(f"\n[INFO] Found {len(img_files)} images in {RAW_DIR}")
    print("=" * 60)
    print("HOW TO USE:")
    print("  1. Image loads with model prediction")
    print("  2. Click & drag to select the diseased region")
    print("     - Selected region stays bright, rest darkens")
    print("     - Green border appears around selection")
    print("  3. ENTER = Accept prediction | 0-9 = Change class")
    print("  4. Confirmation dialog: ENTER = Save | ESC = Re-select")
    print("  S = Skip image    Q = Quit    ESC = Clear selection")
    print("=" * 60)
    print("\nDisease Classes:")
    for i, cls in enumerate(CLASSES):
        print(f"  [{i}] {cls}")
    print()

    WIN = "Auto Annotate"
    cv2.namedWindow(WIN, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(WIN, _mouse_cb)

    saved = 0
    skipped = 0

    for idx, img_file in enumerate(img_files):
        img_path = os.path.join(RAW_DIR, img_file)

        # Predict class using the model
        pred_class, confidence = predict_image(img_path)

        img = cv2.imread(img_path)
        if img is None:
            print(f"  [WARN] Cannot read {img_file}, skipping.")
            skipped += 1
            continue

        # Resize for display (max 900px)
        h, w = img.shape[:2]
        max_dim = 900
        scale = min(max_dim / max(h, w), 1.0)
        if scale < 1.0:
            display_base = cv2.resize(img, (int(w * scale), int(h * scale)))
        else:
            display_base = img.copy()
            scale = 1.0

        # Draw prediction and class legend on base display
        y_off = 22
        cv2.putText(display_base, f"[{idx+1}/{len(img_files)}] {img_file}",
                    (10, y_off), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 1, cv2.LINE_AA)
        y_off += 24
        cv2.putText(display_base, f"Predicted: {pred_class} ({confidence:.2f})",
                    (10, y_off), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2, cv2.LINE_AA)
        y_off += 28
        for i, cls in enumerate(CLASSES):
            marker = " <<" if cls == pred_class else ""
            cv2.putText(display_base, f"[{i}] {cls}{marker}",
                        (10, y_off), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)
            y_off += 16

        # Reset selection state
        _drawing = _rect_done = False
        _start_pt = _end_pt = None

        print(f"\n[{idx+1}/{len(img_files)}] Image: {img_file}")
        print(f"  Predicted: {pred_class} | Confidence: {confidence:.2f}")

        action_done = False

        while not action_done:
            # Build status text
            if _rect_done and _start_pt and _end_pt:
                status = "Region selected | ENTER=Accept prediction | 0-9=Change class | S=Skip | Q=Quit"
            elif _drawing:
                status = "Drawing selection..."
            else:
                status = "Draw a region, then ENTER=Accept | 0-9=Change | S=Skip | Q=Quit"

            has_rect = _drawing or _rect_done
            frame = _draw_overlay(
                display_base,
                _start_pt if has_rect else None,
                _end_pt if has_rect else None,
                status,
                darken=has_rect
            )
            cv2.imshow(WIN, frame)
            key = cv2.waitKey(30) & 0xFF

            if key == 255:  # no key
                continue

            # ── Q = Quit ──
            if key in (ord('q'), ord('Q')):
                cv2.destroyAllWindows()
                print(f"\n[QUIT] Saved {saved} images, skipped {skipped}.")
                return

            # ── S = Skip ──
            if key in (ord('s'), ord('S')):
                skipped += 1
                print(f"  [SKIPPED] {img_file}")
                action_done = True
                continue

            # ── ESC = Clear selection ──
            if key == 27:
                _drawing = _rect_done = False
                _start_pt = _end_pt = None
                continue

            # ── ENTER = Accept prediction ──
            if key in (13, 10):
                final_class = pred_class
                final_conf = confidence

                if _rect_done and _start_pt and _end_pt:
                    # Has region — show confirmation and save with bbox
                    rect = (_start_pt[0], _start_pt[1], _end_pt[0], _end_pt[1])
                    confirm_frame = _draw_overlay(display_base, _start_pt, _end_pt,
                                                  f"Class: {final_class} | ENTER=Save  ESC=Re-select")
                    confirmed = _show_confirmation_dialog(confirm_frame, final_class, rect, final_conf)

                    if confirmed:
                        dest_path, json_path = _save_annotation(
                            img_path, img_file, final_class, rect, scale, final_conf)
                        saved += 1
                        print(f"  [SAVED] {img_file} -> {final_class}/ (with annotation)")
                        action_done = True
                    else:
                        _drawing = _rect_done = False
                        _start_pt = _end_pt = None
                else:
                    # No region drawn — save as plain copy
                    dest_dir = os.path.join(ORIGINAL_DIR, final_class)
                    os.makedirs(dest_dir, exist_ok=True)
                    shutil.copy2(img_path, os.path.join(dest_dir, img_file))
                    saved += 1
                    print(f"  [SAVED] {img_file} -> {final_class}/")
                    action_done = True
                continue

            # ── Number key: override class ──
            if ord('0') <= key <= ord('9'):
                class_idx = key - ord('0')
                if class_idx >= len(CLASSES):
                    continue

                final_class = CLASSES[class_idx]
                final_conf = confidence
                print(f"  -> Changed to: {final_class}")

                if _rect_done and _start_pt and _end_pt:
                    rect = (_start_pt[0], _start_pt[1], _end_pt[0], _end_pt[1])
                    confirm_frame = _draw_overlay(display_base, _start_pt, _end_pt,
                                                  f"Class: {final_class} | ENTER=Save  ESC=Re-select")
                    confirmed = _show_confirmation_dialog(confirm_frame, final_class, rect, final_conf)

                    if confirmed:
                        dest_path, json_path = _save_annotation(
                            img_path, img_file, final_class, rect, scale, final_conf)
                        saved += 1
                        print(f"  [SAVED] {img_file} -> {final_class}/ (with annotation)")
                        action_done = True
                    else:
                        _drawing = _rect_done = False
                        _start_pt = _end_pt = None
                else:
                    dest_dir = os.path.join(ORIGINAL_DIR, final_class)
                    os.makedirs(dest_dir, exist_ok=True)
                    shutil.copy2(img_path, os.path.join(dest_dir, img_file))
                    saved += 1
                    print(f"  [SAVED] {img_file} -> {final_class}/")
                    action_done = True

    cv2.destroyAllWindows()

    print(f"\n{'='*60}")
    print(f"[DONE] Auto annotation complete!")
    print(f"  Saved  : {saved}")
    print(f"  Skipped: {skipped}")
    print(f"  Output : {ORIGINAL_DIR}")
    print(f"\nNext step: run split_dataset.py to split into train/val/test sets.")
    print(f"{'='*60}")


if __name__ == "__main__":
    auto_annotate()
