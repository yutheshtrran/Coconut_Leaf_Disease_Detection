# annotate.py — Label raw coconut leaf images with disease classes
#
# Workflow:
#   1. Put your raw/unlabeled images in:  ml/data/raw/
#   2. Run:  python src/annotate.py      (from the ml/ directory)
#   3. Draw a rectangle on the region of interest (click & drag)
#   4. Press a number key (0-9) to select the disease class
#   5. A confirmation box appears — press ENTER to confirm or ESC to re-select
#   6. The annotated image is saved to:  ml/data/original/<disease_name>/
#   7. annotation.json is updated in:    ml/data/original/<disease_name>/
#
import os
import json
import shutil
import cv2
import numpy as np

# ── Paths (relative to script location) ──────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
ML_DIR       = os.path.dirname(SCRIPT_DIR)
RAW_DIR      = os.path.join(ML_DIR, "data", "raw")
ORIGINAL_DIR = os.path.join(ML_DIR, "data", "original")

# Disease classes (must match the folder names in data/original/)
CLASSES = [
    "Bud Root Dropping",
    "Bud Rot",
    "Caterpillars",
    "DryingofLeaflets",
    "Flaccidity",
    "Gray Leaf Spot",
    "Healthy_Leaves",
    "Leaf Rot",
    "Leaflets",
    "Yellowing",
]

SUPPORTED_EXT = (".jpg", ".jpeg", ".png", ".bmp", ".tiff")

# ── Global state for mouse callback ──────────────────────────────────────────
_drawing   = False
_start_pt  = None
_end_pt    = None
_rect_done = False


def _mouse_cb(event, x, y, flags, param):
    """Mouse callback: left-click drag to draw a selection rectangle."""
    global _drawing, _start_pt, _end_pt, _rect_done

    if event == cv2.EVENT_LBUTTONDOWN:
        _drawing   = True
        _rect_done = False
        _start_pt  = (x, y)
        _end_pt    = (x, y)

    elif event == cv2.EVENT_MOUSEMOVE and _drawing:
        _end_pt = (x, y)

    elif event == cv2.EVENT_LBUTTONUP:
        _drawing   = False
        _end_pt    = (x, y)
        _rect_done = True


