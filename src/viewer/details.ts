import type { DiagramDocument, DiagramEdge, HighlightDirection } from '../model/types';
import type { GraphIndex } from '../model/graph-index';
import { isFlowEdge } from '../model/graph-index';
export interface Selection { kind: 'node' | 'group' | 'edge'; id: string; originalEdgeIds?: string[]; }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; return element; };
export function showDetails(panel: HTMLElement, doc: DiagramDocument, index: GraphIndex, selection: Selection, actions: { close: () => void; highlight: (direction: HighlightDirection) => void; toggle: (id: string) => void; edit: (target: Selection) => void; collapsed: ReadonlySet<string> }) {
  panel.replaceChildren(); panel.hidden = false;
  const close = el('button', '关闭 ×'); close.className = 'close'; close.setAttribute('aria-label', '关闭详情'); close.onclick = actions.close; panel.append(close);
  const relationText = (edge: DiagramEdge) => `${index.nodes.get(edge.source)?.label ?? edge.source} ${edge.directed ? '→' : '↔'} ${index.nodes.get(edge.target)?.label ?? edge.target} · ${edge.kind}${edge.label ? ` · ${edge.label}` : ''}`;
  const list = (title: string, values: string[]) => { panel.append(el('h3', title)); const ul = el('ul'); for (const value of values) ul.append(el('li', value)); if (!values.length) ul.append(el('li', '无')); panel.append(ul); };
  const evidence = (object: { evidenceStatus?: string; sources?: { path: string; line?: number }[] }) => {
    panel.append(el('h3', '信息依据'), el('p', ({ confirmed: '已证实', assumed: '假设，待核实', planned: '规划，尚非运行事实' }[object.evidenceStatus ?? 'assumed'])!));
    list('来源', object.sources?.map(s => `${s.path}${s.line ? `:${s.line}` : ''}`) ?? ['未提供来源']);
  };
  if (selection.kind === 'edge') {
    panel.append(el('h2', '连接详情'));
    const edges = (selection.originalEdgeIds ?? [selection.id]).map(id => index.edges.get(id)).filter((x): x is DiagramEdge => !!x);
    for (const edge of edges) { panel.append(el('h3', edge.id), el('p', relationText(edge))); if (edge.details) panel.append(el('p', edge.details)); const edit = el('button', '编辑详情'); edit.setAttribute('aria-label', edges.length > 1 ? `编辑 ${edge.id} 详情` : '编辑详情'); edit.onclick = () => actions.edit({ kind: 'edge', id: edge.id }); panel.append(edit); evidence(edge); }
    return;
  }
  const object = selection.kind === 'group' ? index.groups.get(selection.id) : index.nodes.get(selection.id);
  if (!object) return;
  panel.append(el('h2', object.label));
  if ('summary' in object && object.summary) panel.append(el('p', object.summary));
  if (object.details) panel.append(el('p', object.details));
  const controls = el('div'); controls.className = 'detail-actions';
  const edit = el('button', '编辑详情'); edit.onclick = () => actions.edit(selection); controls.append(edit);
  for (const [direction, label] of [['upstream', '上游'], ['downstream', '下游']] as const) { const button = el('button', label); button.dataset.highlight = direction; button.onclick = () => actions.highlight(direction); controls.append(button); }
  if (selection.kind === 'group') { const button = el('button', actions.collapsed.has(selection.id) ? '展开分组' : '折叠分组'); button.onclick = () => actions.toggle(selection.id); controls.append(button); }
  panel.append(controls);
  const ids = selection.kind === 'group' ? index.groupMembers.get(selection.id)! : new Set([selection.id]);
  const incoming = doc.edges.filter(e => ids.has(e.target) && (selection.kind !== 'group' || !ids.has(e.source)));
  const outgoing = doc.edges.filter(e => ids.has(e.source) && (selection.kind !== 'group' || !ids.has(e.target)));
  list('输入 / 关联', incoming.map(relationText)); list('输出 / 关联', outgoing.map(relationText));
  if (selection.kind === 'group') {
    panel.append(el('p', `此组包含 ${ids.size} 个节点。关系按成员聚合，不表示任意入口均能到达任意出口。`));
    list('组内流程条件（含折叠隐藏项）', doc.edges.filter(e => ids.has(e.source) && ids.has(e.target) && isFlowEdge(e) && e.label?.trim()).map(relationText));
    list('成员', [...ids].map(id => index.nodes.get(id)!.label));
  } else evidence(index.nodes.get(selection.id)!);
}
