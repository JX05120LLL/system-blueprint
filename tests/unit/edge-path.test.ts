import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polylineEdgePath, splineEdgePath } from '../../src/render/svg.ts';
import { splineControls } from '../../src/layout/curves.ts';

test('ELK spline control points become a continuous cubic route', () => {
  assert.equal(splineEdgePath([
    { x: 0, y: 10 }, { x: 20, y: 10 }, { x: 30, y: 40 }, { x: 50, y: 40 },
    { x: 70, y: 40 }, { x: 80, y: 10 }, { x: 100, y: 10 },
  ]), 'M0 10 C20 10 30 40 50 40 C70 40 80 10 100 10');
  assert.throws(() => splineEdgePath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]), /control points/i);
});

test('waypoint smoothing joins cubic segments with one continuous tangent', () => {
  const points = splineControls([
    { x: 0, y: 0 }, { x: 80, y: 60 }, { x: 160, y: 0 },
  ]);
  assert.equal(points.length, 7);
  assert.deepEqual(points[0], { x: 0, y: 0 });
  assert.deepEqual(points.at(-1), { x: 160, y: 0 });
  const incoming = { x: points[3]!.x - points[2]!.x, y: points[3]!.y - points[2]!.y };
  const outgoing = { x: points[4]!.x - points[3]!.x, y: points[4]!.y - points[3]!.y };
  assert.ok(incoming.x > 0 && outgoing.x > 0, 'the curve keeps moving through the waypoint');
  assert.ok(Math.abs(incoming.x * outgoing.y - incoming.y * outgoing.x) < 1e-9, 'both segments share a tangent');
  assert.match(splineEdgePath(points), /^M[^QL]* C[^QL]* C[^QL]*$/);
});

test('a straight edge keeps both endpoints and uses only one line command', () => {
  assert.equal(polylineEdgePath([{ x: 4, y: 8 }, { x: 84, y: 8 }]), 'M4 8 L84 8');
});

test('obstacle-safe fallback keeps the routed waypoints as literal straight segments', () => {
  const path = polylineEdgePath([
    { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 0 },
    { x: 40, y: 40 }, { x: 80, y: 40 },
  ]);
  assert.equal(path, 'M0 0 L40 0 L40 40 L80 40');
  assert.doesNotMatch(path, /[QC]/, 'fallback must not mix short corner arcs with straight sections');
});

test('a return path keeps all waypoints and its terminal arrow direction', () => {
  const path = polylineEdgePath([
    { x: 10, y: 10 }, { x: 10, y: -30 }, { x: 90, y: -30 },
    { x: 90, y: 50 }, { x: 10, y: 50 }, { x: 10, y: 20 },
  ]);
  assert.equal(path, 'M10 10 L10 -30 L90 -30 L90 50 L10 50 L10 20');
});
