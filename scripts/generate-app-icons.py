#!/usr/bin/env python3
"""Regenerate every app-icon raster from the single vector source.

Source of truth: assets/icons/source/fixate-icon.pdf — a three-tile artboard
(pale-mint / green-gradient / dark) of the same hammer+gear mark.

Each tile is composed of exactly three flat colours: a background, a primary
mark tone and a secondary mark tone. We render the artboard at 600dpi and
un-mix each anti-aliased pixel back into per-shape coverage weights, which
gives resolution-independent alpha masks for the two mark shapes. Every output
below is then re-composited from those masks, so the mark stays artifact-free
at any size and can be recoloured per surface (white-on-green launcher icon,
green-on-white splash, pure-alpha notification icon, ...).

Usage:  python3 scripts/generate-app-icons.py
Deps:   pip install pymupdf pillow numpy
"""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ICONS = ASSETS / "icons"
SOURCE_PDF = ICONS / "source" / "fixate-icon.pdf"

RENDER_DPI = 600

# Tile palettes, sampled from the artboard: (background, mark primary, mark secondary).
LIGHT = ((0xB5, 0xEF, 0xD2), (0x18, 0xB8, 0x78), (0x05, 0x95, 0x6B))
DARK = ((0x08, 0x27, 0x1D), (0x3B, 0xDE, 0x92), (0xB5, 0xEF, 0xD2))
GREEN_MARK = ((0xF5, 0xF9, 0xF6), (0xB5, 0xEF, 0xD2))  # primary, secondary on the gradient

# The green tile's background is a purely horizontal gradient.
GRADIENT_LEFT = (0x20, 0xC5, 0x7C)
GRADIENT_RIGHT = (0x05, 0x97, 0x69)
# Solid stand-in for the gradient, used wherever only one colour is allowed
# (Android adaptiveIcon.backgroundColor fallback, notification tint).
BRAND_GREEN = "#14AE74"

WHITE = (0xFF, 0xFF, 0xFF)

# The mark spans 77.6% of the artboard tile. Android only guarantees the inner
# 72/108 of an adaptive icon is visible, and circular launcher masks cut a
# 66/108 circle out of it — so the mark is scaled to 50% of the adaptive canvas.
# That reproduces the designer's proportion *within* the visible window
# (0.50 / 0.667 = 0.75) while clipping 0.02% of the mark under a circle mask.
ADAPTIVE_MARK_WIDTH = 0.50
# Notification icons are drawn small in the status bar; fill more of the canvas.
NOTIFICATION_MARK_WIDTH = 0.86


def load_masks() -> tuple[np.ndarray, np.ndarray]:
    """Render the artboard and un-mix the dark tile into two coverage masks.

    The dark tile is used because its background is flat (the green tile's is a
    gradient), which makes the three source colours maximally separable. All
    three tiles carry pixel-identical shapes.
    """
    page = fitz.open(SOURCE_PDF)[0]
    pix = page.get_pixmap(dpi=RENDER_DPI, alpha=True)
    board = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 4)

    tiles = _find_tiles(board[..., 3] > 10)
    if len(tiles) != 3:
        raise SystemExit(f"expected 3 icon tiles on the artboard, found {len(tiles)}")
    x0, y0, size = tiles[2]  # dark tile
    tile = board[y0 : y0 + size, x0 : x0 + size].astype(np.float64)

    # Solve  C = w_bg*BG + w_a*A + w_b*B  subject to  w_bg + w_a + w_b = 1.
    basis = np.vstack([np.stack(DARK, axis=1), np.full(3, 255.0)])
    pixels = tile[..., :3].reshape(-1, 3)
    target = np.concatenate([pixels, np.full((len(pixels), 1), 255.0)], axis=1).T
    weights, *_ = np.linalg.lstsq(basis, target, rcond=None)
    weights = np.clip(weights, 0, 1)
    weights /= np.clip(weights.sum(axis=0, keepdims=True), 1e-6, None)

    _, w_primary, w_secondary = (w.reshape(size, size) for w in weights)
    # Outside the rounded-square artwork there is no mark, only background.
    inside = tile[..., 3] / 255.0
    return w_primary * inside, w_secondary * inside


def _find_tiles(opaque: np.ndarray) -> list[tuple[int, int, int]]:
    """Locate each icon tile on the artboard as (x, y, size)."""
    tiles, start = [], None
    columns = opaque.any(axis=0)
    for x, filled in enumerate(np.append(columns, False)):
        if filled and start is None:
            start = x
        elif not filled and start is not None:
            rows = np.where(opaque[:, start:x].any(axis=1))[0]
            tiles.append((start, int(rows[0]), x - start))
            start = None
    return tiles


def crop_mark(primary: np.ndarray, secondary: np.ndarray) -> tuple[Image.Image, Image.Image]:
    """Tight-crop both masks to the mark's bounding box."""
    ys, xs = np.where(primary + secondary > 0.02)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    return tuple(
        Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).crop(box)
        for m in (primary, secondary)
    )


def gradient(width: int, height: int) -> np.ndarray:
    """The green tile's horizontal background gradient, at any size."""
    t = np.linspace(0, 1, width)[None, :, None]
    left = np.array(GRADIENT_LEFT, np.float64)[None, None, :]
    right = np.array(GRADIENT_RIGHT, np.float64)[None, None, :]
    return np.repeat(left + (right - left) * t, height, axis=0)


