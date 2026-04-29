"""
Cross-frame replay-attack signals for the multi-capture liveness flow.

These are *heuristic* signals designed to be used alongside Silent Face per-frame
spoof detection. They are not standalone controls. The goal is to flag two broad
attack classes that pure frame-by-frame PAD can miss:

1. Replay / static image: the user (or attacker) submits nearly-identical frames
   instead of actually moving between prompts.
2. Screen playback: the backlight of a screen produces very uniform brightness
   stats across frames; a real face under ambient light will exhibit more
   natural variation.

We also catch the degenerate "too different" case where consecutive frames look
like entirely different scenes (indicating tampering or a different person).

No third-party hashing library is required — we implement a small dHash.
"""

from __future__ import annotations

import io
import logging
from typing import List, Tuple

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# Hamming distance thresholds on a 64-bit dHash.
# Tuned empirically for consecutive challenge frames where the user changes pose.
PHASH_IDENTICAL_MAX = 4     # <= 4 bits different  => almost surely the same image
PHASH_SCENE_CHANGE_MIN = 32  # >= 32 bits different => near-random, scene fully changed

# If stddev of per-frame mean-brightness across the session is below this,
# frames are *too uniform* (screen playback heuristic).
BRIGHTNESS_STDDEV_MIN = 2.0


def _dhash_bits(image_bytes: bytes, hash_size: int = 8) -> List[int]:
    """Compute a 64-bit difference-hash for an image. Returns a list of 0/1 ints."""
    img = Image.open(io.BytesIO(image_bytes)).convert("L").resize(
        (hash_size + 1, hash_size), Image.LANCZOS
    )
    pixels = list(img.getdata())
    bits: List[int] = []
    for y in range(hash_size):
        row_base = y * (hash_size + 1)
        for x in range(hash_size):
            left = pixels[row_base + x]
            right = pixels[row_base + x + 1]
            bits.append(1 if left > right else 0)
    return bits


def _hamming(a: List[int], b: List[int]) -> int:
    return sum(1 for x, y in zip(a, b) if x != y)


def _mean_brightness(image_bytes: bytes) -> float:
    img = Image.open(io.BytesIO(image_bytes)).convert("L")
    arr = np.asarray(img, dtype=np.float32)
    return float(arr.mean())


def analyse_frames(frames: List[bytes]) -> Tuple[List[int], float, List[str]]:
    """
    Compute cross-frame replay signals.

    Returns:
        (phash_distances, brightness_stddev, notes)
    """
    notes: List[str] = []

    if len(frames) < 2:
        return [], 0.0, ["not_enough_frames"]

    # dHash each frame
    hashes: List[List[int]] = []
    for i, fb in enumerate(frames):
        try:
            hashes.append(_dhash_bits(fb))
        except Exception as e:
            logger.warning("dHash failed for frame %d: %s", i, e)
            notes.append(f"dhash_error_frame_{i}")
            hashes.append([0] * 64)

    # Consecutive hamming distances
    distances: List[int] = []
    for i in range(len(hashes) - 1):
        distances.append(_hamming(hashes[i], hashes[i + 1]))

    # Brightness stddev across frames
    try:
        means = [_mean_brightness(f) for f in frames]
        brightness_stddev = float(np.std(means))
    except Exception as e:
        logger.warning("Brightness analysis failed: %s", e)
        brightness_stddev = 0.0
        notes.append("brightness_error")

    return distances, brightness_stddev, notes


def classify(
    phash_distances: List[int],
    brightness_stddev: float,
) -> dict:
    """
    Convert raw signals into boolean risk classifications.

    Returns:
        dict with keys:
            is_suspicious_identical
            is_suspicious_scene_change
            is_suspicious_uniform_brightness
    """
    is_identical = any(d <= PHASH_IDENTICAL_MAX for d in phash_distances) if phash_distances else False
    is_scene_change = any(d >= PHASH_SCENE_CHANGE_MIN for d in phash_distances) if phash_distances else False
    is_uniform = brightness_stddev < BRIGHTNESS_STDDEV_MIN

    return {
        "is_suspicious_identical": bool(is_identical),
        "is_suspicious_scene_change": bool(is_scene_change),
        "is_suspicious_uniform_brightness": bool(is_uniform),
    }
