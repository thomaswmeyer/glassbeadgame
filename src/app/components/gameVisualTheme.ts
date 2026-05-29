export type GameVisualTheme = 'classic' | 'bead-table';

export function isBeadTableTheme(theme: GameVisualTheme | undefined) {
  return theme === 'bead-table';
}

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}
