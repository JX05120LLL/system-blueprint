import type { VisibleGraph } from '../projection/visible-graph';
import type { MeasuredGraph, TextBlock } from './types';
import type { ThemeTokens } from '../render/theme';
import { wrapText } from './text';
export class ContentError extends Error {
  readonly code = 'TEXT_OVERFLOW';
  readonly severity = 'error';
  constructor(public path: string, public ids: string[], message: string) { super(message); }
}
export async function measureGraph(graph: VisibleGraph, theme: ThemeTokens): Promise<MeasuredGraph> {
  await document.fonts.ready;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;left:-10000px;top:0;width:1000px;height:1000px;visibility:hidden;pointer-events:none';
  const text = document.createElementNS(svg.namespaceURI, 'text') as SVGTextElement;
  text.style.fontFamily = theme.fontFamily;
  svg.append(text); document.body.append(svg);
  const block = (value: string, size: number, maxWidth: number, maxLines: number, path: string, id: string | string[], bold = false): TextBlock => {
    text.setAttribute('font-size', String(size)); text.setAttribute('font-weight', bold ? '600' : '400');
    const cache = new Map<string, number>();
    const measure = (s: string) => { if (cache.has(s)) return cache.get(s)!; text.textContent = s; const width = text.getComputedTextLength(); cache.set(s, width); return width; };
    const lines = wrapText(value, maxWidth, measure);
    const ids = typeof id === 'string' ? [id] : id;
    if (lines.length > maxLines) throw new ContentError(path, ids, `${ids.join(', ')}: ${path} 需要 ${lines.length} 行（最多 ${maxLines} 行）。请精简可见文本或拆图，将实现说明移入 details；不要删除条件。`);
    return { lines, width: Math.max(0, ...lines.map(measure)), height: lines.length * (size + 6), fontSize: size, lineHeight: size + 6 };
  };
  try {
    return {
      ...graph,
      nodes: graph.nodes.map((node, i) => {
        const contentWidth = node.kind === 'decision' ? 144 : node.isCollapsed ? 164 : 192;
        const source = node.sourcePath ?? `/nodes/${i}`, sourceId = node.originalGroupId ?? node.id;
        const titleText = block(node.label, 15, contentWidth, 2, `${source}/label`, sourceId, true);
        const summaryText = block(node.summary ?? '', 13, contentWidth, 2, `${source}/summary`, sourceId);
        const note = node.isCollapsed ? ((node.hiddenDecisionCount || node.hiddenConditionLabels?.length) ? `含 ${node.hiddenDecisionCount ?? 0} 个判断 / ${node.hiddenConditionLabels?.length ?? 0} 个条件，展开查看` : '展开查看内部关系') : node.evidenceStatus === 'planned' ? '规划' : node.evidenceStatus !== 'confirmed' ? '假设' : '';
        const noteText = block(note, 12, contentWidth, 2, `${source}/evidenceStatus`, sourceId);
        const baseHeight = 32 + titleText.height + (summaryText.height ? summaryText.height + 8 : 0) + (noteText.height ? noteText.height + 8 : 0);
        return { ...node, titleText, summaryText, noteText, width: node.kind === 'decision' ? 336 : 224, height: node.kind === 'decision' ? Math.max(170, baseHeight * 2) : Math.max(72, baseHeight + (node.kind === 'store' ? 16 : 0)) };
      }),
      edges: graph.edges.map((edge, i) => ({ ...edge, labelText: block(edge.label ?? '', 12, 180, 3, `${edge.sourcePaths?.[0] ?? `/edges/${i}`}/label`, edge.originalEdgeIds) })),
      groups: graph.groups.map((group, i) => ({ ...group, titleText: block(group.label, 14, 240, 2, `${group.sourcePath ?? `/groups/${i}`}/label`, group.id, true) }))
    };
  } finally { svg.remove(); }
}
