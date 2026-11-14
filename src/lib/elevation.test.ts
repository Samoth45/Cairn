import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyElevations,
  densify,
  elevationCoverage,
  fillMissingElevations,
  needsElevation,
  planElevationQueries,
} from './elevation';
import { cumulativeDistances, haversine } from './geo';
import { fetchElevations, fetchTrackElevations, ElevationError } from '../services/elevation';
import type { Point } from '../types';

describe('couverture des altitudes', () => {
  it('mesure la proportion de points avec altitude', () => {
    expect(elevationCoverage([[[0, 0, 1], [0, 0, null], [0, 0, 2], [0, 0, null]]])).toBe(0.5);
  });
  it('décide s’il faut interroger le modèle de terrain', () => {
    const sparse: Point[][] = [[[0, 0, null], [0, 0, null], [0, 0, 5]]];
    expect(needsElevation({ segments: sparse })).toBe(true);
    expect(needsElevation({ segments: sparse, elevationSource: 'dem' })).toBe(false);
    expect(needsElevation({ segments: [[[0, 0, 1], [0, 0, 2]]] })).toBe(false);
  });
});

describe('fillMissingElevations', () => {
  it('interpole selon la distance et prolonge les extrémités', () => {
    const seg: Point[] = [
      [45, 6, null],
      [45.01, 6, 100],
      [45.02, 6, null],
      [45.04, 6, 400],
      [45.05, 6, null],
    ];
    const [out] = fillMissingElevations([seg]);
    expect(out.map((p) => p[2])).toEqual([100, 100, expect.closeTo(200, 5), 400, 400]);
    expect(seg[0][2]).toBeNull(); // pas de mutation
  });
});

describe('densify', () => {
  it('ajoute des points pour respecter l’espacement', () => {
    const seg: Point[] = [
      [45, 6, null],
      [45.01, 6, null], // ~1112 m
    ];
    const dense = densify(seg, 200);
    expect(dense).toHaveLength(7); // 6 intervalles de ~185 m
    const d = cumulativeDistances(dense);
    for (let i = 1; i < d.length; i++) expect(d[i] - d[i - 1]).toBeLessThanOrEqual(200);
  });
});

describe('planElevationQueries / applyElevations', () => {
  const seg: Point[] = Array.from({ length: 50 }, (_, i) => [45 + i * 0.0001, 6, null] as Point); // ~11 m entre points

  it('espace les requêtes et garde début et fin', () => {
    const plan = planElevationQueries([seg], 50);
    expect(plan.queries[0]).toEqual([0, 0]);
    expect(plan.queries.at(-1)).toEqual([0, 49]);
    expect(plan.queries.length).toBeLessThan(15);
  });

  it('plafonne le nombre de points interrogés', () => {
    const long: Point[] = [
      [45, 6, null],
      [46, 6, null], // ~111 km
    ];
    const plan = planElevationQueries([long], 50, 300);
    expect(plan.queries.length).toBeLessThanOrEqual(302);
  });

  it('applique et interpole les altitudes', () => {
    const plan = planElevationQueries([seg], 50);
    const values = plan.queries.map((_, k) => 1000 + k * 10);
    const [out] = applyElevations(plan, values);
    expect(out.every((p) => p[2] !== null)).toBe(true);
    expect(out[0][2]).toBe(1000);
    expect(out.at(-1)![2]).toBe(1000 + (plan.queries.length - 1) * 10);
  });
});

describe('service Open-Meteo Elevation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('découpe en lots de 100 coordonnées', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url);
      const n = new URL(url).searchParams.get('latitude')!.split(',').length;
      return new Response(JSON.stringify({ elevation: Array(n).fill(1234) }));
    });
    const coords = Array.from({ length: 250 }, (_, i): [number, number] => [45 + i * 1e-4, 6]);
    const result = await fetchElevations(coords);
    expect(calls).toHaveLength(3);
    expect(result).toHaveLength(250);
    expect(calls[0]).toContain('api.open-meteo.com/v1/elevation');
  });

  it('remplit toutes les altitudes d’un tracé sans altitude', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      const lats = new URL(url).searchParams.get('latitude')!.split(',').map(Number);
      return new Response(JSON.stringify({ elevation: lats.map((lat) => (lat - 45) * 10000) }));
    });
    const route: Point[] = [
      [45, 6, null],
      [45.01, 6, null],
    ];
    const [out] = await fetchTrackElevations([route]);
    expect(out.length).toBeGreaterThan(2); // route densifiée
    expect(out.every((p) => p[2] !== null)).toBe(true);
    expect(haversine(out[0][0], out[0][1], 45, 6)).toBe(0);
  });

  it('remonte une erreur lisible', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 429 }));
    await expect(fetchElevations([[45, 6]])).rejects.toThrow(ElevationError);
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('network');
    });
    await expect(fetchElevations([[45, 6]])).rejects.toThrow(/injoignable/);
  });
});
