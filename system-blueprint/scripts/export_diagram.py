#!/usr/bin/env python
from __future__ import annotations

import argparse
from io import BytesIO
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET


JPEG_FORMATS = {"jpg", "jpeg"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=("将 HTML 或 SVG 导出为 PNG / JPG / JPEG；兼容入口保留覆盖已有输出的行为。"
                     "HTML 新增 Node.js 24 + skill 内 Playwright/Chromium 依赖；"
                     "SVG 使用 CairoSVG + Pillow（Windows 还可能需要 Cairo 运行库）。")
    )
    parser.add_argument("input", help="输入 HTML 或 SVG 文件")
    parser.add_argument(
        "--format",
        required=True,
        choices=["png", "jpg", "jpeg"],
        help="目标输出格式",
    )
    parser.add_argument("--output", help="输出文件路径，默认使用输入文件同名扩展名")
    parser.add_argument("--scale", type=float, default=2.0, help="导出缩放倍数 0.5–4，默认 2.0")
    parser.add_argument(
        "--background",
        default="#08111E",
        help="导出 JPG/JPEG 时使用的背景色，默认 #08111E",
    )
    parser.add_argument("--svg-index", type=int, help="旧 HTML 含多个 SVG 时选择从 0 开始的索引")
    args = parser.parse_args()
    if not math.isfinite(args.scale) or not 0.5 <= args.scale <= 4:
        parser.error("--scale 必须为 0.5–4 的有限数值。")
    if args.svg_index is not None and args.svg_index < 0:
        parser.error("--svg-index 必须为从 0 开始的非负整数。")
    return args


def resolve_output_path(input_path: Path, fmt: str, output: str | None) -> Path:
    if output:
        return Path(output)
    extension = ".jpg" if fmt in JPEG_FORMATS else ".png"
    return input_path.with_suffix(extension)


def check_raster_size(width: float, height: float) -> None:
    """Check CSS-computed dimensions at Cairo's allocation boundary."""
    if not math.isfinite(width) or not math.isfinite(height) or width <= 0 or height <= 0:
        raise ValueError("SVG 的尺寸必须为有限正数。")
    pixels = (math.ceil(width), math.ceil(height))
    if max(pixels) > 16000 or pixels[0] * pixels[1] > 40000000:
        raise ValueError("位图超过单边 16000 / 总像素 40000000 限制，请降低 --scale 或拆图。")


def render_svg(svg_text: str, fmt: str, scale: float, background: str) -> bytes:
    # HTML users do not need either Python imaging dependency.
    try:
        from cairosvg.surface import PNGSurface
        from PIL import Image, ImageColor
    except (ImportError, OSError) as error:
        raise RuntimeError("SVG 导出需要 pip install cairosvg pillow；Windows 还可能需要 Cairo 运行库。" f"\n{error}") from error
    root = ET.fromstring(svg_text)
    if root.tag.rsplit("}", 1)[-1] != "svg":
        raise ValueError("输入不是 SVG 文档。")

    class BoundedPNGSurface(PNGSurface):
        def _create_surface(self, width: float, height: float):
            check_raster_size(width, height)
            return super()._create_surface(width, height)

    png_bytes = BoundedPNGSurface.convert(bytestring=svg_text.encode("utf-8"), scale=scale)
    if fmt == "png":
        return png_bytes
    color = ImageColor.getcolor(background, "RGBA")
    if color[3] != 255:
        raise ValueError("JPEG 的 --background 必须是不透明颜色。")
    with Image.open(BytesIO(png_bytes)) as image:
        rgba = image.convert("RGBA")
        bg = Image.new("RGBA", rgba.size, color)
        merged = Image.alpha_composite(bg, rgba).convert("RGB")
        stream = BytesIO()
        merged.save(stream, format="JPEG", quality=95)
        return stream.getvalue()


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False) as file:
            temporary = Path(file.name)
            file.write(content)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def export_html(args: argparse.Namespace, input_path: Path, output_path: Path) -> int:
    node = shutil.which("node")
    entry = Path(__file__).resolve().with_name("export.mjs")
    if not node or not entry.is_file():
        raise RuntimeError("HTML 导出需要 Node.js 24、完整 skill 的 scripts/export.mjs 和 skill 内 Playwright/Chromium。请在 skill 目录 npm ci，再运行 node node_modules/playwright/cli.js install chromium。")
    command = [node, str(entry), str(input_path), "--format", args.format, "--output", str(output_path),
               "--scale", str(args.scale), "--overwrite"]
    if args.format in JPEG_FORMATS:
        command += ["--background", args.background]
    if args.svg_index is not None:
        command += ["--svg-index", str(args.svg_index)]
    return subprocess.run(command, check=False).returncode


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).resolve()
    try:
        if not input_path.is_file():
            raise ValueError(f"输入文件不存在：{input_path}")
        output_path = resolve_output_path(input_path, args.format, args.output).resolve()
        extensions = {".jpg", ".jpeg"} if args.format in JPEG_FORMATS else {".png"}
        if output_path.suffix.lower() not in extensions:
            raise ValueError(f"--format {args.format} 与输出扩展名 {output_path.suffix} 冲突。")
        if output_path == input_path:
            raise ValueError("输出路径不能与输入路径相同。")
        if input_path.suffix.lower() in {".html", ".htm"}:
            return export_html(args, input_path, output_path)
        if input_path.suffix.lower() != ".svg":
            raise ValueError("仅支持 .svg / .html / .htm 文件。")
        if args.svg_index is not None:
            raise ValueError("--svg-index 仅适用于旧 HTML。")
        svg_text = input_path.read_text(encoding="utf-8-sig")
        atomic_write(output_path, render_svg(svg_text, args.format, args.scale, args.background))
        print(f"导出成功：{output_path}")
        return 0
    except (ValueError, ET.ParseError, UnicodeError) as error:
        print(error, file=sys.stderr)
        return 2
    except (RuntimeError, OSError) as error:
        print(error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    # Chinese paths and diagnostics stay intact when the caller captures output.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
