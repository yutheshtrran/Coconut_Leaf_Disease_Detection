"""
Drone farm-map stitcher — Best-Frame-Wins Orthomosaic Builder

How it works
────────────
1. Open the video with cv2.VideoCapture — no frame extraction to disk.
2. Pass 1 (fast): sample every FRAME_STEP-th frame at MATCH_DIM,
   run a GPU/CPU matcher cascade to build the camera trajectory:
     DISK+LightGlue (GPU) → SuperPoint+LightGlue (GPU) → ORB (CPU)
     → AKAZE (CPU) → LoFTR dense (GPU) → phase correlation → velocity extrapolation
3. Pass 2 (full-res): re-read sampled frames at STITCH_DIM, warp each one
   plus a cosine-taper weight mask onto the canvas using GPU (bicubic) or
   CPU (Lanczos4).  Each pixel keeps content from whichever frame has the
   highest weight at that location (nearest to that frame's centre).
4. Fill any residual coverage gaps with scipy nearest-neighbour.
5. Unsharp-mask sharpening via kornia (GPU) or cv2 (CPU).
"""

import gc
import os
from typing import Callable

import cv2
import numpy as np
import torch

from gpu_warp import warp_frame, warp_mask, warp_frame_batch, warp_mask_batch, sharpen_gpu, DEVICE

MATCH_DIM   = 1280    # ORB/AKAZE matching / trajectory resolution
DISK_DIM    = 640     # DISK+LightGlue matching resolution (GPU — smaller = faster)
STITCH_DIM  = 1920    # output resolution per frame — 1080p (was 3840 / 4K: 4× slower)
FRAME_STEP  = 2       # sample every Nth video frame  (≈ 3.75 fps for 30 fps video)
MAX_FRAMES  = 300     # cap on number of frames processed
MAX_PX      = 12_000  # safety cap on canvas dimension (px)
DISK_KP     = 2048    # DISK keypoints per frame
WARP_BATCH  = 8       # frames per GPU warp batch (higher = better GPU utilisation)


# ── DISK + LightGlue (GPU primary matcher) ───────────────────────────────────

_disk_model  = None
_lg_model    = None
_sp_model    = None
_lg_sp_model = None
_loftr_model = None
_sp_enabled  = True    # set False on first init failure
_loftr_enabled = True  # set False on first init failure


def _disk_lg():
    global _disk_model, _lg_model
    if _disk_model is None:
        import kornia.feature as KF
        _disk_model = KF.DISK.from_pretrained('depth').to(DEVICE).eval()
        _lg_model   = KF.LightGlueMatcher('disk').to(DEVICE).eval()
    return _disk_model, _lg_model


def _to_rgb_t(bgr):
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    return torch.from_numpy(rgb).permute(2, 0, 1)[None].to(DEVICE)


def _make_lafs(kp):
    N = kp.shape[0]
    l = torch.zeros(1, N, 2, 3, device=DEVICE)
    l[0, :, 0, 0] = 1.0;  l[0, :, 1, 1] = 1.0
    l[0, :, 0, 2] = kp[:, 0];  l[0, :, 1, 2] = kp[:, 1]
    return l


def _disk_lg_H(img1, img2):
    """DISK+LightGlue match on GPU → affine H3 or None."""
    if DEVICE.type != 'cuda':
        return None   # skip on CPU — ORB is faster there
    disk, lg = _disk_lg()
    # resize to DISK_DIM for fast inference
    i1 = _resize(img1, DISK_DIM);  i2 = _resize(img2, DISK_DIM)
    h1, w1 = i1.shape[:2];  h2, w2 = i2.shape[:2]
    t1 = _to_rgb_t(i1);  t2 = _to_rgb_t(i2)
    with torch.inference_mode():
        f1 = disk(t1, DISK_KP, pad_if_not_divisible=True)[0]
        f2 = disk(t2, DISK_KP, pad_if_not_divisible=True)[0]
        if f1.keypoints.shape[0] < 8 or f2.keypoints.shape[0] < 8:
            return None
        l1 = _make_lafs(f1.keypoints);  l2 = _make_lafs(f2.keypoints)
        _confs, idx = lg(f1.descriptors, f2.descriptors, l1, l2, (h1,w1), (h2,w2))
    if idx.shape[0] < 8:
        return None
    p1 = f1.keypoints[idx[:,0]].cpu().numpy().astype(np.float32)
    p2 = f2.keypoints[idx[:,1]].cpu().numpy().astype(np.float32)
    # scale back to img1/img2 original size
    s1 = max(img1.shape[:2]) / DISK_DIM;  s2 = max(img2.shape[:2]) / DISK_DIM
    p1 *= s1;  p2 *= s2
    H2, inl = cv2.estimateAffinePartial2D(
        p1, p2, method=cv2.RANSAC,
        ransacReprojThreshold=4.0, maxIters=5000, confidence=0.995)
    if H2 is None or inl is None or inl.sum() < 6:
        return None
    H3 = np.eye(3, dtype=np.float64);  H3[:2] = H2
    return H3


