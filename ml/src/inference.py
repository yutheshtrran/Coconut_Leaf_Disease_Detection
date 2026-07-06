import os
import re
import cv2
import base64
import numpy as np
from yaml import safe_load

_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
_ML_DIR  = os.path.dirname(_SRC_DIR)

DISEASE_WEIGHTS = os.path.join(_ML_DIR, 'weights', 'disease_v5', 'weights', 'best.pt')

DISEASE_CLASSES = {
    0: 'Black Beetle Attack',
    1: 'Magnesium Deficiency',
    2: 'Potassium Deficiency',
    3: 'Yellow Patches',
}
ALL_CLASSES = ['Healthy', 'Black Beetle Attack', 'Magnesium Deficiency',
               'Potassium Deficiency', 'Yellow Patches']

# BGR colours matching the frontend DISEASE_PALETTE hex values  (R,G,B → B,G,R)
_CLASS_COLORS_BGR = {
    0: (68,  68,  239),  # Black Beetle Attack  #ef4444  red
    1: (247, 85,  168),  # Magnesium Deficiency #a855f7  violet
    2: (233, 165,  14),  # Potassium Deficiency #0ea5e9  sky-blue
    3: (8,   179, 234),  # Yellow Patches       #eab308  amber
}

_model = None

def _load_thresholds():
    cfg_path = os.path.join(_SRC_DIR, 'config.yaml')
    try:
        with open(cfg_path) as _f:
            cfg = safe_load(_f)
        base    = float(cfg.get('conf_disease_leaf', 0.15))
        raw_cls = cfg.get('conf_disease_classes') or {}
        cls_map = {k: float(v) for k, v in raw_cls.items()}
        cls_min = min(cls_map.values(), default=base) if cls_map else base
        return base, cls_map, cls_min
    except Exception:
        return 0.15, {}, 0.15

CONF_DISEASE_LEAF, CONF_DISEASE_LEAF_CLASSES, _CONF_LEAF_MIN = _load_thresholds()

def _get_model():
    global _model
    if _model is None:
        from ultralytics import YOLO
        _model = YOLO(DISEASE_WEIGHTS)
        print(f"[inference] disease_v5 loaded from {DISEASE_WEIGHTS}")
    return _model


def _plot_clean(image_bgr: np.ndarray, result,
                class_conf: dict = None, cls_name_map: dict = None) -> np.ndarray:
    """Draw clean semi-transparent annotations: coloured fills + thin borders, no text.
    Pass class_conf {name: min_conf} + cls_name_map {id: name} to filter per class."""
    out = image_bgr.copy()
    r   = result

    def _skip(cls_id, cnf):
        if class_conf is None or cls_name_map is None:
            return False
        return cnf < class_conf.get(cls_name_map.get(cls_id, ''), 0.0)

    if r.masks is not None and len(r.masks.xy):
        for i, pts in enumerate(r.masks.xy):
            cls_id = int(r.boxes.cls[i]) if r.boxes is not None else 0
            cnf    = float(r.boxes.conf[i]) if r.boxes is not None else 1.0
            if _skip(cls_id, cnf):
                continue
            color  = _CLASS_COLORS_BGR.get(cls_id, (128, 128, 128))
            poly   = pts.astype(np.int32)
            ov     = out.copy()
            cv2.fillPoly(ov, [poly], color)
            cv2.addWeighted(ov, 0.28, out, 0.72, 0, out)
            cv2.polylines(out, [poly], isClosed=True, color=color, thickness=2)
    elif r.boxes is not None:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            cnf    = float(box.conf[0])
            if _skip(cls_id, cnf):
                continue
            color         = _CLASS_COLORS_BGR.get(cls_id, (128, 128, 128))
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            ov = out.copy()
            cv2.rectangle(ov, (x1, y1), (x2, y2), color, -1)
            cv2.addWeighted(ov, 0.25, out, 0.75, 0, out)
            cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)

    return out


def predict(image_path: str, use_tta: bool = True) -> dict:
    model   = _get_model()
    results = model.predict(source=image_path, conf=_CONF_LEAF_MIN, verbose=False)
    r       = results[0]

    annotated_bgr = _plot_clean(r.orig_img.copy(), r, CONF_DISEASE_LEAF_CLASSES, DISEASE_CLASSES)
    _, buf = cv2.imencode('.jpg', annotated_bgr, [cv2.IMWRITE_JPEG_QUALITY, 88])
    annotated_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf.tobytes()).decode()

    detections = []
    if r.boxes is not None:
        for box in r.boxes:
            cls_id   = int(box.cls[0])
            cnf      = float(box.conf[0])
            cls_name = DISEASE_CLASSES.get(cls_id, f'Class {cls_id}')
            if cnf < CONF_DISEASE_LEAF_CLASSES.get(cls_name, CONF_DISEASE_LEAF):
                continue
            detections.append({
                'disease':    cls_name,
                'confidence': round(cnf, 4),
            })

    if not detections:
        return {
            'disease':         'Healthy',
            'confidence':      1.0,
            'top3':            [{'disease': 'Healthy', 'confidence': 1.0}],
            'annotated_image': annotated_b64,
        }

    class_best = {}
    for d in detections:
        name = d['disease']
        if name not in class_best or d['confidence'] > class_best[name]:
            class_best[name] = d['confidence']

    top3 = sorted(
        [{'disease': k, 'confidence': v} for k, v in class_best.items()],
        key=lambda x: x['confidence'],
        reverse=True,
    )[:3]

    return {
        'disease':         top3[0]['disease'],
        'confidence':      top3[0]['confidence'],
        'top3':            top3,
        'annotated_image': annotated_b64,
    }


# ── Compat helpers used by app.py ─────────────────────────────────────────────

def _to_snake(name: str) -> str:
    return re.sub(r'[\s\-]+', '_', name.strip()).lower()

def load_config(path=None) -> dict:
    p = path or os.path.join(_SRC_DIR, 'config.yaml')
    with open(p) as f:
        return safe_load(f)

def load_class_names(cfg=None) -> list:
    return ALL_CLASSES
