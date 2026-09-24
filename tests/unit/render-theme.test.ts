import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assignSourceEdgeColours, themes } from '../../src/render/theme.ts';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
}

function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter! + .05) / (darker! + .05);
}

test('semantic node and relation colors remain distinguishable in light and dark themes', () => {
  for (const theme of Object.values(themes)) {
    assert.equal(new Set(theme.sourceEdgePalette).size, theme.sourceEdgePalette.length, `${theme.name}: duplicate palette colour`);
    for (const colour of theme.sourceEdgePalette) {
      assert.ok(contrast(colour, theme.background) >= 4.5, `${theme.name}: ${colour} against canvas`);
    }
    const nodes = [theme.semantic.process, theme.semantic.decision, theme.semantic.store, theme.semantic.external, theme.semantic.terminal];
    assert.equal(new Set(nodes.map(node => node.stroke)).size, nodes.length);
    for (const node of nodes) {
      assert.ok(contrast(node.stroke, node.fill) >= 4.5, `${theme.name}: ${node.stroke} against node fill`);
      assert.ok(contrast(theme.text, node.fill) >= 4.5, `${theme.name}: text against ${node.fill}`);
    }
    for (const edge of [theme.accent, theme.exception, theme.semantic.dataEdge, theme.semantic.dependencyEdge, theme.semantic.feedbackEdge]) {
      assert.ok(contrast(edge, theme.background) >= 4.5, `${theme.name}: ${edge} against canvas`);
    }
  }
});

test('source colours are deterministic, distinct within the palette, and preserve their slot across themes', () => {
  const ids = ['order', 'inventory', 'payment', 'gateway', 'catalog', 'notify', 'customer', 'cache'];
  const light = assignSourceEdgeColours(ids, themes.light);
  const reordered = assignSourceEdgeColours([...ids].reverse().concat('order'), themes.light);
  const dark = assignSourceEdgeColours(ids, themes.dark);

  assert.equal(light.size, ids.length);
  assert.equal(new Set([...light.values()].map(({ colour }) => colour)).size, ids.length);
  for (const id of ids) {
    const assigned = light.get(id)!;
    assert.deepEqual(assigned, reordered.get(id), `${id}: changing edge order must not recolour the source`);
    assert.equal(assigned.markerKey, dark.get(id)?.markerKey, `${id}: theme switch must keep palette slot`);
    assert.ok(contrast(assigned.colour, themes.light.background) >= 4.5, `${id}: light theme contrast`);
    assert.ok(contrast(dark.get(id)!.colour, themes.dark.background) >= 4.5, `${id}: dark theme contrast`);
    assert.notEqual(assigned.colour, themes.light.exception, `${id}: ordinary source cannot look like exception`);
    assert.notEqual(assigned.colour, themes.light.semantic.feedbackEdge, `${id}: ordinary source cannot look like feedback`);
  }
});

test('all sources in the README microservice diagram receive distinct arrow colours', () => {
  const document = JSON.parse(readFileSync(new URL('../../examples/traditional-microservices.diagram.json', import.meta.url), 'utf8')) as { nodes: { id: string }[] };
  const ids = document.nodes.map(node => node.id);
  for (const theme of Object.values(themes)) {
    const assignments = assignSourceEdgeColours(ids, theme);
    assert.equal(new Set([...assignments.values()].map(({ colour }) => colour)).size, ids.length, `${theme.name}: colors repeat within the demo`);
  }
});
