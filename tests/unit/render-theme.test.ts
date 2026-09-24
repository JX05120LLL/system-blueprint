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

function oklab(hex: string): [number, number, number] {
  const [red, green, blue] = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const l = Math.cbrt(.4122214708 * red! + .5363325363 * green! + .0514459929 * blue!);
  const m = Math.cbrt(.2119034982 * red! + .6806995451 * green! + .1073969566 * blue!);
  const s = Math.cbrt(.0883024619 * red! + .2817188376 * green! + .6299787005 * blue!);
  return [
    .2104542553 * l + .793617785 * m - .0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + .4505937099 * s,
    .0259040371 * l + .7827717662 * m - .808675766 * s,
  ];
}

function perceptualDistance(first: string, second: string): number {
  const a = oklab(first); const b = oklab(second);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
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

test('source palette separates dense relations and keeps error red reserved', () => {
  for (const theme of Object.values(themes)) {
    const colors = theme.sourceEdgePalette;
    for (let i = 0; i < colors.length; i++) {
      assert.ok(perceptualDistance(colors[i]!, theme.exception) >= .1, `${theme.name}: source ${i} resembles an exception`);
      for (let j = i + 1; j < colors.length; j++) {
        const floor = i < 8 && j < 8 ? .1 : .065;
        assert.ok(perceptualDistance(colors[i]!, colors[j]!) >= floor, `${theme.name}: sources ${i} and ${j} blend together`);
      }
    }
  }
});

test('all sources in the full microservice diagram receive distinct arrow colours', () => {
  const document = JSON.parse(readFileSync(new URL('../fixtures/traditional-microservices-full.diagram.json', import.meta.url), 'utf8')) as { nodes: { id: string }[] };
  const ids = document.nodes.map(node => node.id);
  for (const theme of Object.values(themes)) {
    const assignments = assignSourceEdgeColours(ids, theme);
    assert.equal(new Set([...assignments.values()].map(({ colour }) => colour)).size, ids.length, `${theme.name}: colors repeat within the demo`);
  }
});
