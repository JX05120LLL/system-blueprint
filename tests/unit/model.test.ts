import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDocument } from '../../src/model/validate.ts';
import { buildGraphIndex, findRelated } from '../../src/model/graph-index.ts';
import type { DiagramDocument, DiagramEdge } from '../../src/model/types.ts';

function document(): DiagramDocument {
  return {
    schemaVersion: '2.0', id: 'flow', title: '请求处理',
    view: { kind: 'flow', direction: 'DOWN', theme: 'light' }, groups: [],
    nodes: [
      { id: 'start', kind: 'start', label: '开始' },
      { id: 'check', kind: 'decision', label: '通过？' },
      { id: 'ok', kind: 'end', label: '成功' },
      { id: 'fail', kind: 'end', label: '失败' },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'check', kind: 'control', directed: true },
      { id: 'e2', source: 'check', target: 'ok', kind: 'control', directed: true, label: '通过' },
      { id: 'e3', source: 'check', target: 'fail', kind: 'exception', directed: true, label: '不通过' },
    ],
  };
}

test('V01: a single node is valid; validation preserves input without adding defaults', () => {
  const doc = document(); doc.nodes = [doc.nodes[0]!]; doc.edges = [];
  const before = JSON.stringify(doc);
  const result = validateDocument(doc);
  assert.equal(result.valid, true);
  assert.equal(JSON.stringify(doc), before);
  assert.equal(result.document, doc);
});

test('V03/V04: conditional branches, a feedback cycle and a real self loop are valid', () => {
  const doc = document();
  doc.edges.push({ id: 'retry', source: 'fail', target: 'check', kind: 'feedback', directed: true });
  doc.edges.push({ id: 'self', source: 'start', target: 'start', kind: 'feedback', directed: true });
  doc.view.primaryPath = ['e1', 'e2'];
  assert.equal(validateDocument(doc).valid, true);
});

test('V11: structural errors have field paths, and unknown fields/version are refused', () => {
  for (const [mutate, path] of [
    [(doc: any) => { doc.schemaVersion = '9.0'; }, '/schemaVersion'],
    [(doc: any) => { doc.nodes[0].x = 2; }, '/nodes/0/x'],
    [(doc: any) => { delete doc.edges[0].directed; }, '/edges/0/directed'],
    [(doc: any) => { doc.nodes[0].label = '   '; }, '/nodes/0/label'],
  ] as const) {
    const doc = document(); mutate(doc);
    const result = validateDocument(doc);
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.some((item) => item.path === path), JSON.stringify(result.diagnostics));
  }
});

test('V11: duplicate IDs and missing endpoints/groups point at the offending field', () => {
  const doc = document();
  doc.nodes[1]!.id = 'start'; doc.nodes[2]!.groupId = 'unknown';
  doc.groups = [{ id: 'start', label: '冲突组' }];
  doc.edges[1]!.target = 'missing'; doc.edges[2]!.id = 'e1';
  const diagnostics = validateDocument(doc).diagnostics;
  for (const [code, path] of [
    ['ID_DUPLICATE', '/nodes/1/id'], ['ID_DUPLICATE', '/groups/0/id'],
    ['EDGE_TARGET_MISSING', '/edges/1/target'], ['EDGE_ID_DUPLICATE', '/edges/2/id'],
    ['NODE_GROUP_MISSING', '/nodes/2/groupId'],
  ]) assert.ok(diagnostics.some((item) => item.code === code && item.path === path), JSON.stringify(diagnostics));
});

test('V11: empty, missing-parent, cyclic and deeper-than-two-level groups fail', () => {
  const variants = [
    { groups: [{ id: 'g', label: '空' }], code: 'GROUP_EMPTY' },
    { groups: [{ id: 'g', label: '组', parentId: 'no' }], code: 'GROUP_PARENT_MISSING' },
    { groups: [{ id: 'g', label: '组', parentId: 'h' }, { id: 'h', label: '组', parentId: 'g' }], code: 'GROUP_CYCLE' },
    { groups: [{ id: 'g', label: '组' }, { id: 'h', label: '组', parentId: 'g' }, { id: 'i', label: '组', parentId: 'h' }], code: 'GROUP_DEPTH_LIMIT' },
  ];
  for (const variant of variants) {
    const doc = document(); doc.groups = variant.groups;
    assert.ok(validateDocument(doc).diagnostics.some((item) => item.code === variant.code));
  }
  const nested = document(); nested.groups = [{ id: 'g', label: '父组' }, { id: 'h', label: '子组', parentId: 'g' }];
  nested.nodes[1]!.groupId = 'h';
  assert.equal(validateDocument(nested).valid, true);
});

