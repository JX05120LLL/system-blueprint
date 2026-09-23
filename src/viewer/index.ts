import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { validateDocument } from '../model/validate';
import { buildGraphIndex, findRelated, type GraphIndex } from '../model/graph-index';
import type { DiagramDocument, HighlightDirection } from '../model/types';
import { projectVisibleGraph } from '../projection/visible-graph';
import { measureGraph } from '../layout/measure';
import { layoutGraph } from '../layout/elk';
import { checkGeometry } from '../layout/geometry';
import { renderGraph } from '../render/svg';
import { themes } from '../render/theme';
import type { LayoutGraph, Point } from '../layout/types';
import { LayoutScheduler } from './scheduler';
import { showDetails, type Selection } from './details';
import { createExportSvg, type ExportOptions } from '../export/svg';

const started = (globalThis as typeof globalThis & { __blueprintStarted?: number }).__blueprintStarted ?? performance.now();
const byId = (id: string) => document.getElementById(id)!;
const canvas = byId('canvas') as unknown as SVGSVGElement;
const scene = byId('scene') as unknown as SVGGElement;
const details = byId('details');
let doc: DiagramDocument, index: GraphIndex, graph: LayoutGraph | undefined;
let theme: 'light' | 'dark' = 'light';
let transform: ZoomTransform = zoomIdentity;
let selected: Selection | undefined;
let highlight: HighlightDirection | undefined;
let collapsed = new Set<string>();
let initialFit = true;
let focusId: string | undefined;
let focusKind: Selection['kind'] = 'node';
let exportCounter = 0;
let diagnostics: ReturnType<typeof checkGeometry> = [];
const exportContainers = new Set<string>();
const metrics = { started, readyMs: 0, layouts: [] as number[], longTasks: [] as number[] };
try { new PerformanceObserver(list => { metrics.longTasks.push(...list.getEntries().map(e => e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch { /* Browser without Long Tasks still supports rendering. */ }
const reportError = (error: unknown) => { const target = byId('error'); target.hidden = false; target.textContent = error instanceof Error ? error.message : String(error); byId('status').textContent = '图形处理失败，可重置视图后重试'; };
const zoomer = zoom<SVGSVGElement, unknown>().scaleExtent([.25, 3]).clickDistance(5).on('zoom', event => {
  transform = event.transform; scene.setAttribute('transform', transform.toString()); byId('zoom-level').textContent = `${Math.round(transform.k * 100)}%`;
  byId('status').textContent = transform.k < .25 ? '总览比例，放大查看文字' : '拖动平移 · 滚轮缩放';
  if (transform.k >= .25) zoomer.scaleExtent([.25, 3]);
});
select(canvas).call(zoomer).on('dblclick.zoom', null);
function fit(readableInitial = false) {
  if (!graph) return;
  const b = canvas.getBoundingClientRect();
  const fitted = Math.max(.001, Math.min(1, Math.max(1, b.width - 48) / graph.width, Math.max(1, b.height - 48) / graph.height));
  const k = readableInitial && fitted < .6 ? .8 : fitted;
  zoomer.scaleExtent([Math.min(.25, k), 3]);
  let x = Math.max(24, (b.width - graph.width * k) / 2), y = Math.max(24, (b.height - graph.height * k) / 2);
  if (k > fitted) {
    const firstId = doc.edges.find(edge => edge.id === doc.view.primaryPath?.[0])?.source ?? doc.nodes.find(node => node.kind === 'start')?.id ?? doc.nodes[0]!.id;
    const first = graph.nodes.find(node => node.originalNodeIds.includes(firstId)) ?? graph.nodes[0]!;
    // Feedback lanes can extend far before the first node. Start on the entry, not empty lanes.
    if (doc.view.direction === 'DOWN') { x = b.width / 2 - (first.x + first.width / 2) * k; y = 48 - Math.min(first.y, 32) * k; }
    else { x = 48 - first.x * k; y = b.height / 2 - (first.y + first.height / 2) * k; }
  }
  select(canvas).call(zoomer.transform, zoomIdentity.translate(x, y).scale(k));
  if (k > fitted) byId('status').textContent = '拖动阅读全图 · 适应画布可查看总览';
}
function getGroupAnchor(id: string, layout: LayoutGraph | undefined): Point | undefined {
  const item = layout?.groups.find(g => g.id === id) ?? layout?.nodes.find(n => n.originalGroupId === id);
  return item ? { x: item.x + item.width / 2, y: item.y + 24 } : undefined;
}
function focusSelection() {
  if (!focusId || !graph) return;
  const visibleId = graph.nodeToVisible.get(focusId) ?? graph.nodes.find(n => n.originalGroupId === focusId)?.id;
  const edgeId = focusKind === 'edge' ? graph.edges.find(edge => edge.originalEdgeIds.includes(focusId!))?.id : undefined;
  const element = [...scene.querySelectorAll<SVGElement>('[data-node-id],[data-group-id],[data-edge-id]')].find(el => focusKind === 'edge' ? edgeId !== undefined && el.dataset.edgeId === edgeId : ((visibleId !== undefined && el.dataset.nodeId === visibleId) || (focusKind === 'group' && el.dataset.groupId === focusId)));
  element?.focus({ preventScroll: true });
}
function applyHighlight() {
  if (!graph) return;
  const nodeIds = new Set<string>(); const edgeIds = new Set<string>();
  if (selected?.kind === 'edge') {
    for (const id of selected.originalEdgeIds ?? [selected.id]) { const edge = index.edges.get(id); if (edge) { nodeIds.add(edge.source); nodeIds.add(edge.target); edgeIds.add(id); } }
  } else if (selected && highlight) {
    const related = findRelated(index, selected.id, highlight); related.nodeIds.forEach(id => nodeIds.add(id)); related.edgeIds.forEach(id => edgeIds.add(id));
  } else if (selected) {
    if (selected.kind === 'group') index.groupMembers.get(selected.id)?.forEach(id => nodeIds.add(id)); else nodeIds.add(selected.id);
  }
  const active = !!selected && (!!highlight || selected.kind === 'edge');
  for (const element of scene.querySelectorAll<SVGElement>('[data-node-id]')) {
    const node = graph.nodes.find(n => n.id === element.dataset.nodeId)!;
    const related = node.originalNodeIds.some(id => nodeIds.has(id));
    element.classList.toggle('bp-dim', active && !related); element.classList.toggle('bp-related', active && related);
    element.classList.toggle('bp-selected', !!selected && selected.kind !== 'edge' && (node.id === selected.id || node.originalGroupId === selected.id));
  }
  for (const element of scene.querySelectorAll<SVGElement>('[data-edge-id],[data-label-edge-id]')) {
    const edge = graph.edges.find(e => e.id === (element.dataset.edgeId ?? element.dataset.labelEdgeId))!;
    const related = edge.originalEdgeIds.some(id => edgeIds.has(id));
    element.classList.toggle('bp-dim', active && !related); element.classList.toggle('bp-related', active && related);
  }
}
function refreshDetails() {
  if (!selected) { details.hidden = true; return; }
  showDetails(details, doc, index, selected, { close: () => clearSelection(true), highlight: direction => { highlight = direction; applyHighlight(); for (const b of details.querySelectorAll<HTMLElement>('[data-highlight]')) b.setAttribute('aria-pressed', String(b.dataset.highlight === direction)); }, toggle: toggleGroup, collapsed });
}
function clearSelection(restoreFocus = false) { selected = undefined; highlight = undefined; details.hidden = true; applyHighlight(); if (restoreFocus) focusSelection(); }
function choose(selection: Selection) {
  selected = selection; highlight = undefined; focusKind = selection.kind; focusId = selection.kind === 'edge' ? selection.originalEdgeIds?.[0] ?? selection.id : selection.id;
  refreshDetails(); applyHighlight();
}
function paint() {
  if (!graph) return;
  const hadFocus = scene.contains(document.activeElement) || details.contains(document.activeElement);
  scene.replaceChildren(renderGraph(graph, themes[theme]));
  document.body.dataset.theme = theme; byId('theme').textContent = theme === 'light' ? '深色主题' : '浅色主题';
  applyHighlight(); refreshDetails(); if (hadFocus) focusSelection();
}
interface LayoutRequest { collapsed: Set<string>; anchor?: { id: string; screen: Point }; reset?: boolean; }
const scheduler = new LayoutScheduler<LayoutRequest, LayoutGraph>(async state => {
  const start = performance.now();
  const measured = await measureGraph(projectVisibleGraph(doc, state.collapsed), themes[theme]);
  const layout = await layoutGraph(measured, doc.view);
  const checks = checkGeometry(layout);
  const errors = checks.filter(d => d.severity === 'error');
  if (errors.length) throw new Error(JSON.stringify(errors, null, 2));
  for (const edge of layout.edges) Object.assign(edge, { primary: edge.originalEdgeIds.some(id => doc.view.primaryPath?.includes(id)) });
  metrics.layouts.push(performance.now() - start); return layout;
}, (layout, request) => {
  graph = layout; diagnostics = checkGeometry(layout); byId('error').hidden = true;
  if (selected?.kind === 'node') {
    const visible = graph.nodes.find(n => n.originalNodeIds.includes(selected!.id));
    if (visible?.originalGroupId) { selected = { kind: 'group', id: visible.originalGroupId }; focusId = visible.originalGroupId; focusKind = 'group'; }
  } else if (selected?.kind === 'group' && !graph.groups.some(g => g.id === selected!.id)) {
    const members = index.groupMembers.get(selected.id)!;
    const visible = graph.nodes.find(node => node.originalGroupId && node.originalNodeIds.some(id => members.has(id)));
    if (visible?.originalGroupId) { selected = { kind: 'group', id: visible.originalGroupId }; focusId = visible.originalGroupId; focusKind = 'group'; }
  }
  paint();
  if (initialFit || request.reset) { fit(initialFit && !request.reset); initialFit = false; }
  else if (request.anchor) {
    const anchor = getGroupAnchor(request.anchor.id, graph);
    if (anchor) select(canvas).call(zoomer.transform, zoomIdentity.translate(request.anchor.screen.x - anchor.x * transform.k, request.anchor.screen.y - anchor.y * transform.k).scale(transform.k));
  }
}, reportError);
function toggleGroup(id: string) {
  if (!index?.groups.has(id)) return;
  const anchor = getGroupAnchor(id, graph);
  const screen = anchor ? { x: anchor.x * transform.k + transform.x, y: anchor.y * transform.k + transform.y } : undefined;
  if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
  scheduler.request({ collapsed: new Set(collapsed), anchor: screen ? { id, screen } : undefined });
}
function reset() { clearSelection(); collapsed = new Set(doc.view.collapsedGroups ?? []); scheduler.request({ collapsed: new Set(collapsed), reset: true }); }
function handleTarget(target: EventTarget | null) {
  if (!(target instanceof Element) || !graph) return;
  const toggle = target.closest<SVGElement>('[data-group-toggle]');
  if (toggle) { focusId = toggle.dataset.groupToggle; focusKind = 'group'; toggleGroup(toggle.dataset.groupToggle!); return; }
  const nodeEl = target.closest<SVGElement>('[data-node-id]');
  if (nodeEl) { const node = graph.nodes.find(n => n.id === nodeEl.dataset.nodeId)!; choose({ kind: node.isCollapsed ? 'group' : 'node', id: node.originalGroupId ?? node.id }); return; }
  const edgeEl = target.closest<SVGElement>('[data-edge-id]');
  if (edgeEl) { const edge = graph.edges.find(e => e.id === edgeEl.dataset.edgeId)!; choose({ kind: 'edge', id: edge.id, originalEdgeIds: edge.originalEdgeIds }); return; }
  const group = target.closest<SVGElement>('[data-group-id]');
  if (group) { choose({ kind: 'group', id: group.dataset.groupId! }); return; }
  clearSelection();
}
canvas.addEventListener('click', event => handleTarget(event.target));
canvas.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleTarget(event.target); } });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); clearSelection(true); } });
byId('fit').onclick = () => fit(); byId('reset').onclick = reset;
byId('zoom-in').onclick = () => select(canvas).call(zoomer.scaleBy, 1.25);
byId('zoom-out').onclick = () => select(canvas).call(zoomer.scaleBy, .8);
byId('theme').onclick = () => { theme = theme === 'light' ? 'dark' : 'light'; paint(); };
const api = {
  ready: Promise.resolve(),
  whenIdle: () => scheduler.whenIdle(),
  getState: () => ({ theme, transform: { x: transform.x, y: transform.y, k: transform.k }, graph, selected, highlight, collapsedGroups: [...collapsed], revision: scheduler.revision, committedRevision: scheduler.committedRevision, layoutRuns: scheduler.runs, metrics, diagnostics }),
  toggleGroup,
  exportSvg: async (options: ExportOptions = {}) => { await api.ready; const svg = await createExportSvg(doc, { theme, ...options }); return new XMLSerializer().serializeToString(svg); },
  prepareRasterExport: async (options: ExportOptions = {}) => {
    await api.ready;
    const svg = await createExportSvg(doc, { theme, ...options });
    const elementId = `blueprint-export-${++exportCounter}`;
    const container = document.createElement('div'); container.id = elementId; container.className = 'export-container';
    const width = Number(svg.getAttribute('width')), height = Number(svg.getAttribute('height'));
    container.style.width = `${width}px`; container.style.height = `${height}px`; container.append(svg); document.body.append(container); exportContainers.add(elementId);
    return { elementId, width, height };
  },
  disposeExport: (id: string) => { if (exportContainers.delete(id)) byId(id)?.remove(); },
};
Object.assign(window, { blueprint: api });
api.ready = (async () => {
  const validation = validateDocument(JSON.parse(byId('blueprint-data').textContent!));
  if (!validation.valid || !validation.document) throw new Error(JSON.stringify(validation.diagnostics, null, 2));
  doc = validation.document;
  const freeze = (value: unknown) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } }; freeze(doc);
  index = buildGraphIndex(doc); theme = doc.view.theme; collapsed = new Set(doc.view.collapsedGroups ?? []);
  byId('description').textContent = doc.description ?? '';
  const legendTypes = [...new Set(doc.edges.map(e => e.kind))].filter(kind => ['exception', 'feedback', 'dependency'].includes(kind));
  if (legendTypes.length) {
    const legend = document.createElement('div'); legend.className = 'legend'; legend.setAttribute('aria-label', '连线图例');
    const names: Record<string, string> = { exception: '异常', feedback: '反馈', dependency: '依赖' };
    for (const kind of legendTypes) { const item = document.createElement('span'); const mark = document.createElement('i'); mark.className = kind; item.append(mark, document.createTextNode(names[kind])); legend.append(item); }
    document.querySelector('footer')!.insertBefore(legend, byId('status'));
  }
  scheduler.request({ collapsed: new Set(collapsed) }); await scheduler.whenIdle(); metrics.readyMs = performance.now() - started;
})();
api.ready.catch(reportError);
byId('download').onclick = async () => {
  const button = byId('download') as HTMLButtonElement; button.disabled = true;
  try { const svg = await api.exportSvg(); const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); const a = document.createElement('a'); a.href = url; a.download = `${doc.id.replace(/[^\p{L}\p{N}_.-]/gu, '_')}.svg`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  catch (error) { reportError(error); } finally { button.disabled = false; }
};