# ── SuperPoint + LightGlue (GPU secondary matcher) ───────────────────────────

def _sp_lg():
    global _sp_model, _lg_sp_model
    if _sp_model is None:
        import kornia.feature as KF
        _sp_model    = KF.SuperPoint(max_num_keypoints=DISK_KP).to(DEVICE).eval()
        _lg_sp_model = KF.LightGlueMatcher('superpoint').to(DEVICE).eval()
    return _sp_model, _lg_sp_model


def _to_gray_t(bgr: np.ndarray):
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    return torch.from_numpy(g)[None, None].to(DEVICE)              # (1,1,H,W)


def _sp_lg_H(img1: np.ndarray, img2: np.ndarray):
    """SuperPoint+LightGlue on GPU → affine H3 or None."""
    global _sp_enabled
    if DEVICE.type != 'cuda' or not _sp_enabled:
        return None
    try:
        sp, lg = _sp_lg()
        i1 = _resize(img1, DISK_DIM);  i2 = _resize(img2, DISK_DIM)
        h1, w1 = i1.shape[:2];  h2, w2 = i2.shape[:2]
        with torch.inference_mode():
            f1 = sp({'image': _to_gray_t(i1)})
            f2 = sp({'image': _to_gray_t(i2)})
            kp1 = f1['keypoints'][0];   kp2 = f2['keypoints'][0]  # (N,2)
            d1  = f1['descriptors'][0]; d2  = f2['descriptors'][0] # (N,256)
            if kp1.shape[0] < 8 or kp2.shape[0] < 8:
                return None
            l1 = _make_lafs(kp1);  l2 = _make_lafs(kp2)
            _confs, idx = lg(d1, d2, l1, l2, (h1, w1), (h2, w2))
        if idx.shape[0] < 8:
            return None
        p1 = kp1[idx[:, 0]].cpu().numpy().astype(np.float32)
        p2 = kp2[idx[:, 1]].cpu().numpy().astype(np.float32)
        s1 = max(img1.shape[:2]) / DISK_DIM;  s2 = max(img2.shape[:2]) / DISK_DIM
        p1 *= s1;  p2 *= s2
        H2, inl = cv2.estimateAffinePartial2D(
            p1, p2, method=cv2.RANSAC,
            ransacReprojThreshold=4.0, maxIters=5000, confidence=0.995)
        if H2 is None or inl is None or inl.sum() < 6:
            return None
        H3 = np.eye(3, dtype=np.float64);  H3[:2] = H2
        return H3
    except Exception:
        _sp_enabled = False
        return None


# ── LoFTR (GPU dense matcher — handles repetitive canopy) ────────────────────

def _get_loftr():
    global _loftr_model
    if _loftr_model is None:
        import kornia.feature as KF
        _loftr_model = KF.LoFTR(pretrained='outdoor').to(DEVICE).eval()
    return _loftr_model


