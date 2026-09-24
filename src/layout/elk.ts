import { engine } from './engine';
import type { ElkExtendedEdge, ElkNode, LayoutOptions } from 'elkjs/lib/elk-api';
import type { DiagramView } from '../model/types.ts';
import type { LayoutEdge, LayoutGraph, LayoutGroup, LayoutNode, MeasuredGraph, Point } from './types.ts';
import { checkGeometry, shapeBoundaryPoint } from './geometry.ts';
import { smoothGraphRoutes } from './curves.ts';

// Browser build swaps only the engine for an inline Blob Worker; tests use identical ELK in Node.
let layoutQueue: Promise<unknown> = Promise.resolve();
const ROOT_ID = 'root';
const FRAME = 32;

/** Use ELK to avoid obstacles, then turn safe multi-segment routes into continuous curves. */
export async function layoutGraph(graph: MeasuredGraph, view: DiagramView): Promise<LayoutGraph> {
  const polyline = smoothGraphRoutes(await layoutGraphWithRouting(graph, view, 'POLYLINE'));
  const collisions = (result: LayoutGraph) => checkGeometry(result).filter(diagnostic =>
    diagnostic.severity === 'error' && (diagnostic.code === 'EDGE_NODE_INTERSECTION' || diagnostic.code === 'EDGE_GROUP_TITLE_INTERSECTION')).length;
  const initialCollisions = collisions(polyline);
  if (!initialCollisions) return polyline;
  const orthogonal = smoothGraphRoutes(await layoutGraphWithRouting(graph, view, 'ORTHOGONAL'));
  return collisions(orthogonal) < initialCollisions ? orthogonal : polyline;
}

