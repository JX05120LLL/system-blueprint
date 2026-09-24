import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const check = process.argv.includes('--check');
const names = ['traditional-microservices', 'traditional-microservices-order-flow'];
const stage = 'artifacts/example-build';
const reportPath = check ? 'artifacts/examples-check-report.json' : 'artifacts/examples-generate-report.json';
const run = args => execFileSync(process.execPath, args, { encoding: 'utf8', timeout: 90000 });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
await mkdir(stage, { recursive: true });
await mkdir('images', { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu'] });
const report = { mode: check ? 'check' : 'generate', browser: browser.version(), platform: process.platform, examples: [], errors: [] };
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, offline: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  context.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  for (const name of names) {
    console.log(`${check ? 'check' : 'generate'} ${name}`);
    const source = `examples/${name}.diagram.json`;
    const html = `examples/${name}.html`;
    const model = JSON.parse(await readFile(source, 'utf8'));
    run(['system-flow/scripts/validate.mjs', source]);
    if (check) {
      const candidate = `${stage}/${name}.check.html`;
      run(['system-flow/scripts/generate.mjs', source, '--output', candidate, '--overwrite']);
      assert((await readFile(candidate)).equals(await readFile(html)), `${name}: HTML is stale; run npm run examples:generate`);
    } else {
      run(['system-flow/scripts/generate.mjs', source, '--output', html, '--overwrite']);
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(pathToFileURL(resolve(html)).href);
    await page.evaluate(() => window.blueprint.ready);
    const data = await page.evaluate(() => {
      const state = window.blueprint.getState();
      const embedded = JSON.parse(document.getElementById('blueprint-data').textContent);
      const overflow = [...document.querySelectorAll('[data-node-id]')].flatMap(node => {
        const shape = node.querySelector('.bp-shape').getBBox();
        return [...node.querySelectorAll('[data-text-block]')].filter(text => {
          const box = text.getBBox();
          return box.x < shape.x - .5 || box.y < shape.y - .5 || box.x + box.width > shape.x + shape.width + .5 || box.y + box.height > shape.y + shape.height + .5;
        }).map(text => ({ id: node.getAttribute('data-node-id'), text: text.textContent }));
      });
      return { state, embedded, overflow, canvasRatio: document.getElementById('canvas').getBoundingClientRect().height / innerHeight };
    });
    assert(JSON.stringify(model) === JSON.stringify(data.embedded), `${name}: HTML source model is stale`);
    assert(!data.overflow.length, `${name}: text overflow ${JSON.stringify(data.overflow)}`);
    assert(!data.state.diagnostics.some(d => d.severity === 'error'), `${name}: geometry errors`);
    assert(data.canvasRatio >= .7, `${name}: desktop canvas below 70%`);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByRole('button', { name: '适应画布', exact: true }).click();
    if (!check && name === 'traditional-microservices') await page.screenshot({ path: 'images/traditional-microservices-preview.png' });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await page.evaluate(() => window.blueprint.ready);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: narrow viewport overflows`);
    const outputs = {};
    for (const format of ['svg', 'png', 'jpg']) {
      const staged = `${stage}/${name}.${format}`;
      run(['system-flow/scripts/export.mjs', html, '--format', format, '--output', staged, '--overwrite']);
      const bytes = await readFile(staged);
      if (format === 'svg') {
        const xml = bytes.toString('utf8');
        assert(!/<(?:script|foreignObject)\b/.test(xml) && xml.includes(model.title), `${name}: invalid standalone SVG`);
        const info = await page.evaluate(async xml => {
          const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
          if (doc.querySelector('parsererror')) throw new Error('Invalid SVG XML');
          const root = doc.documentElement;
          const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
          try {
            const image = new Image(); image.src = url; await image.decode();
            return { width: image.naturalWidth, height: image.naturalHeight, nodes: root.querySelectorAll('.bp-node').length, edges: root.querySelectorAll('.bp-edge').length };
          } finally { URL.revokeObjectURL(url); }
        }, xml);
        assert(info.nodes === model.nodes.length && info.edges === model.edges.length, `${name}: static SVG lost model elements`);
        outputs.svg = { ...info, bytes: bytes.length };
      } else {
        assert(bytes.subarray(0, format === 'png' ? 8 : 3).toString('hex') === (format === 'png' ? '89504e470d0a1a0a' : 'ffd8ff'), `${name}: wrong ${format} signature`);
        const info = await page.evaluate(async ({ base64, format }) => {
          const image = new Image(); image.src = `data:image/${format === 'jpg' ? 'jpeg' : format};base64,${base64}`; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = Math.max(1, Math.round(256 * image.height / image.width));
          const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let colored = 0;
          for (let i = 0; i < pixels.length; i += 4) if (Math.abs(pixels[i] - pixels[0]) + Math.abs(pixels[i + 1] - pixels[1]) + Math.abs(pixels[i + 2] - pixels[2]) > 45) colored++;
          return { width: image.width, height: image.height, coloredPixels: colored };
        }, { base64: bytes.toString('base64'), format });
        assert(info.coloredPixels > 100, `${name}: blank ${format}`);
        assert(info.width === outputs.svg.width * 2 && info.height === outputs.svg.height * 2, `${name}: wrong ${format} dimensions`);
        outputs[format] = { ...info, bytes: bytes.length };
      }
    }
    report.examples.push({ name, model: { nodes: model.nodes.length, edges: model.edges.length, groups: model.groups.length }, htmlBytes: (await stat(html)).size, geometry: data.state.diagnostics, canvasRatio: data.canvasRatio, outputs });
  }
  assert((await stat('images/traditional-microservices-preview.png')).size > 1000, 'README preview is missing');
  assert(!errors.length && !requests.length, `Unexpected browser errors or network ${JSON.stringify({ errors, requests })}`);
  report.status = 'passed'; report.externalRequests = requests; report.pageErrors = errors;
  await context.close();
} catch (error) { report.status = 'failed'; report.errors.push(error.stack); process.exitCode = 1; }
finally { await browser.close(); await writeFile(reportPath, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, examples: report.examples.length, errors: report.errors, report: reportPath }, null, 2));
