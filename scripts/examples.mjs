import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { composeSvg } from './comparison.mjs';

// --check verifies committed deliveries without regenerating them.
const check = process.argv.includes('--check');
const names = ['overview', 'runtime-flow', 'memory-recall', 'deployment-topology', 'before', 'after'];
const stage = 'artifacts/example-build';
await mkdir(stage, { recursive: true });
await mkdir('artifacts/screenshots', { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu'] });
const report = { mode: check ? 'check' : 'generate', browser: browser.version(), platform: process.platform, examples: [], comparison: {}, errors: [] };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const run = args => execFileSync(process.execPath, args, { encoding: 'utf8', timeout: 90000 });
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, offline: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  context.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  for (const name of names) {
    console.log(`${check ? 'check' : 'generate'} ${name}`);
    const model = JSON.parse(await readFile(`examples/${name}.diagram.json`, 'utf8'));
    const html = `examples/${name}.html`;
    run(['system-blueprint/scripts/validate.mjs', `examples/${name}.diagram.json`]);
    if (!check) run(['system-blueprint/scripts/generate.mjs', `examples/${name}.diagram.json`, '--output', html, '--overwrite']);
    else {
      const candidate = `${stage}/${name}.check.html`;
      run(['system-blueprint/scripts/generate.mjs', `examples/${name}.diagram.json`, '--output', candidate, '--overwrite']);
      assert((await readFile(candidate)).equals(await readFile(html)), `${name}: HTML is stale; run npm run examples:generate`);
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(pathToFileURL(resolve(html)).href);
    await page.evaluate(() => window.blueprint.ready);
    const data = await page.evaluate(() => {
      const state = window.blueprint.getState();
      const dataElement = document.getElementById('blueprint-data');
      return { state, embedded: JSON.parse(dataElement.textContent), overflow: [...document.querySelectorAll('[data-node-id]')].flatMap(node => {
        const shape = node.querySelector('.bp-shape').getBBox();
        return [...node.querySelectorAll('[data-text-block]')].filter(text => {
          const b = text.getBBox(); return b.x < shape.x - .5 || b.y < shape.y - .5 || b.x + b.width > shape.x + shape.width + .5 || b.y + b.height > shape.y + shape.height + .5;
        }).map(text => ({ id: node.getAttribute('data-node-id'), text: text.textContent }));
      }), canvasRatio: document.getElementById('canvas').getBoundingClientRect().height / innerHeight };
    });
    assert(JSON.stringify(model) === JSON.stringify(data.embedded), `${name}: HTML source model is stale`);
    assert(!data.overflow.length, `${name}: text overflow ${JSON.stringify(data.overflow)}`);
    assert(!data.state.diagnostics.some(d => d.severity === 'error'), `${name}: geometry errors`);
    assert(data.canvasRatio >= .7, `${name}: desktop canvas below 70%`);
    await page.screenshot({ path: `artifacts/screenshots/${name}-v2-desktop.png` });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByRole('button', { name: '适应画布', exact: true }).click();
    await page.screenshot({ path: `artifacts/screenshots/${name}-v2-wide.png` });
    await page.setViewportSize({ width: 375, height: 812 });
    // Reload checks the deliberate readable initial zoom instead of carrying desktop fit.
    await page.reload(); await page.evaluate(() => window.blueprint.ready);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: narrow toolbar/page overflow`);
    await page.screenshot({ path: `artifacts/screenshots/${name}-v2-narrow.png` });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.reload(); await page.evaluate(() => window.blueprint.ready);
    await page.getByRole('button', { name: '切换深浅主题' }).click();
    await page.screenshot({ path: `artifacts/screenshots/${name}-v2-dark.png` });
    const outputs = {};
    for (const format of ['svg', 'png', 'jpg']) {
      const staged = `${stage}/${name}.${format}`, published = `images/system-blueprint-${name}.${format}`;
      if (!check) outputs[format] = JSON.parse(run(['system-blueprint/scripts/export.mjs', html, '--format', format, '--output', staged, '--overwrite']));
      const file = check ? published : staged;
      const bytes = await readFile(file);
      if (format === 'svg') {
        const xml = bytes.toString('utf8');
        assert(!/<(?:script|foreignObject)\b/.test(xml), `${name}: non-static SVG`);
        assert(xml.includes(model.title), `${name}: SVG missing title`);
        // Parse and reopen standalone SVG using an image: no access to HTML styles or scripts.
        const info = await page.evaluate(async xml => {
          const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
          if (doc.querySelector('parsererror')) throw new Error('Invalid SVG XML');
          const root = doc.documentElement;
          const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
          try { const image = new Image(); image.src = url; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight, nodes: root.querySelectorAll('.bp-node').length, edges: root.querySelectorAll('.bp-edge').length, titles: [...root.querySelectorAll('.bp-node')].map(el => el.textContent) }; }
          finally { URL.revokeObjectURL(url); }
        }, xml);
        assert(info.nodes === model.nodes.length && info.edges === model.edges.length, `${name}: static export lost model elements`);
        outputs.svg = { ...outputs.svg, ...info, bytes: bytes.length };
      } else {
        assert(bytes.subarray(0, format === 'png' ? 8 : 3).toString('hex') === (format === 'png' ? '89504e470d0a1a0a' : 'ffd8ff'), `${name}: wrong ${format} file signature`);
        const info = await page.evaluate(async ({ base64, format }) => {
          const image = new Image(); image.src = `data:image/${format === 'jpg' ? 'jpeg' : format};base64,${base64}`; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = Math.max(1, Math.round(256 * image.height / image.width));
          const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let colored = 0;
          for (let i = 0; i < pixels.length; i += 4) if (Math.abs(pixels[i] - pixels[0]) + Math.abs(pixels[i + 1] - pixels[1]) + Math.abs(pixels[i + 2] - pixels[2]) > 45) colored++;
          return { width: image.width, height: image.height, coloredPixels: colored };
        }, { base64: bytes.toString('base64'), format });
        assert(info.coloredPixels > 100, `${name}: blank ${format}`);
        assert(info.width === outputs.svg.width * 2 && info.height === outputs.svg.height * 2, `${name}: wrong default scale dimensions`);
        outputs[format] = { ...outputs[format], ...info, bytes: bytes.length };
      }
    }
    // The old README SVG is only replaced after all three staged artifacts pass.
    if (!check) for (const format of ['svg', 'png', 'jpg']) await copyFile(`${stage}/${name}.${format}`, `images/system-blueprint-${name}.${format}`);
    report.examples.push({ name, model: { nodes: model.nodes.length, edges: model.edges.length, groups: model.groups.length }, htmlBytes: (await stat(html)).size, geometry: data.state.diagnostics, canvasRatio: data.canvasRatio, outputs });
  }
  if (!check) {
    const svg = await page.evaluate(composeSvg, { before: await readFile('images/system-blueprint-before.svg', 'utf8'), after: await readFile('images/system-blueprint-after.svg', 'utf8') });
    await writeFile(`${stage}/before-after.svg`, svg);
    const raster = await browser.newContext({ deviceScaleFactor: 2, offline: true });
    const output = await raster.newPage();
    await output.setContent(`<style>html,body{margin:0}svg{display:block}</style>${svg}`);
    await output.evaluate(() => document.fonts.ready);
    const box = await output.locator('body > svg').boundingBox();
    assert(box.width * 2 <= 16000 && box.height * 2 <= 16000 && box.width * box.height * 4 <= 40000000, 'Comparison exceeds raster limit');
    await output.setViewportSize({ width: Math.ceil(box.width), height: Math.ceil(box.height) });
    for (const format of ['png', 'jpg']) await output.locator('body > svg').screenshot({ path: `${stage}/before-after.${format}`, type: format === 'png' ? 'png' : 'jpeg', ...(format === 'jpg' ? { quality: 95 } : {}) });
    await raster.close();
    for (const format of ['svg', 'png', 'jpg']) await copyFile(`${stage}/before-after.${format}`, `images/system-blueprint-before-after.${format}`);
  }
  const comparison = await readFile('images/system-blueprint-before-after.svg', 'utf8');
  report.comparison = await page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, 'image/svg+xml'), root = doc.documentElement;
    const ids = [...root.querySelectorAll('[id]')].map(el => el.id);
    const refs = [...root.querySelectorAll('*')].flatMap(el => [...el.attributes].flatMap(attr => [...attr.value.matchAll(/url\(#([^)]*)\)/g)].map(match => match[1])));
    return { width: +root.getAttribute('width'), height: +root.getAttribute('height'), uniqueIds: new Set(ids).size === ids.length, missingRefs: refs.filter(id => !ids.includes(id)), sides: [...root.querySelectorAll('[data-side]')].map(el => ({ side: el.getAttribute('data-side'), x: +el.getAttribute('x'), y: +el.getAttribute('y'), width: +el.getAttribute('width'), height: +el.getAttribute('height'), transform: el.getAttribute('transform') })) };
  }, comparison);
  assert(report.comparison.uniqueIds && !report.comparison.missingRefs.length && report.comparison.sides.length === 2 && report.comparison.sides.every(side => side.y === 64 && !side.transform), 'Comparison IDs, scale or alignment invalid');
  for (const name of ['overview', 'runtime-flow', 'memory-recall', 'deployment-topology', 'before-after']) {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.setContent(`<style>body{margin:0;background:#09111f}svg{width:100%;height:auto;display:block}</style>${await readFile(`tests/fixtures/legacy/system-blueprint-${name}.svg`, 'utf8')}`);
    await page.screenshot({ path: `artifacts/screenshots/${name}-v1.png`, fullPage: true });
  }
  const gallery = ['overview', 'runtime-flow', 'memory-recall', 'deployment-topology', 'before-after'].map(name => `<section><h2>${name}</h2><div class="pair"><figure><figcaption>v1 · 原始静态图</figcaption><a href="screenshots/${name}-v1.png"><img src="screenshots/${name}-v1.png" alt="${name} v1"></a></figure><figure><figcaption>v2 · ${name === 'before-after' ? '同尺度静态合成' : '真实阅读器截图'}</figcaption><a href="${name === 'before-after' ? '../images/system-blueprint-before-after.png' : `screenshots/${name}-v2-desktop.png`}"><img src="${name === 'before-after' ? '../images/system-blueprint-before-after.png' : `screenshots/${name}-v2-desktop.png`}" alt="${name} v2"></a></figure></div>${name === 'before-after' ? '<a href="../examples/before.html">Before 交互图</a> · <a href="../examples/after.html">After 交互图</a>' : `<a href="../examples/${name}.html">交互 HTML</a> · <a href="../images/system-blueprint-${name}.svg">完整 SVG</a> · <a href="screenshots/${name}-v2-wide.png">1920 截图</a> · <a href="screenshots/${name}-v2-narrow.png">375 截图</a> · <a href="screenshots/${name}-v2-dark.png">深色截图</a>`}</section>`).join('\n');
  await writeFile('artifacts/visual-comparison.html', `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>System Blueprint v2 新旧对比</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#f8fafc;color:#172033;max-width:1500px;margin:auto;padding:32px}a{color:#2563eb}section{margin:40px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0}figcaption{margin-bottom:8px}img{max-width:100%;border:1px solid #cbd5e1;background:white}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><h1>System Blueprint v2 · 新旧效果</h1><p>旧图为保留的 v1 SVG 在浏览器中的截图；新版为本机 Chromium 的实际截图。长图默认保留可读起点，适应画布可看全图。点击图像查看原始像素。</p><p><a href="../README.md">使用说明</a> · <a href="../docs/validation/v2-validation-report.md">验证记录</a></p>${gallery}</html>`);
  const rows = names.map(name => `| ${name} | [JSON](${name}.diagram.json) | [离线 HTML](${name}.html) | [SVG](../images/system-blueprint-${name}.svg) · [PNG](../images/system-blueprint-${name}.png) · [JPEG](../images/system-blueprint-${name}.jpg) |`);
  await writeFile('examples/README.md', ['# 示例产物索引', '', '五类共六份独立模型。下载 HTML 后可直接离线打开；GitHub README 内的 SVG 是静态图。PNG/JPEG 使用默认 scale=2，完整展开，不受阅读器视角影响。', '', '| 示例 | 可修改数据 | 交互阅读 | 静态图 |', '| --- | --- | --- | --- |', ...rows, '', 'Before / After 同尺度合成：[SVG](../images/system-blueprint-before-after.svg) · [PNG](../images/system-blueprint-before-after.png) · [JPEG](../images/system-blueprint-before-after.jpg)。', '', '[新旧效果与桌面/窄屏/深色截图](../artifacts/visual-comparison.html) · [语义迁移说明](../docs/validation/example-migration.md) · [完整验证](../docs/validation/v2-validation-report.md)', '', '重新生成：在仓库根目录执行 `npm run examples:generate`。检查已有交付：`npm run examples:check`。', ''].join('\n'));
  assert(!errors.length && !requests.length, `Unexpected browser errors or network ${JSON.stringify({ errors, requests })}`);
  report.status = 'passed'; report.externalRequests = requests; report.pageErrors = errors;
} catch (error) { report.status = 'failed'; report.errors.push(error.stack); process.exitCode = 1; }
finally { await browser.close(); await writeFile('artifacts/examples-report.json', JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, examples: report.examples.length, errors: report.errors, report: 'artifacts/examples-report.json' }, null, 2));
