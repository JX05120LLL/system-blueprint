export const fontFamily = '"Segoe UI", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
export interface SemanticNodeColor { stroke: string; fill: string; }
export interface ThemeTokens {
  name: 'light' | 'dark'; background: string; surface: string; group: string;
  text: string; muted: string; border: string; edge: string; accent: string; exception: string;
  sourceEdgePalette: readonly [string, ...string[]];
  semantic: {
    process: SemanticNodeColor; decision: SemanticNodeColor; store: SemanticNodeColor;
    external: SemanticNodeColor; terminal: SemanticNodeColor;
    dataEdge: string; dependencyEdge: string; feedbackEdge: string;
  };
  fontFamily: string;
}

export interface AssignedSourceEdgeColour { colour: string; markerKey: string; }

/** Assign one categorical colour per source, independent of edge order and theme. */
export function assignSourceEdgeColours(sourceIds: Iterable<string>, theme: ThemeTokens): ReadonlyMap<string, AssignedSourceEdgeColour> {
  const sources = [...new Set(sourceIds)].sort();
  return new Map(sources.map((source, index) => {
    const slot = index % theme.sourceEdgePalette.length;
    return [source, { colour: theme.sourceEdgePalette[slot]!, markerKey: `source-${slot}` }];
  }));
}

export const themes: Record<'light' | 'dark', ThemeTokens> = {
  light: {
    name: 'light', background: '#F8FAFC', surface: '#FFFFFF', group: '#F1F5F9', text: '#172033', muted: '#526176', border: '#CBD5E1', edge: '#64748B', accent: '#2563EB', exception: '#B91C1C', fontFamily,
    sourceEdgePalette: [
      '#225BB2', '#0A737E', '#6E53A7', '#286B4D', '#9C3B73', '#475569', '#795548', '#55700D',
      '#822B2B', '#167E16', '#953295', '#6F5625', '#326395', '#25256F', '#11799C', '#6F3E25', '#572B82', '#6F253E',
    ],
    semantic: {
      process: { stroke: '#456BB0', fill: '#F1F6FE' },
      decision: { stroke: '#915E0A', fill: '#FEF7E9' },
      store: { stroke: '#6E53A7', fill: '#F7F3FD' },
      external: { stroke: '#0B777A', fill: '#EFF9F9' },
      terminal: { stroke: '#286B4D', fill: '#F1F9F3' },
      dataEdge: '#0B777A', dependencyEdge: '#6E53A7', feedbackEdge: '#915E0A'
    }
  },
  dark: {
    name: 'dark', background: '#111827', surface: '#1C2738', group: '#162132', text: '#EDF2F7', muted: '#B7C3D4', border: '#536278', edge: '#9AAAC0', accent: '#83AEFF', exception: '#FFA3A3', fontFamily,
    sourceEdgePalette: [
      '#8FB4FF', '#6AD1CE', '#BFA8EC', '#91D5AD', '#F3A5D1', '#C4D0E0', '#D4B9A8', '#C4D68A',
      '#E18E8E', '#8EE18E', '#E18EE1', '#E1C58E', '#8EB8E1', '#8E8EE1', '#8ECCE1', '#E1AA8E', '#B88EE1', '#E18EAA',
    ],
    semantic: {
      process: { stroke: '#8BAEFF', fill: '#22314A' },
      decision: { stroke: '#E5B56A', fill: '#3A3226' },
      store: { stroke: '#B6A1E5', fill: '#302A42' },
      external: { stroke: '#67C6C2', fill: '#1C353C' },
      terminal: { stroke: '#85CDA5', fill: '#23382E' },
      dataEdge: '#67C6C2', dependencyEdge: '#B6A1E5', feedbackEdge: '#E5B56A'
    }
  }
};
