import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute, basename } from 'node:path';
import { buildProject } from './build.mjs';
import { repositoryRoot } from './schema.mjs';

const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function checkPackage(directory) {
  const pkg = await json(join(directory, 'package.json'));
  const lock = await json(join(directory, 'package-lock.json'));
  assert.equal(lock.lockfileVersion, 3, `${directory}: lockfile v3 is required`);
  for (const key of ['name', 'version']) {
    assert.equal(lock[key], pkg[key], `${directory}: package-lock ${key} mismatch`);
    assert.equal(lock.packages[''][key], pkg[key], `${directory}: locked root ${key} mismatch`);
  }
  assert.ok(exactVersion.test(pkg.version), `${directory}: exact package version required`);
  assert.deepEqual(lock.packages[''].engines, pkg.engines, `${directory}: engines differ from lockfile`);
  const dependencies = {};
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    assert.deepEqual(lock.packages[''][field] ?? {}, pkg[field] ?? {}, `${directory}: locked ${field} mismatch`);
    for (const [name, version] of Object.entries(pkg[field] ?? {})) {
      assert.ok(exactVersion.test(version), `${name}: dependency must use an exact version, got ${version}`);
      assert.equal(lock.packages[`node_modules/${name}`]?.version, version, `${name}: lock version mismatch`);
      const installed = await json(join(directory, 'node_modules', name, 'package.json'));
      assert.equal(installed.version, version, `${name}: installed version differs; run npm ci`);
      dependencies[name] = version;
    }
  }
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path) continue;
    assert.ok(exactVersion.test(entry.version ?? ''), `${directory}/${path}: transitive dependency is not version-locked`);
    assert.ok(/^https:\/\//.test(entry.resolved ?? '') && /^sha(256|384|512)-/.test(entry.integrity ?? ''), `${directory}/${path}: missing registry integrity`);
  }
  return { pkg, lock, dependencies };
}

const report = { status: 'failed', node: process.version, platform: process.platform, checks: [], differences: [] };
const output = join(repositoryRoot, 'artifacts/build-consistency/report.json');
let temp;
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 24, 'Build verification requires the documented Node.js 24 toolchain.');
  const [root, skill] = await Promise.all([checkPackage(repositoryRoot), checkPackage(join(repositoryRoot, 'system-flow'))]);
  assert.equal(root.pkg.version, skill.pkg.version, 'Repository and skill version mismatch');
  assert.deepEqual(root.pkg.engines, skill.pkg.engines, 'Repository and skill Node engines mismatch');
  const playwright = skill.dependencies.playwright;
  assert.equal(root.dependencies['@playwright/test'], playwright, 'Root test runner and skill Playwright versions must match');
  for (const [name, environment, directory] of [['root', root, repositoryRoot], ['skill', skill, join(repositoryRoot, 'system-flow')]]) {
    for (const dependency of ['playwright', 'playwright-core']) {
      assert.equal(environment.lock.packages[`node_modules/${dependency}`]?.version, playwright, `${name}: ${dependency} lock version drift`);
      assert.equal((await json(join(directory, 'node_modules', dependency, 'package.json'))).version, playwright, `${name}: installed ${dependency} version drift`);
    }
  }
  const schema = await json(join(repositoryRoot, 'system-flow/references/diagram-schema.json'));
  assert.equal(schema.properties.schemaVersion.const, root.pkg.version.split('.').slice(0, 2).join('.'), 'Schema major/minor differs from package version');
  report.checks.push('exact package versions, lockfiles, installed direct dependencies, Node 24, matching Playwright and schema versions');
  temp = await mkdtemp(join(tmpdir(), 'system-flow-build-check-'));
  const files = await buildProject({ outputRoot: temp, logLevel: 'silent' });
  for (const path of files) {
    const expected = await readFile(join(temp, path));
    let actual;
    try { actual = await readFile(join(repositoryRoot, path)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!actual || !actual.equals(expected)) report.differences.push({ path, expectedSha256: digest(expected), actualSha256: actual ? digest(actual) : null });
  }
  report.filesCompared = files.length;
  report.checks.push('fresh schema types and Ajv validator; browser/CLI bundles; upstream license bytes and notices; build manifest');
  if (report.differences.length) throw new Error(`Stale build outputs: ${report.differences.map(item => item.path).join(', ')}. Run npm run build, review the generated changes, then rerun npm run check:build.`);
  report.status = 'passed'; report.version = root.pkg.version; report.playwright = playwright;
} catch (error) { report.error = error.message; process.exitCode = 1; }
finally {
  if (temp) {
    const actual = await realpath(temp); const base = await realpath(tmpdir()); const child = relative(base, actual);
    if (!child || child.startsWith('..') || isAbsolute(child) || !basename(actual).startsWith('system-flow-build-check-')) throw new Error(`Refusing to remove unverified temporary path: ${actual}`);
    await rm(actual, { recursive: true });
  }
  await mkdir(join(repositoryRoot, 'artifacts/build-consistency'), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ ...report, report: relative(repositoryRoot, output).replaceAll('\\', '/') }, null, 2));
