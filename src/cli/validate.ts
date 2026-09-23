import { InputError, parseArguments, readDocument, runCli } from './common';

runCli(async () => {
  const args = parseArguments(process.argv.slice(2), []);
  const help = '用法：node validate.mjs input.diagram.json\n校验 UTF-8 JSON 的结构、引用、条件、方向及两层分组。';
  if (args.flags.has('--help')) { console.log(help); return; }
  if (!args.input) throw new InputError(help);
  const { document, diagnostics } = await readDocument(args.input);
  console.log(JSON.stringify({ valid: true, id: document.id, diagnostics }, null, 2));
});