test('V20: decision branches ignore data/dependency edges and require distinguishable conditions', () => {
  const doc = document();
  doc.edges[2]!.kind = 'data'; doc.edges[2]!.directed = false;
  assert.ok(validateDocument(doc).diagnostics.some((item) => item.code === 'DECISION_BRANCH_COUNT'));
  doc.edges[2]!.kind = 'exception'; doc.edges[2]!.directed = true; doc.edges[2]!.label = '通过 ';
  assert.ok(validateDocument(doc).diagnostics.some((item) => item.code === 'DECISION_CONDITION_DUPLICATE'));
  delete doc.edges[2]!.label;
  assert.ok(validateDocument(doc).diagnostics.some((item) => item.code === 'DECISION_CONDITION_MISSING' && item.path === '/edges/2/label'));
});

test('V20: flow relationship kinds must be directed even in overview documents', () => {
  for (const kind of ['control', 'exception', 'feedback'] as const) {
    const doc = document(); doc.view.kind = 'overview'; doc.edges[0]!.kind = kind; doc.edges[0]!.directed = false;
    assert.ok(validateDocument(doc).diagnostics.some((item) => item.code === 'FLOW_EDGE_UNDIRECTED' && item.path === '/edges/0/directed'));
  }
});

test('fork/join counts control relations instead of data or exception branches', () => {
  const doc = document(); doc.nodes[1]!.kind = 'fork';
  assert.ok(validateDocument(doc).diagnostics.some((item) => item.code === 'FORK_BRANCH_COUNT'));
  doc.edges[2]!.kind = 'control';
  assert.equal(validateDocument(doc).valid, true);
  doc.nodes[1]!.kind = 'join';
  assert.ok(validateDocument(doc).diagnostics.some((item) => item.code === 'JOIN_BRANCH_COUNT'));
});

test('primary path rejects missing IDs, duplicates, discontinuity and undirected relations', () => {
  for (const [path, code] of [
    [['missing'], 'PRIMARY_EDGE_MISSING'], [['e1', 'e1'], 'PRIMARY_EDGE_DUPLICATE'],
    [['e2', 'e1'], 'PRIMARY_PATH_DISCONNECTED'],
  ] as const) {
    const doc = document(); doc.view.primaryPath = [...path];
    assert.ok(validateDocument(doc).diagnostics.some((item) => item.code === code));
  }
  const doc = document(); doc.edges[0]!.kind = 'dependency'; doc.edges[0]!.directed = false; doc.view.primaryPath = ['e1'];
  assert.ok(validateDocument(doc).diagnostics.some((item) => item.code === 'PRIMARY_EDGE_UNDIRECTED'));
});

test('unknown initial collapse targets fail; disconnected graphs warn without refusing generation', () => {
  const doc = document(); doc.view.collapsedGroups = ['unknown'];
  assert.ok(validateDocument(doc).diagnostics.some((item) => item.code === 'COLLAPSED_GROUP_MISSING'));
  delete doc.view.collapsedGroups;
  doc.nodes.push({ id: 'isolated', kind: 'process', label: '孤立节点' });
  const result = validateDocument(doc);
  assert.equal(result.valid, true);
  assert.ok(result.diagnostics.some((item) => item.code === 'GRAPH_DISCONNECTED' && item.severity === 'warning'));
});

test('flow nodes not reachable from any start warn even when undirected connectivity exists', () => {
  const doc = document();
  doc.nodes.push({ id: 'unreachable', kind: 'process', label: '无法到达的处理' });
  doc.edges.push({ id: 'backwards', source: 'unreachable', target: 'ok', kind: 'control', directed: true });
  const result = validateDocument(doc);
  assert.equal(result.valid, true);
  assert.ok(result.diagnostics.some((item) => item.code === 'GRAPH_UNREACHABLE' && item.ids.includes('unreachable') && item.severity === 'warning'));
});

