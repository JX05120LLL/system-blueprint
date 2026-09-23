import { test, expect } from '@playwright/test';
import { capture, chooseNode, idle, openFixture, relatedEdgeIds, relatedNodeIds, renderedTextOverflow, state, toggle, type ReaderApi } from './helpers';

test('V16 readable narrow initial view centers the entry node even with feedback lanes', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openFixture(page, 'nested-loops');
  const box = await page.locator('[data-node-id="start"]').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  expect(Math.abs(box!.x + box!.width / 2 - 187.5)).toBeLessThan(1);
});

test('V05 hiding a selected child group maps details and focus to the visible parent', async ({ page }) => {
  await openFixture(page, 'nested-loops');
  await page.locator('[data-group-id="child"]').focus(); await page.keyboard.press('Enter');
  expect((await state(page)).selected).toEqual({ kind: 'group', id: 'child' });
  await toggle(page, 'parent');
  expect((await state(page)).selected).toEqual({ kind: 'group', id: 'parent' });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-group-toggle-node="parent"]')).toBeFocused();
});

test('V15 explicit export background covers the diagram as well as its title margin', async ({ page }) => {
  await openFixture(page, 'single-node');
  const backgrounds = await page.evaluate(async () => {
    const xml = await (window as unknown as { blueprint: ReaderApi }).blueprint.exportSvg({ background: '#FFFFFF' });
    const svg = new DOMParser().parseFromString(xml, 'image/svg+xml');
    return [...svg.querySelectorAll('svg > rect:first-of-type')].map(rect => rect.getAttribute('fill'));
  });
  expect(backgrounds.length).toBeGreaterThanOrEqual(2);
  expect(new Set(backgrounds)).toEqual(new Set(['#FFFFFF']));
});

test('V16 details keyboard collapse and edge close restore visible graph focus', async ({ page }) => {
  await openFixture(page, 'nested-loops');
  await page.locator('[data-group-id="child"]').focus(); await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-group-id="child"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '折叠分组', exact: true }).focus(); await page.keyboard.press('Enter'); await idle(page);
  await expect(page.locator('[data-group-toggle-node="child"]')).toBeFocused();
  await page.keyboard.press('Escape');
  const edge = page.locator('[data-edge-id]').first();
  await edge.focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '关闭详情' }).focus(); await page.keyboard.press('Enter');
  await expect(edge).toBeFocused();
});

test('V01 single node fits, opens meaningful details and stays offline', async ({ page }, info) => {
  const opened = await openFixture(page, 'single-node');
  await expect(page.locator('#scene [data-node-id]')).toHaveCount(1);
  await expect(page.locator('#scene [data-edge-id]')).toHaveCount(0);
  const initial = await state(page);
  for (const value of Object.values(initial.transform)) expect(Number.isFinite(value)).toBe(true);
  expect(initial.graph.width).toBeGreaterThan(0); expect(initial.graph.height).toBeGreaterThan(0);
  await page.locator('#canvas').focus(); await page.keyboard.press('Tab');
  await expect(page.locator('[data-node-id="only"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#details')).toContainText('独立组件');
  await expect(page.locator('#details')).toContainText('无需依赖其他节点');
  await page.getByRole('button', { name: '关闭详情' }).click();
  await expect(page.locator('[data-node-id="only"]')).toBeFocused();
  await page.getByRole('button', { name: '适应画布', exact: true }).click();
  const svg = await page.evaluate(() => (window as unknown as { blueprint: ReaderApi }).blueprint.exportSvg());
  expect(svg).toContain('独立组件'); expect(svg).toContain('viewBox=');
  expect(opened.network).toEqual([]); expect(opened.pageErrors).toEqual([]);
  await capture(page, info, 'single-node-offline');
});

