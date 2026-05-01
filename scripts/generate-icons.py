from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw


ROOT_DIR = Path(__file__).resolve().parent.parent
SOURCE_LOGO = (
    ROOT_DIR / "packages" / "frontend" / "src" / "assets" / "story-weaver-logo.png"
)
BUILD_DIR = ROOT_DIR / "build"
ICONSET_DIR = BUILD_DIR / "mac" / "StoryWeaver.iconset"
PADDED_ICON = BUILD_DIR / "icon.png"
ICNS_PATH = BUILD_DIR / "icon.icns"
ICO_PATH = BUILD_DIR / "icon.ico"

CANVAS_SIZE = 1024
BACKGROUND_SIZE = 768
CONTENT_SIZE = 704
CORNER_RADIUS = 144
ICON_BACKGROUND = (239, 230, 213, 255)

ICONSET_SIZES = {
    "icon_16x16.png": 16,
    "icon_16x16@2x.png": 32,
    "icon_32x32.png": 32,
    "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512,
    "icon_512x512@2x.png": 1024,
}


def build_padded_icon() -> Image.Image:
    source = Image.open(SOURCE_LOGO).convert("RGBA")
    resized = source.resize((CONTENT_SIZE, CONTENT_SIZE), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    background = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), ICON_BACKGROUND)
    mask = Image.new("L", (CANVAS_SIZE, CANVAS_SIZE), 0)
    background_offset = (CANVAS_SIZE - BACKGROUND_SIZE) // 2
    ImageDraw.Draw(mask).rounded_rectangle(
        (
            background_offset,
            background_offset,
            background_offset + BACKGROUND_SIZE - 1,
            background_offset + BACKGROUND_SIZE - 1,
        ),
        radius=CORNER_RADIUS,
        fill=255,
    )
    canvas.paste(background, (0, 0), mask)
    offset = ((CANVAS_SIZE - CONTENT_SIZE) // 2, (CANVAS_SIZE - CONTENT_SIZE) // 2)
    canvas.alpha_composite(resized, offset)
    return canvas


def save_iconset(base_image: Image.Image) -> None:
    for file_name, size in ICONSET_SIZES.items():
      output_path = ICONSET_DIR / file_name
      icon_image = base_image.resize((size, size), Image.Resampling.LANCZOS)
      icon_image.save(output_path)


def build_icns() -> None:
    subprocess.run(
        ["iconutil", "-c", "icns", str(ICONSET_DIR), "-o", str(ICNS_PATH)],
        check=True,
    )


def build_ico(base_image: Image.Image) -> None:
    base_image.save(
        ICO_PATH,
        format="ICO",
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
    )


def main() -> None:
    if not SOURCE_LOGO.exists():
        raise FileNotFoundError(f"Missing source logo: {SOURCE_LOGO}")

    ICONSET_DIR.mkdir(parents=True, exist_ok=True)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)

    padded_icon = build_padded_icon()
    padded_icon.save(PADDED_ICON)
    save_iconset(padded_icon)
    build_icns()
    build_ico(padded_icon)


if __name__ == "__main__":
    main()
