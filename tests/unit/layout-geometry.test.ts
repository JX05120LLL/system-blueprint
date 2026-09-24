import assert from 'node:assert/strict';
import test from 'node:test';
import { checkGeometry, routeIntersectsBoxes, shapeBoundaryPoint } from '../../src/layout/geometry.ts';
import { smoothGraphRoutes } from '../../src/layout/curves.ts';
import type { LayoutGraph, LayoutNode, TextBlock } from '../../src/layout/types.ts';

const text: TextBlock = { lines: ['label'], width: 60, height: 20, fontSize: 14, lineHeight: 20 };
const empty: TextBlock = { lines: [], width: 0, height: 0, fontSize: 14, lineHeight: 20 };
const n = (id: string, x: number, y: number, kind: LayoutNode['kind'] = 'process'): LayoutNode => ({ id, kind, label: id, originalNodeIds: [id], x, y, width: 200, height: 100, titleText: text, summaryText: empty, noteText: empty });
const base = (nodes: LayoutNode[]): LayoutGraph => ({ nodes, edges: [], groups: [], nodeToVisible: new Map(nodes.map(n => [n.id, n.id])), width: 900, height: 600 });

test('collapsed geometry errors point back to original groups and original edge IDs', () => {
  const node = { ...n('__summary', -30, 0), isCollapsed: true, originalGroupId: 'original-group', sourcePath: '/groups/4' };
  const graph = base([node]);
  graph.edges.push({ id: '__aggregate', source: '__summary', target: '__summary', kind: 'data', directed: true, originalEdgeIds: ['one', 'two'], sourcePaths: ['/edges/7', '/edges/8'], sections: [], labelText: empty });
  const diagnostics = checkGeometry(graph);
  assert.ok(diagnostics.some(d => d.code === 'NODE_OUT_OF_BOUNDS' && d.path === '/groups/4' && d.ids[0] === 'original-group'));
  assert.ok(diagnostics.some(d => d.code === 'EDGE_ROUTE_MISSING' && d.path === '/edges/7' && d.ids.join(',') === 'one,two'));
});

test('decision port follows diamond boundary while preserving orthogonal final segment', () => {
  const diamond = n('decision', 100, 100, 'decision');
  assert.deepEqual(shapeBoundaryPoint(diamond, { x: 100, y: 125 }, { x: 50, y: 125 }), { x: 150, y: 125 });
  assert.deepEqual(shapeBoundaryPoint(diamond, { x: 250, y: 200 }, { x: 250, y: 250 }), { x: 250, y: 175 });
});

test('a diagonal route keeps the ELK port side when meeting rectangular and diamond outlines', () => {
  const process = n('process', 100, 100);
  assert.deepEqual(shapeBoundaryPoint(process, { x: 300, y: 150 }, { x: 340, y: 180 }), { x: 300, y: 150 });
  assert.deepEqual(shapeBoundaryPoint(process, { x: 200, y: 100 }, { x: 240, y: 60 }), { x: 200, y: 100 });
  const diamond = n('decision', 100, 100, 'decision');
  assert.deepEqual(shapeBoundaryPoint(diamond, { x: 300, y: 125 }, { x: 340, y: 145 }), { x: 250, y: 125 });
});

test('capsule and store endpoints stop at their actual curved outline', () => {
  const capsule = n('end', 100, 100, 'end');
  const p = shapeBoundaryPoint(capsule, { x: 100, y: 110 }, { x: 50, y: 110 });
  assert.ok(Math.abs(p.x - 120) < .001);
  assert.equal(p.y, 110);
  const store = n('db', 100, 100, 'store');
  assert.ok(Math.abs(shapeBoundaryPoint(store, { x: 200, y: 100 }, { x: 200, y: 60 }).y - 100) < .001);
  assert.ok(shapeBoundaryPoint(store, { x: 110, y: 100 }, { x: 110, y: 60 }).y > 100);
  const sideCap = shapeBoundaryPoint(store, { x: 100, y: 103 }, { x: 50, y: 103 });
  assert.equal(sideCap.y, 103, 'horizontal route stays horizontal near a store cap');
  assert.ok(Math.abs(sideCap.x - 131.25) < .001);
});

test('geometry reports overlapping nodes, escaped children and invalid canvas dimensions', () => {
  const g = base([n('a', 50, 50), n('b', 100, 100)]);
  g.nodes[0]!.groupId = 'g';
  g.groups = [{ id: 'g', label: 'Group', x: 200, y: 200, width: 300, height: 200, titleText: text }];
  const diagnostics = checkGeometry(g);
  assert.ok(diagnostics.some(d => d.code === 'NODE_OVERLAP' && d.ids.includes('a') && d.ids.includes('b')));
  assert.ok(diagnostics.some(d => d.code === 'GROUP_CONTAINMENT' && d.ids.includes('a')));
  g.width = NaN;
  assert.ok(checkGeometry(g).some(d => d.code === 'LAYOUT_INVALID_BOUNDS'));
});

