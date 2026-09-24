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
import { showEditor } from './editor-panel';
import { applyDocumentEdit, type DocumentEdit } from './edit';
import { createExportSvg, type ExportOptions } from '../export/svg';

const started = (globalThis as typeof globalThis & { __blueprintStarted?: number }).__blueprintStarted ?? performance.now();
const byId = (id: string) => document.getElementById(id)!;
const canvas = byId('canvas') as unknown as SVGSVGElement;
const scene = byId('scene') as unknown as SVGGElement;
const details = byId('details');
// Keep the pristine single-file shell so a corrected model can be downloaded offline.
const initialHtml = `<!doctype html>\n${document.documentElement.outerHTML}`;
let doc: DiagramDocument, index: GraphIndex, graph: LayoutGraph | undefined;
let theme: 'light' | 'dark' = 'light';
let transform: ZoomTransform = zoomIdentity;
let selected: Selection | undefined;
let editing: Selection | undefined;
let highlight: HighlightDirection | undefined;
let collapsed = new Set<string>();
let pendingDoc: DiagramDocument | undefined;
let pendingHistory: 'edit' | 'undo' | 'redo' | undefined;
const undoDocs: DiagramDocument[] = [];
const redoDocs: DiagramDocument[] = [];
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let animateFlow = !motionPreference.matches;
let motionUserOverride = false;
let initialFit = true;
let focusId: string | undefined;
let focusKind: Selection['kind'] = 'node';
let exportCounter = 0;
let diagnostics: ReturnType<typeof checkGeometry> = [];
const exportContainers = new Set<string>();
const metrics = { started, readyMs: 0, layouts: [] as number[], longTasks: [] as number[] };
const freezeDocument = (value: DiagramDocument): DiagramDocument => {
  const freeze = (item: unknown) => { if (item && typeof item === 'object') { Object.values(item).forEach(freeze); Object.freeze(item); } };
  freeze(value); return value;
};
const safeDocumentJson = (value: DiagramDocument) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const escapeHtmlText = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
function revisedHtml(value: DiagramDocument): string {
  const dataPattern = /(<script id="blueprint-data" type="application\/json">)[\s\S]*?(<\/script>)/;
  if (!dataPattern.test(initialHtml)) throw new Error('原始 HTML 缺少可更新的图数据。');
  const summary = `<ul>${value.nodes.map(node => `<li>${escapeHtmlText(node.label)}${node.summary ? `：${escapeHtmlText(node.summary)}` : ''}</li>`).join('')}</ul>`;
  const summaryPattern = /(<noscript>[\s\S]*?模型摘要：<\/p>)[\s\S]*?(<\/section><\/noscript>)/;
  if (!summaryPattern.test(initialHtml)) throw new Error('原始 HTML 缺少无脚本摘要。');
  return initialHtml.replace(dataPattern, (_, start: string, end: string) => `${start}${safeDocumentJson(value)}${end}`)
    .replace(summaryPattern, (_, start: string, end: string) => `${start}${summary}${end}`);
}
function downloadBlob(filename: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileStem = () => doc.id.replace(/[^\p{L}\p{N}_.-]/gu, '_');
function updateHistoryButtons() {
  (byId('undo-edit') as HTMLButtonElement).disabled = !!pendingDoc || !undoDocs.length;
  (byId('redo-edit') as HTMLButtonElement).disabled = !!pendingDoc || !redoDocs.length;
  const direction = (pendingDoc ?? doc)?.view.direction;
  for (const [id, value] of [['direction-right', 'RIGHT'], ['direction-down', 'DOWN']] as const) {
    const button = byId(id) as HTMLButtonElement;
    button.disabled = !!pendingDoc || !direction;
    button.setAttribute('aria-pressed', String(direction === value));
  }
}
function focusReviewAction(id?: string) {
  const buttons = [...details.querySelectorAll<HTMLButtonElement>('button')];
  const edit = buttons.find(button => button.getAttribute('aria-label') === `编辑 ${id} 详情`)
    ?? buttons.find(button => button.textContent === '编辑详情');
  (edit ?? (details.hidden ? canvas : details)).focus({ preventScroll: true });
}
function finishEditing() { const id = editing?.id; editing = undefined; refreshDetails(); focusReviewAction(id); }
function diagnosticMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
async function queueDocument(candidate: DiagramDocument, action: 'edit' | 'undo' | 'redo'): Promise<string | undefined> {
  if (pendingDoc) return '请等待当前图形更新完成。';
  if (JSON.stringify(candidate) === JSON.stringify(doc)) { if (editing) finishEditing(); return undefined; }
  const directionChanged = candidate.view.direction !== doc.view.direction;
  pendingDoc = freezeDocument(candidate); pendingHistory = action; updateHistoryButtons();
  byId('status').textContent = '正在校验并重新布局…';
  scheduler.request({ document: pendingDoc, collapsed: new Set(collapsed), readableStart: directionChanged });
  try { await scheduler.whenIdle(); byId('status').textContent = directionChanged ? '布局方向已更新；下载可保存当前方向。' : '修改已保存；请下载修订文件。'; return undefined; }
  catch (error) { return diagnosticMessage(error); }
}
async function saveEdit(edit: DocumentEdit): Promise<string | undefined> {
  const result = applyDocumentEdit(doc, edit);
  if (!result.valid || !result.document) return result.diagnostics.slice(0, 4).map(item => `${item.path || edit.id}：${item.message}`).join('\n');
  return queueDocument(result.document, 'edit');
}
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
function revealSelection(selection: Selection) {
  if (!graph) return;
  const node = graph.nodes.find(item => item.originalNodeIds.includes(selection.id) || item.originalGroupId === selection.id);
  const group = graph.groups.find(item => item.id === selection.id);
  const edge = graph.edges.find(item => item.originalEdgeIds.includes(selection.id));
  const point = node ? { x: node.x + node.width / 2, y: node.y + node.height / 2 }
    : group ? { x: group.x + group.width / 2, y: group.y + 36 }
    : edge?.labelBox ? { x: edge.labelBox.x + edge.labelBox.width / 2, y: edge.labelBox.y + edge.labelBox.height / 2 }
    : edge?.sections[0]?.[0];
  if (!point) return;
  const bounds = canvas.getBoundingClientRect();
  const marginX = Math.min(80, bounds.width / 4), marginY = Math.min(80, bounds.height / 4);
  const halfWidth = node ? node.width * transform.k / 2 : 0;
  const halfHeight = node ? node.height * transform.k / 2 : 0;
  const minX = marginX + halfWidth, maxX = bounds.width - marginX - halfWidth;
  const minY = marginY + halfHeight, maxY = bounds.height - marginY - halfHeight;
  const screenX = point.x * transform.k + transform.x, screenY = point.y * transform.k + transform.y;
  const dx = minX > maxX ? bounds.width / 2 - screenX : screenX < minX ? minX - screenX : screenX > maxX ? maxX - screenX : 0;
  const dy = minY > maxY ? bounds.height / 2 - screenY : screenY < minY ? minY - screenY : screenY > maxY ? maxY - screenY : 0;
  if (dx || dy) select(canvas).call(zoomer.transform, zoomIdentity.translate(transform.x + dx, transform.y + dy).scale(transform.k));
}
const revealOnResize = () => { if (selected && graph) requestAnimationFrame(() => { if (selected) revealSelection(selected); }); };
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(revealOnResize).observe(canvas);
else window.addEventListener('resize', revealOnResize);
function refreshDetails() {
  if (!selected) { details.hidden = true; return; }
  if (editing) {
    if (details.dataset.editKind === editing.kind && details.dataset.editId === editing.id && details.querySelector('form')) return;
    showEditor(details, doc, editing, { cancel: finishEditing, save: saveEdit });
    return;
  }
  delete details.dataset.editKind; delete details.dataset.editId;
  showDetails(details, doc, index, selected, { close: () => clearSelection(true), highlight: direction => { highlight = direction; applyHighlight(); for (const b of details.querySelectorAll<HTMLElement>('[data-highlight]')) b.setAttribute('aria-pressed', String(b.dataset.highlight === direction)); }, toggle: toggleGroup, edit: target => { editing = target; refreshDetails(); }, collapsed });
}
function clearSelection(restoreFocus = false) { selected = undefined; editing = undefined; highlight = undefined; details.hidden = true; applyHighlight(); if (restoreFocus) focusSelection(); }
function choose(selection: Selection) {
  selected = selection; editing = undefined; highlight = undefined; focusKind = selection.kind; focusId = selection.kind === 'edge' ? selection.originalEdgeIds?.[0] ?? selection.id : selection.id;
  refreshDetails(); applyHighlight(); revealSelection(selection);
}
function refreshLegend() {
  const footer = document.querySelector('footer')!;
  footer.querySelector('.legend')?.remove();
  const kinds = [...new Set(doc.edges.map(edge => edge.kind))].filter(kind => ['exception', 'feedback', 'dependency'].includes(kind));
  const hasSourceColours = doc.edges.some(edge => edge.kind !== 'exception' && edge.kind !== 'feedback');
  if (!kinds.length && !hasSourceColours) return;
  const legend = document.createElement('div'); legend.className = 'legend'; legend.setAttribute('aria-label', '连线图例');
  if (hasSourceColours) { const item = document.createElement('span'); item.textContent = '普通连线按来源着色'; legend.append(item); }
  const names: Record<string, string> = { exception: '异常', feedback: '反馈', dependency: '依赖' };
  for (const kind of kinds) { const item = document.createElement('span'); const mark = document.createElement('i'); mark.className = kind; item.append(mark, document.createTextNode(names[kind])); legend.append(item); }
  footer.insertBefore(legend, byId('status'));
}
function paint() {
  if (!graph) return;
  const hadFocus = scene.contains(document.activeElement) || (details.contains(document.activeElement) && !editing);
  scene.replaceChildren(renderGraph(graph, themes[theme], { animateFlow, overrideReducedMotion: motionUserOverride }));
  document.body.dataset.theme = theme; byId('theme').textContent = theme === 'light' ? '深色主题' : '浅色主题';
  byId('motion').textContent = animateFlow ? '暂停流向' : '播放流向'; byId('motion').setAttribute('aria-pressed', String(animateFlow));
  applyHighlight(); refreshDetails(); if (hadFocus) focusSelection();
}
interface LayoutRequest { document: DiagramDocument; collapsed: Set<string>; anchor?: { id: string; screen: Point }; reset?: boolean; readableStart?: boolean; }
const scheduler = new LayoutScheduler<LayoutRequest, LayoutGraph>(async state => {
  const start = performance.now();
  const measured = await measureGraph(projectVisibleGraph(state.document, state.collapsed), themes[theme]);
  const layout = await layoutGraph(measured, state.document.view);
  const checks = checkGeometry(layout);
  const errors = checks.filter(d => d.severity === 'error');
  if (errors.length) throw new Error(JSON.stringify(errors, null, 2));
  for (const edge of layout.edges) Object.assign(edge, { primary: edge.originalEdgeIds.some(id => state.document.view.primaryPath?.includes(id)) });
  metrics.layouts.push(performance.now() - start); return layout;
}, (layout, request) => {
  const editedFocusId = pendingDoc === request.document && pendingHistory === 'edit' ? editing?.id : undefined;
  if (pendingDoc === request.document) {
    if (pendingHistory === 'edit') { undoDocs.push(doc); if (undoDocs.length > 30) undoDocs.shift(); redoDocs.length = 0; }
    else if (pendingHistory === 'undo') { undoDocs.pop(); redoDocs.push(doc); }
    else if (pendingHistory === 'redo') { redoDocs.pop(); undoDocs.push(doc); }
    doc = request.document; index = buildGraphIndex(doc);
    if (editing?.kind === 'edge') { selected = { kind: 'edge', id: editing.id, originalEdgeIds: [editing.id] }; focusId = editing.id; focusKind = 'edge'; }
    editing = undefined;
    byId('blueprint-data').textContent = safeDocumentJson(doc);
    refreshLegend();
    pendingDoc = undefined; pendingHistory = undefined; updateHistoryButtons();
  }
  graph = layout; diagnostics = checkGeometry(layout); byId('error').hidden = true;
  if (selected?.kind === 'edge') {
    const originalId = focusKind === 'edge' && focusId && index.edges.has(focusId) ? focusId
      : selected.originalEdgeIds?.find(id => index.edges.has(id));
    const visible = originalId && graph.edges.find(edge => edge.originalEdgeIds.includes(originalId));
    if (visible) { selected = { kind: 'edge', id: visible.id, originalEdgeIds: [...visible.originalEdgeIds] }; focusId = originalId; focusKind = 'edge'; }
    else { selected = undefined; highlight = undefined; }
  } else if (selected?.kind === 'node') {
    const visible = graph.nodes.find(n => n.originalNodeIds.includes(selected!.id));
    if (visible?.originalGroupId) { selected = { kind: 'group', id: visible.originalGroupId }; focusId = visible.originalGroupId; focusKind = 'group'; }
  } else if (selected?.kind === 'group' && !graph.groups.some(g => g.id === selected!.id)) {
    const members = index.groupMembers.get(selected.id)!;
    const visible = graph.nodes.find(node => node.originalGroupId && node.originalNodeIds.some(id => members.has(id)));
    if (visible?.originalGroupId) { selected = { kind: 'group', id: visible.originalGroupId }; focusId = visible.originalGroupId; focusKind = 'group'; }
  }
  paint();
  if (editedFocusId) focusReviewAction(editedFocusId);
  if (initialFit || request.reset || request.readableStart) {
    fit((initialFit && !request.reset) || !!request.readableStart);
    initialFit = false;
    if (request.readableStart && selected) revealSelection(selected);
  }
  else if (request.anchor) {
    const anchor = getGroupAnchor(request.anchor.id, graph);
    if (anchor) select(canvas).call(zoomer.transform, zoomIdentity.translate(request.anchor.screen.x - anchor.x * transform.k, request.anchor.screen.y - anchor.y * transform.k).scale(transform.k));
  }
}, error => { pendingDoc = undefined; pendingHistory = undefined; updateHistoryButtons(); reportError(error); });
function toggleGroup(id: string) {
  if (!index?.groups.has(id)) return;
  const anchor = getGroupAnchor(id, graph);
  const screen = anchor ? { x: anchor.x * transform.k + transform.x, y: anchor.y * transform.k + transform.y } : undefined;
  if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
  scheduler.request({ document: pendingDoc ?? doc, collapsed: new Set(collapsed), anchor: screen ? { id, screen } : undefined });
}
function reset() { clearSelection(); collapsed = new Set((pendingDoc ?? doc).view.collapsedGroups ?? []); scheduler.request({ document: pendingDoc ?? doc, collapsed: new Set(collapsed), reset: true }); }
function handleTarget(target: EventTarget | null) {
  if (!(target instanceof Element) || !graph) return;
  if (pendingDoc) { byId('status').textContent = '请等待当前图形更新完成。'; return; }
  if (editing && details.dataset.dirty === 'true') { byId('status').textContent = '请先保存或取消详情修改。'; return; }
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
document.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); if (pendingDoc) byId('status').textContent = '请等待当前图形更新完成。'; else if (editing && details.dataset.dirty === 'true') byId('status').textContent = '请先保存或点击取消修改。'; else if (editing) finishEditing(); else clearSelection(true); } });
byId('fit').onclick = () => fit(); byId('reset').onclick = () => { if (pendingDoc) byId('status').textContent = '请等待当前图形更新完成。'; else if (editing && details.dataset.dirty === 'true') byId('status').textContent = '请先保存或取消详情修改。'; else reset(); };
function chooseDirection(direction: DiagramDocument['view']['direction']) {
  if (!doc || pendingDoc) return;
  if (editing) { byId('status').textContent = '请先保存或取消详情修改。'; return; }
  if (doc.view.direction === direction) return;
  void queueDocument({ ...doc, view: { ...doc.view, direction } }, 'edit');
}
byId('direction-right').onclick = () => chooseDirection('RIGHT');
byId('direction-down').onclick = () => chooseDirection('DOWN');
byId('zoom-in').onclick = () => select(canvas).call(zoomer.scaleBy, 1.25);
byId('zoom-out').onclick = () => select(canvas).call(zoomer.scaleBy, .8);
byId('theme').onclick = () => { theme = theme === 'light' ? 'dark' : 'light'; paint(); };
motionPreference.addEventListener('change', event => { if (!motionUserOverride) { animateFlow = !event.matches; paint(); } });
byId('motion').onclick = () => { animateFlow = !animateFlow; motionUserOverride = true; paint(); };
byId('undo-edit').onclick = () => { if (editing && details.dataset.dirty === 'true') { byId('status').textContent = '请先保存或取消详情修改。'; return; } const previous = undoDocs.at(-1); if (previous) void queueDocument(previous, 'undo'); };
byId('redo-edit').onclick = () => { if (editing && details.dataset.dirty === 'true') { byId('status').textContent = '请先保存或取消详情修改。'; return; } const next = redoDocs.at(-1); if (next) void queueDocument(next, 'redo'); };
const api = {
  ready: Promise.resolve(),
  whenIdle: () => scheduler.whenIdle(),
  getState: () => ({ theme, animateFlow, transform: { x: transform.x, y: transform.y, k: transform.k }, graph, selected, highlight, collapsedGroups: [...collapsed], revision: scheduler.revision, committedRevision: scheduler.committedRevision, layoutRuns: scheduler.runs, metrics, diagnostics }),
  getDocument: () => structuredClone(doc),
  toggleGroup,
  exportSvg: async (options: ExportOptions = {}) => { await api.ready; await scheduler.whenIdle(); const svg = await createExportSvg(doc, { theme, ...options }); return new XMLSerializer().serializeToString(svg); },
  prepareRasterExport: async (options: ExportOptions = {}) => {
    await api.ready; await scheduler.whenIdle();
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
  doc = freezeDocument(validation.document);
  index = buildGraphIndex(doc); theme = doc.view.theme; collapsed = new Set(doc.view.collapsedGroups ?? []);
  updateHistoryButtons();
  byId('description').textContent = doc.description ?? '';
  refreshLegend();
  scheduler.request({ document: doc, collapsed: new Set(collapsed) }); await scheduler.whenIdle(); metrics.readyMs = performance.now() - started;
})();
api.ready.catch(reportError);
function readyToDownload(): boolean {
  if (editing && details.dataset.dirty === 'true') {
    byId('status').textContent = '详情有未保存修改，请先保存或取消。';
    return false;
  }
  return true;
}
byId('download').onclick = async () => {
  if (!readyToDownload()) return;
  const button = byId('download') as HTMLButtonElement; button.disabled = true;
  try { const svg = await api.exportSvg(); downloadBlob(`${fileStem()}.svg`, 'image/svg+xml', svg); }
  catch (error) { reportError(error); } finally { button.disabled = false; }
};
byId('download-data').onclick = async () => {
  if (!readyToDownload()) return;
  try { await api.ready; await scheduler.whenIdle(); downloadBlob(`${fileStem()}.diagram.json`, 'application/json', `${JSON.stringify(doc, null, 2)}\n`); }
  catch (error) { reportError(error); }
};
byId('download-html').onclick = async () => {
  if (!readyToDownload()) return;
  try { await api.ready; await scheduler.whenIdle(); downloadBlob(`${fileStem()}-revised.html`, 'text/html', revisedHtml(doc)); }
  catch (error) { reportError(error); }
};
