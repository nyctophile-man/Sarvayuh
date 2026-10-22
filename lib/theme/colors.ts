export type Colors = {
  /** Brand heading / accent text (adapts to the mode). */
  deep: string;
  /** Dark brand panel background (headers, primary surfaces). */
  deepSurface: string;
  /** Text on a `deepSurface` background. */
  onDeep: string;
  /** Secondary text on a `deepSurface` background. */
  onDeepSoft: string;
  /** Primary accent (buttons, links, highlights). */
  teal: string;
  /** Tinted background that pairs with `teal`. */
  tealSoft: string;
  /** Neutral tinted background (icon wells, chips). */
  soft: string;
  gold: string;
  goldEdge: string;
  /** App background. */
  bg: string;
  /** Cards, sheets, panels. */
  surface: string;
  /** Inputs and subtle raised areas. */
  surfaceAlt: string;
  /** Modal backdrop. */
  overlay: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  inkSoft: string;
  /** Tertiary text / placeholders. */
  mute: string;
  /** Text placed on `teal` / `deepSurface` backgrounds. */
  onBrand: string;
  /** Borders and dividers. */
  line: string;
  red: string;
  redSoft: string;
  green: string;
  greenSoft: string;
  amber: string;
  amberSoft: string;
  blue: string;
  blueSoft: string;
  purple: string;
  purpleSoft: string;
  /** Always white – used for logos and QR quiet zones. */
  white: string;
};

export const LIGHT: Colors = {
  deep: '#0A3A47',
  deepSurface: '#0A3A47',
  onDeep: '#FFFFFF',
  onDeepSoft: '#9FC3C8',
  teal: '#0E7C86',
  tealSoft: '#E1F3F4',
  soft: '#E3F1F1',
  gold: '#C9A24B',
  goldEdge: 'rgba(201,162,75,.6)',
  bg: '#EEF4F4',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F8FA',
  overlay: 'rgba(4,22,28,.82)',
  ink: '#0E2A33',
  inkSoft: '#12303A',
  mute: '#5E7680',
  onBrand: '#FFFFFF',
  line: '#DCE7E8',
  red: '#D9534F',
  redSoft: '#F8E1E0',
  green: '#1E9E6A',
  greenSoft: '#DDF5EA',
  amber: '#C77A12',
  amberSoft: '#FFF0D6',
  blue: '#2563EB',
  blueSoft: '#E2ECFF',
  purple: '#5B4B8A',
  purpleSoft: '#EEE9F7',
  white: '#FFFFFF',
};

export const DARK: Colors = {
  deep: '#8FD6DC',
  deepSurface: '#0C2A33',
  onDeep: '#E8F0FF',
  onDeepSoft: '#9FC3C8',
  teal: '#4FD1C5',
  tealSoft: '#15343B',
  soft: '#16293A',
  gold: '#E3C46B',
  goldEdge: 'rgba(227,196,107,.45)',
  bg: '#0A1220',
  surface: '#121D30',
  surfaceAlt: '#16233A',
  overlay: 'rgba(2,8,14,.86)',
  ink: '#E8F0FF',
  inkSoft: '#C7D5EA',
  mute: '#8FA3C0',
  onBrand: '#04131A',
  line: '#1F2E48',
  red: '#FF6B6B',
  redSoft: '#3A1F22',
  green: '#3DD9A0',
  greenSoft: '#12332A',
  amber: '#F5B24A',
  amberSoft: '#3A2C13',
  blue: '#5AA9FF',
  blueSoft: '#14263F',
  purple: '#B6A7F0',
  purpleSoft: '#2C2542',
  white: '#FFFFFF',
};

export const THEMES: Record<'light' | 'dark', Colors> = { light: LIGHT, dark: DARK };
