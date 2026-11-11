/** Couleurs bien visibles sur les fonds IGN et OpenTopoMap. */
export const TRACK_COLORS = [
  '#e6194b',
  '#3c5bd8',
  '#f58231',
  '#911eb4',
  '#0b8a6f',
  '#d6226e',
  '#1f9bd1',
  '#8a5a00',
  '#6a3d9a',
  '#c0392b',
];

export function pickColor(index: number): string {
  const n = TRACK_COLORS.length;
  return TRACK_COLORS[((index % n) + n) % n];
}
