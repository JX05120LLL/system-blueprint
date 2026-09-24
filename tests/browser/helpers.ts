import { expect, type Page, type TestInfo } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DiagramDocument } from '../../src/model/types';
import type { LayoutGraph } from '../../src/layout/types';

export interface ReaderState {
  graph: LayoutGraph;
  selected?: { id: string; kind: 'node' | 'group' | 'edge'; originalEdgeIds?: string[] };
  highlight?: 'upstream' | 'downstream';
  collapsedGroups: string[];
  revision: number;
  committedRevision: number;
  layoutRuns: number;
  theme: 'light' | 'dark';
  transform: { x: number; y: number; k: number };
}

export interface ReaderApi {
  ready: Promise<void>;
  whenIdle(): Promise<void>;
  getState(): ReaderState;
  toggleGroup(id: string): void;
  exportSvg(options?: { theme?: 'light' | 'dark'; background?: string }): Promise<string>;
}

export async function openFixture(page: Page, name: string, options: { mutate?: (document: DiagramDocument) => void; expectFailure?: boolean } = {}) {
  const input = resolve(`tests/fixtures/${name}.diagram.json`);
  const document: DiagramDocument = JSON.parse(await readFile(input, 'utf8'));
  const output = resolve(`artifacts/acceptance-${name}${options.mutate ? '-modified' : ''}.html`);
  let source = input;
  if (options.mutate) {
    options.mutate(document);
    source = resolve(`artifacts/acceptance-${name}-modified.diagram.json`);
    await mkdir(resolve('artifacts'), { recursive: true });
    await writeFile(source, JSON.stringify(document), 'utf8');
  }
  execFileSync(process.execPath, ['system-flow/scripts/generate.mjs', source, '--output', output, '--overwrite'], { encoding: 'utf8' });
  const network: string[] = [];
  const pageErrors: string[] = [];
  page.on('request', request => { if (/^https?:/i.test(request.url())) network.push(request.url()); });
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(output).href);
  if (!options.expectFailure) {
    await idle(page, true);
    await expect(page.locator('#error')).toBeHidden();
  }
  return { document, network, pageErrors, output };
}

export async function idle(page: Page, initial = false) {
  await page.evaluate(async (first) => {
    const api = (window as unknown as { blueprint: ReaderApi }).blueprint;
    if (first) await api.ready;
    await api.whenIdle();
  }, initial);
}

export async function state(page: Page): Promise<ReaderState> {
  return page.evaluate(() => (window as unknown as { blueprint: ReaderApi }).blueprint.getState());
}

export async function toggle(page: Page, id: string) {
  await page.evaluate(groupId => (window as unknown as { blueprint: ReaderApi }).blueprint.toggleGroup(groupId), id);
  await idle(page);
}

export async function chooseNode(page: Page, id: string) {
  const node = page.locator(`[data-node-id="${id}"]`);
  await node.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#details')).toBeVisible();
}

export async function relatedNodeIds(page: Page): Promise<string[]> {
  return page.locator('#scene [data-node-id].bp-related').evaluateAll(elements => elements.map(element => element.getAttribute('data-node-id')!).sort());
}

export async function relatedEdgeIds(page: Page): Promise<string[]> {
  return page.locator('#scene [data-edge-id].bp-related').evaluateAll(elements => elements.map(element => element.getAttribute('data-edge-id')!).sort());
}

export async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: 'image/png' });
}

/** Browser font geometry, measured from rendered SVG rather than from cached layout estimates. */
export async function renderedTextOverflow(page: Page): Promise<string[]> {
  return page.locator('#scene [data-node-id]').evaluateAll(elements => {
    const failures: string[] = [];
    for (const element of elements) {
      const shape = element.querySelector<SVGGraphicsElement>('.bp-shape')!;
      const bounds = shape.getBBox();
      for (const text of element.querySelectorAll<SVGGraphicsElement>('[data-text-block]')) {
        const box = text.getBBox();
        if (box.x < bounds.x - .5 || box.y < bounds.y - .5 || box.x + box.width > bounds.x + bounds.width + .5 || box.y + box.height > bounds.y + bounds.height + .5) {
          failures.push(`${element.getAttribute('data-node-id')}: ${text.textContent}`);
        }
      }
    }
    return failures;
  });
}