def _draw_overlay(base_img, rect_start, rect_end, status_text=""):
    """Return a copy of base_img with the current selection and a status bar."""
    overlay = base_img.copy()

    if rect_start and rect_end:
        x1, y1 = rect_start
        x2, y2 = rect_end
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 255, 0), 2)

    # Dark status bar at the bottom
    h, w = overlay.shape[:2]
    bar_h = 36
    cv2.rectangle(overlay, (0, h - bar_h), (w, h), (30, 30, 30), -1)
    cv2.putText(overlay, status_text, (10, h - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1, cv2.LINE_AA)
    return overlay


def _show_confirmation_dialog(display_img, disease_name, rect):
    """
    Draw a modal-style confirmation box over display_img asking the user to
    confirm or cancel.  Returns True if user presses ENTER, False on ESC/other.
    """
    WIN = "Annotate - Label Disease"
    h, w = display_img.shape[:2]

    box_w, box_h = 440, 160
    bx = (w - box_w) // 2
    by = (h - box_h) // 2

    while True:
        confirm_img = display_img.copy()
        # Dim background
        dim = np.zeros_like(confirm_img, dtype=np.uint8)
        alpha = 0.55
        cv2.addWeighted(dim, alpha, confirm_img, 1 - alpha, 0, confirm_img)

        # Box
        cv2.rectangle(confirm_img, (bx, by), (bx + box_w, by + box_h), (50, 50, 50), -1)
        cv2.rectangle(confirm_img, (bx, by), (bx + box_w, by + box_h), (0, 200, 100), 2)

        # Text
        cv2.putText(confirm_img, "Confirm Annotation?",
                    (bx + 15, by + 38), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(confirm_img, f"Class: {disease_name}",
                    (bx + 15, by + 72), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (0, 220, 120), 1, cv2.LINE_AA)
        rx1, ry1, rx2, ry2 = rect
        cv2.putText(confirm_img, f"Region: ({rx1},{ry1}) -> ({rx2},{ry2})",
                    (bx + 15, by + 100), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (180, 180, 180), 1, cv2.LINE_AA)
        cv2.putText(confirm_img, "ENTER = Save    ESC = Re-select",
                    (bx + 15, by + 132), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (100, 200, 255), 1, cv2.LINE_AA)

        cv2.imshow(WIN, confirm_img)
        key = cv2.waitKey(30) & 0xFF

        if key in (13, 10):   # ENTER
            return True
        elif key == 27:       # ESC
            return False


def _save_annotation(img_path, img_file, disease_name, rect, scale):
    """
    Copy the image with a drawn bounding-box to the destination folder and
    append/update annotation.json in that folder.
    """
    x1, y1, x2, y2 = rect

    # Scale coordinates back to original image space
    rx1 = int(min(x1, x2) / scale)
    ry1 = int(min(y1, y2) / scale)
    rx2 = int(max(x1, x2) / scale)
    ry2 = int(max(y1, y2) / scale)

    dest_dir = os.path.join(ORIGINAL_DIR, disease_name)
    os.makedirs(dest_dir, exist_ok=True)

    # Build destination filename (avoid overwriting)
    dest_path = os.path.join(dest_dir, img_file)
    if os.path.exists(dest_path):
        name, ext = os.path.splitext(img_file)
        counter = 1
        while os.path.exists(dest_path):
            dest_path = os.path.join(dest_dir, f"{name}_{counter}{ext}")
            counter += 1

    saved_name = os.path.basename(dest_path)

    # Draw bounding box on a copy of the original image, then save
    orig_img = cv2.imread(img_path)
    cv2.rectangle(orig_img, (rx1, ry1), (rx2, ry2), (0, 0, 255), 3)
    label = f"{disease_name}"
    (lw, lh), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
    cv2.rectangle(orig_img, (rx1, ry1 - lh - baseline - 4), (rx1 + lw + 4, ry1), (0, 0, 200), -1)
    cv2.putText(orig_img, label, (rx1 + 2, ry1 - baseline - 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.imwrite(dest_path, orig_img)

    # ── Update annotation.json ────────────────────────────────────────────────
    json_path = os.path.join(dest_dir, "annotation.json")
    if os.path.exists(json_path):
        with open(json_path, "r") as f:
            annotations = json.load(f)
    else:
        annotations = []

    annotations.append({
        "filename"   : saved_name,
        "disease"    : disease_name,
        "bbox"       : {"x1": rx1, "y1": ry1, "x2": rx2, "y2": ry2},
        "width"      : orig_img.shape[1],
        "height"     : orig_img.shape[0],
    })

    with open(json_path, "w") as f:
        json.dump(annotations, f, indent=2)

    return dest_path, json_path


# ── Main annotation loop ──────────────────────────────────────────────────────
def annotate_images():
    global _drawing, _start_pt, _end_pt, _rect_done

    if not os.path.exists(RAW_DIR):
        os.makedirs(RAW_DIR, exist_ok=True)
        print(f"Created raw image folder: {RAW_DIR}")
        print("Place your unlabeled images there and re-run this script.")
        return

    img_files = sorted([
        f for f in os.listdir(RAW_DIR)
        if f.lower().endswith(SUPPORTED_EXT)
    ])

    if not img_files:
        print(f"No images found in: {RAW_DIR}")
        print("Place your unlabeled .jpg/.png images there and re-run.")
        return

    print(f"\nFound {len(img_files)} images in {RAW_DIR}")
    print("=" * 60)
    print("HOW TO USE:")
    print("  1. Click & drag on the image to select a region")
    print("  2. Press 0-9 to pick a disease class")
    print("  3. Press ENTER to confirm and save, ESC to re-select")
    print("  S = Skip image    Q = Quit")
    print("=" * 60)
    print("\nDisease Classes:")
    for i, cls in enumerate(CLASSES):
        print(f"  [{i}] {cls}")
    print()

    WIN = "Annotate - Label Disease"
    cv2.namedWindow(WIN, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(WIN, _mouse_cb)

    labeled_count = 0
    skipped_count = 0

    for idx, img_file in enumerate(img_files):
        img_path = os.path.join(RAW_DIR, img_file)
        img = cv2.imread(img_path)
        if img is None:
            print(f"  [SKIP] Cannot read: {img_file}")
            continue

        # Resize for display
        h, w = img.shape[:2]
        max_dim = 900
        scale = min(max_dim / max(h, w), 1.0)
        if scale < 1.0:
            display_base = cv2.resize(img, (int(w * scale), int(h * scale)))
        else:
            display_base = img.copy()
            scale = 1.0

        # Draw class legend on base display
        y_off = 22
        cv2.putText(display_base, f"Image {idx+1}/{len(img_files)}: {img_file}",
                    (10, y_off), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 1, cv2.LINE_AA)
        y_off += 20
        for i, cls in enumerate(CLASSES):
            cv2.putText(display_base, f"[{i}] {cls}",
                        (10, y_off), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)
            y_off += 16

        # Reset selection state for this image
        _drawing = _rect_done = False
        _start_pt = _end_pt = None
        selected_class = None

        action_done = False   # set True when image is labeled or skipped

        while not action_done:
            # Render current rectangle
            status = "Draw a region, then press 0-9 to label"
            if _rect_done and _start_pt and _end_pt:
                status = "Region selected — press 0-9 to choose class  |  ESC to clear"
            frame = _draw_overlay(display_base, _start_pt if (_drawing or _rect_done) else None,
                                  _end_pt, status)
            cv2.imshow(WIN, frame)
            key = cv2.waitKey(30) & 0xFF

            if key == 255:    # no key pressed — keep looping
                continue

            # ── Q = Quit ──────────────────────────────────────────────────
            if key in (ord('q'), ord('Q')):
                print(f"\nQuitting. Labeled: {labeled_count}, Skipped: {skipped_count}")
                cv2.destroyAllWindows()
                return

            # ── S = Skip ──────────────────────────────────────────────────
            if key in (ord('s'), ord('S')):
                skipped_count += 1
                print(f"  [SKIP] {img_file}")
                action_done = True
                continue

            # ── ESC = Clear selection ─────────────────────────────────────
            if key == 27:
                _drawing = _rect_done = False
                _start_pt = _end_pt = None
                selected_class = None
                continue

            # ── Number key: assign class ──────────────────────────────────
            if ord('0') <= key <= ord('9'):
                class_idx = key - ord('0')
                if class_idx >= len(CLASSES):
                    continue  # invalid index

                if not _rect_done or _start_pt is None or _end_pt is None:
                    # No region drawn yet — flash a warning in the status bar
                    warn_frame = _draw_overlay(display_base, None, None,
                                               "⚠  Draw a region FIRST, then press a number key!")
                    cv2.imshow(WIN, warn_frame)
                    cv2.waitKey(1200)
                    continue

                disease_name = CLASSES[class_idx]
                rect = (_start_pt[0], _start_pt[1], _end_pt[0], _end_pt[1])

                # Show confirmation dialog
                confirm_frame = _draw_overlay(display_base, _start_pt, _end_pt,
                                              f"Class: {disease_name}  |  ENTER=Save  ESC=Re-select")
                confirmed = _show_confirmation_dialog(confirm_frame, disease_name, rect)

                if confirmed:
                    dest_path, json_path = _save_annotation(
                        img_path, img_file, disease_name, rect, scale)
                    labeled_count += 1
                    print(f"  [{labeled_count}] {img_file} -> {disease_name}")
                    print(f"        Saved image : {dest_path}")
                    print(f"        Annotation  : {json_path}")
                    action_done = True
                else:
                    # Re-select: clear the current rectangle
                    _drawing = _rect_done = False
                    _start_pt = _end_pt = None

    cv2.destroyAllWindows()

    print(f"\n{'='*60}")
    print(f"Annotation complete!")
    print(f"  Labeled : {labeled_count}")
    print(f"  Skipped : {skipped_count}")
    print(f"  Total   : {len(img_files)}")
    print(f"\nLabeled images saved to: {ORIGINAL_DIR}")
    print(f"\nNext steps:")
    print(f"  1. cd {ML_DIR}")
    print(f"  2. python src/split_dataset.py   (re-split with new images)")
    print(f"  3. python src/train.py           (retrain the model)")
    print(f"{'='*60}")


if __name__ == "__main__":
    annotate_images()
