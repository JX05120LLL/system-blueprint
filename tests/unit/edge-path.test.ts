import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundedEdgePath } from '../../src/render/svg.ts';

test('a straight edge keeps both ELK endpoints and its terminal direction', () => {
  assert.equal(roundedEdgePath([{ x: 4, y: 8 }, { x: 84, y: 8 }]), 'M4 8 L84 8');
});

test('an orthogonal bend becomes a short curve with a straight final arrow segment', () => {
  assert.equal(roundedEdgePath([
    { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 },
  ]), 'M0 0 L30 0 Q40 0 40 10 L40 40');
});

test('a diagonal turn is rounded without changing the supplied route endpoints', () => {
  assert.equal(roundedEdgePath([
    { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 70, y: 40 },
  ]), 'M0 0 L30 0 Q40 0 46 8 L70 40');
  assert.equal(roundedEdgePath([
    { x: 0, y: 0 }, { x: 30, y: 40 }, { x: 70, y: 70 },
  ]), 'M0 0 L24 32 Q30 40 38 46 L70 70');
  assert.equal(roundedEdgePath([
    { x: 0, y: 0 }, { x: 30, y: 40 }, { x: 80, y: 40 },
  ]), 'M0 0 L24 32 Q30 40 40 40 L80 40');
});

test('multiple turns keep a visible segment between adjacent rounded corners', () => {
  assert.equal(roundedEdgePath([
    { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 40, y: 20 },
  ]), 'M0 0 L11 0 Q20 0 20 9 L20 11 Q20 20 29 20 L40 20');
});

test('duplicate points and tiny legs stay finite and do not produce stray curves', () => {
  assert.equal(roundedEdgePath([
    { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 2 }, { x: 30, y: 2 },
  ]), 'M0 0 L20 0 L20 2 L30 2');
});

test('a loop retains its return leg and final tangent for the arrow', () => {
  const path = roundedEdgePath([
    { x: 10, y: 10 }, { x: 10, y: -30 }, { x: 90, y: -30 },
    { x: 90, y: 50 }, { x: 10, y: 50 }, { x: 10, y: 20 },
  ]);
  assert.ok(path.startsWith('M10 10 L10 -20 Q10 -30 20 -30'));
  assert.ok(path.endsWith('L10 20'));
  assert.equal((path.match(/Q/g) ?? []).length, 4);
});

test('rounding is skipped when its swept corner could enter a node or group title', () => {
  assert.equal(roundedEdgePath([
    { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 },
  ], [{ x: 36, y: 2, width: 3, height: 2 }]), 'M0 0 L40 0 L40 40');
});

test('near-collinear and reversal points remain literal routed segments', () => {
  assert.equal(roundedEdgePath([
    { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 80, y: 1 }, { x: 40, y: 1 },
  ]), 'M0 0 L40 0 L80 1 L40 1');
});
