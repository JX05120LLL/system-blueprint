import assert from 'node:assert/strict';
import test from 'node:test';
import { projectVisibleGraph } from '../../src/projection/visible-graph.ts';
import type { DiagramDocument } from '../../src/model/types.ts';

function document(): DiagramDocument {
  return {
    schemaVersion: '2.0', id: 'groups', title: '两层判断', view: { kind: 'flow', direction: 'DOWN', theme: 'light' },
    groups: [{ id: 'parent', label: '请求处理' }, { id: 'child', label: '内部校验', parentId: 'parent' }],
    nodes: [
      { id: 'a', kind: 'decision', label: '有效？', groupId: 'child' },
      { id: 'b', kind: 'process', label: '准备执行', groupId: 'child' },
      { id: 'c', kind: 'process', label: '调度', groupId: 'parent' },
      { id: 'end', kind: 'end', label: '返回' },
    ],
    edges: [
      { id: 'yes', source: 'a', target: 'b', kind: 'control', directed: true, label: '通过' },
      { id: 'no', source: 'a', target: 'c', kind: 'exception', directed: true, label: '不通过' },
      { id: 'retry', source: 'b', target: 'a', kind: 'feedback', directed: true },
      { id: 'out1', source: 'b', target: 'end', kind: 'control', directed: true, label: '成功' },
      { id: 'out2', source: 'c', target: 'end', kind: 'exception', directed: true, label: '失败' },
      { id: 'self', source: 'end', target: 'end', kind: 'feedback', directed: true },
    ],
  };
}

test('V05: child state survives parent collapse and source document stays unchanged', () => {
  const doc = document(); const before = JSON.stringify(doc); const collapsed = new Set(['child']);
  let graph = projectVisibleGraph(doc, collapsed);
  let summary = graph.nodes.find((node) => node.originalGroupId === 'child')!;
  assert.equal(summary.groupId, 'parent');
  assert.deepEqual(summary.originalNodeIds, ['a', 'b']);
  assert.equal(summary.sourcePath, '/groups/1');
  assert.equal(graph.nodes.find(node => node.id === 'end')!.sourcePath, '/nodes/3');
  assert.deepEqual(graph.groups.map((group) => group.id), ['parent']);
  collapsed.add('parent'); graph = projectVisibleGraph(doc, collapsed);
  summary = graph.nodes.find((node) => node.originalGroupId === 'parent')!;
  assert.deepEqual(summary.originalNodeIds, ['a', 'b', 'c']);
  assert.equal(summary.groupId, undefined);
  assert.equal(graph.groups.length, 0);
  collapsed.delete('parent'); graph = projectVisibleGraph(doc, collapsed);
  assert.ok(graph.nodes.some((node) => node.originalGroupId === 'child'));
  assert.equal(collapsed.has('child'), true);
  assert.equal(JSON.stringify(doc), before);
});

test('V06: distinct conditions and directions survive collapsed endpoint projection', () => {
  const doc = document(); doc.edges[4]!.kind = 'control';
  doc.edges.push({ id: 'out3', source: 'a', target: 'end', kind: 'control', directed: true, label: '成功' });
  doc.edges.push({ id: 'back', source: 'end', target: 'a', kind: 'control', directed: true, label: '成功' });
  const graph = projectVisibleGraph(doc, new Set(['parent']));
  const summary = graph.nodes.find((node) => node.isCollapsed)!;
  const outgoing = graph.edges.filter((edge) => edge.source === summary.id);
  assert.deepEqual(outgoing.map((edge) => edge.label).sort(), ['失败', '成功']);
  assert.deepEqual(outgoing.find((edge) => edge.label === '成功')!.originalEdgeIds, ['out1', 'out3']);
  assert.deepEqual(outgoing.find((edge) => edge.label === '成功')!.sourcePaths, ['/edges/3', '/edges/6']);
  assert.ok(graph.edges.some((edge) => edge.source === 'end' && edge.target === summary.id && edge.originalEdgeIds[0] === 'back'));
  assert.ok(graph.edges.some((edge) => edge.source === 'end' && edge.target === 'end' && edge.id === 'self'));
});

test('V19: all hidden conditions and decisions are signalled, and expansion restores edges', () => {
  const doc = document(); delete doc.edges[3]!.label; delete doc.edges[4]!.label;
  const collapsed = projectVisibleGraph(doc, new Set(['parent']));
  const summary = collapsed.nodes.find((node) => node.isCollapsed)!;
  assert.equal(summary.hiddenDecisionCount, 1);
  assert.deepEqual(summary.hiddenConditionLabels, ['通过', '不通过']);
  assert.deepEqual(summary.hiddenEdgeIds, ['yes', 'no', 'retry']);
  // Renderer adds the hidden-condition notice from the explicit counters.
  assert.equal(summary.summary, '3 个节点');
  const expanded = projectVisibleGraph(doc, new Set());
  assert.deepEqual(expanded.edges.map((edge) => edge.originalEdgeIds), [['yes'], ['no'], ['retry'], ['out1'], ['out2'], ['self']]);
  assert.deepEqual(expanded.nodes.map((node) => node.id), ['a', 'b', 'c', 'end']);
});

test('no synthetic ID can collide with original node, group or edge IDs', () => {
  const doc = document();
  doc.nodes.push({ id: '__blueprint_group_parent', kind: 'process', label: 'ID 冲突输入' });
  doc.edges.push({ id: '__blueprint_edge_0', source: 'c', target: 'end', kind: 'control', directed: true, label: '成功' });
  const graph = projectVisibleGraph(doc, new Set(['parent']));
  assert.equal(new Set(graph.nodes.map((node) => node.id)).size, graph.nodes.length);
  assert.equal(new Set(graph.edges.map((edge) => edge.id)).size, graph.edges.length);
  assert.equal(graph.nodeToVisible.get('a'), graph.nodes.find((node) => node.isCollapsed)!.id);
  assert.equal(graph.nodeToVisible.get('end'), 'end');
});

test('synthetic identifiers never interpolate raw group text into the generated ID', () => {
  const doc = document();
  doc.groups[0]!.id = '</script> / request'; doc.groups[1]!.parentId = '</script> / request';
  doc.nodes[2]!.groupId = '</script> / request';
  doc.nodes.push({ id: '__blueprint_group_0', kind: 'process', label: '保留原 ID' });
  const graph = projectVisibleGraph(doc, new Set(['</script> / request']));
  const summary = graph.nodes.find((node) => node.isCollapsed)!;
  assert.match(summary.id, /^__blueprint_group_[a-zA-Z0-9_]+$/);
  assert.notEqual(summary.id, '__blueprint_group_0');
  assert.equal(summary.originalGroupId, '</script> / request');
});

test('projection defaults to initial collapse set but supports explicit expanded export', () => {
  const doc = document(); doc.view.collapsedGroups = ['parent'];
  assert.equal(projectVisibleGraph(doc).nodes.length, 2);
  assert.equal(projectVisibleGraph(doc, new Set()).nodes.length, 4);
});

test('every original edge occurs exactly once as a visible mapping or hidden internal edge', () => {
  const doc = document();
  for (const collapsed of [[], ['child'], ['parent'], ['child', 'parent']]) {
    const graph = projectVisibleGraph(doc, new Set(collapsed));
    const covered = [
      ...graph.edges.flatMap((edge) => edge.originalEdgeIds),
      ...graph.nodes.flatMap((node) => node.hiddenEdgeIds ?? []),
    ];
    assert.deepEqual(covered.sort(), ['no', 'out1', 'out2', 'retry', 'self', 'yes']);
    assert.equal(new Set(covered).size, 6);
  }
});
