import { cp, mkdir, mkdtemp, readFile, writeFile, stat, realpath, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join, relative, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'blueprint-package-'));
const skill = join(temp, '独立 skill'); const cwd = join(temp, '仓库外 工作目录');
const artifacts = join(root, 'artifacts/package');
const steps = [];
async function run(label, executable, args, expected = 0) {
  const started = performance.now(); let result;
  try { result = { status: 0, ...await execute(executable, args, { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 }) }; }
  catch (error) { result = { status: error.code, stdout: error.stdout ?? '', stderr: error.stderr ?? error.message }; }
  steps.push({ label, executable, args, expected, ...result, milliseconds: Math.round(performance.now() - started) });
  if (result.status !== expected) throw new Error(`${label}: exit ${result.status}; expected ${expected}\n${result.stderr}\n${result.stdout}`);
  return result;
}
let passed = false;
try {
  await mkdir(cwd); await mkdir(artifacts, { recursive: true });
  await cp(join(root, 'system-blueprint'), skill, { recursive: true, filter: path => !path.split(/[\\/]/).some(part => part === 'node_modules' || part === '__pycache__') });
  const input = join(cwd, '请求 流程.json'); const html = join(cwd, '请求 流程.html');
  const model = { schemaVersion: '2.0', id: 'package-check', title: '独立安装验证', view: { kind: 'flow', direction: 'DOWN', theme: 'light' }, groups: [], nodes: [{ id: 'start', kind: 'start', label: '收到请求' }, { id: 'gate', kind: 'decision', label: '校验通过？' }, { id: 'done', kind: 'end', label: '返回结果' }, { id: 'error', kind: 'end', label: '返回错误' }], edges: [{ id: 'e1', source: 'start', target: 'gate', kind: 'control', directed: true }, { id: 'e2', source: 'gate', target: 'done', kind: 'control', directed: true, label: '通过' }, { id: 'e3', source: 'gate', target: 'error', kind: 'exception', directed: true, label: '不通过' }] };
  await writeFile(input, JSON.stringify(model, null, 2));
  if (existsSync(join(skill, 'node_modules'))) throw new Error('复制时意外包含了 node_modules。');
  await run('validate before npm install', process.execPath, [join(skill, 'scripts/validate.mjs'), input]);
  await run('generate before npm install', process.execPath, [join(skill, 'scripts/generate.mjs'), input, '--output', html]);
  await run('export refuses missing local Playwright', process.execPath, [join(skill, 'scripts/export.mjs'), html, '--format', 'svg', '--output', join(cwd, 'before-install.svg')], 1);
  let npm = process.env.npm_execpath;
  if (!npm) npm = process.platform === 'win32' ? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js') : await realpath(execFileSync('which', ['npm'], { encoding: 'utf8' }).trim());
  await run('npm ci using copied skill lockfile', process.execPath, [npm, 'ci', '--prefix', skill, '--no-audit', '--no-fund']);
  const packageVersion = JSON.parse(await readFile(join(skill, 'node_modules/playwright/package.json'), 'utf8')).version;
  for (const format of ['svg', 'png', 'jpg']) {
    const path = join(cwd, `请求 流程.${format}`);
    await run(`export ${format} from outside repository`, process.execPath, [join(skill, 'scripts/export.mjs'), html, '--format', format, '--output', path, ...(format === 'svg' ? [] : ['--scale', '1'])]);
    const bytes = await readFile(path);
    if (format === 'png' && bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('PNG 格式错误。');
    if (format === 'jpg' && bytes.subarray(0, 3).toString('hex') !== 'ffd8ff') throw new Error('JPEG 格式错误。');
    if (format === 'svg' && (!bytes.toString().includes('不通过') || /<script|<foreignObject/.test(bytes.toString()))) throw new Error('SVG 缺少完整条件或包含脚本。');
    await cp(path, join(artifacts, `standalone.${format}`));
  }
  await cp(html, join(artifacts, 'standalone.html')); await cp(input, join(artifacts, 'standalone.diagram.json'));
  const report = { status: 'passed', node: process.version, platform: process.platform, temp, copiedSkill: skill, cwd, playwright: packageVersion, htmlBytes: (await stat(html)).size, repositoryDependenciesUsed: false, browser: 'installed Chromium cache; shared OS browser cache is permitted', steps };
  await writeFile(join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
  passed = true;
  console.log(JSON.stringify({ status: report.status, report: join(artifacts, 'report.json'), htmlBytes: report.htmlBytes, playwright: packageVersion, steps: steps.length }));
} catch (error) {
  await mkdir(artifacts, { recursive: true });
  await writeFile(join(artifacts, 'report.json'), JSON.stringify({ status: 'failed', temp, error: error.message, steps }, null, 2));
  console.error(error.message); process.exitCode = 1;
} finally {
  if (passed) {
    // Only remove the exact directory created above, after checking its resolved containment.
    const actual = await realpath(temp); const base = await realpath(tmpdir()); const child = relative(base, actual);
    if (!child || child.startsWith('..') || isAbsolute(child) || !basename(actual).startsWith('blueprint-package-')) throw new Error(`拒绝删除未核实的临时路径：${actual}`);
    await rm(actual, { recursive: true });
  }
}
