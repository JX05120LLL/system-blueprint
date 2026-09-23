import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { composeSvg } from './comparison.mjs';
const args = process.argv.slice(2);
const value = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const before = value('--before'), after = value('--after'), output = value('--output');
if (!before || !after || !output) { console.error('用法: node scripts/compose-comparison.mjs --before before.svg --after after.svg --output comparison.svg [--overwrite]'); process.exit(2); }
if (!args.includes('--overwrite')) { try { await access(output); console.error('输出已存在，请显式 --overwrite'); process.exit(2); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu'] });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(composeSvg, { before: await readFile(before, 'utf8'), after: await readFile(after, 'utf8') });
  await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(output, result, 'utf8'); console.log(output);
} finally { await browser.close(); }
