import type { Point } from '../types';

/** FNV-1a 32 bits (fonctionne hors contexte sécurisé, contrairement à crypto.subtle). */
export function fnv1a(input: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Empreinte stable d'un tracé, basée sur ses coordonnées arrondies (~1 m). */
export function trackFingerprint(segments: Point[][]): string {
  const text = segments
    .map((seg) => seg.map(([lat, lon]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join(';'))
    .join('|');
  // Deux hachages avec des graines différentes → 64 bits, collisions négligeables.
  const a = fnv1a(text).toString(16).padStart(8, '0');
  const b = fnv1a(text, 0x9747b28c).toString(16).padStart(8, '0');
  return `t${a}${b}`;
}
