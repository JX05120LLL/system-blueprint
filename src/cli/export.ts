import { createRequire } from 'node:module';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { realpath } from 'node:fs/promises';
import type { Page } from 'playwright';
import { atomicWrite, checkOutput, InputError, readInput, runCli } from './common';
import { checkRasterSize, exportHelp, parseExportOptions } from './export-options';
import { inspectHtml, prepareLegacyExport } from './legacy';

type ExportOptions = { theme?: 'light' | 'dark'; background?: string };
type BlueprintExport = { ready: Promise<unknown>; whenIdle(): Promise<unknown>; exportSvg(options?: ExportOptions): Promise<string>; prepareRasterExport(options?: ExportOptions): Promise<{ elementId: string; width: number; height: number }>; disposeExport(id: string): void };

async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('导出 30 秒内未完成，请检查渲染诊断或拆分图形。')), 30000); })]); }
  finally { clearTimeout(timer); }
}

async function loadPlaywright() {
  const skill = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const require = createRequire(resolve(skill, 'package.json'));
  try {
    const installed = await realpath(resolve(skill, 'node_modules/playwright'));
    const entry = await realpath(require.resolve('playwright'));
    const local = relative(installed, entry);
    if (local.startsWith('..') || isAbsolute(local)) throw new Error('解析到了 skill 目录之外的 Playwright。');
    return require(entry) as typeof import('playwright');
  } catch (error) {
    throw new Error(`缺少 skill 内的 Playwright，不能借用仓库根目录依赖。请执行 npm ci --prefix "${skill}"，再执行 node "${resolve(skill, 'node_modules/playwright/cli.js')}" install chromium。\n${error instanceof Error ? error.message : String(error)}`);
  }
}

async function waitForExportApi(page: Page) {
  await page.evaluate(async () => {
    const api = (window as unknown as { blueprint?: BlueprintExport }).blueprint;
    if (!api || !api.ready || typeof api.whenIdle !== 'function' || typeof api.exportSvg !== 'function' || typeof api.prepareRasterExport !== 'function' || typeof api.disposeExport !== 'function') throw new Error('v2 HTML 缺少完整 blueprint 导出接口；请重新生成 HTML。');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([(async () => { await api.ready; await api.whenIdle(); })(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('图形 30 秒内未就绪，请检查渲染诊断。')), 30000); })]);
    } finally { clearTimeout(timer); }
  });
}

