/* Generated from diagram-schema.json. Do not edit. */

export type NonEmptyText = string;
export type Details = string;
export type EvidenceStatus = "confirmed" | "assumed" | "planned";
export type Sources = Source[];

export interface DiagramDocument {
  schemaVersion: "2.0";
  id: NonEmptyText;
  title: NonEmptyText;
  description?: string;
  view: {
    kind: "overview" | "flow" | "deployment";
    direction: "RIGHT" | "DOWN";
    theme: "light" | "dark";
    collapsedGroups?: NonEmptyText[];
    primaryPath?: NonEmptyText[];
  };
  /**
   * @minItems 1
   * @maxItems 100
   */
  nodes: Node[];
  /**
   * @maxItems 300
   */
  edges: Edge[];
  /**
   * @maxItems 20
   */
  groups: Group[];
}
export interface Node {
  id: NonEmptyText;
  kind: "start" | "end" | "process" | "decision" | "store" | "external" | "fork" | "join";
  label: NonEmptyText;
  summary?: string;
  details?: Details;
  groupId?: NonEmptyText;
  evidenceStatus?: EvidenceStatus;
  sources?: Sources;
}
export interface Source {
  path: NonEmptyText;
  line?: number;
}
export interface Edge {
  id: NonEmptyText;
  source: NonEmptyText;
  target: NonEmptyText;
  kind: "control" | "data" | "dependency" | "exception" | "feedback";
  directed: boolean;
  label?: string;
  details?: Details;
  evidenceStatus?: EvidenceStatus;
  sources?: Sources;
}
export interface Group {
  id: NonEmptyText;
  label: NonEmptyText;
  parentId?: NonEmptyText;
  details?: Details;
}