test('V12: supported limits are inclusive and oversize collections/details fail', () => {
  const doc = document();
  doc.nodes = Array.from({ length: 100 }, (_, i) => ({ id: `n${i}`, kind: 'process', label: `节点 ${i}`, groupId: `g${i % 20}`, details: '字'.repeat(8000) }));
  doc.groups = Array.from({ length: 20 }, (_, i) => ({ id: `g${i}`, label: `组 ${i}` }));
  doc.edges = Array.from({ length: 300 }, (_, i) => ({ id: `e${i}`, source: `n${i % 100}`, target: `n${(i + 1) % 100}`, kind: 'data', directed: true }));
  // Byte limit is independent of character/detail limits.
  doc.nodes.forEach((node) => { delete node.details; });
  assert.equal(validateDocument(doc).valid, true);
  for (const change of [
    (value: DiagramDocument) => value.nodes.push({ id: 'extra', kind: 'process', label: '超限' }),
    (value: DiagramDocument) => value.edges.push({ ...value.edges[0]!, id: 'extra' }),
    (value: DiagramDocument) => value.groups.push({ id: 'extra', label: '超限' }),
    (value: DiagramDocument) => { value.nodes[0]!.details = '字'.repeat(8001); },
  ]) {
    const copy = structuredClone(doc); change(copy);
    assert.equal(validateDocument(copy).valid, false);
  }
  doc.description = '字'.repeat(710000);
  assert.ok(validateDocument(doc).diagnostics.some((item) => item.code === 'DOCUMENT_SIZE_LIMIT'));
});

test('V04/V20: traversals terminate on cycles and select relations by view semantics', () => {
  const doc = document();
  doc.edges.push({ id: 'retry', source: 'fail', target: 'check', kind: 'feedback', directed: true });
  doc.nodes.push({ id: 'store', kind: 'store', label: '数据' }, { id: 'external', kind: 'external', label: '外部' });
  doc.edges.push({ id: 'data', source: 'ok', target: 'store', kind: 'data', directed: true }, { id: 'dep', source: 'store', target: 'external', kind: 'dependency', directed: false });
  let index = buildGraphIndex(doc);
  let related = findRelated(index, 'check', 'downstream');
  assert.deepEqual([...related.nodeIds].sort(), ['check', 'fail', 'ok']);
  assert.deepEqual([...related.edgeIds].sort(), ['e2', 'e3', 'retry']);
  related = findRelated(index, 'ok', 'upstream');
  assert.deepEqual([...related.nodeIds].sort(), ['check', 'fail', 'ok', 'start']);
  doc.view.kind = 'overview'; index = buildGraphIndex(doc);
  related = findRelated(index, 'check', 'downstream');
  assert.deepEqual([...related.nodeIds].sort(), ['check', 'fail', 'ok', 'store']);
  assert.equal(related.edgeIds.has('dep'), false);
  assert.deepEqual(findRelated(index, 'missing', 'upstream'), { nodeIds: new Set(), edgeIds: new Set() });
});

test('group queries use all descendants and indexes preserve undirected direct relations', () => {
  const doc = document(); doc.groups = [{ id: 'parent', label: '父' }, { id: 'child', label: '子', parentId: 'parent' }];
  doc.nodes[1]!.groupId = 'child'; doc.nodes[2]!.groupId = 'parent';
  doc.edges.push({ id: 'dep', source: 'ok', target: 'start', kind: 'dependency', directed: false });
  const index = buildGraphIndex(doc);
  assert.deepEqual([...index.groupMembers.get('parent')!].sort(), ['check', 'ok']);
  assert.deepEqual(index.nodeAncestors.get('check'), ['child', 'parent']);
  assert.ok(index.outgoing.get('ok')!.some((edge: DiagramEdge) => edge.id === 'dep'));
  assert.deepEqual([...findRelated(index, 'parent', 'upstream').nodeIds].sort(), ['check', 'ok', 'start']);
});
