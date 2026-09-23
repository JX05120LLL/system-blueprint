#!/usr/bin/env python
from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup
from PIL import Image

try:
    import cairosvg
except ImportError:
    cairosvg = None


JPEG_FORMATS = {"jpg", "jpeg"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="将 HTML(内联 SVG) 或 SVG 导出为 PNG / JPG / JPEG。"
    )
    parser.add_argument("input", help="输入 HTML 或 SVG 文件")
    parser.add_argument(
        "--format",
        required=True,
        choices=["png", "jpg", "jpeg"],
        help="目标输出格式",
    )
    parser.add_argument("--output", help="输出文件路径，默认使用输入文件同名扩展名")
    parser.add_argument("--scale", type=float, default=2.0, help="导出缩放倍数，默认 2.0")
    parser.add_argument(
        "--background",
        default="#08111E",
        help="导出 JPG/JPEG 时使用的背景色，默认 #08111E",
    )
    return parser.parse_args()


def require_cairosvg() -> None:
    if cairosvg is None:
        raise SystemExit(
            "缺少依赖 cairosvg，无法进行 SVG/HTML 到 PNG/JPG 的导出。\n"
            "请先安装：pip install cairosvg"
        )


def resolve_output_path(input_path: Path, fmt: str, output: Optional[str]) -> Path:
    if output:
        return Path(output)
    extension = ".jpg" if fmt in JPEG_FORMATS else ".png"
    return input_path.with_suffix(extension)


def read_svg(input_path: Path) -> str:
    suffix = input_path.suffix.lower()
    content = input_path.read_text(encoding="utf-8")
    if suffix == ".svg":
        return content
    if suffix in {".html", ".htm"}:
        soup = BeautifulSoup(content, "html.parser")
        svg = soup.find("svg")
        if svg is None:
            raise SystemExit("输入 HTML 中未找到内联 <svg>。")
        return str(svg)
    raise SystemExit("仅支持 .svg / .html / .htm 文件。")


def render_png_bytes(svg_text: str, scale: float) -> bytes:
    require_cairosvg()
    assert cairosvg is not None
    return cairosvg.svg2png(bytestring=svg_text.encode("utf-8"), scale=scale)


def save_png(output_path: Path, png_bytes: bytes) -> None:
    output_path.write_bytes(png_bytes)


def save_jpeg(output_path: Path, png_bytes: bytes, background: str) -> None:
    with Image.open(BytesIO(png_bytes)) as image:
        rgba = image.convert("RGBA")
        bg = Image.new("RGBA", rgba.size, background)
        merged = Image.alpha_composite(bg, rgba).convert("RGB")
        merged.save(output_path, quality=95)


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).resolve()
    if not input_path.exists():
        raise SystemExit(f"输入文件不存在：{input_path}")

    output_path = resolve_output_path(input_path, args.format, args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    svg_text = read_svg(input_path)
    png_bytes = render_png_bytes(svg_text, args.scale)

    if args.format == "png":
        save_png(output_path, png_bytes)
    else:
        save_jpeg(output_path, png_bytes, args.background)

    print(f"导出成功：{output_path}")


if __name__ == "__main__":
    main()