def composite(background: np.ndarray, masks, colors, alpha: np.ndarray | None = None):
    """Paint the mark tones over a background; returns a PIL image."""
    out = background.copy()
    for mask, color in zip(masks, colors):
        m = (np.asarray(mask, np.float64) / 255.0)[..., None]
        out = out * (1 - m) + np.array(color, np.float64)[None, None, :] * m
    rgb = np.clip(out, 0, 255).astype(np.uint8)
    if alpha is None:
        return Image.fromarray(rgb)
    return Image.fromarray(np.dstack([rgb, alpha]))


def place(masks, size: int, mark_width: float, offset=(0.0, 0.0)):
    """Scale the mark to `mark_width` of a square canvas and centre it."""
    primary, secondary = masks
    w = round(mark_width * size)
    h = round(w * primary.height / primary.width)
    x = round((size - w) / 2 + offset[0] * size)
    y = round((size - h) / 2 + offset[1] * size)
    out = []
    for mask in (primary, secondary):
        canvas = Image.new("L", (size, size), 0)
        canvas.paste(mask.resize((w, h), Image.LANCZOS), (x, y))
        out.append(canvas)
    return out


def full_bleed(masks, size: int) -> tuple[Image.Image, list[Image.Image]]:
    """The launcher icon: the artboard tile with its rounded corners squared off.

    iOS and Google Play both apply their own corner mask, so the shipped icon
    must be a full-bleed square — we extend the gradient into the corners the
    artboard had rounded away, keeping the mark exactly as composed.
    """
    # The mark occupies 77.6% of the tile, centred at (0.522, 0.531).
    placed = place(masks, size, 0.776, offset=(0.022, 0.031))
    return composite(gradient(size, size), placed, GREEN_MARK), placed


def silhouette(masks, size: int, mark_width: float, color=WHITE) -> Image.Image:
    """A single-tone mark on transparency (notification / monochrome icons)."""
    primary, secondary = place(masks, size, mark_width)
    alpha = np.clip(np.array(primary, np.uint16) + np.array(secondary, np.uint16), 0, 255)
    body = np.zeros((size, size, 3), np.uint8)
    body[:] = color
    return Image.fromarray(np.dstack([body, alpha.astype(np.uint8)]))


def transparent_mark(masks, height: int, palette) -> Image.Image:
    """The two-tone mark on transparency, for in-app logos."""
    primary, secondary = masks
    w = round(height * primary.width / primary.height)
    scaled = [m.resize((w, height), Image.LANCZOS) for m in (primary, secondary)]
    alpha = np.clip(
        np.array(scaled[0], np.uint16) + np.array(scaled[1], np.uint16), 0, 255
    ).astype(np.uint8)
    # Premultiplied-safe: paint tones onto the primary colour so fringe pixels
    # never blend towards black.
    base = np.zeros((height, w, 3), np.float64)
    base[:] = palette[0]
    return composite(base, scaled, palette, alpha=alpha)


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    print(f"  {path.relative_to(ROOT)}  {image.width}x{image.height} {image.mode}")


def main() -> None:
    print("un-mixing artboard ...")
    masks = crop_mark(*load_masks())

    print("launcher icons")
    icon, _ = full_bleed(masks, 1024)
    save(icon, ASSETS / "icon.png")  # iOS + fallback, no alpha
    save(icon, ICONS / "ios-appstore-1024.png")
    save(icon.resize((512, 512), Image.LANCZOS), ICONS / "play-store-512.png")
    save(icon.resize((256, 256), Image.LANCZOS), ASSETS / "favicon.png")

    print("android adaptive icon")
    # The foreground keeps both mark tones; the mark's off-centre composition is
    # preserved, scaled into the 72/108 visible window.
    placed = place(masks, 1024, ADAPTIVE_MARK_WIDTH, offset=(0.022 * 0.667, 0.031 * 0.667))
    alpha = np.clip(
        np.array(placed[0], np.uint16) + np.array(placed[1], np.uint16), 0, 255
    ).astype(np.uint8)
    base = np.zeros((1024, 1024, 3), np.float64)
    base[:] = GREEN_MARK[0]
    save(composite(base, placed, GREEN_MARK, alpha=alpha), ASSETS / "adaptive-icon.png")
    save(
        Image.fromarray(np.clip(gradient(1024, 1024), 0, 255).astype(np.uint8)),
        ASSETS / "adaptive-icon-background.png",
    )
    save(silhouette(masks, 1024, ADAPTIVE_MARK_WIDTH), ASSETS / "adaptive-icon-monochrome.png")

    print("notification icon (alpha-only silhouette)")
    save(silhouette(masks, 256, NOTIFICATION_MARK_WIDTH), ASSETS / "notification-icon.png")

    print("in-app logos")
    save(transparent_mark(masks, 380, LIGHT[1:]), ASSETS / "fixate-logo-main.png")
    save(transparent_mark(masks, 380, DARK[1:]), ASSETS / "fixate-logo-dark.png")
    save(transparent_mark(masks, 380, LIGHT[1:]), ASSETS / "logo.png")

    print("splash")
    splash = Image.new("RGB", (1242, 2436), "#ffffff")
    logo = transparent_mark(masks, 152, LIGHT[1:])  # matches the old mark's optical size
    splash.paste(logo, ((1242 - logo.width) // 2, (2436 - logo.height) // 2), logo)
    save(splash, ASSETS / "splash.png")

    print("play store launcher densities (reference — prebuild regenerates android/)")
    for name, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
        save(icon.resize((px, px), Image.LANCZOS), ICONS / "android" / f"mipmap-{name}.png")


if __name__ == "__main__":
    main()
