import type { Diagnostic } from '../model/types.ts';
import type { Box, LayoutGraph, LayoutNode, Point } from './types.ts';

const EPSILON = .01;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

/** Move an ELK port onto the rendered outline, preserving its assigned side even for diagonal routes. */
export function shapeBoundaryPoint(node: LayoutNode, port: Point, adjacent: Point): Point {
  const w = node.width; const h = node.height;
  const x = clamp(port.x - node.x, 0, w); const y = clamp(port.y - node.y, 0, h);
  const xSideDistance = Math.min(Math.abs(port.x - node.x), Math.abs(port.x - node.x - w));
  const ySideDistance = Math.min(Math.abs(port.y - node.y), Math.abs(port.y - node.y - h));
  const horizontal = xSideDistance + EPSILON < ySideDistance ? true
    : ySideDistance + EPSILON < xSideDistance ? false
      : Math.abs(port.x - adjacent.x) >= Math.abs(port.y - adjacent.y);
  const positiveSide = horizontal ? port.x > node.x + w / 2 : port.y > node.y + h / 2;
  if (node.kind === 'decision') {
    if (horizontal) {
      const halfWidth = w / 2 * (1 - Math.abs(y - h / 2) / (h / 2));
      return { x: node.x + w / 2 + (positiveSide ? halfWidth : -halfWidth), y: port.y };
    }
    const halfHeight = h / 2 * (1 - Math.abs(x - w / 2) / (w / 2));
    return { x: port.x, y: node.y + h / 2 + (positiveSide ? halfHeight : -halfHeight) };
  }
  if (node.kind === 'store') {
    // Matches render/svg.ts: the cap is a cubic Bezier, not a true ellipse.
    if (!horizontal) {
      let lo = 0; let hi = 1;
      for (let i = 0; i < 32; i++) {
        const t = (lo + hi) / 2;
        if (3 * t * t - 2 * t * t * t < x / w) lo = t; else hi = t;
      }
      const t = (lo + hi) / 2;
      const cap = 12 - 48 * t * (1 - t);
      return { x: port.x, y: node.y + (positiveSide ? h - cap : cap) };
    }
    const capY = Math.min(y, h - y);
    const t = capY < 12 ? (1 - Math.sqrt(Math.max(0, capY / 12))) / 2 : 0;
    const inset = w * (3 * t * t - 2 * t * t * t);
    return { x: node.x + (positiveSide ? w - inset : inset), y: port.y };
  }
  const radius = node.kind === 'start' || node.kind === 'end' ? Math.min(w, h) / 2 : 8;
  if (horizontal) {
    const cy = clamp(y, radius, h - radius);
    const inset = radius - Math.sqrt(Math.max(0, radius * radius - (y - cy) ** 2));
    return { x: node.x + (positiveSide ? w - inset : inset), y: port.y };
  }
  const cx = clamp(x, radius, w - radius);
  const inset = radius - Math.sqrt(Math.max(0, radius * radius - (x - cx) ** 2));
  return { x: port.x, y: node.y + (positiveSide ? h - inset : inset) };
}

function contains(outer: Box, inner: Box, padding = 0): boolean {
  return inner.x >= outer.x + padding - EPSILON && inner.y >= outer.y + padding - EPSILON &&
    inner.x + inner.width <= outer.x + outer.width - padding + EPSILON && inner.y + inner.height <= outer.y + outer.height - padding + EPSILON;
}
function overlaps(a: Box, b: Box): boolean {
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > EPSILON &&
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > EPSILON;
}
function finiteBox(box: Box): boolean { return [box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width > 0 && box.height > 0; }
function segmentIntersectsBox(a: Point, b: Point, box: Box): boolean {
  // Liang–Barsky against a slightly inset box excludes a route merely touching its border.
  const left = box.x + EPSILON; const right = box.x + box.width - EPSILON;
  const top = box.y + EPSILON; const bottom = box.y + box.height - EPSILON;
  let lo = 0; let hi = 1;
  const dx = b.x - a.x; const dy = b.y - a.y;
  const ps = [-dx, dx, -dy, dy]; const qs = [a.x - left, right - a.x, a.y - top, bottom - a.y];
  for (let i = 0; i < 4; i++) {
    const p = ps[i]!; const q = qs[i]!;
    if (Math.abs(p) < EPSILON) { if (q < 0) return false; continue; }
    const ratio = q / p;
    if (p < 0) lo = Math.max(lo, ratio); else hi = Math.min(hi, ratio);
    if (lo > hi) return false;
  }
  return true;
}

/** Curved routes store cubic controls, so geometry checks must follow the drawn curve. */
export function drawnSection(points: Point[], spline: boolean): Point[] {
  if (!spline || points.length < 4 || (points.length - 1) % 3 !== 0) return points;
  const drawn = [points[0]!];
  for (let i = 0; i + 3 < points.length; i += 3) {
    const a = points[i]!; const b = points[i + 1]!; const c = points[i + 2]!; const d = points[i + 3]!;
    const controlLength = Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - b.x, c.y - b.y) + Math.hypot(d.x - c.x, d.y - c.y);
    const steps = Math.max(8, Math.min(512, Math.ceil(controlLength / 6)));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps; const u = 1 - t;
      drawn.push({
        x: u ** 3 * a.x + 3 * u ** 2 * t * b.x + 3 * u * t ** 2 * c.x + t ** 3 * d.x,
        y: u ** 3 * a.y + 3 * u ** 2 * t * b.y + 3 * u * t ** 2 * c.y + t ** 3 * d.y,
      });
    }
  }
  return drawn;
}

