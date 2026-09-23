export function wrapText(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  if (!text) return [];
  const result: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    const tokens = paragraph.match(/[\p{Script=Latin}\d_./:@-]+|\s+|[^\s]/gu) ?? [];
    for (const token of tokens) {
      if (measure(line + token) <= maxWidth) { line += token; continue; }
      if (line.trim()) { result.push(line.trimEnd()); line = ''; }
      if (!token.trim()) continue;
      if (measure(token) <= maxWidth) { line = token; continue; }
      // A long identifier is split only after word wrapping has been exhausted.
      for (const char of token) {
        if (line && measure(line + char) > maxWidth) { result.push(line); line = ''; }
        line += char;
      }
    }
    if (line.trim()) result.push(line.trimEnd());
  }
  return result;
}
