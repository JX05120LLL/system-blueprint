import type { VisibleGraph, VisibleNode, VisibleEdge, VisibleGroup } from '../projection/visible-graph';
export interface TextBlock { lines: string[]; width: number; height: number; fontSize: number; lineHeight: number; }
export interface MeasuredNode extends VisibleNode { width: number; height: number; titleText: TextBlock; summaryText: TextBlock; noteText: TextBlock; }
export interface MeasuredEdge extends VisibleEdge { labelText: TextBlock; }
export interface MeasuredGroup extends VisibleGroup { titleText: TextBlock; }
export interface MeasuredGraph extends Omit<VisibleGraph, 'nodes' | 'edges' | 'groups'> { nodes: MeasuredNode[]; edges: MeasuredEdge[]; groups: MeasuredGroup[]; }
export interface Point { x: number; y: number; }
export interface Box extends Point { width: number; height: number; }
export interface LayoutNode extends MeasuredNode, Point {}
export interface LayoutGroup extends MeasuredGroup, Box {}
export interface LayoutEdge extends MeasuredEdge { sections: Point[][]; routing?: 'spline' | 'polyline'; labelBox?: Box; }
export interface LayoutGraph extends Omit<MeasuredGraph, 'nodes' | 'edges' | 'groups'> { nodes: LayoutNode[]; edges: LayoutEdge[]; groups: LayoutGroup[]; width: number; height: number; }
