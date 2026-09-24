import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { layoutGraph } from '../../src/layout/elk.ts';
import { checkGeometry } from '../../src/layout/geometry.ts';
import { projectVisibleGraph } from '../../src/projection/visible-graph.ts';
import type { DiagramDocument } from '../../src/model/types.ts';
import type { DiagramView } from '../../src/model/types.ts';
import type { Box, LayoutGraph, MeasuredEdge, MeasuredGraph, MeasuredNode, TextBlock } from '../../src/layout/types.ts';

const block = (text = '', width = 80): TextBlock => ({ lines: text ? [text] : [], width: text ? width : 0, height: text ? 20 : 0, fontSize: 14, lineHeight: 20 });
const node = (id: string, groupId?: string, kind: MeasuredNode['kind'] = 'process'): MeasuredNode => ({ id, kind, label: id, groupId, width: kind === 'decision' ? 336 : 224, height: kind === 'decision' ? 180 : 84, titleText: block(id), summaryText: block(), noteText: block(), originalNodeIds: [id] });
const edge = (id: string, source: string, target: string, label = ''): MeasuredEdge => ({ id, source, target, kind: 'control', directed: true, label, labelText: block(label), originalEdgeIds: [id] });
const graph = (nodes: MeasuredNode[], edges: MeasuredEdge[] = [], groups: MeasuredGraph['groups'] = []): MeasuredGraph => ({ nodes, edges, groups, nodeToVisible: new Map(nodes.map(n => [n.id, n.id])) });
const view = (direction: 'RIGHT' | 'DOWN' = 'RIGHT'): DiagramView => ({ kind: 'flow', direction, theme: 'light' });
const contains = (outer: Box, inner: Box, gap = 0): boolean => inner.x >= outer.x + gap - .01 && inner.y >= outer.y + gap - .01 && inner.x + inner.width <= outer.x + outer.width - gap + .01 && inner.y + inner.height <= outer.y + outer.height - gap + .01;
const boundaryDistance = (n: Box, p: { x: number; y: number }): number => Math.min(Math.abs(p.x - n.x), Math.abs(p.y - n.y), Math.abs(p.x - n.x - n.width), Math.abs(p.y - n.y - n.height));

test('V01 lays out one node with a finite complete canvas', async () => {
  const result = await layoutGraph(graph([node('only')]), view());
  assert.equal(result.nodes.length, 1);
  assert.ok(Number.isFinite(result.width) && Number.isFinite(result.height));
  assert.ok(contains({ x: 0, y: 0, width: result.width, height: result.height }, result.nodes[0]!));
});

test('RIGHT and DOWN follow requested flow direction without changing measured dimensions', async () => {
  const input = graph([node('a'), node('b')], [edge('ab', 'a', 'b')]);
  const right = await layoutGraph(input, view('RIGHT'));
  const down = await layoutGraph(input, view('DOWN'));
  assert.ok(right.nodes[1]!.x >= right.nodes[0]!.x + 224 + 60);
  assert.ok(down.nodes[1]!.y >= down.nodes[0]!.y + 84 + 60);
  assert.equal(down.nodes[0]!.width, 224);
  assert.equal(down.nodes[0]!.height, 84);
  assert.ok(right.edges.every(edge => edge.routing === 'polyline' || edge.routing === 'spline'));
  assert.ok(right.edges.every(edge => edge.routing !== 'spline' || edge.sections.every(section => (section.length - 1) % 3 === 0)));
});