def _loftr_H(img1: np.ndarray, img2: np.ndarray):
    """LoFTR dense GPU match → affine H3 or None."""
    global _loftr_enabled
    if DEVICE.type != 'cuda' or not _loftr_enabled:
        return None
    try:
        loftr = _get_loftr()

        def _prep(bgr, max_dim=640):
            small = _resize(bgr, max_dim)
            h, w  = small.shape[:2]
            h8, w8 = (h // 8) * 8 or 8, (w // 8) * 8 or 8
            if h8 != h or w8 != w:
                small = cv2.resize(small, (w8, h8))
            g = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
            return torch.from_numpy(g)[None, None].to(DEVICE), small.shape[:2]

        t1, sz1 = _prep(img1);  t2, sz2 = _prep(img2)
        with torch.inference_mode():
            out = loftr({'image0': t1, 'image1': t2})

        kp0  = out['keypoints0'].cpu().numpy().astype(np.float32)
        kp1  = out['keypoints1'].cpu().numpy().astype(np.float32)
        conf = out['confidence'].cpu().numpy()
        mask = conf > 0.5
        p1 = kp0[mask];  p2 = kp1[mask]
        if len(p1) < 8:
            return None
        s1 = max(img1.shape[:2]) / max(sz1)
        s2 = max(img2.shape[:2]) / max(sz2)
        p1 *= s1;  p2 *= s2
        H2, inl = cv2.estimateAffinePartial2D(
            p1, p2, method=cv2.RANSAC,
            ransacReprojThreshold=4.0, maxIters=5000, confidence=0.995)
        if H2 is None or inl is None or inl.sum() < 6:
            return None
        H3 = np.eye(3, dtype=np.float64);  H3[:2] = H2
        return H3
    except Exception:
        _loftr_enabled = False
        return None


# ── helpers ───────────────────────────────────────────────────────────────────

def _resize(img: np.ndarray, max_dim: int) -> np.ndarray:
    h, w = img.shape[:2]
    if max(h, w) <= max_dim:
        return img
    s = max_dim / max(h, w)
    return cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)


# ── feature matchers ──────────────────────────────────────────────────────────

_CLAHE = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))

# ORB — fast, good for small rotations
_ORB = cv2.ORB_create(nfeatures=3000, scaleFactor=1.2, nlevels=8,
                       edgeThreshold=10, patchSize=31)
_BF  = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

# AKAZE — slower but handles larger rotations (zig-zag turns)
_AKAZE    = cv2.AKAZE_create()
_BF_AKAZE = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)


def _enhance(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return _CLAHE.apply(gray)


def _match_pair(img1: np.ndarray, img2: np.ndarray):
    """ORB match two consecutive frames → 3×3 homography or None."""
    g1 = _enhance(img1);  g2 = _enhance(img2)
    kp1, des1 = _ORB.detectAndCompute(g1, None)
    kp2, des2 = _ORB.detectAndCompute(g2, None)

    if des1 is None or des2 is None or len(kp1) < 12 or len(kp2) < 12:
        return None

    matches = _BF.knnMatch(des1, des2, k=2)
    good = [m for pair in matches if len(pair) == 2
            for m, n in [pair] if m.distance < 0.75 * n.distance]
    if len(good) < 10:
        return None

    pts1 = np.float32([kp1[m.queryIdx].pt for m in good])
    pts2 = np.float32([kp2[m.trainIdx].pt for m in good])

    H2, inliers = cv2.estimateAffinePartial2D(
        pts1, pts2, method=cv2.RANSAC,
        ransacReprojThreshold=6.0, maxIters=5000, confidence=0.995,
    )
    if H2 is None or inliers is None or inliers.sum() < 8:
        return None

    H3 = np.eye(3, dtype=np.float64)
    H3[:2] = H2
    return H3


def _match_pair_akaze(img1: np.ndarray, img2: np.ndarray):
    """AKAZE match — more rotation-robust than ORB, used at zig-zag turns."""
    g1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    g2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
    kp1, des1 = _AKAZE.detectAndCompute(g1, None)
    kp2, des2 = _AKAZE.detectAndCompute(g2, None)

    if des1 is None or des2 is None or len(kp1) < 8 or len(kp2) < 8:
        return None

    matches = _BF_AKAZE.knnMatch(des1, des2, k=2)
    good = [m for pair in matches if len(pair) == 2
            for m, n in [pair] if m.distance < 0.80 * n.distance]
    if len(good) < 6:
        return None

    pts1 = np.float32([kp1[m.queryIdx].pt for m in good])
    pts2 = np.float32([kp2[m.trainIdx].pt for m in good])

    H2, inliers = cv2.estimateAffinePartial2D(
        pts1, pts2, method=cv2.RANSAC,
        ransacReprojThreshold=8.0, maxIters=5000, confidence=0.99,
    )
    if H2 is None or inliers is None or inliers.sum() < 5:
        return None

    H3 = np.eye(3, dtype=np.float64)
    H3[:2] = H2
    return H3


def _phase_fallback(img1: np.ndarray, img2: np.ndarray):
    g1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY).astype(np.float32)
    g2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY).astype(np.float32)
    (dx, dy), _ = cv2.phaseCorrelate(g1, g2)
    H3 = np.eye(3, dtype=np.float64)
    H3[0, 2] = dx;  H3[1, 2] = dy
    return H3


