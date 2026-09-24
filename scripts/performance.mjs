import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFile, mkdir, stat } from 'node:fs/promises';
import os from 'node:os';
import { makePerformanceDocument } from '../tests/fixtures/factory.ts';
await mkdir('artifacts/performance', { recursive: true });
for (const [name, counts] of [['standard', [30, 45, 3]], ['upper', [100, 300, 20]]]) {
  await writeFile(`artifacts/performance/${name}.json`, JSON.stringify(makePerformanceDocument(...counts)));
  execFileSync(process.execPath, ['system-flow/scripts/generate.mjs', `artifacts/performance/${name}.json`, '--output', `artifacts/performance/${name}.html`, '--overwrite']);
}
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu'] });
const results = { machine: { platform: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, memoryGiB: +(os.totalmem() / 2 ** 30).toFixed(1), node: process.version, browser: browser.version(), viewport: '1366x768', font: 'Segoe UI, Microsoft YaHei, Noto Sans CJK SC, sans-serif', gpu: 'disabled for reproducible Windows screenshots' }, targets: { htmlMiB: 3, readyP95Ms: 1500, collapseP95Ms: 500 }, standard: {}, upper: {} };
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, offline: true });
  const ready = [];
  for (let i = 0; i < 10; i++) {
    const page = await context.newPage();
    await page.goto(pathToFileURL(resolve('artifacts/performance/standard.html')).href);
    await page.evaluate(() => window.blueprint.ready);
    ready.push(await page.evaluate(() => window.blueprint.getState().metrics.readyMs)); await page.close();
  }
  const page = await context.newPage();
  await page.goto(pathToFileURL(resolve('artifacts/performance/standard.html')).href); await page.evaluate(() => window.blueprint.ready);
  const fontSession = await context.newCDPSession(page);
  await fontSession.send('DOM.enable'); await fontSession.send('CSS.enable');
  const { root } = await fontSession.send('DOM.getDocument');
  const { nodeId } = await fontSession.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.bp-node text' });
  results.machine.actualNodeFonts = (await fontSession.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
  await fontSession.detach();
  const collapse = [];
  for (let i = 0; i < 20; i++) collapse.push(await page.evaluate(async () => { const start = performance.now(); window.blueprint.toggleGroup('g02'); await window.blueprint.whenIdle(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return performance.now() - start; }));
  const initialRuns = await page.evaluate(() => window.blueprint.getState().layoutRuns);
  await context.tracing.start({ screenshots: true, snapshots: true });
  for (let i = 0; i < 10; i++) { await page.locator('#zoom-in').click(); await page.locator('#zoom-out').click(); }
  await page.mouse.move(400, 250); await page.mouse.down(); await page.mouse.move(520, 310, { steps: 20 }); await page.mouse.up();
  const finalRuns = await page.evaluate(() => window.blueprint.getState().layoutRuns);
  await context.tracing.stop({ path: 'artifacts/performance/zoom-pan-trace.zip' });
  const cdp = await context.newCDPSession(page);
  // A separate browser Performance trace includes task durations, not just automation actions.
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing', transferMode: 'ReportEvents' });
  const trace = []; cdp.on('Tracing.dataCollected', event => trace.push(...event.value));
  for (let i = 0; i < 5; i++) { await page.mouse.move(600, 360); await page.mouse.wheel(0, -80); await page.waitForTimeout(30); }
  const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve)); await cdp.send('Tracing.end'); await complete;
  await writeFile('artifacts/performance/zoom-pan-performance.json', JSON.stringify({ traceEvents: trace }));
  const eventDurations = trace.filter(event => event.name === 'EventDispatch' && event.dur).map(event => event.dur / 1000);
  results.standard = { bytes: (await stat('artifacts/performance/standard.html')).size, readyMs: ready, readyP95Ms: p95(ready), collapseMs: collapse, collapseP95Ms: p95(collapse), collapseTiming: 'operation to DOM commit plus two animation frames', zoomPanLayoutRuns: { before: initialRuns, after: finalRuns }, zoomPanEventDispatchMaxMs: Math.max(0, ...eventDurations) };
  await page.goto(pathToFileURL(resolve('artifacts/performance/upper.html')).href); await page.evaluate(() => window.blueprint.ready);
  await page.waitForTimeout(150);
  results.upper = await page.evaluate(() => { const state = window.blueprint.getState(); return { readyMs: state.metrics.readyMs, longTasksMs: state.metrics.longTasks, nodes: state.graph.nodes.length, edges: state.graph.edges.length, groups: state.graph.groups.length, width: state.graph.width, height: state.graph.height }; });
  await page.getByRole('button', { name: '适应画布' }).click(); await page.screenshot({ path: 'artifacts/screenshots/performance-upper.png' });
  results.upper.operations = await page.evaluate(async () => {
    const start = performance.now(); window.blueprint.toggleGroup('g02'); await window.blueprint.whenIdle();
    const collapsedMs = performance.now() - start;
    window.blueprint.toggleGroup('g02'); await window.blueprint.whenIdle();
    const state = window.blueprint.getState(), roundTripMs = performance.now() - start, exportStart = performance.now();
    const svg = await window.blueprint.exportSvg();
    const xml = new DOMParser().parseFromString(svg, 'image/svg+xml');
    return { collapseMs: collapsedMs, roundTripMs, restoredNodes: state.graph.nodes.length, restoredEdges: state.graph.edges.length, restoredGroups: state.graph.groups.length, svgMs: performance.now() - exportStart, exportedNodes: xml.querySelectorAll('.bp-node').length, exportedEdges: xml.querySelectorAll('.bp-edge').length, svgBytes: new Blob([svg]).size, longTasksMs: [...state.metrics.longTasks] };
  });
  if (results.standard.readyP95Ms > results.targets.readyP95Ms || results.standard.collapseP95Ms > results.targets.collapseP95Ms || results.standard.bytes > 3 * 2 ** 20 || initialRuns !== finalRuns || results.upper.nodes !== 100 || results.upper.edges !== 300 || results.upper.groups !== 20 || results.upper.operations.restoredNodes !== 100 || results.upper.operations.exportedEdges !== 300) throw new Error('Performance or completeness target failed; see recorded measurements.');
} catch (error) { results.error = error.message; process.exitCode = 1; }
finally { await browser.close(); await writeFile('artifacts/performance/results.json', JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2)); }
