import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DiagramDocument } from '../../src/model/types';
import { chooseNode, idle, openFixture, renderedTextOverflow, state, toggle, type ReaderApi } from './helpers';

async function selectEdge(page: Page, id: string) {
  const edge = page.locator(`#scene [data-edge-id="${id}"]`);
  await edge.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#details')).toBeVisible();
}

async function readDownload(page: Page, buttonId: string): Promise<string> {
  const started = page.waitForEvent('download');
  await page.locator(buttonId).click();
  const download = await started;
  const path = await download.path();
  if (!path) throw new Error(`${buttonId} did not produce a local download`);
  return readFile(path, 'utf8');
}

test('reviewer corrects node details offline and receives matching graph, SVG, JSON and revised HTML', async ({ page, browser }) => {
  const opened = await openFixture(page, 'single-node');
  await chooseNode(page, 'only');
  await page.getByRole('button', { name: '编辑详情' }).click();
  await page.getByRole('textbox', { name: '名称' }).fill('独立审核组件');
  await page.getByRole('textbox', { name: '摘要' }).fill('先核对输入，再决定是否继续');
  await page.getByRole('textbox', { name: '说明' }).fill('本节点由审核人校正，不代表已自动运行。');
  await page.getByRole('button', { name: '保存修改' }).click();
  await idle(page);

  await expect(page.locator('#scene [data-node-id="only"]')).toContainText('独立审核组件');
  await expect(page.locator('#details')).toContainText('本节点由审核人校正');
  expect(await renderedTextOverflow(page)).toEqual([]);
  const svg = await page.evaluate(() => (window as unknown as { blueprint: ReaderApi }).blueprint.exportSvg());
  expect(svg).toContain('独立审核组件');
  expect(svg).toContain('先核对输入');
  expect(svg).not.toContain('无需依赖其他节点');

  const revised = JSON.parse(await readDownload(page, '#download-data')) as DiagramDocument;
  expect(revised.nodes.find(node => node.id === 'only')).toMatchObject({
    label: '独立审核组件', summary: '先核对输入，再决定是否继续',
    details: '本节点由审核人校正，不代表已自动运行。',
  });
  expect(revised.id).toBe(opened.document.id);

  const html = await readDownload(page, '#download-html');
  expect(html).toContain('独立审核组件');
  const revisedPath = resolve('artifacts/acceptance-editor-revision.html');
  await writeFile(revisedPath, html, 'utf8');
  const reopened = await page.context().newPage();
  const externalRequests: string[] = [];
  reopened.on('request', request => { if (/^https?:/i.test(request.url())) externalRequests.push(request.url()); });
  try {
    await reopened.goto(pathToFileURL(revisedPath).href);
    await idle(reopened, true);
    await expect(reopened.locator('#scene [data-node-id="only"]')).toContainText('独立审核组件');
    await expect(reopened.locator('#error')).toBeHidden();
  } finally { await reopened.close(); }
  const withoutScripts = await browser.newContext({ javaScriptEnabled: false, offline: true });
  try {
    const staticPage = await withoutScripts.newPage();
    await staticPage.goto(pathToFileURL(revisedPath).href);
    await expect(staticPage.locator('.noscript')).toContainText('独立审核组件');
    await expect(staticPage.locator('.noscript')).toContainText('先核对输入，再决定是否继续');
    await expect(staticPage.locator('#workspace')).toBeHidden();
  } finally { await withoutScripts.close(); }
  expect(externalRequests).toEqual([]);
  expect(opened.network).toEqual([]);
  expect(opened.pageErrors).toEqual([]);
});

test('reviewer can undo and redo a correction and downloads the current accepted version', async ({ page }) => {
  await openFixture(page, 'single-node');
  await chooseNode(page, 'only');
  await page.getByRole('button', { name: '编辑详情' }).click();
  await page.getByRole('textbox', { name: '名称' }).fill('人工复核后的组件');
  await page.getByRole('button', { name: '保存修改' }).click();
  await idle(page);
  await expect(page.locator('#scene [data-node-id="only"]')).toContainText('人工复核后的组件');
  await expect(page.locator('#undo-edit')).toBeEnabled();
  await expect(page.locator('#redo-edit')).toBeDisabled();

  await page.locator('#undo-edit').click();
  await idle(page);
  await expect(page.locator('#scene [data-node-id="only"]')).toContainText('独立组件');
  let current = JSON.parse(await readDownload(page, '#download-data')) as DiagramDocument;
  expect(current.nodes[0]?.label).toBe('独立组件');
  await expect(page.locator('#redo-edit')).toBeEnabled();

  await page.locator('#redo-edit').click();
  await idle(page);
  await expect(page.locator('#scene [data-node-id="only"]')).toContainText('人工复核后的组件');
  current = JSON.parse(await readDownload(page, '#download-data')) as DiagramDocument;
  expect(current.nodes[0]?.label).toBe('人工复核后的组件');
});

