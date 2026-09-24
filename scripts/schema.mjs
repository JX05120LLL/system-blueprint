import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';
import Ajv from 'ajv';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { build } from 'esbuild';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const schemaOutputs = ['src/model/diagram.generated.ts', 'src/model/validator.generated.js'];

/** Generate only under outputRoot, allowing verification without changing checked-in files. */
export async function generateSchema({ outputRoot = repositoryRoot } = {}) {
  const schema = JSON.parse(await readFile(join(repositoryRoot, 'system-flow/references/diagram-schema.json'), 'utf8'));
  const types = await compile(schema, 'DiagramDocument', {
    bannerComment: '/* Generated from diagram-schema.json. Do not edit. */',
    additionalProperties: false, ignoreMinAndMaxItems: true,
  });
  const ajv = new Ajv({ allErrors: true, strict: true, code: { source: true, esm: true } });
  const validator = await build({
    absWorkingDir: repositoryRoot,
    stdin: { contents: standaloneCode(ajv, ajv.compile(schema)), resolveDir: repositoryRoot },
    bundle: true, format: 'esm', platform: 'browser', write: false,
  });
  await mkdir(join(outputRoot, 'src/model'), { recursive: true });
  await writeFile(join(outputRoot, schemaOutputs[0]), types);
  await writeFile(join(outputRoot, schemaOutputs[1]), validator.outputFiles[0].text);
  return schemaOutputs;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output-root' || !args[1])) throw new Error('Usage: node scripts/schema.mjs [--output-root PATH]');
  await generateSchema({ outputRoot: args.length ? resolve(args[1]) : repositoryRoot });
}