test('geometry detects edge crossing a non-endpoint node and label clipping but allows edge crossings', () => {
  const g = base([n('a', 0, 200), n('blocker', 300, 200), n('b', 600, 200)]);
  g.edges = [{ id: 'ab', source: 'a', target: 'b', kind: 'control', directed: true, originalEdgeIds: ['ab'], label: 'condition', labelText: text, labelBox: { x: 880, y: 40, width: 60, height: 20 }, sections: [[{ x: 200, y: 250 }, { x: 600, y: 250 }]] }];
  assert.ok(checkGeometry(g).some(d => d.code === 'EDGE_NODE_INTERSECTION' && d.ids.includes('blocker')));
  assert.ok(checkGeometry(g).some(d => d.code === 'LABEL_OUT_OF_BOUNDS'));
  g.nodes.splice(1, 1);
  g.edges[0]!.labelBox = { x: 300, y: 160, width: 60, height: 20 };
  g.edges.push({ id: 'other', source: 'a', target: 'b', kind: 'feedback', directed: true, originalEdgeIds: ['other'], labelText: empty, sections: [[{ x: 400, y: 0 }, { x: 400, y: 500 }]] });
  assert.ok(!checkGeometry(g).some(d => d.code === 'EDGE_NODE_INTERSECTION'));
  assert.ok(!checkGeometry(g).some(d => /CROSS/.test(d.code) && d.severity === 'error'));
});

test('geometry checks the drawn cubic curve rather than its control polygon', () => {
  const g = base([n('a', 0, 200), n('blocker', 300, 200), n('b', 600, 200)]);
  g.edges = [{
    id: 'ab', source: 'a', target: 'b', kind: 'control', directed: true,
    originalEdgeIds: ['ab'], labelText: empty, routing: 'spline',
    sections: [[{ x: 200, y: 250 }, { x: 320, y: 250 }, { x: 480, y: 250 }, { x: 600, y: 250 }]],
  }];
  assert.ok(checkGeometry(g).some(d => d.code === 'EDGE_NODE_INTERSECTION' && d.ids.includes('blocker')));
  g.nodes[1]!.y = 330;
  g.edges[0]!.sections = [[{ x: 200, y: 250 }, { x: 320, y: 350 }, { x: 480, y: 350 }, { x: 600, y: 250 }]];
  assert.ok(!checkGeometry(g).some(d => d.code === 'EDGE_NODE_INTERSECTION'));
});

test('curved route collision follows its painted arc even when all controls avoid the obstacle', () => {
  const cubic = [[
    { x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 },
  ]];
  const obstacle = { x: 45, y: 65, width: 10, height: 10 };
  assert.ok(cubic[0]!.every(point => point.x < obstacle.x || point.x > obstacle.x + obstacle.width || point.y < obstacle.y || point.y > obstacle.y + obstacle.height));
  assert.equal(routeIntersectsBoxes(cubic, true, [obstacle]), true);
  assert.equal(routeIntersectsBoxes(cubic, true, [{ ...obstacle, y: 80 }]), false);
});

test('smoothing preserves the original straight route when every curve would enter a nearby node', () => {
  const source = n('source', 0, 0);
  const target = n('target', 200, 200);
  const blocker = { ...n('blocker', 85, 140), width: 14, height: 50, titleText: empty };
  const graph = base([source, target, blocker]);
  graph.edges = [{
    id: 'route', source: source.id, target: target.id, kind: 'control', directed: true,
    originalEdgeIds: ['route'], labelText: empty, routing: 'polyline',
    sections: [[{ x: 100, y: 100 }, { x: 100, y: 200 }, { x: 200, y: 200 }]],
  }];
  const before = structuredClone(graph.edges[0]!.sections);
  const result = smoothGraphRoutes(graph);
  assert.equal(result.edges[0]!.routing, 'polyline');
  assert.deepEqual(result.edges[0]!.sections, before);
  assert.deepEqual(graph.edges[0]!.sections, before, 'the original layout is immutable');
});

test('geometry checks measured text and separate labels without manufacturing errors for valid spacing', () => {
  const g = base([n('a', 32, 32), n('b', 400, 32)]);
  assert.deepEqual(checkGeometry(g), []);
  g.nodes[0]!.titleText = { ...text, width: 210 };
  assert.ok(checkGeometry(g).some(d => d.code === 'NODE_TEXT_OVERFLOW'));
  g.edges = [{ id: 'ab', source: 'a', target: 'b', kind: 'control', directed: true, originalEdgeIds: ['ab'], labelText: text, labelBox: { x: 50, y: 50, width: 60, height: 20 }, sections: [[{ x: 232, y: 82 }, { x: 400, y: 82 }]] }];
  assert.ok(checkGeometry(g).some(d => d.code === 'LABEL_NODE_OVERLAP'));
});

test('geometry reports a route or label hiding a group title', () => {
  const g = base([n('a', 32, 32), n('b', 400, 32)]);
  g.groups = [{ id: 'g', label: 'Group', x: 300, y: 250, width: 300, height: 200, titleText: text }];
  g.edges = [{ id: 'ab', source: 'a', target: 'b', kind: 'control', directed: true, originalEdgeIds: ['ab'], labelText: text, labelBox: { x: 328, y: 264, width: 60, height: 20 }, sections: [[{ x: 200, y: 274 }, { x: 500, y: 274 }]] }];
  const diagnostics = checkGeometry(g);
  assert.ok(diagnostics.some(d => d.code === 'EDGE_GROUP_TITLE_INTERSECTION'));
  assert.ok(diagnostics.some(d => d.code === 'LABEL_GROUP_TITLE_OVERLAP'));
});