test('downloads wait for an unsaved detail correction', async ({ page }) => {
  await openFixture(page, 'single-node');
  await chooseNode(page, 'only');
  await page.getByRole('button', { name: '编辑详情' }).click();
  await page.getByRole('textbox', { name: '名称' }).fill('尚未保存的名称');
  const downloads: string[] = [];
  page.on('download', download => { downloads.push(download.suggestedFilename()); });
  for (const id of ['#download-data', '#download-html', '#download']) {
    await page.locator(id).click();
    await expect(page.locator('#status')).toContainText('未保存修改');
  }
  expect(downloads).toEqual([]);
  await page.getByRole('button', { name: '保存修改' }).click();
  await idle(page);
  expect(JSON.parse(await readDownload(page, '#download-data')).nodes[0].label).toBe('尚未保存的名称');
});

test('saving an unchanged inspector preserves exact sources and creates no undo history', async ({ page }) => {
  const opened = await openFixture(page, 'single-node', { mutate: document => {
    document.nodes[0]!.sources = [
      { path: 'https://example.test/guide#L12' },
      { path: ' C:\\reports\\review.ts ', line: 12 },
    ];
  } });
  const before = await state(page);
  await chooseNode(page, 'only');
  await page.getByRole('button', { name: '编辑详情' }).click();
  await expect(page.getByRole('textbox', { name: '来源' })).toHaveValue('"https://example.test/guide#L12"\n" C:\\\\reports\\\\review.ts "#L12');
  await page.getByRole('button', { name: '保存修改' }).click();
  await idle(page);

  const after = await state(page);
  expect(after.revision).toBe(before.revision);
  expect(after.layoutRuns).toBe(before.layoutRuns);
  await expect(page.locator('#undo-edit')).toBeDisabled();
  await expect(page.locator('#redo-edit')).toBeDisabled();
  await expect(page.locator('#details form')).toHaveCount(0);
  const current = JSON.parse(await readDownload(page, '#download-data')) as DiagramDocument;
  expect(current).toEqual(opened.document);
});

test('saving an edit locks the inspector until asynchronous layout commits', async ({ page }) => {
  await openFixture(page, 'single-node');
  await chooseNode(page, 'only');
  await page.getByRole('button', { name: '编辑详情' }).click();
  await page.getByRole('textbox', { name: '名称' }).fill('异步保存后的组件');

  // requestSubmit dispatches synchronously, so this observes the pending phase
  // before the layout promise can resolve and tries the formerly misleading cancel.
  const pending = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('#details')!;
    const form = panel.querySelector<HTMLFormElement>('form')!;
    form.requestSubmit();
    const controls = [...panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>('input,textarea,select,button')];
    const allDisabled = controls.length > 0 && controls.every(control => control.disabled);
    panel.querySelector<HTMLButtonElement>('button.close')!.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const blueprint = (window as unknown as { blueprint: ReaderApi }).blueprint;
    return { allDisabled, editorStillVisible: !!panel.querySelector('form'), revision: blueprint.getState().revision, committed: blueprint.getState().committedRevision };
  });
  expect(pending.allDisabled).toBe(true);
  expect(pending.editorStillVisible).toBe(true);
  expect(pending.revision).toBeGreaterThan(pending.committed);

  await idle(page);
  await expect(page.locator('#scene [data-node-id="only"]')).toContainText('异步保存后的组件');
  await expect(page.locator('#details')).toContainText('异步保存后的组件');
  await expect(page.locator('#details form')).toHaveCount(0);
  const current = JSON.parse(await readDownload(page, '#download-data')) as DiagramDocument;
  expect(current.nodes[0]?.label).toBe('异步保存后的组件');
  const settled = await state(page);
  expect(settled.revision).toBe(settled.committedRevision);
});