export function routeIntersectsBoxes(sections: Point[][], spline: boolean, boxes: Box[]): boolean {
  return sections.some(points => {
    const drawn = drawnSection(points, spline);
    return boxes.some(box => drawn.slice(1).some((point, i) => segmentIntersectsBox(drawn[i]!, point, box)));
  });
}

/** Report geometric defects without treating ordinary edge crossings as invalid topology. */
export function checkGeometry(graph: LayoutGraph): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const add = (code: string, path: string, ids: string[], message: string, severity: Diagnostic['severity'] = 'error') => {
    const match = /^\/(nodes|edges|groups)\/(\d+)(.*)$/.exec(path);
    if (match) {
      const position = Number(match[2]);
      const original = match[1] === 'edges' ? graph.edges[position]?.sourcePaths?.[0] : match[1] === 'nodes' ? graph.nodes[position]?.sourcePath : graph.groups[position]?.sourcePath;
      if (original) path = original + (match[1] === 'nodes' && graph.nodes[position]?.isCollapsed && match[3] === '/groupId' ? '/parentId' : match[3]);
    }
    const originalIds = ids.flatMap(id => {
      const node = graph.nodes.find(n => n.id === id);
      if (node?.originalGroupId) return [node.originalGroupId];
      return graph.edges.find(edge => edge.id === id)?.originalEdgeIds ?? [id];
    });
    diagnostics.push({ code, path, ids: [...new Set(originalIds)], message, severity });
  };
  const canvas = { x: 0, y: 0, width: graph.width, height: graph.height };
  if (!finiteBox(canvas)) add('LAYOUT_INVALID_BOUNDS', '', [], '布局画布尺寸必须是有限正数。');
  const groups = new Map(graph.groups.map(group => [group.id, group]));
  const titles = graph.groups.map(group => ({ id: group.id, x: group.x + 20, y: group.y + 14, width: group.titleText.width, height: group.titleText.height }));
  graph.nodes.forEach((node, i) => {
    if (!finiteBox(node)) add('LAYOUT_INVALID_BOUNDS', `/nodes/${i}`, [node.id], '节点坐标或尺寸无效。');
    if (!contains(canvas, node)) add('NODE_OUT_OF_BOUNDS', `/nodes/${i}`, [node.id], '节点超出了完整画布边界。');
    const parent = node.groupId ? groups.get(node.groupId) : undefined;
    if (parent && (!contains(parent, node, 24) || node.y < parent.y + Math.max(56, parent.titleText.height + 24) - EPSILON)) {
      add('GROUP_CONTAINMENT', `/nodes/${i}/groupId`, [node.id, parent.id], '节点必须位于所属分组内，保留 24 px 内边距并避开组标题。');
    }
    const blocks = [node.titleText, node.summaryText, node.noteText].filter(block => block.lines.length);
    const contentHeight = blocks.reduce((sum, block) => sum + block.height, 0) + Math.max(0, blocks.length - 1) * 8;
    const textWidth = Math.max(0, ...blocks.map(block => block.width));
    const allowedWidth = node.kind === 'decision' ? node.width * (1 - contentHeight / node.height) : node.width - 32;
    if (textWidth > allowedWidth + EPSILON || contentHeight > node.height - 24) {
      add('NODE_TEXT_OVERFLOW', `/nodes/${i}/label`, [node.id], '测量后的节点文字超出形状内部可用区域；请精简内容或调整形状尺寸，不缩小字号。');
    }
    for (let j = i + 1; j < graph.nodes.length; j++) if (overlaps(node, graph.nodes[j]!)) add('NODE_OVERLAP', `/nodes/${i}`, [node.id, graph.nodes[j]!.id], '节点外框发生重叠。');
  });
  graph.groups.forEach((group, i) => {
    if (!finiteBox(group)) add('LAYOUT_INVALID_BOUNDS', `/groups/${i}`, [group.id], '分组坐标或尺寸无效。');
    if (!contains(canvas, group)) add('GROUP_OUT_OF_BOUNDS', `/groups/${i}`, [group.id], '分组超出了完整画布边界。');
    if (group.width < group.titleText.width + 76) add('GROUP_TITLE_OVERFLOW', `/groups/${i}/label`, [group.id], '分组标题与折叠控件没有足够空间。');
    const parent = group.parentId ? groups.get(group.parentId) : undefined;
    if (parent && (!contains(parent, group, 24) || group.y < parent.y + Math.max(56, parent.titleText.height + 24) - EPSILON)) {
      add('GROUP_CONTAINMENT', `/groups/${i}/parentId`, [group.id, parent.id], '子分组必须完整位于父分组的内容区。');
    }
    for (let j = i + 1; j < graph.groups.length; j++) if (group.parentId === graph.groups[j]!.parentId && overlaps(group, graph.groups[j]!)) add('GROUP_OVERLAP', `/groups/${i}`, [group.id, graph.groups[j]!.id], '同层分组发生重叠。');
  });
  graph.edges.forEach((edge, i) => {
    if (!edge.sections.length) add('EDGE_ROUTE_MISSING', `/edges/${i}`, [edge.id], '边没有可绘制的路径。');
    const drawn = edge.sections.map(section => drawnSection(section, edge.routing === 'spline'));
    for (const section of edge.sections) {
      if (section.length < 2) add('EDGE_ROUTE_MISSING', `/edges/${i}`, [edge.id], '连线路径至少需要两个端点。');
      if (edge.routing === 'spline' && (section.length - 1) % 3 !== 0) add('EDGE_ROUTE_INVALID', `/edges/${i}`, [edge.id], '样条控制点必须构成完整三次曲线。');
      if (section.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < -EPSILON || p.y < -EPSILON || p.x > graph.width + EPSILON || p.y > graph.height + EPSILON)) add('EDGE_OUT_OF_BOUNDS', `/edges/${i}`, [edge.id], '边折点超出画布或包含非有限坐标。');
    }
    for (const node of graph.nodes) {
      if (node.id === edge.source || node.id === edge.target) continue;
      if (drawn.some(section => section.slice(1).some((point, k) => segmentIntersectsBox(section[k]!, point, node)))) add('EDGE_NODE_INTERSECTION', `/edges/${i}`, [edge.id, node.id], '连线穿过了非端点节点。');
    }
    for (const title of titles) if (drawn.some(section => section.slice(1).some((point, k) => segmentIntersectsBox(section[k]!, point, title)))) add('EDGE_GROUP_TITLE_INTERSECTION', `/edges/${i}`, [edge.id, title.id], '连线穿过了分组标题。');
    if (edge.labelText.lines.length && !edge.labelBox) add('LABEL_MISSING', `/edges/${i}/label`, [edge.id], '非空边标签没有布局位置。');
    if (edge.labelBox) {
      const label = { x: edge.labelBox.x - 5, y: edge.labelBox.y - 2, width: edge.labelBox.width + 10, height: edge.labelBox.height + 4 };
      if (!finiteBox(label) || !contains(canvas, label)) add('LABEL_OUT_OF_BOUNDS', `/edges/${i}/label`, [edge.id], '边标签及背景超出画布。');
      for (const node of graph.nodes) if (overlaps(label, node)) add('LABEL_NODE_OVERLAP', `/edges/${i}/label`, [edge.id, node.id], '边标签遮挡了节点。');
      for (const title of titles) if (overlaps(label, title)) add('LABEL_GROUP_TITLE_OVERLAP', `/edges/${i}/label`, [edge.id, title.id], '边标签遮挡了分组标题。');
      for (let j = i + 1; j < graph.edges.length; j++) {
        const other = graph.edges[j]!;
        if (other.labelBox && overlaps(label, { x: other.labelBox.x - 5, y: other.labelBox.y - 2, width: other.labelBox.width + 10, height: other.labelBox.height + 4 })) add('LABEL_OVERLAP', `/edges/${i}/label`, [edge.id, other.id], '两个边标签发生重叠。');
      }
    }
  });
  if (Math.max(graph.width / graph.height, graph.height / graph.width) > 8) add('LAYOUT_ELONGATED', '', [], '图较长，适应画布后文字可能过小；请考虑拆分为总览与子图。', 'warning');
  return diagnostics;
}