test('V05 compound coordinates include parent and child offsets and reserve group titles', async () => {
  const input = graph([node('inside', 'child'), node('sibling', 'parent'), node('outside')], [edge('out', 'inside', 'outside', '跨组输出'), edge('local', 'inside', 'sibling', '内部')], [
    { id: 'parent', label: '父组', titleText: block('父组') },
    { id: 'child', label: '两行组标题', parentId: 'parent', titleText: { ...block('两行组标题', 240), lines: ['两行', '组标题'], height: 40 } },
  ]);
  const before = structuredClone(input);
  const result = await layoutGraph(input, view());
  const parent = result.groups.find(g => g.id === 'parent')!;
  const child = result.groups.find(g => g.id === 'child')!;
  const inside = result.nodes.find(n => n.id === 'inside')!;
  assert.equal(result.groups.length, 2);
  assert.ok(contains(parent, child, 24));
  assert.ok(contains(child, inside, 24));
  assert.ok(child.y >= parent.y + 56);
  assert.ok(inside.y >= child.y + 64);
  assert.ok(child.width >= 240 + 76, 'title text and 40px collapse button must fit');
  assert.deepEqual(input, before, 'layout must not mutate measured or original graph');
  for (const e of result.edges) {
    const source = result.nodes.find(n => n.id === e.source)!;
    const target = result.nodes.find(n => n.id === e.target)!;
    assert.ok(boundaryDistance(source, e.sections[0]![0]!) < .01, `${e.id}: source at global boundary`);
    assert.ok(boundaryDistance(target, e.sections.at(-1)!.at(-1)!) < .01, `${e.id}: target at global boundary`);
    assert.ok(e.labelBox && contains({ x: 0, y: 0, width: result.width, height: result.height }, e.labelBox));
  }
  assert.deepEqual(checkGeometry(result).filter(d => d.severity === 'error'), []);
});

test('V03 V04 V06 preserves branches, loops and all original edge mappings with finite routes', async () => {
  const input = graph([node('start'), node('check', undefined, 'decision'), node('done')], [
    edge('in', 'start', 'check'), edge('yes', 'check', 'done', '通过'), edge('no', 'check', 'done', '不通过'),
    { ...edge('back', 'done', 'start', '重新处理'), kind: 'feedback' }, edge('self', 'done', 'done', '重试'),
  ]);
  input.edges[1]!.originalEdgeIds = ['original-yes-1', 'original-yes-2'];
  const result = await layoutGraph(input, view());
  assert.deepEqual(result.edges.map(e => [e.id, e.originalEdgeIds, e.source, e.target, e.label]), input.edges.map(e => [e.id, e.originalEdgeIds, e.source, e.target, e.label]));
  for (const e of result.edges) {
    assert.ok(e.sections.length > 0 && e.sections.every(s => s.length >= 2), e.id);
    for (const section of e.sections) for (let i = 1; i < section.length; i++) {
      const a = section[i - 1]!; const b = section[i]!;
      assert.ok([a.x, a.y, b.x, b.y].every(Number.isFinite), `${e.id}: finite route points`);
    }
  }
  const self = result.edges.find(e => e.id === 'self')!;
  assert.ok(self.sections[0]!.length >= 4, 'self loop must have a visible path outside its node');
  assert.notDeepEqual(result.edges[1]!.labelBox, result.edges[2]!.labelBox, 'parallel conditions need separate label positions');
  assert.deepEqual(checkGeometry(result).filter(d => d.severity === 'error'), []);
});

test('full microservice branches retain every original relation when routes are smoothed', async () => {
  const document = JSON.parse(readFileSync(new URL('../fixtures/traditional-microservices-full.diagram.json', import.meta.url), 'utf8')) as DiagramDocument;
  const visible = projectVisibleGraph(document);
  const measured: MeasuredGraph = {
    ...visible,
    nodes: visible.nodes.map(n => ({ ...node(n.id, n.groupId, n.kind), ...n, titleText: block(n.label, 120), summaryText: block(n.summary, 160) })),
    groups: visible.groups.map(g => ({ ...g, titleText: block(g.label, 120) })),
    edges: visible.edges.map(e => ({ ...e, labelText: block(e.label, 80) })),
  };
  const result = await layoutGraph(measured, document.view);
  assert.ok(result.edges.some(edge => edge.routing === 'spline'), 'dense branches should permit at least one continuous arc');
  assert.ok(result.edges.every(edge => edge.sections.every(section => section.length >= 2)), 'every edge remains drawable');
  assert.deepEqual(result.edges.map(e => e.originalEdgeIds).flat().sort(), document.edges.map(e => e.id).sort());
});

