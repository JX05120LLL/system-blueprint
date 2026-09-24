import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const noticePackages = ['elkjs', 'ajv', 'fast-deep-equal', 'd3-selection', 'd3-zoom', 'd3-dispatch', 'd3-drag', 'd3-interpolate', 'd3-transition', 'd3-color', 'd3-timer', 'd3-ease'];

function repositoryUrl(pkg) {
  let source = typeof pkg.repository === 'object' ? pkg.repository.url : pkg.repository;
  source ??= pkg.homepage;
  if (!source) throw new Error(`Upstream repository missing: ${pkg.name}`);
  source = source.replace(/^git\+/, '').replace(/\.git$/, '');
  if (/^[\w.-]+\/[\w.-]+$/.test(source)) source = `https://github.com/${source}`;
  source = source.replace(/^github:/, 'https://github.com/').replace(/^git:\/\/github.com\//, 'https://github.com/').replace(/^git@github.com:/, 'https://github.com/');
  const url = new URL(source);
  if (url.protocol !== 'https:') throw new Error(`Upstream repository must be an HTTPS source URL: ${pkg.name}`);
  return url.href.replace(/\/$/, '');
}

export async function generateNotices({ outputRoot = root } = {}) {
  await mkdir(join(outputRoot, 'system-blueprint/references/licenses'), { recursive: true });
  const outputs = []; const versions = {};
  const lines = ['# Third-party notices', '', 'The offline viewer includes the following libraries. Their installed upstream license texts are copied without alteration into `references/licenses/`. These links identify source repositories; the generated HTML loads no remote resources.', '', '| Package | Version | License | Source |', '| --- | --- | --- | --- |'];
  for (const name of noticePackages) {
    const pkg = JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8'));
    versions[name] = pkg.version;
    let license;
    for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md']) {
      try { license = await readFile(join(root, 'node_modules', name, file)); break; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (!license?.length) throw new Error(`License missing: ${name}`);
    const path = `system-blueprint/references/licenses/${name}.txt`;
    await writeFile(join(outputRoot, path), license); outputs.push(path);
    lines.push(`| ${name} | ${pkg.version} | [${pkg.license}](references/licenses/${name}.txt) | [upstream](${repositoryUrl(pkg)}) |`);
  }
  const exporter = JSON.parse(await readFile(join(root, 'system-blueprint/package.json'), 'utf8'));
  lines.push('',
    `ELK is upstream code distributed under EPL-2.0. The corresponding elkjs wrapper and build sources are available at [elkjs ${versions.elkjs}](https://github.com/kieler/elkjs/tree/${versions.elkjs}); its [build definition](https://raw.githubusercontent.com/kieler/elkjs/${versions.elkjs}/build.gradle) identifies the Eclipse Layout Kernel modules incorporated into the worker. The underlying Java layout sources are in the [Eclipse Layout Kernel repository](https://github.com/eclipse-elk/elk). The application embeds the installed upstream \`elk-worker.min.js\` without changing its layout algorithms.`, '',
    `The optional export dependency is Playwright ${exporter.dependencies.playwright} (Apache-2.0). Its license and third-party notices are installed by \`npm ci\` in the skill directory; Chromium carries its own notices in the installed browser distribution.`, '',
    'Build-only dependencies (TypeScript, esbuild, json-schema-to-typescript, tsx and test tools) are locked in the repository package-lock.json. They are not needed to generate HTML from an installed skill.', '',
    'The drawio-skill repository was consulted for workflow and review ideas only; no upstream implementation code was copied.',
  );
  const path = 'system-blueprint/THIRD_PARTY_NOTICES.md';
  await writeFile(join(outputRoot, path), `${lines.join('\n')}\n`); outputs.push(path);
  return outputs;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output-root' || !args[1])) throw new Error('Usage: node scripts/notices.mjs [--output-root PATH]');
  await generateNotices({ outputRoot: args.length ? resolve(args[1]) : root });
}
