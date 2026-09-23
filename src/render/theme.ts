export const fontFamily = '"Segoe UI", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
export interface ThemeTokens {
  name: 'light' | 'dark'; background: string; surface: string; group: string;
  text: string; muted: string; border: string; edge: string; accent: string; exception: string;
  fontFamily: string;
}
export const themes: Record<'light' | 'dark', ThemeTokens> = {
  light: { name: 'light', background: '#F8FAFC', surface: '#FFFFFF', group: '#F1F5F9', text: '#172033', muted: '#526176', border: '#CBD5E1', edge: '#64748B', accent: '#2563EB', exception: '#B91C1C', fontFamily },
  dark: { name: 'dark', background: '#111827', surface: '#1C2738', group: '#162132', text: '#EDF2F7', muted: '#B7C3D4', border: '#536278', edge: '#9AAAC0', accent: '#83AEFF', exception: '#FFA3A3', fontFamily }
};