test('parallel reader/export layouts keep independent results and a failure does not poison later layouts', async () => {
  const left = graph([node('l1'), node('l2')], [edge('left', 'l1', 'l2', '左')]);
  const right = graph([node('r1'), node('r2')], [edge('right', 'r1', 'r2', '右')]);
  const [a, failure, b] = await Promise.allSettled([
    layoutGraph(left, view('RIGHT')),
    layoutGraph(graph([node('bad')], [edge('broken', 'bad', 'missing')]), view()),
    layoutGraph(right, view('DOWN')),
  ]);
  assert.equal(failure.status, 'rejected');
  assert.equal(a.status, 'fulfilled'); assert.equal(b.status, 'fulfilled');
  if (a.status !== 'fulfilled' || b.status !== 'fulfilled') return;
  assert.deepEqual(a.value.nodes.map(n => n.id), ['l1', 'l2']);
  assert.deepEqual(b.value.nodes.map(n => n.id), ['r1', 'r2']);
  assert.ok(b.value.nodes[1]!.y > b.value.nodes[0]!.y);
});

test('nested sibling groups and in-group edge labels use the actual ELK edge container', async () => {
  const input = graph([node('a', 'left'), node('b', 'left'), node('c', 'right'), node('d', 'right'), node('outer')], [
    edge('ab', 'a', 'b', '组内条件'), edge('bc', 'b', 'c', '跨子组条件'), edge('cd', 'c', 'd', '第二组内部'),
    edge('da', 'd', 'a', '反馈'), edge('outside', 'd', 'outer', '输出'),
  ], [
    { id: 'left', label: '子组一', parentId: 'parent', titleText: block('子组一') },
    { id: 'right', label: '子组二', parentId: 'parent', titleText: block('子组二') },
    { id: 'parent', label: '父组', titleText: block('父组') },
  ]);
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const result = await layoutGraph(input, view(direction));
    assert.equal(result.groups[0]!.id, 'parent', 'parent is painted first even if source order differs');
    assert.deepEqual(checkGeometry(result).filter(d => d.severity === 'error'), []);
    for (const [edgeId, groupId] of [['ab', 'left'], ['cd', 'right'], ['bc', 'parent']]) {
      const e = result.edges.find(e => e.id === edgeId)!;
      const g = result.groups.find(g => g.id === groupId)!;
      assert.ok(e.labelBox && contains(g, e.labelBox), `${direction} ${edgeId} label relative to ${groupId}`);
    }
  }
});

test('deployment fixture keeps nested cyclic cross-group data dependencies and primary path', async () => {
  const document = JSON.parse(readFileSync(new URL('../fixtures/deployment-cross-group.diagram.json', import.meta.url), 'utf8')) as DiagramDocument;
  const visible = projectVisibleGraph(document);
  const measured: MeasuredGraph = {
    ...visible,
    nodes: visible.nodes.map(n => ({ ...node(n.id, n.groupId, n.kind), ...n, titleText: block(n.label, 100) })),
    groups: visible.groups.map(g => ({ ...g, titleText: block(g.label, 100) })),
    edges: visible.edges.map(e => ({ ...e, labelText: block(e.label, 80) })),
  };
  const result = await layoutGraph(measured, document.view);
  assert.equal(result.nodes.length, 6);
  assert.equal(result.groups.length, 4);
  assert.deepEqual(result.edges.map(e => [e.id, e.source, e.target, e.directed]), document.edges.map(e => [e.id, e.source, e.target, e.directed]));
  assert.deepEqual(checkGeometry(result).filter(d => d.severity === 'error'), []);
});

test('short relationship labels do not insert a second full spacing layer', async () => {
  const input = graph([node('a'), node('b')], [{ ...edge('ab', 'a', 'b', '提取'), labelText: block('提取', 24) }]);
  const result = await layoutGraph(input, view());
  const gap = result.nodes[1]!.x - result.nodes[0]!.x - result.nodes[0]!.width;
  assert.ok(gap >= 64, 'retain engineering layer spacing');
  assert.ok(gap <= 112, `short label should fit without excessive blank layer, got ${gap}`);
  assert.deepEqual(checkGeometry(result).filter(d => d.severity === 'error'), []);
});

