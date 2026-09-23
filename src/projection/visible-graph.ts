import { buildGraphIndex, isFlowEdge } from '../model/graph-index.ts';
import type { DiagramDocument, DiagramEdge, DiagramGroup, DiagramNode } from '../model/types.ts';

export interface VisibleNode extends DiagramNode {
  sourcePath?: string;
  originalNodeIds: string[];
  isCollapsed?: boolean;
  originalGroupId?: string;
  hiddenConditionLabels?: string[];
  hiddenEdgeIds?: string[];
  hiddenDecisionCount?: number;
}

export interface VisibleEdge extends DiagramEdge {
  originalEdgeIds: string[];
  sourcePaths?: string[];
}

export interface VisibleGroup extends DiagramGroup { sourcePath?: string; }

export interface VisibleGraph {
  nodes: VisibleNode[];
  edges: VisibleEdge[];
  groups: VisibleGroup[];
  nodeToVisible: Map<string, string>;
}

/** Project a validated document. UI collapse choices and original graph remain untouched. */
export function projectVisibleGraph(document: DiagramDocument, collapsedGroups: ReadonlySet<string> = new Set(document.view.collapsedGroups ?? [])): VisibleGraph {
  const index = buildGraphIndex(document);
  const usedIds = new Set([...index.nodes.keys(), ...index.groups.keys(), ...index.edges.keys()]);
  const uniqueId = (base: string): string => {
    let id = base;
    let suffix = 0;
    while (usedIds.has(id)) id = `${base}_${++suffix}`;
    usedIds.add(id);
    return id;
  };
  const summaryByGroup = new Map<string, VisibleNode>();
  const nodes: VisibleNode[] = [];
  const nodeToVisible = new Map<string, string>();

  for (const [nodeIndex, node] of document.nodes.entries()) {
    const ancestors = index.nodeAncestors.get(node.id) ?? [];
    const outermostCollapsed = [...ancestors].reverse().find((id) => collapsedGroups.has(id));
    if (!outermostCollapsed) {
      nodes.push({ ...node, originalNodeIds: [node.id], sourcePath: `/nodes/${nodeIndex}` });
      nodeToVisible.set(node.id, node.id);
      continue;
    }
    let summary = summaryByGroup.get(outermostCollapsed);
    if (!summary) {
      const group = index.groups.get(outermostCollapsed)!;
      summary = {
        id: uniqueId(`__blueprint_group_${document.groups.indexOf(group)}`), kind: 'process', label: group.label,
        ...(group.parentId ? { groupId: group.parentId } : {}),
        ...(group.details !== undefined ? { details: group.details } : {}),
        originalGroupId: group.id, originalNodeIds: [], isCollapsed: true,
        sourcePath: `/groups/${document.groups.indexOf(group)}`,
        hiddenConditionLabels: [], hiddenEdgeIds: [], hiddenDecisionCount: 0,
      };
      summaryByGroup.set(group.id, summary);
      nodes.push(summary);
    }
    summary.originalNodeIds.push(node.id);
    if (node.kind === 'decision') summary.hiddenDecisionCount! += 1;
    nodeToVisible.set(node.id, summary.id);
  }

  const summaryById = new Map([...summaryByGroup.values()].map((node) => [node.id, node]));
  const edges: VisibleEdge[] = [];
  const edgeBySignature = new Map<string, VisibleEdge>();
  for (const [edgeIndex, edge] of document.edges.entries()) {
    const source = nodeToVisible.get(edge.source)!;
    const target = nodeToVisible.get(edge.target)!;
    const summary = source === target ? summaryById.get(source) : undefined;
    if (summary) {
      summary.hiddenEdgeIds!.push(edge.id);
      if (isFlowEdge(edge) && edge.label?.trim()) summary.hiddenConditionLabels!.push(edge.label);
      continue;
    }
    // Uncollapsed original edges retain their identities, including true self loops.
    if (source === edge.source && target === edge.target) {
      edges.push({ ...edge, originalEdgeIds: [edge.id], sourcePaths: [`/edges/${edgeIndex}`] });
      continue;
    }
    // An ordered tuple avoids delimiter collisions and never merges distinct conditions.
    const signature = JSON.stringify([source, target, edge.directed, edge.kind, edge.label ?? null]);
    const aggregated = edgeBySignature.get(signature);
    if (aggregated) {
      aggregated.originalEdgeIds.push(edge.id);
      aggregated.sourcePaths!.push(`/edges/${edgeIndex}`);
    } else {
      const visible = { ...edge, id: uniqueId(`__blueprint_edge_${edges.length}`), source, target, originalEdgeIds: [edge.id], sourcePaths: [`/edges/${edgeIndex}`] };
      edges.push(visible);
      edgeBySignature.set(signature, visible);
    }
  }
  for (const summary of summaryByGroup.values()) {
    // The renderer measures a separate mandatory hidden-condition notice from the counters.
    summary.summary = `${summary.originalNodeIds.length} 个节点`;
  }
  const groups = document.groups.filter((group) => {
    const seen = new Set<string>();
    let current: DiagramGroup | undefined = group;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (collapsedGroups.has(current.id)) return false;
      current = current.parentId ? index.groups.get(current.parentId) : undefined;
    }
    return true;
  }).map((group) => ({ ...group, sourcePath: `/groups/${document.groups.indexOf(group)}` }));
  return { nodes, edges, groups, nodeToVisible };
}
