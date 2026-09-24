import type { LayoutGraph, LayoutNode, Point, TextBlock } from '../layout/types';
import { assignSourceEdgeColours, type ThemeTokens } from './theme';
export const SVG_NS = 'http://www.w3.org/2000/svg';
export interface RenderOptions { animateFlow?: boolean; overrideReducedMotion?: boolean; }
const cornerCoordinate = (value: number) => Number(value.toFixed(3));
const pointCommand = (command: 'M' | 'L', point: Point) => `${command}${point.x} ${point.y}`;

/** ELK waypoints converted by the layout layer into complete cubic control triplets. */
export function splineEdgePath(points: Point[]): string {
  if (points.length < 4 || (points.length - 1) % 3 !== 0) throw new Error('Spline path needs complete cubic control points.');
  const xy = (point: Point) => `${cornerCoordinate(point.x)} ${cornerCoordinate(point.y)}`;
  const commands = [`M${xy(points[0]!)}`];
  for (let i = 1; i < points.length; i += 3) commands.push(`C${xy(points[i]!)} ${xy(points[i + 1]!)} ${xy(points[i + 2]!)}`);
  return commands.join(' ');
}

/** Keep explicit straight segments only when a continuous curve cannot clear obstacles. */
export function polylineEdgePath(points: Point[]): string {
  const route = points.filter((point, index) => index === 0 ||
    Math.hypot(point.x - points[index - 1]!.x, point.y - points[index - 1]!.y) > 1e-6);
  return route.map((point, index) => pointCommand(index ? 'L' : 'M', point)).join(' ');
}
export function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  return element;
}
function writeText(parent: SVGElement, block: TextBlock, x: number, y: number, fill: string, bold = false, centered = false) {
  if (!block.lines.length) return;
  const element = svgElement('text', { x, y, fill, 'font-size': block.fontSize, 'font-weight': bold ? 600 : 400, 'text-anchor': centered ? 'middle' : 'start', 'data-text-block': 'true' });
  block.lines.forEach((line, i) => { const span = svgElement('tspan', { x, dy: i === 0 ? 0 : block.lineHeight }); span.textContent = line; element.append(span); });
  parent.append(element);
}
function shape(node: LayoutNode, theme: ThemeTokens): SVGElement {
  const { width: w, height: h } = node;
  const colour = node.isCollapsed ? { fill: theme.surface, stroke: theme.border }
    : node.kind === 'decision' ? theme.semantic.decision
    : node.kind === 'store' ? theme.semantic.store
    : node.kind === 'external' ? theme.semantic.external
    : node.kind === 'start' || node.kind === 'end' ? theme.semantic.terminal
    : theme.semantic.process;
  const attrs = { ...colour, 'stroke-width': 1.5, class: 'bp-shape' };
  if (node.kind === 'decision') return svgElement('polygon', { ...attrs, points: `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}` });
  if (node.kind === 'store') return svgElement('path', { ...attrs, d: `M0 12 C0 -4 ${w} -4 ${w} 12 V${h - 12} C${w} ${h + 4} 0 ${h + 4} 0 ${h - 12} Z M0 12 C0 28 ${w} 28 ${w} 12` });
  return svgElement('rect', { ...attrs, width: w, height: h, rx: ['start', 'end'].includes(node.kind) ? h / 2 : 8, 'stroke-dasharray': node.kind === 'external' ? '5 3' : 'none' });
}
export function renderGraph(graph: LayoutGraph, theme: ThemeTokens, options: RenderOptions = {}): SVGSVGElement {
  const root = svgElement('svg', { xmlns: SVG_NS, width: graph.width, height: graph.height, viewBox: `0 0 ${graph.width} ${graph.height}`, role: 'group', 'aria-label': '技术图', 'data-diagram': 'true' });
  root.style.fontFamily = theme.fontFamily;
  const style = svgElement('style');
  style.textContent = `.bp-node,.bp-group-toggle,.bp-edge{cursor:pointer}.bp-node:focus{outline:none}.bp-node:focus .bp-shape,.bp-node.bp-selected .bp-shape{stroke:${theme.accent};stroke-width:3}.bp-dim{opacity:.2}.bp-related .bp-shape{stroke:${theme.accent};stroke-width:2.5}.bp-edge.bp-related .bp-edge-line,.bp-edge.bp-selected .bp-edge-line{stroke-width:3}.bp-edge:focus .bp-edge-line{stroke-width:3}.bp-group-toggle:focus rect{stroke:${theme.accent};stroke-width:2}.bp-group-toggle:hover rect{fill:${theme.group}}`
    + (options.animateFlow ? `.bp-edge-flow{pointer-events:none;animation:bp-flow 1.8s linear infinite}.bp-motion-paused .bp-edge-flow{animation-play-state:paused}@keyframes bp-flow{to{stroke-dashoffset:-21}}${options.overrideReducedMotion ? '' : '@media (prefers-reduced-motion:reduce){.bp-edge-flow{display:none}}'}` : '');
  root.append(style);
  const defs = svgElement('defs');
  const markerColours = {
    exception: theme.exception, feedback: theme.semantic.feedbackEdge,
    ...Object.fromEntries(theme.sourceEdgePalette.map((colour, index) => [`source-${index}`, colour])),
  };
  for (const [name, colour] of Object.entries(markerColours)) { const marker = svgElement('marker', { id: `bp-arrow-${name}`, markerWidth: 8, markerHeight: 8, refX: 8, refY: 4, orient: 'auto', markerUnits: 'userSpaceOnUse' }); marker.append(svgElement('path', { d: 'M0 0 L8 4 L0 8 Z', fill: colour })); defs.append(marker); }
  root.append(defs);
  root.append(svgElement('rect', { width: graph.width, height: graph.height, fill: theme.background, 'data-background': 'true' }));
  for (const group of graph.groups) {
    const el = svgElement('g', { 'data-group-id': group.id, tabindex: 0, role: 'button', 'aria-label': `分组 ${group.label}` });
    el.append(svgElement('rect', { x: group.x, y: group.y, width: group.width, height: group.height, rx: 10, fill: theme.group, 'fill-opacity': .55, stroke: theme.border, 'stroke-dasharray': '5 4' }));
    writeText(el, group.titleText, group.x + 20, group.y + 29, theme.muted, true);
    const button = svgElement('g', { class: 'bp-group-toggle', 'data-group-toggle': group.id, tabindex: 0, role: 'button', 'aria-label': `折叠 ${group.label}`, 'aria-expanded': 'true', transform: `translate(${group.x + group.width - 48} ${group.y + 8})` });
    button.append(svgElement('rect', { width: 40, height: 40, rx: 6, fill: theme.surface, stroke: theme.border }));
    button.append(svgElement('path', { d: 'M14 20 H26', stroke: theme.muted, 'stroke-width': 1.5 })); el.append(button); root.append(el);
  }
  const labels = svgElement('g', { 'data-edge-labels': 'true' });
  const nodeById = new Map(graph.nodes.map(node => [node.id, node]));
  const sourceColours = assignSourceEdgeColours(graph.nodes.flatMap(node => node.originalNodeIds), theme);
  for (const edge of graph.edges) {
    const main = !!(edge as typeof edge & { primary?: boolean }).primary;
    const sourceNode = nodeById.get(edge.source);
    const sourceId = sourceNode?.originalNodeIds.includes(edge.source) ? edge.source : sourceNode?.originalNodeIds.slice().sort()[0];
    const assigned = sourceId ? sourceColours.get(sourceId) : undefined;
    if (!assigned) throw new Error(`缺少连接 ${edge.id} 的来源节点颜色。`);
    const colour = edge.kind === 'exception' ? theme.exception : edge.kind === 'feedback' ? theme.semantic.feedbackEdge : assigned.colour;
    const marker = edge.kind === 'exception' || edge.kind === 'feedback' ? edge.kind : assigned.markerKey;
    const dash = edge.kind === 'feedback' ? '6 4' : edge.kind === 'dependency' ? '3 4' : 'none';
    const kindName = { control: '流程', data: '数据', dependency: '依赖', exception: '异常', feedback: '反馈' }[edge.kind];
    const el = svgElement('g', { class: 'bp-edge', 'data-edge-id': edge.id, 'data-edge-kind': edge.kind, tabindex: 0, role: 'button', 'aria-label': `${kindName}：${edge.source} ${edge.directed ? '到' : '关联'} ${edge.target}${edge.label ? `：${edge.label}` : ''}` });
    for (const points of edge.sections) {
      const d = edge.routing === 'spline' ? splineEdgePath(points) : polylineEdgePath(points);
      el.append(svgElement('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 16, 'data-edge-hit': 'true' }));
      el.append(svgElement('path', { d, fill: 'none', stroke: colour, 'stroke-width': main ? 2.8 : 2, 'stroke-dasharray': dash, 'stroke-linejoin': 'round', 'marker-end': edge.directed ? `url(#bp-arrow-${marker})` : '', class: 'bp-edge-line' }));
      if (options.animateFlow && main && edge.directed) el.append(svgElement('path', { d, fill: 'none', stroke: theme.name === 'light' ? '#FFFFFF' : '#111827', 'stroke-width': 2, 'stroke-dasharray': '5 16', 'stroke-linecap': 'round', class: 'bp-edge-flow', 'aria-hidden': 'true' }));
    }
    root.append(el);
    if (edge.labelBox && edge.labelText.lines.length) {
      const b = edge.labelBox;
      const label = svgElement('g', { 'data-label-edge-id': edge.id, 'pointer-events': 'none' });
      label.append(svgElement('rect', { x: b.x - 5, y: b.y - 2, width: b.width + 10, height: b.height + 4, rx: 3, fill: theme.background }));
      writeText(label, edge.labelText, b.x, b.y + edge.labelText.fontSize, colour); labels.append(label);
    }
  }
  for (const node of graph.nodes) {
    const el = svgElement('g', { class: 'bp-node', 'data-node-id': node.id, 'data-node-kind': node.kind, 'data-original-node-ids': JSON.stringify(node.originalNodeIds), tabindex: 0, role: 'button', 'aria-label': node.label, transform: `translate(${node.x} ${node.y})` });
    if (node.isCollapsed) { el.setAttribute('data-group-toggle-node', node.originalGroupId!); el.setAttribute('aria-expanded', 'false'); }
    el.append(shape(node, theme));
    const centered = ['start', 'end', 'decision'].includes(node.kind);
    const total = node.titleText.height + (node.summaryText.height ? node.summaryText.height + 8 : 0) + (node.noteText.height ? node.noteText.height + 8 : 0);
    let y = (node.height - total) / 2 + 15 + (node.kind === 'store' ? 4 : 0);
    const x = centered ? node.width / 2 : 16;
    writeText(el, node.titleText, x, y, theme.text, true, centered); y += node.titleText.height + 8;
    writeText(el, node.summaryText, x, y - 2, theme.muted, false, centered); y += node.summaryText.height + 8;
    writeText(el, node.noteText, x, y - 3, theme.muted, false, centered);
    if (node.kind === 'external') { const t = svgElement('text', { x: node.width - 20, y: 18, fill: theme.muted, 'font-size': 12 }); t.textContent = '↗'; el.append(t); }
    if (node.kind === 'fork' || node.kind === 'join') el.append(svgElement('rect', { x: 16, y: node.height - 10, width: node.width - 32, height: 4, fill: theme.text }));
    if (node.isCollapsed) {
      const toggle = svgElement('g', { 'data-group-toggle': node.originalGroupId!, class: 'bp-group-toggle', tabindex: 0, role: 'button', 'aria-label': `展开 ${node.label}`, 'aria-expanded': 'false', transform: `translate(${node.width - 43} 2)` });
      toggle.append(svgElement('rect', { width: 40, height: 40, rx: 6, fill: theme.surface, stroke: 'none' }));
      toggle.append(svgElement('path', { d: 'M15 20 H25 M20 15 V25', stroke: theme.muted, 'stroke-width': 1.5 })); el.append(toggle);
    }
    root.append(el);
  }
  root.append(labels);
  return root;
}
