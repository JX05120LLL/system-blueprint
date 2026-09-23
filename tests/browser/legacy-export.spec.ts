import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const outputRoot = resolve('artifacts/compatibility');
const nodeExporter = resolve('system-blueprint/scripts/export.mjs');
const pythonExporter = resolve('system-blueprint/scripts/export_diagram.py');
async function invoke(command: string, args: string[]) {
  try { const result = await execute(command, args, { encoding: 'utf8', timeout: 40000 }); return { status: 0, ...result }; }
  catch (error) { const result = error as Error & { code: number; stdout: string; stderr: string }; return { status: result.code, stdout: result.stdout, stderr: result.stderr }; }
}
test.beforeAll(async () => { await mkdir(outputRoot, { recursive: true }); });

test('V17 legacy template preserves viewBox casing and intrinsic size through Node and Python', async () => {
  const input = resolve('tests/fixtures/legacy/template.html');
  for (const [command, prefix, name] of [[process.execPath, [nodeExporter], 'node'], ['python', [pythonExporter], 'python']] as const) {
    const output = join(outputRoot, `${name}-template.png`);
    const result = await invoke(command, [...prefix, input, '--format', 'png', '--scale', '0.5', '--output', output, ...(name === 'node' ? ['--overwrite'] : [])]);
    expect(result.status, result.stderr).toBe(0);
    const bytes = await readFile(output);
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([700, 430]);
  }
  // The historical JPEG-only background default must not recolor PNG output.
  expect(await readFile(join(outputRoot, 'python-template.png'))).toEqual(await readFile(join(outputRoot, 'node-template.png')));
});

test('V17 legacy browser CSS and inherited font survive, while page scripts stay disabled', async ({ page }) => {
  const input = join(outputRoot, 'css-static.html'); const output = join(outputRoot, 'css-static.png');
  await writeFile(input, '<!doctype html><style>body{font-family:serif;background:#000}svg{width:20px}rect{fill:rgb(34,197,94)}</style><div style="background:rgba(255,255,255,.5)"><svg viewBox="0 0 200 80"><rect x="5" y="5" width="190" height="70"/><text x="30" y="45">字体 CSS</text></svg></div><script>document.querySelector("rect").style.fill="red";document.body.append(document.createElementNS("http://www.w3.org/2000/svg","svg"));</script>');
  const result = await invoke(process.execPath, [nodeExporter, input, '--format', 'png', '--scale', '1', '--output', output, '--overwrite']);
  expect(result.status, result.stderr).toBe(0);
  const base64 = (await readFile(output)).toString('base64');
  const pixel = await page.evaluate(async data => {
    const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    return { size: [image.width, image.height], color: [...ctx.getImageData(10, 10, 1, 1).data], background: [...ctx.getImageData(0, 0, 1, 1).data] };
  }, base64);
  expect(pixel).toEqual({ size: [200, 80], color: [34, 197, 94, 255], background: [128, 128, 128, 255] });
});

