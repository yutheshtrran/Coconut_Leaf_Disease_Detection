"""
GPU-accelerated warpPerspective via Kornia (PyTorch).
Pip-installed OpenCV has no CUDA support, so we use Kornia for all
image warping when a CUDA GPU is available.
Shared by stitch_opencv.py, stitch_loftr.py, stitch_colmap.py.
"""

import cv2
import numpy as np
import torch
import kornia.geometry.transform as _KGT

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
_USE_GPU = DEVICE.type == 'cuda'

print(f'[gpu_warp] device={DEVICE}  GPU warp: {"ON" if _USE_GPU else "OFF (CPU fallback)"}')


def warp_frame(src_bgr: np.ndarray, M: np.ndarray,
               out_w: int, out_h: int) -> np.ndarray:
    """
    Warp a BGR uint8 frame.  Uses Kornia bicubic on GPU, cv2 Lanczos4 on CPU.
    M follows cv2 convention: forward transform from src to dst.
    """
    if _USE_GPU:
        t  = (torch.from_numpy(src_bgr.astype(np.float32) / 255.0)
              .permute(2, 0, 1)[None].to(DEVICE))
        Mt = torch.from_numpy(M.astype(np.float32))[None].to(DEVICE)
        out = _KGT.warp_perspective(t, Mt, (out_h, out_w),
                                     mode='bicubic',
                                     padding_mode='zeros',
                                     align_corners=False)
        return (out[0].permute(1, 2, 0).clamp(0, 1)
                .cpu().numpy() * 255).astype(np.uint8)
    return cv2.warpPerspective(src_bgr, M, (out_w, out_h),
                               flags=cv2.INTER_LANCZOS4,
                               borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def warp_mask(src_f32: np.ndarray, M: np.ndarray,
              out_w: int, out_h: int) -> np.ndarray:
    """
    Warp a float32 2-D weight mask.  Uses Kornia on GPU, cv2 on CPU.
    """
    if _USE_GPU:
        t  = torch.from_numpy(src_f32[None, None]).to(DEVICE)
        Mt = torch.from_numpy(M.astype(np.float32))[None].to(DEVICE)
        out = _KGT.warp_perspective(t, Mt, (out_h, out_w),
                                     mode='bilinear',
                                     padding_mode='zeros',
                                     align_corners=False)
        return out[0, 0].cpu().numpy()
    return cv2.warpPerspective(src_f32, M, (out_w, out_h),
                               flags=cv2.INTER_LINEAR,
                               borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def warp_frame_batch(frames_bgr: list, Ms: list,
                     out_w: int, out_h: int) -> list:
    """
    Warp a batch of BGR frames in one GPU call — higher GPU utilisation.
    frames_bgr : list of np.ndarray (H,W,3) uint8
    Ms         : list of np.ndarray (3,3) float64
    Returns    : list of np.ndarray (out_h, out_w, 3) uint8
    """
    if not _USE_GPU or not frames_bgr:
        return [warp_frame(f, M, out_w, out_h)
                for f, M in zip(frames_bgr, Ms)]

    B = len(frames_bgr)
    t  = torch.stack([
        torch.from_numpy(f.astype(np.float32) / 255.0).permute(2, 0, 1)
        for f in frames_bgr]).to(DEVICE)                          # (B,3,H,W)
    Mt = torch.stack([
        torch.from_numpy(M.astype(np.float32))
        for M in Ms]).to(DEVICE)                                   # (B,3,3)

    out = _KGT.warp_perspective(t, Mt, (out_h, out_w),
                                 mode='bicubic',
                                 padding_mode='zeros',
                                 align_corners=False)              # (B,3,H,W)
    results = []
    for i in range(B):
        results.append(
            (out[i].permute(1, 2, 0).clamp(0, 1)
             .cpu().numpy() * 255).astype(np.uint8))
    return results


def warp_mask_batch(masks_f32: list, Ms: list,
                    out_w: int, out_h: int) -> list:
    """
    Warp a batch of float32 2-D weight masks in one GPU call.
    masks_f32 : list of np.ndarray (H, W) float32
    Ms        : list of np.ndarray (3, 3) float64
    Returns   : list of np.ndarray (out_h, out_w) float32
    """
    if not _USE_GPU or not masks_f32:
        return [warp_mask(m, M, out_w, out_h) for m, M in zip(masks_f32, Ms)]

    B  = len(masks_f32)
    t  = torch.stack([torch.from_numpy(m[None]) for m in masks_f32]).to(DEVICE)  # (B,1,H,W)
    Mt = torch.stack([
        torch.from_numpy(M.astype(np.float32))
        for M in Ms]).to(DEVICE)                                    # (B,3,3)

    out = _KGT.warp_perspective(t, Mt, (out_h, out_w),
                                 mode='bilinear',
                                 padding_mode='zeros',
                                 align_corners=False)               # (B,1,H,W)
    return [out[i, 0].cpu().numpy() for i in range(B)]


def sharpen_gpu(img_bgr: np.ndarray,
                sigma: float = 1.0, amount: float = 0.3) -> np.ndarray:
    """
    Unsharp mask: output = input + amount*(input - gaussian_blur(input)).
    Uses kornia on GPU (in-place on a temp tensor), falls back to cv2 on CPU.
    """
    if _USE_GPU:
        import kornia.filters as KF
        t = (torch.from_numpy(img_bgr.astype(np.float32) / 255.0)
             .permute(2, 0, 1)[None].to(DEVICE))                    # (1,3,H,W)
        blurred = KF.gaussian_blur2d(t, (5, 5), (sigma, sigma))
        result  = (t + amount * (t - blurred)).clamp(0, 1)
        return (result[0].permute(1, 2, 0).cpu().numpy() * 255).astype(np.uint8)
    blur = cv2.GaussianBlur(img_bgr, (0, 0), sigma)
    return cv2.addWeighted(img_bgr, 1 + amount, blur, -amount, 0)