def _extrapolate_H3(recent_H3s: list) -> np.ndarray:
    """
    Velocity extrapolation: weighted mean of the last few successful transforms.
    More recent transforms get higher weight → smooth turn extrapolation.
    This replaces the naive last_H3 copy that pointed in the wrong direction
    after zig-zag course changes.
    """
    if not recent_H3s:
        return np.eye(3, dtype=np.float64)
    n = min(len(recent_H3s), 5)
    buf = recent_H3s[-n:]
    weights = np.arange(1, n + 1, dtype=np.float64)   # 1,2,…,n — most recent highest
    txs = np.array([h[0, 2] for h in buf])
    tys = np.array([h[1, 2] for h in buf])
    tx  = float(np.average(txs, weights=weights))
    ty  = float(np.average(tys, weights=weights))
    H3  = np.eye(3, dtype=np.float64)
    H3[0, 2] = tx
    H3[1, 2] = ty
    return H3


# ── gap fill ─────────────────────────────────────────────────────────────────

def _fill_gaps(img: np.ndarray) -> np.ndarray:
    """Replace every black (all-zero) pixel with the nearest non-black pixel.

    Uses scipy distance_transform_edt for an O(n) nearest-neighbour fill that
    handles gaps of any size instantly.  Falls back to progressive OpenCV
    dilation if scipy is unavailable.
    """
    gap = img.max(axis=2) == 0
    if not gap.any():
        return img
    try:
        from scipy.ndimage import distance_transform_edt
        _, (ri, ci) = distance_transform_edt(gap, return_indices=True)
        return img[ri, ci]
    except ImportError:
        result = img.copy()
        mask   = gap
        for ksize in [201, 101, 51, 21, 9, 3]:
            if not mask.any():
                break
            dilated = cv2.dilate(result, np.ones((ksize, ksize), np.uint8))
            result  = np.where(mask[:, :, np.newaxis], dilated, result)
            mask    = result.max(axis=2) == 0
        return result


def _is_sky(img: np.ndarray, thresh: float = 0.25) -> bool:
    """Return True if more than thresh of pixels are severely overexposed (sky/glare)."""
    return float((img.max(axis=2) > 240).mean()) > thresh


# ── weight mask ──────────────────────────────────────────────────────────────

def _make_weight(h: int, w: int) -> np.ndarray:
    """
    Cosine-taper weight: 1.0 at frame centre, 0.0 at all four edges.
    Warping this alongside each frame enables seam-free weighted blending.
    """
    wy = np.sin(np.pi * np.arange(h) / max(h - 1, 1)).astype(np.float32)
    wx = np.sin(np.pi * np.arange(w) / max(w - 1, 1)).astype(np.float32)
    return np.outer(wy, wx)


# ── trajectory builder (shared logic) ────────────────────────────────────────

