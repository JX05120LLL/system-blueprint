import type { DiagramDocument } from './diagram.generated.ts';

export type { DiagramDocument } from './diagram.generated.ts';
export type DiagramNode = DiagramDocument['nodes'][number];
export type DiagramEdge = DiagramDocument['edges'][number];
export type DiagramGroup = DiagramDocument['groups'][number];
export type DiagramView = DiagramDocument['view'];
export type HighlightDirection = 'upstream' | 'downstream';

export interface Diagnostic {
  code: string;
  path: string;
  ids: string[];
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  document?: DiagramDocument;
  diagnostics: Diagnostic[];
}
