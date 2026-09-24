import type { DiagramDocument, DiagramEdge, DiagramGroup, DiagramNode, Diagnostic, ValidationResult } from '../model/types';
import { validateDocument } from '../model/validate';

export type DocumentEdit =
  | { type: 'node'; id: string; patch: Partial<Omit<DiagramNode, 'id'>> }
  | { type: 'edge'; id: string; patch: Partial<Omit<DiagramEdge, 'id'>> }
  | { type: 'group'; id: string; patch: Partial<Omit<DiagramGroup, 'id'>> };

const editableFields: Record<DocumentEdit['type'], ReadonlySet<string>> = {
  node: new Set(['kind', 'label', 'summary', 'details', 'groupId', 'evidenceStatus', 'sources']),
  edge: new Set(['source', 'target', 'kind', 'directed', 'label', 'details', 'evidenceStatus', 'sources']),
  group: new Set(['label', 'details', 'parentId']),
};

function invalid(code: string, id: string, message: string): ValidationResult {
  const diagnostic: Diagnostic = { code, path: '', ids: [id], message, severity: 'error' };
  return { valid: false, diagnostics: [diagnostic] };
}

/** Apply a narrow property edit to a copy; the previous document is never mutated. */
export function applyDocumentEdit(document: DiagramDocument, edit: DocumentEdit): ValidationResult {
  const keys = Object.keys(edit.patch);
  if (keys.some(key => !editableFields[edit.type].has(key))) {
    return invalid('EDIT_FIELD_UNSUPPORTED', edit.id, '此属性不能在详情板中修改。');
  }
  const next = structuredClone(document);
  const items = edit.type === 'node' ? next.nodes : edit.type === 'edge' ? next.edges : next.groups;
  const target = items.find(item => item.id === edit.id) as Record<string, unknown> | undefined;
  if (!target) return invalid('EDIT_TARGET_MISSING', edit.id, '要修改的图形元素已不存在。');
  for (const [key, value] of Object.entries(edit.patch)) {
    if (value === undefined) delete target[key];
    else target[key] = value;
  }
  return validateDocument(next);
}

/** A quoted JSON path plus optional #L12 is lossless; unquoted lines are literal paths. */
export function parseSourceLines(text: string): { path: string; line?: number }[] {
  return text.split(/\r?\n/).map(value => value.trim()).filter(Boolean).map(value => {
    if (!value.startsWith('"')) return { path: value };
    const match = /^("(?:\\.|[^"\\])*")(?:#L([1-9]\d*))?$/.exec(value);
    if (!match) throw new Error(`来源格式错误：${value}`);
    const path = JSON.parse(match[1]!) as unknown;
    if (typeof path !== 'string') throw new Error(`来源路径必须是文本：${value}`);
    if (!match[2]) return { path };
    const line = Number(match[2]);
    if (!Number.isSafeInteger(line)) throw new Error(`来源行号超出范围：${value}`);
    return { path, line };
  });
}

export function formatSourceLines(sources: readonly { path: string; line?: number }[] | undefined): string {
  return sources?.map(source => `${JSON.stringify(source.path)}${source.line === undefined ? '' : `#L${source.line}`}`).join('\n') ?? '';
}