def _build_trajectory(match_imgs: list, progress_cb, pct_start: int, pct_end: int):
    """
    Build cumulative transform list from a sequence of MATCH_DIM images.
    Returns (raw_T, stats_string).
    """
    nb = len(match_imgs)
    raw_T   = [np.eye(3, dtype=np.float64)]
    cum_T   = np.eye(3, dtype=np.float64)
    recent_H3s: list = []          # last ≤5 successful matches for extrapolation

    disk_ok = sp_ok = orb_ok = akaze_ok = loftr_ok = phase_ok = fallback = 0

    for i in range(nb - 1):
        # ── 0. DISK+LightGlue (GPU primary) ─────────────────────────────────
        H3 = _disk_lg_H(match_imgs[i], match_imgs[i + 1])
        if H3 is not None:
            disk_ok += 1
        else:
            # ── 1. SuperPoint+LightGlue (GPU secondary) ──────────────────────
            H3 = _sp_lg_H(match_imgs[i], match_imgs[i + 1])
            if H3 is not None:
                sp_ok += 1
            else:
                # ── 2. ORB (CPU fast) ─────────────────────────────────────────
                H3 = _match_pair(match_imgs[i], match_imgs[i + 1])
                if H3 is not None:
                    orb_ok += 1
                else:
                    # ── 3. AKAZE (CPU, larger rotations) ──────────────────────
                    H3 = _match_pair_akaze(match_imgs[i], match_imgs[i + 1])
                    if H3 is not None:
                        akaze_ok += 1
                    else:
                        # ── 4. LoFTR (GPU dense, repetitive canopy) ───────────
                        H3 = _loftr_H(match_imgs[i], match_imgs[i + 1])
                        if H3 is not None:
                            loftr_ok += 1
                        else:
                            # ── 5. Phase correlation ───────────────────────────
                            H3_ph = _phase_fallback(match_imgs[i], match_imgs[i + 1])
                            tx, ty = H3_ph[0, 2], H3_ph[1, 2]
                            if abs(tx) < 200 and abs(ty) < 200:
                                H3 = H3_ph;  phase_ok += 1
                            else:
                                # ── 6. Velocity extrapolation ─────────────────
                                H3 = _extrapolate_H3(recent_H3s)
                                fallback += 1

        recent_H3s.append(H3)
        if len(recent_H3s) > 5:
            recent_H3s.pop(0)

        cum_T = cum_T @ np.linalg.inv(H3)
        raw_T.append(cum_T.copy())

        if progress_cb and (i % 5 == 0 or i == nb - 2):
            pct = pct_start + int((i + 1) / (nb - 1) * (pct_end - pct_start))
            progress_cb(
                pct,
                f'Matching {i+1}/{nb-1}  DISK:{disk_ok} SP:{sp_ok} '
                f'ORB:{orb_ok} AKAZE:{akaze_ok} LoFTR:{loftr_ok} '
                f'phase:{phase_ok} ext:{fallback}',
            )

    stats = (f'DISK:{disk_ok} SP:{sp_ok} ORB:{orb_ok} AKAZE:{akaze_ok} '
             f'LoFTR:{loftr_ok} phase:{phase_ok} extrap:{fallback}')
    return raw_T, stats


# ── canvas setup helper ───────────────────────────────────────────────────────

