import type { Box, LayoutGraph, Point } from './types.ts';
import { routeIntersectsBoxes } from './geometry.ts';

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Convert a routed waypoint chain into connected cubic Beziers with a shared tangent at each bend. */
export function splineControls(points: Point[], tension = 1): Point[] {
  const route = points.filter((point, index) => index === 0 || distance(point, points[index - 1]!) > 1e-6);
  if (route.length < 2) throw new Error('A curve needs at least two distinct route points.');
  const tangent = (index: number): Point => {
    const current = route[index]!;
    const before = route[Math.max(0, index - 1)]!;
    const after = route[Math.min(route.length - 1, index + 1)]!;
    const length = index === 0 ? distance(current, after)
      : index === route.length - 1 ? distance(before, current)
        : Math.min(distance(before, current), distance(current, after));
    const direction = { x: after.x - before.x, y: after.y - before.y };
    const magnitude = Math.hypot(direction.x, direction.y);
    if (magnitude < 1e-6) return { x: 0, y: 0 };
    return { x: direction.x / magnitude * length * tension, y: direction.y / magnitude * length * tension };
  };
  const result = [route[0]!];
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]!; const b = route[i + 1]!;
    const start = tangent(i); const end = tangent(i + 1);
    result.push(
      { x: a.x + start.x / 3, y: a.y + start.y / 3 },
      { x: b.x - end.x / 3, y: b.y - end.y / 3 },
      b,
    );
  }
  return result;
}

/** Only keep a curved replacement when its actual painted path remains clear of diagram content. */
export function smoothGraphRoutes(graph: LayoutGraph): LayoutGraph {
  const titles: Box[] = graph.groups.filter(group => group.titleText.lines.length).map(group => ({
    x: group.x + 20, y: group.y + 14, width: group.titleText.width, height: group.titleText.height,
  }));
  const edges = graph.edges.map(edge => {
    if (edge.sections.every(section => section.length <= 2)) return edge;
    const obstacles: Box[] = [
      ...graph.nodes.filter(node => node.id !== edge.source && node.id !== edge.target),
      ...titles,
      ...graph.edges.filter(other => other.id !== edge.id && other.labelBox).map(other => ({
        x: other.labelBox!.x - 5, y: other.labelBox!.y - 2,
        width: other.labelBox!.width + 10, height: other.labelBox!.height + 4,
      })),
    ];
    for (const tension of [1.4, 1, .7, .4]) {
      const sections = edge.sections.map(section => splineControls(section, tension));
      const bounded = sections.flat().every(point => point.x >= 0 && point.y >= 0 && point.x <= graph.width && point.y <= graph.height);
      if (bounded && !routeIntersectsBoxes(sections, true, obstacles)) return { ...edge, sections, routing: 'spline' as const };
    }
    return edge;
  });
  return { ...graph, edges };
}
