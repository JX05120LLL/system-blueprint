import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkRasterSize } from '../../src/cli/export-options';

const scripts = resolve('system-blueprint/scripts');
const run = (name: string, args: string[]) => spawnSync(process.execPath, [join(scripts, `${name}.mjs`), ...args], { encoding: 'utf8', timeout: 15000 });
const doc = { schemaVersion: '2.0', id: 'cli-test', title: '中文安全路径', view: { kind: 'overview', direction: 'RIGHT', theme: 'light' }, nodes: [{ id: 'n', kind: 'process', label: '输入材料' }], edges: [], groups: [] };

test('V10 generate preserves existing files and rejects unknown options instead of silently accepting them', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'blueprint 中文路径 '));
  const input = join(dir, '图 数据.json'); const output = join(dir, '产物.html');
  await writeFile(input, JSON.stringify(doc));
  assert.equal(run('generate', [input, '--output', output, '--unknown']).status, 2);
  assert.equal(run('generate', [input, '--output', output]).status, 0);
  const initial = await readFile(output);
  assert.equal(run('generate', [input, '--output', output]).status, 2);
  assert.deepEqual(await readFile(output), initial);
  await writeFile(input, '{broken');
  assert.equal(run('generate', [input, '--output', output, '--overwrite']).status, 2);
  assert.deepEqual(await readFile(output), initial);
});

test('V12 whitespace-padded JSON over 2 MiB is rejected before parsing and writing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'blueprint-limit-'));
  const input = join(dir, 'large.json');
  await writeFile(input, `${' '.repeat(2 * 1024 * 1024)}${JSON.stringify(doc)}`);
  const result = run('generate', [input, '--output', join(dir, 'large.html')]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /2 MiB/);
});

test('V11 validate reports a concrete missing endpoint and refuses unsupported versions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'blueprint-invalid-')); const input = join(dir, 'invalid.json');
  await writeFile(input, JSON.stringify({ ...doc, edges: [{ id: 'e', source: 'n', target: 'absent', kind: 'dependency', directed: true }] }));
  const result = run('validate', [input]);
  assert.equal(result.status, 2); assert.match(result.stderr, /EDGE_TARGET_MISSING/); assert.match(result.stderr, /\/edges\/0\/target/);
  await writeFile(input, JSON.stringify({ ...doc, schemaVersion: '3.0' }));
  const version = run('validate', [input]); assert.equal(version.status, 2); assert.match(version.stderr, /schemaVersion/);
});

test('V12 export refuses invalid scale, SVG scale and conflicting formats before browser startup', () => {
  const input = resolve('tests/fixtures/legacy/template.html');
  for (const args of [
    ['--format', 'png', '--scale', 'NaN', '--output', 'unused.png'],
    ['--format', 'png', '--scale', '4.1', '--output', 'unused.png'],
    ['--format', 'svg', '--scale', '2', '--output', 'unused.svg'],
    ['--format', 'png', '--output', 'unused.jpg'],
    ['--format', 'jpg', '--output', 'unused.png'],
    ['--format', 'png', '--svg-index', '-1', '--output', 'unused.png'],
  ]) assert.equal(run('export', [input, ...args]).status, 2, args.join(' '));
});

test('V15 raster metadata uses Chromium pixel rounding and V12 bounds remain conservative', () => {
  assert.deepEqual(checkRasterSize(1632, 309, 1.2), { pixelWidth: 1958, pixelHeight: 371 });
  assert.throws(() => checkRasterSize(16000.1, 1, 1), /降低 --scale/);
  assert.throws(() => checkRasterSize(8000, 5001, 1), /降低 --scale/);
});
