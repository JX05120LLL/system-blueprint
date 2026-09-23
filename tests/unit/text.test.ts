import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapText } from '../../src/layout/text.ts';
const width = (text: string) => [...text].reduce((sum, char) => sum + (/[^\x00-\x7F]/.test(char) ? 15 : 7), 0);
test('V02 wraps Chinese, English words and unbroken identifiers without losing characters', () => {
  for (const text of ['中文长标题测试换行', 'Long english label', 'someVeryLongIdentifierWithoutSpaces']) {
    const lines = wrapText(text, 80, width);
    assert.ok(lines.every(line => width(line) <= 80));
    assert.equal(lines.join('').replaceAll(' ', ''), text.replaceAll(' ', ''));
  }
  assert.deepEqual(wrapText('hello world', 40, width), ['hello', 'world']);
});