test('V02 real Chinese and identifier wrapping retains text at normal font sizes', async ({ page }, info) => {
  await openFixture(page, 'long-text');
  const graph = (await state(page)).graph;
  const chinese = graph.nodes.find(node => node.id === 'chinese')!;
  const identifier = graph.nodes.find(node => node.id === 'identifier')!;
  expect(chinese.titleText.lines).toHaveLength(2);
  expect(chinese.titleText.lines.join('')).toBe('中文请求与历史上下文完整性检查');
  expect(identifier.titleText.lines).toHaveLength(2);
  expect(identifier.titleText.lines.join('')).toBe('RequestContextNormalizationService');
  expect(chinese.summaryText.lines).toHaveLength(2);
  expect(identifier.summaryText.lines).toHaveLength(2);
  expect(await renderedTextOverflow(page)).toEqual([]);
  const sizes = await page.locator('#scene [data-node-id] text[data-text-block]').evaluateAll(elements => elements.map(element => Number(element.getAttribute('font-size'))));
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(13);
  await capture(page, info, 'long-text-light');
  await page.getByRole('button', { name: '切换深浅主题' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');
  expect(await renderedTextOverflow(page)).toEqual([]);
  await capture(page, info, 'long-text-dark');
});

test('V02 overlong visible title reports the node and field instead of shrinking or truncating', async ({ page }) => {
  await openFixture(page, 'single-node', { mutate: document => { document.nodes[0]!.label = '必须保留的完整中文条件'.repeat(15); }, expectFailure: true });
  const result = await page.evaluate(async () => {
    try { await (window as unknown as { blueprint: ReaderApi }).blueprint.ready; return { rejected: false, message: '' }; }
    catch (error) { return { rejected: true, message: error instanceof Error ? error.message : String(error) }; }
  });
  expect(result.rejected).toBe(true);
  expect(result.message).toContain('only'); expect(result.message).toContain('/nodes/0/label');
  expect(result.message).toContain('最多 2 行');
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#scene [data-node-id]')).toHaveCount(0);
});

test('V03 V06 shared endpoints keep two visible conditions and edge details through collapse', async ({ page }, info) => {
  await openFixture(page, 'decision-shared-endpoint');
  for (const [id, label] of [['success', '成功'], ['failure', '失败']]) {
    await expect(page.locator(`[data-label-edge-id="${id}"]`)).toContainText(label!);
    await expect(page.locator(`[data-edge-id="${id}"] .bp-edge-line`)).toHaveAttribute('marker-end', /url\(#/);
  }
  await page.getByRole('button', { name: '折叠 请求校验', exact: true }).click();
  await idle(page);
  const graph = (await state(page)).graph;
  const conditionEdges = graph.edges.filter(edge => edge.originalEdgeIds.some(id => id === 'success' || id === 'failure'));
  expect(conditionEdges).toHaveLength(2);
  expect(conditionEdges.map(edge => edge.label).sort()).toEqual(['失败', '成功']);
  expect(new Set(conditionEdges.map(edge => edge.source)).size).toBe(1);
  expect(new Set(conditionEdges.map(edge => edge.target)).size).toBe(1);
  const success = conditionEdges.find(edge => edge.label === '成功')!;
  await page.locator(`[data-edge-id="${success.id}"]`).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#details')).toContainText('success');
  await expect(page.locator('#details')).toContainText('返回校验成功及已解析的字段');
  await expect(page.locator('#details').getByRole('button', { name: '上游', exact: true })).toHaveCount(0);
  expect(await relatedEdgeIds(page)).toEqual([success.id]);
  await capture(page, info, 'shared-conditions-edge-details');
});

test('V04 cycle traversal terminates with correct upstream and downstream relations', async ({ page }) => {
  await openFixture(page, 'nested-loops');
  await expect(page.locator('[data-edge-id="self-loop"] .bp-edge-line')).toHaveAttribute('marker-end', /url\(#/);
  await chooseNode(page, 'work');
  await page.locator('#details').getByRole('button', { name: '下游', exact: true }).click();
  expect(await relatedNodeIds(page)).toEqual(['audit', 'check', 'end', 'work']);
  expect(await relatedEdgeIds(page)).toEqual(['allowed', 'audit', 'complete', 'denied', 'retry', 'self-loop']);
  await page.locator('#details').getByRole('button', { name: '上游', exact: true }).click();
  expect(await relatedNodeIds(page)).toEqual(['check', 'start', 'work']);
  expect(await relatedEdgeIds(page)).toEqual(['allowed', 'enter', 'retry']);
  await page.keyboard.press('Escape');
  await expect(page.locator('#details')).toBeHidden();
  await expect(page.locator('[data-node-id="work"]')).toBeFocused();
  await expect(page.locator('#scene .bp-related')).toHaveCount(0);
});

test('V06 aggregate edge details enumerate every original relation with matching conditions', async ({ page }) => {
  await openFixture(page, 'decision-shared-endpoint', { mutate: document => {
    document.nodes.push({ id: 'worker', kind: 'process', label: '补充处理', groupId: 'checks', evidenceStatus: 'confirmed' });
    document.edges.push(
      { id: 'route-worker', source: 'check', target: 'worker', kind: 'control', directed: true, label: '补充检查' },
      { id: 'success-copy', source: 'worker', target: 'result', kind: 'control', directed: true, label: '成功', details: '第二条独立原始关系的具体说明。' },
    );
  } });
  await toggle(page, 'checks');
  const aggregate = (await state(page)).graph.edges.find(edge => edge.label === '成功')!;
  expect(aggregate.originalEdgeIds).toEqual(['success', 'success-copy']);
  await page.locator(`[data-edge-id="${aggregate.id}"]`).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#details').getByRole('heading', { name: 'success', exact: true })).toBeVisible();
  await expect(page.locator('#details').getByRole('heading', { name: 'success-copy', exact: true })).toBeVisible();
  await expect(page.locator('#details')).toContainText('返回校验成功及已解析的字段');
  await expect(page.locator('#details')).toContainText('第二条独立原始关系的具体说明');
  await expect(page.locator('#details').getByRole('button', { name: '下游', exact: true })).toHaveCount(0);
});

test('V05 V16 nested keyboard collapse restores child state and moves hidden-node focus safely', async ({ page }, info) => {
  const opened = await openFixture(page, 'nested-loops');
  const sourceBefore = await page.locator('#blueprint-data').textContent();
  await chooseNode(page, 'work');
  await toggle(page, 'child');
  expect((await state(page)).selected).toMatchObject({ kind: 'group', id: 'child' });
  await expect(page.locator('[data-node-id="work"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-group-toggle-node="child"]')).toBeFocused();
  const parentToggle = page.locator('[data-group-toggle="parent"]');
  await parentToggle.focus(); await page.keyboard.press('Space'); await idle(page);
  expect((await state(page)).collapsedGroups.sort()).toEqual(['child', 'parent']);
  await expect(page.locator('[data-group-id="child"]')).toHaveCount(0);
  await capture(page, info, 'nested-parent-collapsed');
  await page.locator('[data-group-toggle="parent"]').focus(); await page.keyboard.press('Enter'); await idle(page);
  expect((await state(page)).collapsedGroups).toEqual(['child']);
  await expect(page.locator('[data-group-toggle-node="child"]')).toBeVisible();
  await expect(page.locator('[data-group-id="parent"]')).toBeVisible();
  await expect(page.locator('[data-group-toggle="child"]')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('[data-group-toggle="child"]').focus(); await page.keyboard.press('Enter'); await idle(page);
  expect((await state(page)).graph.edges.map(edge => edge.originalEdgeIds).flat().sort()).toEqual(opened.document.edges.map(edge => edge.id).sort());
  expect(await page.locator('#blueprint-data').textContent()).toBe(sourceBefore);
  await expect(page.locator('[data-group-toggle="child"]')).toHaveAttribute('aria-expanded', 'true');
});

test('V07 latest rapid collapse and theme actions win without mutating the original model', async ({ page }) => {
  await openFixture(page, 'nested-loops');
  const before = await page.locator('#blueprint-data').textContent();
  const result = await page.evaluate(async () => {
    const api = (window as unknown as { blueprint: ReaderApi }).blueprint;
    const initialRuns = api.getState().layoutRuns;
    for (const id of ['child', 'parent', 'child', 'parent', 'child', 'parent', 'child', 'parent', 'child']) api.toggleGroup(id);
    for (let i = 0; i < 3; i++) document.getElementById('theme')!.click();
    await api.whenIdle();
    const current = api.getState();
    return { revision: current.revision, committed: current.committedRevision, runs: current.layoutRuns - initialRuns, groups: current.collapsedGroups, nodes: current.graph.nodes.map(node => ({ id: node.id, group: node.originalGroupId })), theme: current.theme };
  });
  expect(result.revision).toBe(result.committed);
  expect(result.groups).toEqual(['child']); expect(result.theme).toBe('dark');
  expect(result.runs).toBeLessThanOrEqual(2); expect(result.runs).toBeGreaterThan(0);
  expect(result.nodes).toHaveLength(4); expect(result.nodes.some(node => node.group === 'child')).toBe(true);
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('[data-group-toggle-node="child"]')).toBeVisible();
  await expect(page.locator('#error')).toBeHidden();
  expect(await page.locator('#blueprint-data').textContent()).toBe(before);
});

test('V07 failed collapsed measurement retains the last graph and recovers on reset', async ({ page }) => {
  await openFixture(page, 'decision-shared-endpoint', { mutate: document => {
    // Fits the expanded group heading, exceeds the narrower collapsed node title.
    document.groups[0]!.label = '校验处理分组包含需要保留的完整中文职责说明';
  } });
  const before = await state(page);
  const failure = await page.evaluate(async () => {
    const api = (window as unknown as { blueprint: ReaderApi }).blueprint;
    api.toggleGroup('checks');
    try { await api.whenIdle(); return ''; }
    catch (error) { return error instanceof Error ? error.message : String(error); }
  });
  expect(failure).toContain('最多 2 行');
  expect(failure).toContain('/groups/0/label');
  expect(failure).toContain('checks');
  expect(failure).not.toContain('__blueprint_group_');
  await expect(page.locator('#error')).toBeVisible();
  const failed = await state(page);
  expect(failed.graph.nodes.map(node => node.id)).toEqual(before.graph.nodes.map(node => node.id));
  expect(failed.committedRevision).toBe(before.committedRevision);
  expect(failed.revision).toBeGreaterThan(failed.committedRevision);
  await page.getByRole('button', { name: '重置视图', exact: true }).click(); await idle(page);
  await expect(page.locator('#error')).toBeHidden();
  expect((await state(page)).collapsedGroups).toEqual([]);
  expect((await state(page)).graph.nodes.map(node => node.id)).toEqual(['start', 'check', 'result']);
});

test('V08 zoom and pan do not relayout; export is complete and leaves reader state untouched', async ({ page }) => {
  await openFixture(page, 'hidden-conditions');
  const initial = await state(page);
  await page.getByRole('button', { name: '放大', exact: true }).click();
  const canvas = await page.locator('#canvas').boundingBox();
  expect(canvas).not.toBeNull();
  await page.mouse.move(canvas!.x + 15, canvas!.y + 15); await page.mouse.down();
  await page.mouse.move(canvas!.x + 85, canvas!.y + 65, { steps: 8 }); await page.mouse.up();
  const beforeExport = await state(page);
  expect(beforeExport.layoutRuns).toBe(initial.layoutRuns);
  expect(beforeExport.transform).not.toEqual(initial.transform);
  const exported = await page.evaluate(async () => {
    const api = (window as unknown as { blueprint: ReaderApi }).blueprint;
    const svg = new DOMParser().parseFromString(await api.exportSvg(), 'image/svg+xml');
    return { nodes: svg.querySelectorAll('[data-node-id]').length, edges: svg.querySelectorAll('[data-edge-id]').length, text: svg.documentElement.textContent, controls: svg.querySelectorAll('[data-group-toggle],button,#details,.bp-selected,.bp-related').length, viewBox: svg.documentElement.getAttribute('viewBox'), width: Number(svg.documentElement.getAttribute('width')), height: Number(svg.documentElement.getAttribute('height')) };
  });
  expect(exported.nodes).toBe(6); expect(exported.edges).toBe(6); expect(exported.controls).toBe(0);
  expect(exported.text).toContain('通过'); expect(exported.text).toContain('不通过');
  expect(exported.width).toBeGreaterThan(0); expect(exported.height).toBeGreaterThan(0); expect(exported.viewBox).toMatch(/^0 0 /);
  const afterExport = await state(page);
  expect(afterExport.transform).toEqual(beforeExport.transform);
  expect(afterExport.collapsedGroups).toEqual(['processing']);
  expect(afterExport.layoutRuns).toBe(beforeExport.layoutRuns);
});

test('V09 malicious-looking labels, IDs and details remain text with no network or script execution', async ({ page }) => {
  const opened = await openFixture(page, 'injection');
  await expect(page.locator('#title')).toHaveText('纯文本 </script> & 引号验收');
  const node = page.getByRole('button', { name: '<script>文本</script>', exact: true });
  await node.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#details')).toContainText('globalThis.__blueprintInjectionExecuted=true');
  await expect(page.locator('#details')).toContainText('src/<img-onerror>.ts:7');
  await expect(page.locator('#details script,#details img,#scene script,#scene image')).toHaveCount(0);
  await toggle(page, 'group-<svg/onload=alert(1)>');
  await expect(page.locator('[data-group-toggle-node]')).toContainText('<b>分组</b>');
  const security = await page.evaluate(() => ({ executed: (window as any).__blueprintInjectionExecuted ?? false, resources: performance.getEntriesByType('resource').map(entry => entry.name).filter(name => /^https?:/.test(name)) }));
  expect(security.executed).toBe(false); expect(security.resources).toEqual([]);
  expect(opened.network).toEqual([]); expect(opened.pageErrors).toEqual([]);
});

test('V16 canvas dragging over a node does not accidentally open details', async ({ page }) => {
  await openFixture(page, 'single-node');
  const node = await page.locator('[data-node-id="only"]').boundingBox(); expect(node).not.toBeNull();
  const before = (await state(page)).transform;
  await page.mouse.move(node!.x + node!.width / 2, node!.y + node!.height / 2); await page.mouse.down();
  await page.mouse.move(node!.x + node!.width / 2 + 70, node!.y + node!.height / 2 + 30, { steps: 10 }); await page.mouse.up();
  await expect(page.locator('#details')).toBeHidden();
  expect((await state(page)).selected).toBeUndefined();
  expect((await state(page)).transform).not.toEqual(before);
  // A subsequent ordinary click remains usable after the drag suppression ends.
  await page.locator('[data-node-id="only"]').click();
  await expect(page.locator('#details')).toBeVisible();
});

test('V19 hidden conditions appear in summary and group details; reset restores initial collapse and retains theme', async ({ page }, info) => {
  await openFixture(page, 'hidden-conditions');
  const summary = page.locator('[data-group-toggle-node="processing"]');
  await expect(summary).toContainText('1 个判断'); await expect(summary).toContainText('2 个条件');
  await summary.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#details')).toContainText('组内流程条件');
  await expect(page.locator('#details')).toContainText('通过'); await expect(page.locator('#details')).toContainText('不通过');
  await expect(page.locator('#details')).toContainText('不表示任意入口均能到达任意出口');
  await capture(page, info, 'hidden-conditions-details');
  await page.locator('#details').getByRole('button', { name: '展开分组', exact: true }).click(); await idle(page);
  await expect(page.locator('[data-node-id="decision"]')).toBeVisible();
  await page.locator('#details').getByRole('button', { name: '下游', exact: true }).click();
  await page.getByRole('button', { name: '切换深浅主题' }).click();
  await page.getByRole('button', { name: '重置视图', exact: true }).click(); await idle(page);
  const reset = await state(page);
  expect(reset.collapsedGroups).toEqual(['processing']); expect(reset.theme).toBe('dark');
  expect(reset.selected).toBeUndefined(); expect(reset.highlight).toBeUndefined();
  await expect(page.locator('#details')).toBeHidden();
  await expect(page.locator('[data-group-toggle-node="processing"]')).toBeVisible();
  await expect(page.locator('#scene .bp-related')).toHaveCount(0);
});

for (const [fixture, expectedNodes, expectedEdges] of [
  ['mixed-flow', ['check', 'done', 'failed'], ['allow', 'deny']],
  ['mixed-overview', ['catalog', 'check', 'done', 'failed', 'store'], ['allow', 'deny', 'lookup', 'record']],
] as const) {
  test(`V20 ${fixture} highlighter follows its view semantics and keeps direct relations in details`, async ({ page }) => {
    await openFixture(page, fixture);
    await chooseNode(page, 'check');
    await expect(page.locator('#details')).toContainText('记录判定');
    await expect(page.locator('#details')).toContainText('读取规则');
    await page.locator('#details').getByRole('button', { name: '下游', exact: true }).click();
    expect(await relatedNodeIds(page)).toEqual([...expectedNodes]); expect(await relatedEdgeIds(page)).toEqual([...expectedEdges]);
    await expect(page.locator('[data-node-id="external"]')).toHaveClass(/bp-dim/);
    await expect(page.locator('[data-edge-id="shared"] .bp-edge-line')).toHaveAttribute('marker-end', '');
    await expect(page.locator('[data-node-id="check"] .bp-shape')).toHaveJSProperty('tagName', 'polygon');
  });
}

test('V16 V21 narrow long flow fits below 25 percent and zooms continuously with reachable details', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const opened = await openFixture(page, 'narrow-long-flow');
  await page.getByRole('button', { name: '适应画布', exact: true }).click();
  const fitted = await state(page);
  expect(fitted.transform.k).toBeGreaterThan(0); expect(fitted.transform.k).toBeLessThan(.25);
  expect(fitted.graph.nodes).toHaveLength(32); expect(fitted.graph.edges).toHaveLength(31);
  await expect(page.locator('#status')).toContainText('总览比例');
  const bounds = await page.locator('header button,footer button').evaluateAll(elements => elements.map(element => ({ text: element.textContent, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })));
  for (const boundsItem of bounds) { expect(boundsItem.left, boundsItem.text ?? '').toBeGreaterThanOrEqual(0); expect(boundsItem.right, boundsItem.text ?? '').toBeLessThanOrEqual(375); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await capture(page, info, 'narrow-overview');
  await page.getByRole('button', { name: '放大', exact: true }).click();
  expect((await state(page)).transform.k).toBeCloseTo(fitted.transform.k * 1.25, 6);
  await chooseNode(page, 'n16');
  await expect(page.locator('#details')).toContainText('执行步骤 16');
  const detailBounds = await page.locator('#details').boundingBox(); expect(detailBounds!.width).toBeLessThanOrEqual(375);
  const beforeWheel = (await state(page)).transform;
  await page.locator('#details').hover(); await page.mouse.wheel(0, 160);
  expect((await state(page)).transform).toEqual(beforeWheel);
  await page.getByRole('button', { name: '关闭详情' }).click();
  await expect(page.locator('#details')).toBeHidden();
  expect((await state(page)).layoutRuns).toBe(fitted.layoutRuns);
  expect(opened.network).toEqual([]); expect(opened.pageErrors).toEqual([]);
});
