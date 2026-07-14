# App icon assets

Every icon raster in this repo is generated from one vector source — never edit
the PNGs by hand, edit the source and re-run the generator.

```bash
pip install pymupdf pillow numpy
python3 scripts/generate-app-icons.py
npx expo prebuild --clean   # regenerates android/ and ios/ from the new assets
```

## Source

`source/fixate-icon.pdf` — a three-tile artboard of the hammer+gear mark:
pale-mint, green-gradient and dark. Each tile is exactly three flat colours
(background, mark primary, mark secondary), which is what lets the generator
un-mix anti-aliased pixels back into clean per-shape coverage masks and
re-composite the mark at any size and in any palette.

The **green-gradient** tile is the primary app icon.

| | |
|---|---|
| Gradient | `#20C57C` → `#059769` (horizontal) |
| Flat stand-in | `#14AE74` (`adaptiveIcon.backgroundColor`, notification tint) |
| Mark on green | `#F5F9F6` primary, `#B5EFD2` secondary |
| Mark on white | `#18B878` primary, `#05956B` secondary |
| Mark on dark | `#3BDE92` primary, `#B5EFD2` secondary |

## Generated

| File | Used by |
|---|---|
| `../icon.png` | iOS app icon (1024, full-bleed, **no alpha**) |
| `../adaptive-icon.png` | Android adaptive foreground |
| `../adaptive-icon-background.png` | Android adaptive background (gradient) |
| `../adaptive-icon-monochrome.png` | Android 13+ themed icons |
| `../notification-icon.png` | Android notification icon (white, alpha-only) |
| `../splash.png` | native splash screen |
| `../favicon.png` | web |
| `../logo.png`, `../fixate-logo-main.png` | in-app logo, light surfaces |
| `../fixate-logo-dark.png` | in-app logo, dark surfaces |
| `ios-appstore-1024.png` | App Store listing icon |
| `play-store-512.png` | Google Play listing icon |
| `android/mipmap-*.png` | reference only — `expo prebuild` generates the real ones |

## Sizing

The mark fills 77.6% of the artboard tile, which is right for a full-bleed iOS
icon but would be clipped by Android's launcher masks. The adaptive foreground
therefore scales the mark to 50% of its 108dp canvas: that reproduces the same
proportion inside Android's guaranteed-visible 72dp window (0.50 / 0.667 = 0.75)
while clipping only 0.02% of the mark under a circular mask.

`android/` and `ios/` are gitignored and rebuilt by `expo prebuild`, so the
files above plus `app.json` are the only sources of truth.

## Rollback

The previous wrench+phone icons are in `backup/`, and unreferenced legacy logo
files in `backup/legacy/`. Restore by copying `backup/*.png` back over
`assets/` and re-running `expo prebuild --clean`.
