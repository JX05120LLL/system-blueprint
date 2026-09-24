import assert from 'node:assert/strict';
import test from 'node:test';
import { applyDocumentEdit, formatSourceLines, parseSourceLines } from '../../src/viewer/edit.ts';
import type { DiagramDocument } from '../../src/model/types.ts';

function document(): DiagramDocument {
  return {
    schemaVersion: '2.0', id: 'review-flow', title: '审核流程',
    view: { kind: 'flow', direction: 'DOWN', theme: 'light', primaryPath: ['enter', 'allow'] },
    groups: [{ id: 'review', label: '审核环节', details: '先人工确认。' }],
    nodes: [
      { id: 'start', kind: 'start', label: '收到请求' },
      { id: 'check', kind: 'decision', label: '资料齐全？', groupId: 'review', summary: '检查必填项' },
      { id: 'done', kind: 'end', label: '完成' },
      { id: 'reject', kind: 'end', label: '退回' },
    ],
    edges: [
      { id: 'enter', source: 'start', target: 'check', kind: 'control', directed: true },
      { id: 'allow', source: 'check', target: 'done', kind: 'control', directed: true, label: '齐全' },
      { id: 'deny', source: 'check', target: 'reject', kind: 'exception', directed: true, label: '缺失' },
    ],
  };
}

test('node detail correction updates a new document without mutating the original graph', () => {
  const original = document();
  const snapshot = structuredClone(original);
  const result = applyDocumentEdit(original, {
    type: 'node', id: 'check', patch: {
      label: '资料与授权均齐全？',
      summary: '逐项核对请求材料',
      details: '发现缺失时先退回补齐，不直接放行。',
    },
  });
  assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
  assert.ok(result.document);
  assert.notStrictEqual(result.document, original);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(result.document.nodes.find(node => node.id === 'check'), {
    ...snapshot.nodes[1], label: '资料与授权均齐全？', summary: '逐项核对请求材料',
    details: '发现缺失时先退回补齐，不直接放行。',
  });
  assert.deepEqual(result.document.edges, snapshot.edges);
  assert.deepEqual(result.document.view.primaryPath, ['enter', 'allow']);
});

test('edge correction retains IDs and other branch conditions while changing direction and endpoints', () => {
  const original = document();
  const snapshot = structuredClone(original);
  const result = applyDocumentEdit(original, {
    type: 'edge', id: 'deny', patch: {
      source: 'check', target: 'start', kind: 'feedback', directed: true,
      label: '材料缺失，重新提交', details: '申请人补齐后从入口重新处理。',
    },
  });
  assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
  assert.ok(result.document);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(result.document.edges.find(edge => edge.id === 'deny'), {
    ...snapshot.edges[2], source: 'check', target: 'start', kind: 'feedback', directed: true,
    label: '材料缺失，重新提交', details: '申请人补齐后从入口重新处理。',
  });
  assert.deepEqual(result.document.edges.slice(0, 2), snapshot.edges.slice(0, 2));
  assert.deepEqual(result.document.view.primaryPath, snapshot.view.primaryPath);
});

test('invalid edits report schema and semantic errors without changing the accepted document', () => {
  const original = document();
  const snapshot = structuredClone(original);
  for (const [edit, expectedPath] of [
    [{ type: 'node', id: 'check', patch: { label: '   ' } }, '/nodes/1/label'],
    [{ type: 'edge', id: 'deny', patch: { label: '齐全' } }, '/edges/2/label'],
    [{ type: 'edge', id: 'deny', patch: { target: 'missing' } }, '/edges/2/target'],
    [{ type: 'edge', id: 'deny', patch: { directed: false } }, '/edges/2/directed'],
  ] as const) {
    const result = applyDocumentEdit(original, edit);
    assert.equal(result.valid, false, JSON.stringify(edit));
    assert.equal(result.document, undefined);
    assert.ok(result.diagnostics.some(diagnostic => diagnostic.path === expectedPath && diagnostic.severity === 'error'), JSON.stringify(result.diagnostics));
    assert.deepEqual(original, snapshot);
  }
});

test('group detail correction retains membership and document topology', () => {
  const original = document();
  const result = applyDocumentEdit(original, {
    type: 'group', id: 'review', patch: { label: '人工复核', details: '逐项确认材料与授权。' },
  });
  assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
  assert.ok(result.document);
  assert.equal(result.document.groups[0]?.label, '人工复核');
  assert.equal(result.document.groups[0]?.details, '逐项确认材料与授权。');
  assert.equal(result.document.nodes[1]?.groupId, 'review');
  assert.deepEqual(result.document.edges, original.edges);
  assert.equal(original.groups[0]?.label, '审核环节');
});

test('editor refuses ID changes and missing targets instead of silently changing graph identity', () => {
  const original = document();
  const snapshot = structuredClone(original);
  const changeId = applyDocumentEdit(original, { type: 'node', id: 'check', patch: { id: 'renamed' } as never });
  assert.equal(changeId.valid, false);
  assert.ok(changeId.diagnostics.some(diagnostic => diagnostic.code === 'EDIT_FIELD_UNSUPPORTED'));
  const missing = applyDocumentEdit(original, { type: 'node', id: 'no-such-node', patch: { label: '不存在' } });
  assert.equal(missing.valid, false);
  assert.ok(missing.diagnostics.some(diagnostic => diagnostic.code === 'EDIT_TARGET_MISSING'));
  assert.deepEqual(original, snapshot);
});

test('source editor text round-trips URLs, line-like suffixes, spaces and escaped newlines', () => {
  const sources = [
    { path: 'https://example.test/a#L12' },
    { path: ' C:\\files\\a.ts ', line: 12 },
    { path: 'first\nsecond' },
  ];
  assert.deepEqual(parseSourceLines(formatSourceLines(sources)), sources);
  assert.deepEqual(parseSourceLines('https://example.test/a#L12'), [{ path: 'https://example.test/a#L12' }]);
  assert.deepEqual(parseSourceLines('"src/a.ts"#L7'), [{ path: 'src/a.ts', line: 7 }]);
  assert.throws(() => parseSourceLines('"src/a.ts"#L0'), /来源格式错误/);
});