runCli(async () => {
  const options = parseExportOptions(process.argv.slice(2));
  if (!options) { console.log(exportHelp); return; }
  await checkOutput(options.output, options.overwrite, options.input);
  const html = await readInput(options.input);
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu'] });
  try {
    const blocked: string[] = [];
    let context = await browser.newContext({ javaScriptEnabled: false, deviceScaleFactor: options.scale, viewport: { width: 1600, height: 1000 }, serviceWorkers: 'block' });
    await context.route('**/*', route => { blocked.push(route.request().url()); return route.abort(); });
    let page = await context.newPage(); page.setDefaultTimeout(30000);
    const inspection = await inspectHtml(page, html);
    if (inspection.resources.length) throw new InputError(`HTML 缺少自包含资源，外部资源不会被加载：\n${inspection.resources.join('\n')}`);
    const background = options.background === undefined ? undefined : await page.evaluate(value => {
      if (!CSS.supports('color', value) || /^(inherit|initial|unset|revert|currentcolor)$/i.test(value.trim())) return null;
      const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
      const rgba = ctx.getImageData(0, 0, 1, 1).data;
      if (rgba[3] !== 255) return null;
      return `#${[...rgba].slice(0, 3).map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
    }, options.background);
    if (background === null) throw new InputError('--background 必须为有效的不透明 CSS 颜色。');
    const isV2 = inspection.version != null || inspection.hasData;
    const staticOptions: ExportOptions = { theme: options.theme, background };
    let capture: { elementId: string; width: number; height: number } | undefined;
    if (isV2) {
      if (inspection.version !== '2.0' || !inspection.hasData) throw new InputError(`不支持或不完整的 v2 HTML schema 标识：${inspection.version ?? 'missing'}。`);
      if (options.svgIndex !== undefined) throw new InputError('--svg-index 仅用于 legacy HTML。');
      await context.close();
      context = await browser.newContext({ deviceScaleFactor: options.format === 'svg' ? 1 : options.scale, viewport: { width: 1600, height: 1000 }, serviceWorkers: 'block' });
      const inputUrl = pathToFileURL(options.input).href;
      await context.route('**/*', route => {
        if (route.request().url() === inputUrl) return route.continue();
        blocked.push(route.request().url()); return route.abort();
      });
      page = await context.newPage(); page.setDefaultTimeout(30000);
      await page.goto(inputUrl, { waitUntil: 'load', timeout: 30000 });
      await waitForExportApi(page);
      if (options.format === 'svg') {
        const svg = await bounded(page.evaluate(settings => (window as unknown as { blueprint: BlueprintExport }).blueprint.exportSvg(settings), staticOptions));
        if (blocked.length) throw new Error(`导出时发现外部请求：${blocked.join(', ')}`);
        await atomicWrite(options.output, svg, options.overwrite);
        console.log(JSON.stringify({ output: options.output, format: 'svg', bytes: Buffer.byteLength(svg), mode: 'v2' }));
        return;
      }
      capture = await bounded(page.evaluate(settings => (window as unknown as { blueprint: BlueprintExport }).blueprint.prepareRasterExport(settings), staticOptions));
    } else {
      if (options.format === 'svg') throw new InputError('legacy HTML 仅支持 PNG/JPEG；SVG 自动导出要求 v2 HTML。');
      if (options.theme !== undefined) throw new InputError('--theme 仅用于 v2 HTML；legacy HTML 保留原始样式。');
      if (!inspection.svgs.length) throw new InputError('legacy HTML 未找到静态内联 SVG；此入口不执行页面脚本生成图形。');
      if (options.svgIndex === undefined && inspection.svgs.length !== 1) throw new InputError(`HTML 包含多个 SVG，请用 --svg-index 选择：\n${inspection.svgs.map(svg => `${svg.index}: ${svg.label || '(无标题)'} [${svg.viewBox ?? '无 viewBox'}]`).join('\n')}`);
      const index = options.svgIndex ?? 0;
      if (index >= inspection.svgs.length) throw new InputError(`--svg-index ${index} 越界；可选索引为 0–${inspection.svgs.length - 1}。`);
      capture = await bounded(prepareLegacyExport(page, index, background));
    }
    try {
      const pixels = checkRasterSize(capture.width, capture.height, options.scale);
      // Real SVG dimensions, independent of reader viewport and transform; the full locator is captured.
      await page.setViewportSize({ width: Math.max(1, Math.min(16000, Math.ceil(capture.width))), height: Math.max(1, Math.min(16000, Math.ceil(capture.height))) });
      const target = page.locator(`[id=${JSON.stringify(capture.elementId)}]`);
      const bounds = await target.boundingBox();
      if (!bounds || Math.abs(bounds.width - capture.width) > 1 || Math.abs(bounds.height - capture.height) > 1) throw new Error('导出容器尺寸与导出接口不一致。');
      const bytes = await target.screenshot({ type: options.format === 'png' ? 'png' : 'jpeg', ...(options.format === 'png' ? {} : { quality: 95 }), animations: 'disabled', timeout: 30000 });
      if (blocked.length) throw new Error(`导出时发现外部请求：${blocked.join(', ')}`);
      await atomicWrite(options.output, bytes, options.overwrite);
      console.log(JSON.stringify({ output: options.output, format: options.format, bytes: bytes.length, width: capture.width, height: capture.height, ...pixels, scale: options.scale, mode: isV2 ? 'v2' : 'legacy' }));
    } finally {
      if (isV2 && capture) await page.evaluate(id => (window as unknown as { blueprint: BlueprintExport }).blueprint.disposeExport(id), capture.elementId);
    }
  } finally { await browser.close(); }
});
