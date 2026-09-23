import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWrite, checkOutput, InputError, parseArguments, readDocument, requireExtension, runCli } from './common';
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
async function main() {
  const args = parseArguments(process.argv.slice(2), ['--output'], ['--overwrite']);
  const help = '用法：node generate.mjs input.diagram.json --output output.html [--overwrite]\n仅需 Node.js 24；生成完成后仍需浏览器视觉检查。';
  if (args.flags.has('--help')) { console.log(help); return; }
  if (!args.input || !args.values.has('--output')) throw new InputError(help);
  const output = resolve(args.values.get('--output')!); const overwrite = args.flags.has('--overwrite');
  requireExtension(output, ['.html', '.htm']);
  await checkOutput(output, overwrite, args.input);
  const { document: doc, diagnostics } = await readDocument(args.input);
  const assets = resolve(dirname(fileURLToPath(import.meta.url)), '../assets');
  const [template, css, js] = (await Promise.all(['template.html', 'viewer.css', 'viewer.js'].map(file => readFile(resolve(assets, file), 'utf8')))).map(content => content.replace(/\r\n?/g, '\n'));
  const values: Record<string, string> = { TITLE: escapeHtml(doc.title), CSS: css, JS: js.replace(/<\/script/gi, '<\\/script'), DATA: JSON.stringify(doc).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'), SUMMARY: `<ul>${doc.nodes.map(n => `<li>${escapeHtml(n.label)}${n.summary ? `：${escapeHtml(n.summary)}` : ''}</li>`).join('')}</ul>` };
  const html = template.replace(/__(TITLE|CSS|JS|DATA|SUMMARY)__/g, (_, key: string) => values[key]);
  await atomicWrite(output, html, overwrite);
  console.log(JSON.stringify({ output, bytes: Buffer.byteLength(html), diagnostics, status: 'assembled; browser validation required' }));
}
runCli(main);
