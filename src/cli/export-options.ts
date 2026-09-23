import { extname, resolve } from 'node:path';
import { InputError, parseArguments, requireExtension } from './common';

export const exportHelp = `用法：node export.mjs input.html --format svg|png|jpg|jpeg [--output file] [--scale 2] [--background '#FFFFFF'] [--theme light|dark] [--svg-index 0] [--overwrite]
依赖：在 skill 目录 npm ci，再运行 node node_modules/playwright/cli.js install chromium。
SVG 仅支持 v2 HTML，不接受 --scale。位图 scale 为 0.5–4；默认 2。
legacy HTML 仅支持静态、自包含的内联 SVG；不执行页面脚本。多个 SVG 时必须 --svg-index。
新入口默认禁止覆盖；Python 兼容入口保留覆盖行为。`;

export function parseExportOptions(argv: string[]) {
  const args = parseArguments(argv, ['--format', '--output', '--scale', '--background', '--theme', '--svg-index'], ['--overwrite']);
  if (args.flags.has('--help')) return undefined;
  const format = args.values.get('--format');
  if (!args.input || !format || !['svg', 'png', 'jpg', 'jpeg'].includes(format)) throw new InputError(exportHelp);
  requireExtension(args.input, ['.html', '.htm']);
  if (format === 'svg' && args.values.has('--scale')) throw new InputError('SVG 是矢量格式，不能指定 --scale。');
  const scale = Number(args.values.get('--scale') ?? 2);
  if (!Number.isFinite(scale) || scale < 0.5 || scale > 4) throw new InputError('--scale 必须为 0.5–4 的有限数值。');
  const theme = args.values.get('--theme');
  if (theme !== undefined && theme !== 'light' && theme !== 'dark') throw new InputError('--theme 必须为 light 或 dark。');
  const index = args.values.get('--svg-index');
  if (index !== undefined && !/^\d+$/.test(index)) throw new InputError('--svg-index 必须为从 0 开始的非负整数。');
  const svgIndex = index === undefined ? undefined : Number(index);
  if (svgIndex !== undefined && !Number.isSafeInteger(svgIndex)) throw new InputError('--svg-index 超出有效整数范围。');
  const input = resolve(args.input);
  const output = resolve(args.values.get('--output') ?? `${input.slice(0, -extname(input).length)}.${format === 'jpeg' ? 'jpg' : format}`);
  requireExtension(output, format === 'jpg' || format === 'jpeg' ? ['.jpg', '.jpeg'] : [`.${format}`]);
  return { input, output, format: format as 'svg' | 'png' | 'jpg' | 'jpeg', scale, theme: theme as 'light' | 'dark' | undefined, background: args.values.get('--background'), svgIndex, overwrite: args.flags.has('--overwrite') };
}

export function checkRasterSize(width: number, height: number, scale: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('导出图形没有有效的正数尺寸。');
  const pixelWidth = Math.ceil(width * scale); const pixelHeight = Math.ceil(height * scale);
  if (pixelWidth > 16000 || pixelHeight > 16000 || pixelWidth * pixelHeight > 40000000) throw new InputError(`位图尺寸 ${pixelWidth}×${pixelHeight} 超过单边 16000 / 总像素 40000000 限制；请降低 --scale 或拆图。`);
  // Chromium rounds screenshot device pixels; ceil above deliberately makes limit checks conservative.
  return { pixelWidth: Math.round(width * scale), pixelHeight: Math.round(height * scale) };
}