test('V17 R3 legacy ancestor gradients and embedded images retain their pixels and SVG-relative position', async ({ page }) => {
  const svg = '<svg width="200" height="80"><text x="10" y="40">Test</text></svg>';
  const dataImage = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><path fill="red" d="M0 0h200v80H0z"/><path fill="blue" d="M200 0h200v80H200z"/></svg>').toString('base64');
  const cases = [
    { name: 'gradient', html: `<div style="width:200px;background:linear-gradient(to right,red,blue)">${svg}</div>`, background: undefined },
    { name: 'gradient-alpha', html: `<div style="width:200px;background:linear-gradient(to right,red,blue)"><div style="background:rgba(255,255,255,.5)">${svg}</div></div>`, background: undefined },
    { name: 'embedded-image-offset', html: `<div style="width:400px;background-image:url(data:image/svg+xml;base64,${dataImage})"><svg width="200" height="80" style="margin-left:125px;width:100px;height:40px"><text x="10" y="40">Test</text></svg></div>`, background: undefined },
    { name: 'explicit-background', html: `<div style="width:200px;background:linear-gradient(to right,red,blue)">${svg}</div>`, background: '#00ff00' },
  ];
  const pixels = [];
  for (const fixture of cases) {
    const input = join(outputRoot, `r3-${fixture.name}.html`); const output = join(outputRoot, `r3-${fixture.name}.png`);
    await writeFile(input, `<!doctype html>${fixture.html}`);
    const result = await invoke(process.execPath, [nodeExporter, input, '--format', 'png', '--scale', '1', '--output', output, '--overwrite', ...(fixture.background ? ['--background', fixture.background] : [])]);
    expect(result.status, result.stderr).toBe(0);
    const actual = await page.evaluate(async data => {
      const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
      const rgba = ctx.getImageData(0, 0, image.width, image.height).data;
      let darkPixels = 0;
      for (let i = 0; i < rgba.length; i += 4) if (rgba[i]! < 40 && rgba[i + 1]! < 40 && rgba[i + 2]! < 40) darkPixels++;
      return { size: [image.width, image.height], left: [...ctx.getImageData(2, 60, 1, 1).data], middle: [...ctx.getImageData(100, 60, 1, 1).data], right: [...ctx.getImageData(197, 60, 1, 1).data], darkPixels };
    }, (await readFile(output)).toString('base64'));
    pixels.push({ name: fixture.name, ...actual });
    expect(actual.size).toEqual([200, 80]); expect(actual.darkPixels).toBeGreaterThan(15);
    if (fixture.name === 'explicit-background') {
      expect(actual.left).toEqual([0, 255, 0, 255]); expect(actual.right).toEqual([0, 255, 0, 255]);
    } else if (fixture.name === 'gradient-alpha') {
      expect(actual.left[0]).toBeGreaterThan(250); expect(actual.left[1]).toBe(128); expect(actual.left[2]).toBeLessThan(133);
      expect(actual.right[0]).toBeLessThan(133); expect(actual.right[1]).toBe(128); expect(actual.right[2]).toBeGreaterThan(250);
    } else {
      expect(actual.left[0]).toBeGreaterThan(245); expect(actual.left[1]).toBe(0); expect(actual.left[2]).toBeLessThan(10);
      expect(actual.right[0]).toBeLessThan(10); expect(actual.right[1]).toBe(0); expect(actual.right[2]).toBeGreaterThan(245);
      if (fixture.name === 'embedded-image-offset') expect(actual.middle).toEqual([255, 0, 0, 255]);
    }
  }
  await writeFile(join(outputRoot, 'r3-background-pixels.json'), JSON.stringify(pixels, null, 2));
});

test('V17 legacy multiple SVGs require selection and prohibit SVG export', async () => {
  const input = join(outputRoot, 'multiple.html'); const output = join(outputRoot, 'second.png');
  await writeFile(input, '<svg viewBox="0 0 100 40" aria-label="first"></svg><svg viewBox="0 0 200 90" aria-label="second"></svg>');
  const noIndex = await invoke(process.execPath, [nodeExporter, input, '--format', 'png', '--output', output, '--overwrite']);
  expect(noIndex.status).toBe(2); expect(noIndex.stderr).toContain('--svg-index'); expect(noIndex.stderr).toContain('1: second');
  const selected = await invoke(process.execPath, [nodeExporter, input, '--format', 'png', '--scale', '1', '--svg-index', '1', '--output', output, '--overwrite']);
  expect(selected.status, selected.stderr).toBe(0);
  const bytes = await readFile(output); expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([200, 90]);
  const outOfRange = await invoke(process.execPath, [nodeExporter, input, '--format', 'png', '--svg-index', '2', '--output', output, '--overwrite']);
  expect(outOfRange.status).toBe(2);
  const svg = await invoke(process.execPath, [nodeExporter, input, '--format', 'svg', '--output', join(outputRoot, 'legacy.svg'), '--overwrite']);
  expect(svg.status).toBe(2); expect(svg.stderr).toContain('v2 HTML');
});

test('V17 legacy fails explicitly for remote and missing sibling resources', async () => {
  for (const [name, content] of [['remote', '<svg viewBox="0 0 10 10"><image href="https://example.com/private.png"/></svg>'], ['local', '<link rel="stylesheet" href="missing.css"><svg viewBox="0 0 10 10"></svg>']] as const) {
    const input = join(outputRoot, `${name}.html`); await writeFile(input, content);
    const result = await invoke(process.execPath, [nodeExporter, input, '--format', 'png', '--output', join(outputRoot, `${name}.png`), '--overwrite']);
    expect(result.status).toBe(2); expect(result.stderr).toContain('自包含');
  }
});

test('V12 legacy refuses over-limit bitmaps and v2 missing API fails without hanging', async () => {
  const input = join(outputRoot, 'huge.html'); await writeFile(input, '<svg viewBox="0 0 9000 20"></svg>');
  const huge = await invoke(process.execPath, [nodeExporter, input, '--format', 'png', '--output', join(outputRoot, 'huge.png'), '--overwrite']);
  expect(huge.status).toBe(2); expect(huge.stderr).toContain('降低 --scale');
  const broken = join(outputRoot, 'missing-api.html'); await writeFile(broken, '<meta name="system-blueprint" content="2.0"><script id="blueprint-data" type="application/json">{"schemaVersion":"2.0"}</script>');
  const started = Date.now();
  const missing = await invoke(process.execPath, [nodeExporter, broken, '--format', 'svg', '--output', join(outputRoot, 'missing.svg'), '--overwrite']);
  expect(missing.status).toBe(1); expect(missing.stderr).toContain('导出接口'); expect(Date.now() - started).toBeLessThan(15000);
});