test('revised offline HTML treats edited markup-like text as data when reopened', async ({ page }) => {
  await openFixture(page, 'single-node');
  await chooseNode(page, 'only');
  await page.getByRole('button', { name: '编辑详情' }).click();
  const dangerous = '</script><script>window.__blueprintInjected=true</script>';
  await page.getByRole('textbox', { name: '说明' }).fill(dangerous);
  await page.getByRole('button', { name: '保存修改' }).click();
  await idle(page);
  const html = await readDownload(page, '#download-html');
  const revisedPath = resolve('artifacts/acceptance-editor-markup.html');
  await writeFile(revisedPath, html, 'utf8');
  const reopened = await page.context().newPage();
  try {
    await reopened.goto(pathToFileURL(revisedPath).href);
    await idle(reopened, true);
    await chooseNode(reopened, 'only');
    await expect(reopened.locator('#details')).toContainText(dangerous);
    expect(await reopened.evaluate(() => (window as unknown as { __blueprintInjected?: boolean }).__blueprintInjected)).toBeUndefined();
  } finally { await reopened.close(); }
});

test('invalid decision branch correction remains in the editor and never changes the accepted diagram', async ({ page }) => {
  await openFixture(page, 'mixed-flow');
  await selectEdge(page, 'deny');
  await page.getByRole('button', { name: '编辑详情' }).click();
  await page.getByRole('textbox', { name: '条件 / 标签' }).fill('允许');
  await page.getByRole('button', { name: '保存修改' }).click();

  await expect(page.locator('#details [role="alert"]')).toBeVisible();
  await expect(page.locator('#details [role="alert"]')).toContainText(/条件|重复|区分/);
  await expect(page.getByRole('button', { name: '保存修改' })).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).last().click();
  const revised = JSON.parse(await readDownload(page, '#download-data')) as DiagramDocument;
  expect(revised.edges.find(edge => edge.id === 'deny')?.label).toBe('拒绝');
  expect((await state(page)).graph.edges.find(edge => edge.originalEdgeIds.includes('deny'))?.label).toBe('拒绝');
});

test('reviewer can correct an edge endpoint and direction; static export includes full expanded graph', async ({ page }) => {
  await openFixture(page, 'mixed-flow');
  await selectEdge(page, 'shared');
  await page.getByRole('button', { name: '编辑详情' }).click();
  await page.getByRole('combobox', { name: '来源节点' }).selectOption('start');
  await page.getByRole('combobox', { name: '目标节点' }).selectOption('external');
  await page.getByRole('checkbox', { name: '有方向' }).check();
  await page.getByRole('textbox', { name: '条件 / 标签' }).fill('同步规则');
  await page.getByRole('button', { name: '保存修改' }).click();
  await idle(page);

  const revised = JSON.parse(await readDownload(page, '#download-data')) as DiagramDocument;
  expect(revised.edges.find(edge => edge.id === 'shared')).toMatchObject({ source: 'start', target: 'external', directed: true, label: '同步规则' });
  await expect(page.locator('#scene [data-edge-id="shared"] .bp-edge-line').first()).toHaveAttribute('marker-end', /bp-arrow/);
  const svg = await page.evaluate(() => (window as unknown as { blueprint: ReaderApi }).blueprint.exportSvg());
  expect(svg).toContain('同步规则');
  expect(svg).not.toContain('共享定义');
});

