import { open, mkdir, rename, link, unlink, access } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MAX_DOCUMENT_BYTES, validateDocument } from '../model/validate';

export class InputError extends Error {}
export type Arguments = { input?: string; values: Map<string, string>; flags: Set<string> };

export function parseArguments(argv: string[], valueOptions: string[], flagOptions: string[] = []): Arguments {
  const result: Arguments = { values: new Map(), flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      if (result.values.has(arg) || result.flags.has(arg)) throw new InputError(`重复参数：${arg}`);
      if (flagOptions.includes(arg) || arg === '--help') result.flags.add(arg);
      else if (valueOptions.includes(arg)) {
        const value = argv[++i];
        if (value === undefined || value.startsWith('--')) throw new InputError(`参数 ${arg} 缺少值。`);
        result.values.set(arg, value);
      } else throw new InputError(`未知参数：${arg}`);
    } else if (!result.input) result.input = arg;
    else throw new InputError(`多余的输入路径：${arg}`);
  }
  return result;
}

export async function readInput(path: string, limit?: number): Promise<string> {
  let file;
  try {
    file = await open(resolve(path), 'r');
    const info = await file.stat();
    if (!info.isFile()) throw new InputError(`输入不是普通文件：${path}`);
    if (limit !== undefined && info.size > limit) throw new InputError('DOCUMENT_SIZE_LIMIT: 图数据超过 2 MiB，请拆为总览与子图。');
    const bytes = await file.readFile();
    if (limit !== undefined && bytes.byteLength > limit) throw new InputError('DOCUMENT_SIZE_LIMIT: 图数据超过 2 MiB，请拆为总览与子图。');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError(`无法读取 UTF-8 输入 ${path}：${error instanceof Error ? error.message : String(error)}`);
  } finally { await file?.close(); }
}

export async function readDocument(path: string) {
  const source = await readInput(path, MAX_DOCUMENT_BYTES);
  let data: unknown;
  try { data = JSON.parse(source); } catch (error) { throw new InputError(`JSON_PARSE_ERROR: ${error instanceof Error ? error.message : String(error)}`); }
  const result = validateDocument(data);
  if (!result.valid || !result.document) throw new InputError(JSON.stringify(result.diagnostics, null, 2));
  return { document: result.document, diagnostics: result.diagnostics };
}

export async function checkOutput(path: string, overwrite: boolean, input?: string) {
  if (input && resolve(path).toLowerCase() === resolve(input).toLowerCase()) throw new InputError('输出路径不能与输入路径相同。');
  if (!overwrite) {
    try { await access(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    throw new InputError(`目标已存在，请使用 --overwrite：${path}`);
  }
}

/** Complete the sibling temporary file before publishing. Hard-link creation keeps no-overwrite atomic. */
export async function atomicWrite(path: string, content: string | Uint8Array, overwrite: boolean) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, 'wx');
    try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
    if (overwrite) await rename(temporary, path);
    else {
      try { await link(temporary, path); } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new InputError(`目标已存在，请使用 --overwrite：${path}`);
        throw error;
      }
    }
  } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}

export function requireExtension(path: string, extensions: string[]) {
  if (!extensions.includes(extname(path).toLowerCase())) throw new InputError(`文件扩展名必须为 ${extensions.join(' / ')}：${path}`);
}

export function runCli(main: () => Promise<void>) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error instanceof InputError ? 2 : 1;
  });
}
