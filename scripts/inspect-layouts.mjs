import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { checkGeometry } from '../src/layout/geometry.ts';
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu'] });
const names = ['overview', 'long-text', 'nested-loops', 'deployment-cross-group', 'hidden-conditions', 'decision-shared-endpoint', 'mixed-flow', 'injection', 'parallel-control'];
const results = [];
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, offline: true });
  await mkdir('artifacts/layouts', { recursive: true });
  const page = await context.newPage();
  for (const name of names) {
    const output = resolve(`artifacts/layouts/${name}.html`);
    execFileSync(process.execPath, ['system-blueprint/scripts/generate.mjs', `tests/fixtures/${name}.diagram.json`, '--output', output, '--overwrite']);
    await page.goto(pathToFileURL(output).href);
    try {
      await page.evaluate(() => window.blueprint.ready);
      const data = await page.evaluate(() => ({ state: window.blueprint.getState(), overflow: [...document.querySelectorAll('[data-node-id]')].flatMap(node => {
        const shape = node.querySelector('.bp-shape').getBBox();
        return [...node.querySelectorAll('[data-text-block]')].filter(text => { const b = text.getBBox(); return b.x < shape.x - .5 || b.y < shape.y - .5 || b.x + b.width > shape.x + shape.width + .5 || b.y + b.height > shape.y + shape.height + .5; }).map(text => ({ id: node.getAttribute('data-node-id'), text: text.textContent }));
      }) }));
      results.push({ name, width: data.state.graph.width, height: data.state.graph.height, ms: data.state.metrics.readyMs, geometry: checkGeometry(data.state.graph), textOverflow: data.overflow });
      await page.screenshot({ path: `artifacts/screenshots/${name}-desktop.png` });
    } catch (error) { results.push({ name, error: error.message }); }
  }
  await writeFile('artifacts/layout-check.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