test('V17 Python SVG keeps overwrite behavior and encodes real JPEG with explicit background', async ({ page }) => {
  const input = join(outputRoot, 'python-source.svg'); const output = join(outputRoot, 'python-source.jpeg');
  await writeFile(input, '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect x="20" y="20" width="20" height="20" fill="blue"/></svg>');
  await writeFile(output, 'previous');
  const result = await invoke('python', [pythonExporter, input, '--format', 'jpg', '--scale', '1', '--output', output, '--background', '#ffffff']);
  expect(result.status, result.stderr).toBe(0);
  const bytes = await readFile(output); expect(bytes.subarray(0, 3).toString('hex')).toBe('ffd8ff');
  const size = await page.evaluate(async data => { const image = new Image(); image.src = `data:image/jpeg;base64,${data}`; await image.decode(); return [image.width, image.height]; }, bytes.toString('base64'));
  expect(size).toEqual([100, 60]);
  const conflict = await invoke('python', [pythonExporter, input, '--format', 'jpg', '--output', join(outputRoot, 'invalid.png')]);
  expect(conflict.status).toBe(2);
});

test('V12 Python applies bitmap limit to CSS-computed SVG dimensions before Cairo allocation', async () => {
  const input = join(outputRoot, 'css-oversize.svg');
  await writeFile(input, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" style="width:16001px;height:1px"></svg>');
  const result = await invoke('python', [pythonExporter, input, '--format', 'png', '--scale', '1', '--output', join(outputRoot, 'css-oversize.png')]);
  expect(result.status).toBe(2); expect(result.stderr).toContain('降低 --scale');
});

test('V15 v2 CLI creates independently readable SVG, PNG and JPEG with matching dimensions', async ({ page }) => {
  const input = join(outputRoot, 'v2-format.html');
  const generated = await invoke(process.execPath, [resolve('system-blueprint/scripts/generate.mjs'), resolve('examples/overview.diagram.json'), '--output', input, '--overwrite']);
  expect(generated.status, generated.stderr).toBe(0);
  const svgPath = join(outputRoot, 'v2-format.svg');
  const svgResult = await invoke(process.execPath, [nodeExporter, input, '--format', 'svg', '--output', svgPath, '--overwrite']);
  expect(svgResult.status, svgResult.stderr).toBe(0);
  const svg = await readFile(svgPath, 'utf8');
  expect(svg).toContain('viewBox='); expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(svg).not.toMatch(/<script|<foreignObject|https?:\/\/(?!www.w3.org\/)/);
  await page.goto(`file:///${svgPath.replaceAll('\\', '/')}`);
  const dimensions = await page.locator('svg').first().evaluate(svg => ({ width: Number(svg.getAttribute('width')), height: Number(svg.getAttribute('height')) }));
  expect(await page.locator('text').count()).toBeGreaterThan(5);
  await page.goto('about:blank');
  for (const format of ['png', 'jpg'] as const) {
    const scale = format === 'png' ? 1.2 : 1.5;
    const output = join(outputRoot, `v2-format.${format}`);
    const result = await invoke(process.execPath, [nodeExporter, input, '--format', format, '--scale', String(scale), '--background', 'white', '--output', output, '--overwrite']);
    expect(result.status, result.stderr).toBe(0);
    const bytes = await readFile(output);
    expect(bytes.subarray(0, format === 'png' ? 8 : 3).toString('hex')).toBe(format === 'png' ? '89504e470d0a1a0a' : 'ffd8ff');
    const actual = await page.evaluate(async ({ data, format }) => {
      const image = new Image(); image.src = `data:image/${format === 'jpg' ? 'jpeg' : format};base64,${data}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
      return { width: image.width, height: image.height, background: [...ctx.getImageData(1, 1, 1, 1).data] };
    }, { data: bytes.toString('base64'), format });
    expect(actual.width).toBe(Math.round(dimensions.width * scale));
    expect(actual.height).toBe(Math.round(dimensions.height * scale));
    const metadata = JSON.parse(result.stdout);
    expect([metadata.pixelWidth, metadata.pixelHeight]).toEqual([actual.width, actual.height]);
    expect(actual.background).toEqual([255, 255, 255, 255]);
  }
});