def _setup_canvas(raw_T, nb, fw, fh):
    """Anchor trajectory to centre frame, scale to STITCH_DIM, compute canvas."""
    T_centre_inv = np.linalg.inv(raw_T[nb // 2])
    raw_T_anch   = [T_centre_inv @ T for T in raw_T]

    scale  = STITCH_DIM / MATCH_DIM
    T_list = []
    for T in raw_T_anch:
        Ts = T.copy()
        Ts[0, 2] *= scale
        Ts[1, 2] *= scale
        T_list.append(Ts)

    corners_src = np.float32([[0, 0], [fw, 0], [fw, fh], [0, fh]]).reshape(-1, 1, 2)
    pts = np.concatenate([
        cv2.perspectiveTransform(corners_src, T).reshape(-1, 2) for T in T_list
    ])
    xmin, ymin = pts[:, 0].min(), pts[:, 1].min()
    xmax, ymax = pts[:, 0].max(), pts[:, 1].max()

    raw_w = int(np.ceil(xmax - xmin))
    raw_h = int(np.ceil(ymax - ymin))
    sc    = min(1.0, MAX_PX / max(raw_w, raw_h))
    cw    = max(1, int(raw_w * sc))
    ch    = max(1, int(raw_h * sc))

    T_off = np.array([[sc, 0, -xmin * sc],
                      [0, sc, -ymin * sc],
                      [0,  0,  1        ]], dtype=np.float64)
    return T_list, T_off, cw, ch


# ── main video stitcher ───────────────────────────────────────────────────────

def stitch_video(
    video_path: str,
    output_path: str,
    frame_step: int = FRAME_STEP,
    progress_cb: Callable[[int, str], None] | None = None,
) -> str:
    """
    Build an orthomosaic directly from a drone video.
    No frame-extraction step — reads the video with cv2.VideoCapture.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f'Cannot open video: {video_path}')

    total_f = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    src_fps = max(1.0, cap.get(cv2.CAP_PROP_FPS))

    if progress_cb:
        progress_cb(2, f'Video: {total_f/src_fps:.0f}s  {src_fps:.0f}fps — '
                       f'sampling every {frame_step} frames…')

    # Decide which frame numbers to sample
    raw_fnos = list(range(0, total_f, frame_step))
    if len(raw_fnos) > MAX_FRAMES:
        step2    = len(raw_fnos) / MAX_FRAMES
        raw_fnos = [raw_fnos[int(i * step2)] for i in range(MAX_FRAMES)]
    target_set = set(raw_fnos)

    # ── Pass 1: read video sequentially, collect MATCH_DIM frames ─────────────
    match_imgs: list[np.ndarray] = []
    fno = 0
    while fno <= raw_fnos[-1]:
        ret, frame = cap.read()
        if not ret:
            break
        if fno in target_set:
            match_imgs.append(_resize(frame, MATCH_DIM))
            if progress_cb and len(match_imgs) % 30 == 0:
                progress_cb(2 + int(fno / total_f * 8),
                            f'Loading {len(match_imgs)}/{len(raw_fnos)}…')
        fno += 1
    cap.release()

    nb = len(match_imgs)
    if nb < 2:
        raise RuntimeError('Too few frames sampled from video.')

    if progress_cb:
        progress_cb(10, f'Computing trajectory for {nb} frames…')

    # ── GPU/CPU matcher cascade trajectory ───────────────────────────────────
    raw_T, stats = _build_trajectory(match_imgs, progress_cb, 10, 40)
    del match_imgs;  gc.collect()

    if progress_cb:
        progress_cb(40, f'Trajectory done — {stats}')

    # Frame size at STITCH_DIM
    cap_sz = cv2.VideoCapture(video_path)
    ret_sz, frame_sz = cap_sz.read()
    cap_sz.release()
    if not ret_sz:
        raise RuntimeError('Cannot read first frame for size.')
    fh_orig, fw_orig = frame_sz.shape[:2]
    _f = _resize(frame_sz, STITCH_DIM)
    fh, fw = _f.shape[:2]
    del _f, frame_sz

    if progress_cb:
        progress_cb(41, f'Frame: {fw}×{fh} px')

    T_list, T_off, cw, ch = _setup_canvas(raw_T, nb, fw, fh)

    # Save trajectory so frame_tree_detector can project detections to canvas space.
    # Each transform maps original-resolution frame coords → canvas pixel coords.
    try:
        import json as _json
        s_orig = fw / fw_orig  # original → STITCH_DIM scale
        _T_down = np.array([[s_orig, 0, 0], [0, s_orig, 0], [0, 0, 1]], dtype=np.float64)
        _traj = {
            'frame_indices':  raw_fnos,
            'transforms':     [(T_off @ T @ _T_down).tolist() for T in T_list],
            'canvas_wh':      [cw, ch],
            'orig_frame_wh':  [fw_orig, fh_orig],
        }
        _traj_dir = os.path.dirname(os.path.abspath(output_path))
        os.makedirs(_traj_dir, exist_ok=True)
        with open(os.path.join(_traj_dir, 'trajectory.json'), 'w') as _tf:
            _json.dump(_traj, _tf)
    except Exception:
        pass   # trajectory is optional — don't crash the main stitch

    if progress_cb:
        progress_cb(42, f'Canvas: {cw}×{ch} px  (frame: {fw}×{fh} px)')

    # ── Pass 2: best-frame-wins blend (batched GPU warp) ─────────────────────
    # Frames are accumulated into WARP_BATCH-sized batches and warped together
    # in a single GPU kernel call, then merged into the canvas.
    weight_mask = _make_weight(fh, fw)
    best_weight = np.zeros((ch, cw),    dtype=np.float32)
    canvas      = np.zeros((ch, cw, 3), dtype=np.uint8)

    def _flush_batch(b_imgs, b_Ts, b_fi_end):
        nonlocal canvas, best_weight
        warped_fs = warp_frame_batch(b_imgs, b_Ts, cw, ch)
        warped_ws = warp_mask_batch([weight_mask] * len(b_imgs), b_Ts, cw, ch)
        for wf, wm in zip(warped_fs, warped_ws):
            better = wm > best_weight
            canvas[better]      = wf[better]
            best_weight[better] = wm[better]
        if progress_cb:
            progress_cb(42 + int(b_fi_end / nb * 50),
                        f'Painting {b_fi_end}/{nb}…')

    cap2    = cv2.VideoCapture(video_path)
    fno2    = 0
    fi      = 0
    b_imgs: list = []
    b_Ts:   list = []

    while fi < nb:
        ret, frame = cap2.read()
        if not ret:
            break

        if fno2 in target_set:
            img = _resize(frame, STITCH_DIM)
            if not _is_sky(img):
                b_imgs.append(img)
                b_Ts.append(T_off @ T_list[fi])
            del img
            fi += 1

            if len(b_imgs) >= WARP_BATCH:
                _flush_batch(b_imgs, b_Ts, fi)
                b_imgs = []; b_Ts = []
                gc.collect()

        fno2 += 1
        if fno2 > raw_fnos[-1]:
            break

    cap2.release()

    if b_imgs:                               # flush remaining partial batch
        _flush_batch(b_imgs, b_Ts, fi)

    del best_weight, b_imgs, b_Ts;  gc.collect()

    # ── Fill residual gaps ────────────────────────────────────────────────────
    if progress_cb:
        progress_cb(93, 'Filling gaps…')
    canvas = _fill_gaps(canvas)

    # ── Unsharp mask ──────────────────────────────────────────────────────────
    if progress_cb:
        progress_cb(97, 'Sharpening…')
    result = sharpen_gpu(canvas)
    del canvas;  gc.collect()

    # ── Save ──────────────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    cv2.imwrite(output_path, result)

    if progress_cb:
        progress_cb(100, f'Map ready — {cw}×{ch} px  ({fw}×{fh} frame res)')

    return output_path


# ── Legacy entry point (used by test_4k.py) ───────────────────────────────────

def stitch_frames(
    frames_dir: str,
    output_path: str,
    conf_thresh: float = 0.1,
    progress_cb: Callable[[int, str], None] | None = None,
) -> str:
    """Backward-compatible wrapper: stitches pre-extracted JPEG frames."""
    import glob as _glob

    blend_paths = sorted(_glob.glob(os.path.join(frames_dir, '*.jpg')))
    if not blend_paths:
        raise RuntimeError('No extracted frames found.')

    MAX_BLEND = 200
    if len(blend_paths) > MAX_BLEND:
        step        = len(blend_paths) / MAX_BLEND
        blend_paths = [blend_paths[int(i * step)] for i in range(MAX_BLEND)]

    nb = len(blend_paths)

    if progress_cb:
        progress_cb(2, f'Loading {nb} frames…')

    match_imgs: list[np.ndarray] = []
    for i, p in enumerate(blend_paths):
        img = cv2.imread(p)
        if img is not None:
            match_imgs.append(_resize(img, MATCH_DIM))
        if progress_cb and i % 10 == 0:
            progress_cb(2 + int(i / nb * 8), f'Loading {i+1}/{nb}…')

    if len(match_imgs) < 2:
        raise RuntimeError('Need at least 2 frames.')
    nb = len(match_imgs)

    if progress_cb:
        progress_cb(10, f'Computing trajectory for {nb} frames…')

    raw_T, stats = _build_trajectory(match_imgs, progress_cb, 10, 42)
    del match_imgs;  gc.collect()

    if progress_cb:
        progress_cb(42, f'Trajectory done — {stats}')

    _s = _resize(cv2.imread(blend_paths[0]), STITCH_DIM)
    fh, fw = _s.shape[:2]
    del _s

    T_list, T_off, cw, ch = _setup_canvas(raw_T, nb, fw, fh)

    if progress_cb:
        progress_cb(44, f'Canvas: {cw}×{ch} px')

    weight_mask = _make_weight(fh, fw)
    best_weight = np.zeros((ch, cw),    dtype=np.float32)
    canvas      = np.zeros((ch, cw, 3), dtype=np.uint8)

    b_imgs: list = []; b_Ts: list = []; b_i = 0
    for i, (path, T) in enumerate(zip(blend_paths, T_list)):
        img = _resize(cv2.imread(path), STITCH_DIM)
        if img is None:
            continue
        b_imgs.append(img); b_Ts.append(T_off @ T); b_i = i
        if len(b_imgs) >= WARP_BATCH or i == nb - 1:
            wfs = warp_frame_batch(b_imgs, b_Ts, cw, ch)
            wws = warp_mask_batch([weight_mask] * len(b_imgs), b_Ts, cw, ch)
            for wf, wm in zip(wfs, wws):
                better = wm > best_weight
                canvas[better] = wf[better]
                best_weight[better] = wm[better]
            b_imgs = []; b_Ts = []
            gc.collect()
            if progress_cb:
                progress_cb(44 + int((b_i + 1) / nb * 48), f'Painting {b_i+1}/{nb}…')

    del best_weight;  gc.collect()

    if progress_cb:
        progress_cb(93, 'Filling gaps…')
    canvas = _fill_gaps(canvas)

    if progress_cb:
        progress_cb(97, 'Sharpening…')
    result = sharpen_gpu(canvas)
    del canvas

    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    cv2.imwrite(output_path, result)

    if progress_cb:
        progress_cb(100, f'Map ready — {cw}×{ch} px')

    return output_path
