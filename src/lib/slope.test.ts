import { describe, expect, it } from 'vitest';
import { eleAt, maxSlopes, slopeAt, slopeClassIndex, slopeRuns, type ElePoint } from './slope';
import { analyzeTrack } from './stats';
import { buildGpx, gpxFileName } from './gpxExport';
import { parseGpx } from './gpx';
import { formatSlope } from './format';
import type { Point } from '../types';

// Montée à 10 % sur 1 km, puis descente à 20 % sur 500 m (un point tous les 10 m).
const profile: ElePoint[] = [];
for (let d = 0; d <= 1000; d += 10) profile.push({ d, ele: 1000 + d * 0.1 });
for (let d = 1010; d <= 1500; d += 10) profile.push({ d, ele: 1100 - (d - 1000) * 0.2 });

describe('pentes', () => {
  it('interpole l’altitude', () => {
    expect(eleAt(profile, 505)).toBeCloseTo(1050.5);
    expect(eleAt(profile, -10)).toBe(1000);
    expect(eleAt(profile, 99999)).toBe(1000);
  });

  it('calcule la pente au point survolé, signée', () => {
    expect(slopeAt(profile, 500)).toBeCloseTo(10);
    expect(slopeAt(profile, 1250)).toBeCloseTo(-20);
    expect(slopeAt(profile, 0)).toBeCloseTo(10); // fenêtre décalée au départ
    expect(slopeAt(profile, 1500)).toBeCloseTo(-20); // et à l'arrivée
  });

  it('lisse le bruit des altitudes', () => {
    const noisy = profile.map((p, i) => ({ d: p.d, ele: p.ele + (i % 2 ? 2 : -2) }));
    // Point à point, le bruit donnerait des pentes de ±40 % ; sur 100 m, on reste proche de 10 %.
    expect(slopeAt(noisy, 500)).toBeGreaterThan(5);
    expect(slopeAt(noisy, 500)).toBeLessThan(15);
  });

  it('trouve les pentes maximales', () => {
    const { up, down } = maxSlopes(profile);
    expect(up).toBeCloseTo(10);
    expect(down).toBeCloseTo(20);
  });

  it('classe les pentes et fusionne les tronçons', () => {
    expect(slopeClassIndex(3)).toBe(0);
    expect(slopeClassIndex(-12)).toBe(2);
    expect(slopeClassIndex(40)).toBe(4);
    const runs = slopeRuns(profile, 20);
    expect(runs[0]).toMatchObject({ d0: 0, classIndex: 2 }); // 10 % → classe 10–15
    expect(runs.at(-1)).toMatchObject({ d1: 1500, classIndex: 3 }); // 20 % → classe 15–25
    // Au sommet, la pente lissée traverse les classes intermédiaires : quelques tronçons courts.
    expect(runs.length).toBeLessThanOrEqual(7);
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].d0).toBe(runs[i - 1].d1); // tronçons contigus
      expect(runs[i].classIndex).not.toBe(runs[i - 1].classIndex); // fusionnés
    }
  });

  it('formate la pente', () => {
    expect(formatSlope(12.4)).toBe('↗ 12 %');
    expect(formatSlope(-8)).toBe('↘ 8 %');
    expect(formatSlope(0.2)).toBe('→ 0 %');
    expect(formatSlope(null)).toBe('–');
    expect(formatSlope(15, false)).toBe('15 %');
  });

  it('ajoute les pentes max aux statistiques, sans compter le saut entre segments', () => {
    const a: Point[] = [
      [45, 6, 1000],
      [45.001, 6, 1011], // ~111 m, ~10 %
    ];
    const b: Point[] = [
      [45.001, 6, 2000], // saut de 1000 m d'altitude au même endroit : ignoré
      [45.002, 6, 2000],
    ];
    const { stats } = analyzeTrack([a, b]);
    expect(stats.maxSlopeUpPct).toBeCloseTo(10, 0);
    expect(stats.maxSlopeDownPct).toBe(0);
  });
});

describe('export GPX', () => {
  const track = {
    name: 'Tour <du> Lac & co',
    elevationSource: 'dem' as const,
    segments: [
      [
        [45.123456, 6.5, 1500.26],
        [45.2, 6.6, null],
      ],
      [
        [46, 7, 2000],
        [46.1, 7.1, 2100],
      ],
    ] as Point[][],
  };

  it('produit un GPX relisible avec les mêmes segments et altitudes', () => {
    const xml = buildGpx(track);
    expect(xml).toContain('<desc>Altitudes issues du modèle numérique de terrain');
    const parsed = parseGpx(xml, 'export.gpx');
    expect(parsed.name).toBe('Tour <du> Lac & co');
    expect(parsed.segments).toEqual([
      [
        [45.123456, 6.5, 1500.3],
        [45.2, 6.6, null],
      ],
      [
        [46, 7, 2000],
        [46.1, 7.1, 2100],
      ],
    ]);
  });

  it('génère un nom de fichier sûr', () => {
    expect(gpxFileName('Lac Blanc / Flégère: "boucle"')).toBe('Lac Blanc - Flégère- -boucle-.gpx');
    expect(gpxFileName('   ')).toBe('trace.gpx');
  });
});