test('incoming compound edge avoids a legal two-line Chinese group heading', async () => {
  const document = JSON.parse(readFileSync(new URL('../fixtures/decision-shared-endpoint.diagram.json', import.meta.url), 'utf8')) as DiagramDocument;
  document.groups[0]!.label = '校验处理分组包含需要保留的完整中文职责说明';
  const visible = projectVisibleGraph(document);
  const measured: MeasuredGraph = {
    ...visible,
    nodes: visible.nodes.map(n => ({ ...node(n.id, n.groupId, n.kind), ...n, titleText: block(n.label, 100) })),
    groups: visible.groups.map(g => ({ ...g, titleText: { ...block(g.label, 238), lines: ['校验处理分组包含需要保留的', '完整中文职责说明'], height: 40 } })),
    edges: visible.edges.map(e => ({ ...e, labelText: block(e.label, e.label ? 28 : 0) })),
  };
  const result = await layoutGraph(measured, document.view);
  assert.deepEqual(checkGeometry(result).filter(d => d.severity === 'error'), []);
  assert.equal(result.groups[0]!.titleText.lines.length, 2);
  assert.equal(result.edges.length, 3);
});

test('M5 deployment high fan-out keeps all seven labeled dependencies readable', async () => {
  const document = JSON.parse(readFileSync(new URL('../fixtures/deployment-topology.diagram.json', import.meta.url), 'utf8')) as DiagramDocument;
  const visible = projectVisibleGraph(document);
  const measured: MeasuredGraph = {
    ...visible,
    nodes: visible.nodes.map(n => ({ ...node(n.id, n.groupId, n.kind), ...n, titleText: block(n.label, 120), summaryText: block(n.summary, 160), height: n.kind === 'store' ? 100 : 84 })),
    groups: visible.groups.map(g => ({ ...g, titleText: block(g.label, 120) })),
    edges: visible.edges.map(e => ({ ...e, labelText: block(e.label, e.label === '读写业务记录' ? 84 : 72) })),
  };
  const before = structuredClone(measured);
  const result = await layoutGraph(measured, document.view);
  assert.deepEqual(result.edges.map(e => [e.id, e.source, e.target, e.label, e.originalEdgeIds]), measured.edges.map(e => [e.id, e.source, e.target, e.label, e.originalEdgeIds]));
  assert.equal(result.edges.filter(e => e.source === 'agent').length, 7);
  assert.equal(result.edges.filter(e => e.labelBox && e.labelText.lines.length).length, 10);
  assert.deepEqual(checkGeometry(result).filter(d => d.severity === 'error'), []);
  assert.deepEqual(measured, before);
});

test('high fan-out labels remain distinct after target groups collapse in either direction', async () => {
  const document = JSON.parse(readFileSync(new URL('../fixtures/deployment-topology.diagram.json', import.meta.url), 'utf8')) as DiagramDocument;
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    for (const collapsed of [[], ['data-zone'], ['data-zone', 'external-zone']]) {
      const visible = projectVisibleGraph(document, new Set(collapsed));
      const measured: MeasuredGraph = {
        ...visible,
        nodes: visible.nodes.map(n => ({ ...node(n.id, n.groupId, n.kind), ...n, titleText: block(n.label, 120), summaryText: block(n.summary, 160), height: n.kind === 'store' ? 100 : 84 })),
        groups: visible.groups.map(g => ({ ...g, titleText: block(g.label, 120) })),
        edges: visible.edges.map(e => ({ ...e, labelText: block(e.label, e.label === '读写业务记录' ? 84 : 72) })),
      };
      const result = await layoutGraph(measured, { ...document.view, direction });
      assert.deepEqual(checkGeometry(result).filter(d => d.severity === 'error'), [], `${direction}; collapsed=${collapsed.join(',')}`);
      assert.deepEqual(result.edges.flatMap(e => e.originalEdgeIds).sort(), document.edges.map(e => e.id).sort());
      assert.equal(result.edges.filter(e => e.labelBox && e.labelText.lines.length).length, 10);
    }
  }
});
