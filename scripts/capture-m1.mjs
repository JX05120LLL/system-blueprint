import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: process.env.BLUEPRINT_BROWSER_CHANNEL || 'chrome', args: ['--disable-gpu'] });
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, offline: true });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await mkdir('artifacts/screenshots', { recursive: true });
  await page.setContent(`<style>body{margin:0;background:#09111f}svg{width:100%;height:auto;display:block}</style>${await readFile('tests/fixtures/legacy/system-blueprint-overview.svg', 'utf8')}`);
  await page.screenshot({ path: 'artifacts/screenshots/overview-v1.png', fullPage: true, timeout: 15000 });
  await page.goto(pathToFileURL(resolve('examples/overview.html')).href);
  const ready = await page.evaluate(() => window.blueprint.ready);
  const geometry = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-node-id]')];
    const overflow = nodes.flatMap(node => {
      const shape = node.querySelector('.bp-shape').getBBox();
      return [...node.querySelectorAll('[data-text-block]')].filter(text => { const box = text.getBBox(); return box.x < shape.x || box.y < shape.y || box.x + box.width > shape.x + shape.width + .5 || box.y + box.height > shape.y + shape.height + .5; }).map(text => ({ id: node.getAttribute('data-node-id'), text: text.textContent }));
    });
    return { nodes: nodes.length, arrows: document.querySelectorAll('[marker-end]').length, overflow, canvasHeight: document.getElementById('canvas').getBoundingClientRect().height, viewportHeight: innerHeight };
  });
  await page.screenshot({ path: 'artifacts/screenshots/overview-v2-m1.png' });
  await page.getByRole('button', { name: '切换深浅主题' }).click();
  await page.screenshot({ path: 'artifacts/screenshots/overview-v2-m1-dark.png' });
  await page.getByRole('button', { name: '放大', exact: true }).click();
  await page.getByRole('button', { name: '适应画布' }).click();
  const result = { stage: 'M1 visual sample (temporary simple layout)', browser: browser.version(), ready, geometry, errors };
  await writeFile('artifacts/m1-visual-check.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || geometry.overflow.length || geometry.nodes !== 5) throw Error('M1 visual geometry failure');
} finally { await browser.close(); }
