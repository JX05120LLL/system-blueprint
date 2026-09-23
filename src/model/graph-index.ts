import type { DiagramDocument, DiagramEdge, DiagramGroup, DiagramNode, HighlightDirection } from './types.ts';

export interface GraphIndex {
  document: DiagramDocument;
  nodes: Map<string, DiagramNode>;
  edges: Map<string, DiagramEdge>;
  groups: Map<string, DiagramGroup>;
  incoming: Map<string, DiagramEdge[]>;
  outgoing: Map<string, DiagramEdge[]>;
  groupMembers: Map<string, Set<string>>;
  /** Closest group first, outermost ancestor last. */
  nodeAncestors: Map<string, string[]>;
}

export interface RelatedSet {
  /** Includes the starting nodes; all IDs are from the original document. */
  nodeIds: Set<string>;
  edgeIds: Set<string>;
}

export function isFlowEdge(edge: DiagramEdge): boolean {
  return edge.kind === 'control' || edge.kind === 'exception' || edge.kind === 'feedback';
}

/** Build only from a validated document. Never changes the document or invents relations. */
export function buildGraphIndex(document: DiagramDocument): GraphIndex {
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  const edges = new Map(document.edges.map((edge) => [edge.id, edge]));
  const groups = new Map(document.groups.map((group) => [group.id, group]));
  const incoming = new Map(document.nodes.map((node) => [node.id, [] as DiagramEdge[]]));
  const outgoing = new Map(document.nodes.map((node) => [node.id, [] as DiagramEdge[]]));
  const groupMembers = new Map(document.groups.map((group) => [group.id, new Set<string>()]));
  const nodeAncestors = new Map<string, string[]>();

  for (const node of document.nodes) {
    const ancestors: string[] = [];
    const visited = new Set<string>();
    let groupId = node.groupId;
    while (groupId && groups.has(groupId) && !visited.has(groupId)) {
      visited.add(groupId);
      ancestors.push(groupId);
      groupMembers.get(groupId)!.add(node.id);
      groupId = groups.get(groupId)!.parentId;
    }
    nodeAncestors.set(node.id, ancestors);
  }
  for (const edge of document.edges) {
    outgoing.get(edge.source)?.push(edge);
    incoming.get(edge.target)?.push(edge);
  }
  return { document, nodes, edges, groups, incoming, outgoing, groupMembers, nodeAncestors };
}

/** Groups are multi-source queries, not assertions of internal all-to-all connectivity. */
export function findRelated(index: GraphIndex, selectedId: string | readonly string[], direction: HighlightDirection): RelatedSet {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  for (const id of typeof selectedId === 'string' ? [selectedId] : selectedId) {
    if (index.nodes.has(id)) nodeIds.add(id);
    for (const member of index.groupMembers.get(id) ?? []) nodeIds.add(member);
  }
  const queue = [...nodeIds];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor]!;
    const candidates = direction === 'upstream' ? index.incoming.get(id) : index.outgoing.get(id);
    for (const edge of candidates ?? []) {
      if (!edge.directed || (index.document.view.kind === 'flow' && !isFlowEdge(edge))) continue;
      const adjacent = direction === 'upstream' ? edge.source : edge.target;
      if (!index.nodes.has(adjacent)) continue;
      edgeIds.add(edge.id);
      if (!nodeIds.has(adjacent)) {
        nodeIds.add(adjacent);
        queue.push(adjacent);
      }
    }
  }
  return { nodeIds, edgeIds };
}
