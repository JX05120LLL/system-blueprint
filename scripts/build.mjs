import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSchema, repositoryRoot, schemaOutputs } from './schema.mjs';
import { generateNotices } from './notices.mjs';

export const bundleOutputs = ['system-blueprint/assets/viewer.js', ...['generate', 'validate', 'export'].map(name => `system-blueprint/scripts/${name}.mjs`)];
export const manifestPath = 'system-blueprint/assets/build-manifest.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Rebuild from source into outputRoot; no installed prebuilt resource is a bundle input. */
export async function buildProject({ outputRoot = repositoryRoot, logLevel = 'info' } = {}) {
  outputRoot = resolve(outputRoot);
  await generateSchema({ outputRoot });
  const generatedValidator = await readFile(join(outputRoot, schemaOutputs[1]), 'utf8');
  const generatedPlugin = {
    name: 'fresh-schema-validator',
    setup(builder) {
      // Keep real module paths so temporary builds have deterministic source comments.
      builder.onResolve({ filter: /(?:^|\/)validator\.generated\.js$/ }, args => args.importer.replaceAll('\\', '/').endsWith('/src/model/validate.ts') ? { path: join(repositoryRoot, 'src/model/validator.generated.js') } : undefined);
      builder.onLoad({ filter: /[\\/]src[\\/]model[\\/]validator\.generated\.js$/ }, () => ({ contents: generatedValidator, loader: 'js', resolveDir: join(repositoryRoot, 'src/model') }));
    },
  };
  const common = { absWorkingDir: repositoryRoot, bundle: true, logLevel, legalComments: 'eof', target: 'es2022', plugins: [generatedPlugin] };
  await build({ ...common, entryPoints: ['src/viewer/index.ts'], outfile: join(outputRoot, bundleOutputs[0]), format: 'iife', platform: 'browser', minify: true,
    banner: { js: 'globalThis.__blueprintStarted = performance.now();' },
    define: { __ELK_WORKER_SOURCE__: JSON.stringify(await readFile(join(repositoryRoot, 'node_modules/elkjs/lib/elk-worker.min.js'), 'utf8')) },
    plugins: [generatedPlugin, { name: 'inline-layout-worker', setup(builder) { builder.onResolve({ filter: /^\.\/engine(?:\.ts)?$/ }, args => args.importer.replaceAll('\\', '/').endsWith('/layout/elk.ts') ? { path: join(repositoryRoot, 'src/layout/engine.browser.ts') } : undefined); } }],
  });
  for (const name of ['generate', 'validate', 'export']) {
    await build({ ...common, entryPoints: [`src/cli/${name}.ts`], outfile: join(outputRoot, `system-blueprint/scripts/${name}.mjs`), platform: 'node', format: 'esm', external: ['playwright'], banner: { js: '#!/usr/bin/env node' } });
  }
  const notices = await generateNotices({ outputRoot });
  const pkg = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'));
  const skill = JSON.parse(await readFile(join(repositoryRoot, 'system-blueprint/package.json'), 'utf8'));
  const schemaBytes = await readFile(join(repositoryRoot, 'system-blueprint/references/diagram-schema.json'));
  const schema = JSON.parse(schemaBytes);
  const hashes = {};
  for (const path of [...schemaOutputs, ...bundleOutputs, ...notices]) hashes[path] = sha256(await readFile(join(outputRoot, path)));
  const manifest = {
    version: pkg.version, schemaVersion: schema.properties.schemaVersion.const,
    schemaSha256: sha256(schemaBytes), node: pkg.engines.node,
    playwright: skill.dependencies.playwright, buildDependencies: pkg.devDependencies, files: hashes,
  };
  await mkdir(join(outputRoot, 'system-blueprint/assets'), { recursive: true });
  await writeFile(join(outputRoot, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`);
  return [...schemaOutputs, ...bundleOutputs, ...notices, manifestPath];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output-root' || !args[1])) throw new Error('Usage: node scripts/build.mjs [--output-root PATH]');
  await buildProject({ outputRoot: args.length ? resolve(args[1]) : repositoryRoot });
}