/** Adapt measured compound data to ELK, then convert every result to canvas coordinates. */
async function layoutGraphWithRouting(graph: MeasuredGraph, view: DiagramView, routing: 'POLYLINE' | 'ORTHOGONAL'): Promise<LayoutGraph> {
  const options: LayoutOptions = {
    'elk.algorithm': 'layered', 'elk.direction': view.direction, 'elk.edgeRouting': routing,
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 'elk.spacing.nodeNode': '32',
    'elk.layered.spacing.nodeNodeBetweenLayers': '64', 'elk.spacing.edgeNode': '24',
    'elk.layered.spacing.edgeNodeBetweenLayers': '24', 'elk.spacing.edgeEdge': '16',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '16', 'elk.spacing.labelNode': '16',
    'elk.spacing.edgeLabel': '8', 'elk.spacing.nodeSelfLoop': '32',
    'elk.layered.mergeEdges': 'false', 'elk.layered.mergeHierarchyEdges': 'false',
    // ELK 0.11's SortByInputModel dereferences absent model IDs on hierarchy dummy nodes.
    // Keep source insertion order and a fixed seed, but skip that unsafe sorting pass for compounds.
    'elk.layered.considerModelOrder.strategy': graph.groups.length ? 'NONE' : 'NODES_AND_EDGES',
    'elk.randomSeed': '1', 'elk.padding': `[top=${FRAME},left=${FRAME},bottom=${FRAME},right=${FRAME}]`,
    'elk.json.shapeCoords': 'PARENT', 'elk.json.edgeCoords': 'CONTAINER',
  };
  // Internal names avoid collisions between node IDs, edge IDs, ports, and ELK's root.
  const ids = new Map<string, string>();
  graph.nodes.forEach((node, i) => ids.set(node.id, `n${i}`));
  graph.groups.forEach((group, i) => ids.set(group.id, `g${i}`));
  const root: ElkNode = { id: ROOT_ID, layoutOptions: options, children: [], edges: [] };
  const containers = new Map<string, ElkNode>([[ROOT_ID, root]]);
  graph.groups.forEach(group => {
    const id = ids.get(group.id)!;
    containers.set(id, {
      id, children: [],
      // Padding alone does not keep hierarchy edges out of the header. Let ELK reserve it too.
      labels: [{ text: group.titleText.lines.join('\n'), width: group.titleText.width, height: group.titleText.height, layoutOptions: { 'elk.nodeLabels.placement': 'INSIDE H_LEFT V_TOP' } }],
      layoutOptions: {
        ...options, 'elk.padding': `[top=${Math.max(56, group.titleText.height + 24)},left=24,bottom=24,right=24]`,
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${Math.max(176, group.titleText.width + 76)},${Math.max(80, group.titleText.height + 48)})`,
      },
    });
  });
  graph.groups.forEach(group => {
    const parent = group.parentId ? containers.get(ids.get(group.parentId)!) : root;
    if (!parent) throw new Error(`布局引用了不存在的父组：${group.parentId}`);
    parent.children!.push(containers.get(ids.get(group.id)!)!);
  });
  const elkNodes = new Map<string, ElkNode>();
  graph.nodes.forEach(node => {
    const item: ElkNode = { id: ids.get(node.id)!, width: node.width, height: node.height, ports: [], layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' } };
    const parent = node.groupId ? containers.get(ids.get(node.groupId)!) : root;
    if (!parent) throw new Error(`布局引用了不存在的分组：${node.groupId}`);
    parent.children!.push(item); elkNodes.set(node.id, item);
  });
  const primary = new Set(view.primaryPath ?? []);
  const outgoingLabels = new Map<string, number>();
  const incomingLabels = new Map<string, number>();
  for (const edge of graph.edges) {
    if (!edge.labelText.lines.length) continue;
    outgoingLabels.set(edge.source, (outgoingLabels.get(edge.source) ?? 0) + 1);
    incomingLabels.set(edge.target, (incomingLabels.get(edge.target) ?? 0) + 1);
  }
  graph.edges.forEach((edge, i) => {
    const source = elkNodes.get(edge.source); const target = elkNodes.get(edge.target);
    if (!source || !target) throw new Error(`布局边 ${edge.id} 的端点不存在。`);
    const sourcePort = `p${i}s`; const targetPort = `p${i}t`;
    source.ports!.push({ id: sourcePort, width: 0, height: 0, layoutOptions: { 'elk.port.side': view.direction === 'RIGHT' ? 'EAST' : 'SOUTH' } });
    target.ports!.push({ id: targetPort, width: 0, height: 0, layoutOptions: { 'elk.port.side': view.direction === 'RIGHT' ? 'WEST' : 'NORTH' } });
    const main = edge.originalEdgeIds.some(id => primary.has(id));
    // Endpoint labels do not enlarge a node to fit adjacent port labels. Fan-out would
    // stack every TAIL label beside one source: use a free target, or a reserved center
    // label layer when both ends are crowded. A single chain keeps its compact spacing.
    const labelPlacement = (outgoingLabels.get(edge.source) ?? 0) > 1
      ? (incomingLabels.get(edge.target) ?? 0) > 1 ? 'CENTER' : 'HEAD'
      : 'TAIL';
    root.edges!.push({
      id: `e${i}`, sources: [sourcePort], targets: [targetPort],
      layoutOptions: { 'elk.layered.priority.direction': main ? '10' : '0', 'elk.layered.priority.shortness': main ? '10' : '1' },
      ...(edge.labelText.lines.length ? { labels: [{ text: edge.labelText.lines.join('\n'), width: edge.labelText.width + 10, height: edge.labelText.height + 4, layoutOptions: { 'elk.edgeLabels.placement': labelPlacement } }] } : {}),
    });
  });
  // Reader and export views share one engine. Rejection must release the queue as well.
  const pending = layoutQueue.then(() => engine.layout(root));
  layoutQueue = pending.catch(() => undefined);
  const result = await pending;
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>([[ROOT_ID, { x: 0, y: 0, width: result.width ?? 0, height: result.height ?? 0 }]]);
  const routed = new Map<string, { edge: ElkExtendedEdge; parentId: string }>();
  function flatten(parent: ElkNode, origin: Point) {
    for (const child of parent.children ?? []) {
      const position = { x: origin.x + (child.x ?? 0), y: origin.y + (child.y ?? 0), width: child.width ?? 0, height: child.height ?? 0 };
      positions.set(child.id, position); flatten(child, position);
    }
    for (const edge of parent.edges ?? []) routed.set(edge.id, { edge, parentId: parent.id });
  }
  flatten(result, { x: 0, y: 0 });
  const nodes: LayoutNode[] = graph.nodes.map(node => ({ ...node, ...positions.get(ids.get(node.id)!)! }));
  const groups: LayoutGroup[] = graph.groups.map(group => ({ ...group, ...positions.get(ids.get(group.id)!)! }));
  // Parent groups paint before their descendants regardless of input order.
  groups.sort((a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const edges: LayoutEdge[] = graph.edges.map((edge, i) => {
    const entry = routed.get(`e${i}`);
    if (!entry?.edge.sections?.length) throw new Error(`ELK 没有返回边 ${edge.id} 的完整路径。`);
    // Edges can stay in root.edges while coordinates are relative to their LCA container.
    const origin = positions.get(entry.edge.container ?? entry.parentId);
    if (!origin) throw new Error(`ELK 边 ${edge.id} 的坐标容器缺失。`);
    const point = (p: Point): Point => ({ x: p.x + origin.x, y: p.y + origin.y });
    const sections = entry.edge.sections.map(section => [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(point));
    const first = sections[0]!; const last = sections.at(-1)!;
    first[0] = shapeBoundaryPoint(byId.get(edge.source)!, first[0]!, first[1]!);
    last[last.length - 1] = shapeBoundaryPoint(byId.get(edge.target)!, last.at(-1)!, last.at(-2)!);
    const label = entry.edge.labels?.[0];
    return {
      ...edge, sections, routing: 'polyline',
      ...(label ? { labelBox: { x: (label.x ?? 0) + origin.x + 5, y: (label.y ?? 0) + origin.y + 2, width: edge.labelText.width, height: edge.labelText.height } } : {}),
    };
  });
  const maxX = Math.max(FRAME, ...nodes.map(n => n.x + n.width), ...groups.map(g => g.x + g.width), ...edges.flatMap(e => [...e.sections.flat().map(p => p.x), ...(e.labelBox ? [e.labelBox.x + e.labelBox.width + 5] : [])]));
  const maxY = Math.max(FRAME, ...nodes.map(n => n.y + n.height), ...groups.map(g => g.y + g.height), ...edges.flatMap(e => [...e.sections.flat().map(p => p.y), ...(e.labelBox ? [e.labelBox.y + e.labelBox.height + 2] : [])]));
  return { ...graph, nodes, groups, edges, width: Math.ceil(Math.max(result.width ?? 0, maxX + FRAME)), height: Math.ceil(Math.max(result.height ?? 0, maxY + FRAME)) };
}