test('editing one original edge of a collapsed aggregate selects only its new visible relation', async ({ page }) => {
  await openFixture(page, 'decision-shared-endpoint', { mutate: document => {
    document.nodes.push({ id: 'worker', kind: 'process', label: '补充处理', groupId: 'checks', evidenceStatus: 'confirmed' });
    document.edges.push(
      { id: 'route-worker', source: 'check', target: 'worker', kind: 'control', directed: true, label: '补充检查' },
      { id: 'success-copy', source: 'worker', target: 'result', kind: 'control', directed: true, label: '成功', details: '第二条独立关系。' },
    );
  } });
  await toggle(page, 'checks');
  const aggregate = (await state(page)).graph.edges.find(edge => edge.originalEdgeIds.includes('success-copy'))!;
  expect(aggregate.originalEdgeIds).toEqual(['success', 'success-copy']);
  await selectEdge(page, aggregate.id);
  await page.getByRole('button', { name: '编辑 success-copy 详情' }).click();
  await page.getByRole('textbox', { name: '条件 / 标签' }).fill('成功后人工复核');
  await page.getByRole('button', { name: '保存修改' }).click();
  await idle(page);

  const current = await state(page);
  const original = current.graph.edges.find(edge => edge.originalEdgeIds.includes('success'))!;
  const edited = current.graph.edges.find(edge => edge.originalEdgeIds.includes('success-copy'))!;
  expect(original.originalEdgeIds).toEqual(['success']);
  expect(edited.originalEdgeIds).toEqual(['success-copy']);
  expect(current.selected).toEqual({ kind: 'edge', id: edited.id, originalEdgeIds: ['success-copy'] });
  await expect(page.locator('#details').getByRole('heading', { name: 'success-copy', exact: true })).toBeVisible();
  await expect(page.locator('#details').getByRole('heading', { name: 'success', exact: true })).toHaveCount(0);
  await expect(page.locator(`#scene [data-edge-id="${edited.id}"]`)).toHaveClass(/bp-related/);
  await expect(page.locator(`#scene [data-edge-id="${original.id}"]`)).toHaveClass(/bp-dim/);
  const revised = JSON.parse(await readDownload(page, '#download-data')) as DiagramDocument;
  expect(revised.edges.find(edge => edge.id === 'success')?.label).toBe('成功');
  expect(revised.edges.find(edge => edge.id === 'success-copy')?.label).toBe('成功后人工复核');
});

test('an edited nested node survives collapse, zoom and selection in the full static SVG', async ({ page }) => {
  await openFixture(page, 'nested-loops');
  await chooseNode(page, 'check');
  await page.getByRole('button', { name: '编辑详情' }).click();
  await page.getByRole('textbox', { name: '名称' }).fill('材料满足复核条件？');
  await page.getByRole('button', { name: '保存修改' }).click();
  await idle(page);
  await toggle(page, 'parent');
  await page.getByRole('button', { name: '放大' }).click();
  expect((await state(page)).collapsedGroups).toContain('parent');
  await expect(page.locator('#scene [data-node-id="check"]')).toHaveCount(0);
  const svg = await page.evaluate(() => (window as unknown as { blueprint: ReaderApi }).blueprint.exportSvg());
  expect(svg).toContain('材料满足复核条件？');
  expect(svg).toContain('需要重试');
  expect(svg).toContain('不满足');
});

test('flow motion can be paused and respects reduced-motion preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFixture(page, 'nested-loops');
  await expect(page.locator('#motion')).toHaveText('播放流向');
  await expect(page.locator('#scene .bp-edge-flow')).toHaveCount(0);
  await page.locator('#motion').click();
  await expect(page.locator('#motion')).toHaveText('暂停流向');
  const flow = page.locator('#scene .bp-edge-flow').first();
  await expect(flow).toHaveCount(1);
  expect(await flow.evaluate(element => getComputedStyle(element).display)).not.toBe('none');
  expect(await flow.evaluate(element => getComputedStyle(element).animationName)).toBe('bp-flow');
  const initialOffset = await flow.evaluate(element => getComputedStyle(element).strokeDashoffset);
  await expect.poll(() => flow.evaluate(element => getComputedStyle(element).strokeDashoffset), { timeout: 3000 }).not.toBe(initialOffset);
  await page.locator('#motion').click();
  await expect(page.locator('#motion')).toHaveText('播放流向');
  await expect(page.locator('#scene .bp-edge-flow')).toHaveCount(0);
});

test('system reduced-motion changes update an open flow until the reader chooses a preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openFixture(page, 'nested-loops');
  await expect(page.locator('#motion')).toHaveText('暂停流向');
  expect(await page.locator('#scene .bp-edge-flow').count()).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#motion')).toHaveText('播放流向');
  await expect(page.locator('#scene .bp-edge-flow')).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('#motion')).toHaveText('暂停流向');
  expect(await page.locator('#scene .bp-edge-flow').count()).toBeGreaterThan(0);
});
