import type { DiagramDocument } from '../model/types';
import { projectVisibleGraph } from '../projection/visible-graph';
import { measureGraph } from '../layout/measure';
import { layoutGraph } from '../layout/elk';
import { checkGeometry } from '../layout/geometry';
import { renderGraph, svgElement, SVG_NS } from '../render/svg';
import { themes } from '../render/theme';
import { wrapText } from '../layout/text';
export interface ExportOptions { theme?: 'light' | 'dark'; background?: string; }
let sequence = 0;
export async function createExportSvg(doc: DiagramDocument, options: ExportOptions = {}): Promise<SVGSVGElement> {
  const baseTheme = themes[options.theme ?? doc.view.theme];
  if (!baseTheme) throw new Error('不支持的导出主题');
  if (options.background && !/^#[\da-f]{6}$/i.test(options.background)) throw new Error('背景色必须为 #RRGGBB');
  const theme = { ...baseTheme, background: options.background ?? baseTheme.background };
  const measured = await measureGraph(projectVisibleGraph(doc, new Set()), theme);
  const graph = await layoutGraph(measured, doc.view);
  const errors = checkGeometry(graph).filter(d => d.severity === 'error');
  if (errors.length) throw new Error(JSON.stringify(errors, null, 2));
  for (const edge of graph.edges) Object.assign(edge, { primary: edge.originalEdgeIds.some(id => doc.view.primaryPath?.includes(id)) });
  const diagram = renderGraph(graph, theme);
  diagram.querySelectorAll('[data-group-toggle]').forEach(el => el.remove());
  diagram.querySelectorAll('[tabindex]').forEach(el => { el.removeAttribute('tabindex'); el.removeAttribute('role'); });
  // Export lives beside the reader. Marker IDs must not resolve into the live theme.
  const prefix = `export-${++sequence}-`;
  const ids = new Map([...diagram.querySelectorAll('[id]')].map(el => [el.id, prefix + el.id]));
  for (const element of [diagram, ...diagram.querySelectorAll('*')]) {
    if (element.id) element.id = ids.get(element.id)!;
    for (const attribute of [...element.attributes]) if (attribute.value.includes('url(#')) element.setAttribute(attribute.name, attribute.value.replace(/url\(#([^)]*)\)/g, (_, id: string) => `url(#${ids.get(id) ?? id})`));
  }
  const width = Math.max(480, graph.width);
  const root = svgElement('svg', { xmlns: SVG_NS, width, role: 'img', 'data-theme': theme.name }); root.style.fontFamily = theme.fontFamily;
  const title = svgElement('title'); title.textContent = doc.title; root.append(title);
  const desc = svgElement('desc'); desc.textContent = doc.description ?? '全展开技术图'; root.append(desc);
  const measuring = svgElement('svg'); measuring.style.cssText = 'position:absolute;left:-10000px;visibility:hidden'; measuring.style.fontFamily = theme.fontFamily;
  const text = svgElement('text'); measuring.append(text); document.body.append(measuring);
  let y = 32;
  try {
    for (const [value, size, bold] of [[doc.title, 22, true], [doc.description ?? '', 13, false]] as const) {
      if (!value) continue;
      text.setAttribute('font-size', String(size)); text.setAttribute('font-weight', bold ? '600' : '400');
      const lines = wrapText(value, width - 64, s => { text.textContent = s; return text.getComputedTextLength(); });
      for (const line of lines) { const t = svgElement('text', { x: 32, y: y + size, fill: bold ? theme.text : theme.muted, 'font-size': size, 'font-weight': bold ? 600 : 400 }); t.textContent = line; root.append(t); y += size + 8; }
      y += 8;
    }
  } finally { measuring.remove(); }
  diagram.setAttribute('y', String(y + 8)); diagram.setAttribute('x', String((width - graph.width) / 2)); root.append(diagram);
  let height = y + 8 + graph.height + 16;
  const types = new Set(doc.edges.map(e => e.kind));
  const legend = [
    ...(doc.edges.some(e => e.kind !== 'exception' && e.kind !== 'feedback') ? ['普通连线按来源节点着色；同源同色，超出色板容量时颜色可能复用'] : []),
    ...(types.has('exception') ? ['红色实线：异常'] : []),
    ...(types.has('feedback') ? ['琥珀长虚线：反馈'] : []),
    ...(types.has('dependency') ? ['短虚线：依赖'] : []),
  ];
  for (const item of legend) { const line = svgElement('text', { x: 32, y: height + 14, fill: theme.muted, 'font-size': 12 }); line.textContent = item; root.append(line); height += 18; }
  if (legend.length) height += 20;
  root.setAttribute('height', String(height)); root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  root.insertBefore(svgElement('rect', { width, height, fill: options.background ?? theme.background }), root.firstChild);
  return root;
}
