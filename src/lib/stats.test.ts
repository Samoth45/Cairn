import { describe, expect, it } from 'vitest';
import { analyzeTrack, elevationGain, nearestProfileIndex } from './stats';
import { haversine } from './geo';
import { dinDurationHours } from './din';
import { DEFAULT_DIN, type Point } from '../types';

describe('haversine', () => {
  it('donne ~111,2 km pour 1° de latitude', () => {
    expect(haversine(45, 6, 46, 6)).toBeCloseTo(111195, -1);
  });
  it('vaut 0 pour un même point', () => {
    expect(haversine(45, 6, 45, 6)).toBe(0);
  });
});

describe('elevationGain (hystérésis)', () => {
  it('ignore le bruit inférieur au seuil', () => {
    // Oscillations de ±2 m autour de 1000 m : aucun dénivelé réel.
    const noisy = [1000, 1002, 999, 1001, 998, 1002, 1000];
    const { ascent, descent } = elevationGain(noisy);
    expect(ascent).toBeLessThan(5);
    expect(descent).toBeLessThan(5);
  });

  it('compte une montée régulière à petits pas', () => {
    // +1 m par point sur 100 points : chaque pas est sous le seuil, mais le cumul compte.
    const climb = Array.from({ length: 101 }, (_, i) => 1000 + i);
    expect(elevationGain(climb)).toEqual({ ascent: 100, descent: 0 });
  });

  it('compte montée puis descente', () => {
    const { ascent, descent } = elevationGain([1000, 1100, 1200, 1150, 1050]);
    expect(ascent).toBe(200);
    expect(descent).toBe(150);
  });
});

describe('analyzeTrack', () => {
  const seg: Point[] = [
    [45.0, 6.0, 1000],
    [45.01, 6.0, 1200],
    [45.02, 6.0, null], // interpolé : 1300
    [45.03, 6.0, 1400],
    [45.04, 6.0, 1100],
  ];

  it('calcule distance, dénivelés, min/max et point culminant', () => {
    const { stats, profile } = analyzeTrack([seg]);
    expect(stats.distanceM).toBeCloseTo(4 * 1111.95, -1);
    expect(stats.ascentM).toBe(400);
    expect(stats.descentM).toBe(300);
    expect(stats.minEle).toBe(1000);
    expect(stats.maxEle).toBe(1400);
    expect(stats.summit).toEqual({ lat: 45.03, lon: 6.0, ele: 1400 });
    expect(profile).toHaveLength(5);
    expect(profile[2].ele).toBeCloseTo(1300);
  });

  it('ne compte pas le saut entre deux segments', () => {
    const a: Point[] = [
      [45, 6, 1000],
      [45.01, 6, 1000],
    ];
    const b: Point[] = [
      [46, 7, 1000],
      [46.01, 7, 1000],
    ];
    expect(analyzeTrack([a, b]).stats.distanceM).toBeCloseTo(2 * 1111.95, -1);
  });

  it('renvoie null pour les altitudes si le tracé n’en a aucune', () => {
    const { stats } = analyzeTrack([
      [
        [45, 6, null],
        [45.01, 6, null],
      ],
    ]);
    expect(stats.ascentM).toBeNull();
    expect(stats.maxEle).toBeNull();
    expect(stats.summit).toBeNull();
    expect(stats.distanceM).toBeGreaterThan(1000);
  });
});

describe('nearestProfileIndex', () => {
  const profile = [0, 100, 250, 600].map((d) => ({ d, lat: 0, lon: 0, ele: 0 }));
  it('trouve le point le plus proche', () => {
    expect(nearestProfileIndex(profile, -5)).toBe(0);
    expect(nearestProfileIndex(profile, 160)).toBe(1);
    expect(nearestProfileIndex(profile, 200)).toBe(2);
    expect(nearestProfileIndex(profile, 9999)).toBe(3);
  });
});

describe('dinDurationHours', () => {
  it('applique max + moitié du min', () => {
    // 12 km → 3 h horizontal ; 900 m D+ (3 h) + 500 m D- (1 h) → 4 h vertical.
    expect(dinDurationHours(12, 900, 500, DEFAULT_DIN)).toBeCloseTo(4 + 3 / 2);
  });
  it('respecte les vitesses personnalisées', () => {
    expect(dinDurationHours(10, 0, 0, { flatKmh: 5, ascentMh: 300, descentMh: 500 })).toBeCloseTo(2);
  });
});
