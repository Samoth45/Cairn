import { describe, expect, it } from 'vitest';
import { GpxError, parseGpx } from './gpx';
import { trackFingerprint } from './hash';

const wrap = (body: string, meta = '') =>
  `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">${meta}${body}</gpx>`;

const TRK = `<trk><name>Lac Blanc</name><trkseg>
  <trkpt lat="45.9500" lon="6.8700"><ele>1250</ele></trkpt>
  <trkpt lat="45.9600" lon="6.8800"><ele>1500.5</ele></trkpt>
  <trkpt lat="45.9700" lon="6.8900"><ele>2350</ele></trkpt>
</trkseg></trk>`;

const RTE = `<rte><name>Ma route</name>
  <rtept lat="45.1" lon="6.1"></rtept>
  <rtept lat="45.2" lon="6.2"></rtept>
</rte>`;

describe('parseGpx', () => {
  it('lit un trk avec altitudes et nom', () => {
    const r = parseGpx(wrap(TRK), 'fichier.gpx');
    expect(r.name).toBe('Lac Blanc');
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0][0]).toEqual([45.95, 6.87, 1250]);
    expect(r.segments[0][1][2]).toBeCloseTo(1500.5);
  });

  it('lit une rte sans altitude (ele = null)', () => {
    const r = parseGpx(wrap(RTE), 'route.gpx');
    expect(r.name).toBe('Ma route');
    expect(r.segments[0]).toEqual([
      [45.1, 6.1, null],
      [45.2, 6.2, null],
    ]);
  });

  it('combine trk et rte dans un même fichier', () => {
    const r = parseGpx(wrap(TRK + RTE), 'mixte.gpx');
    expect(r.segments).toHaveLength(2);
    expect(r.name).toBe('Lac Blanc');
  });

  it('gère plusieurs trkseg', () => {
    const two = `<trk><trkseg><trkpt lat="1" lon="1"/><trkpt lat="1.1" lon="1.1"/></trkseg>
      <trkseg><trkpt lat="2" lon="2"/><trkpt lat="2.1" lon="2.1"/></trkseg></trk>`;
    expect(parseGpx(wrap(two), 'a.gpx').segments).toHaveLength(2);
  });

  it('privilégie le nom des métadonnées, sinon le nom de fichier', () => {
    expect(parseGpx(wrap(TRK, '<metadata><name>Méta</name></metadata>'), 'x.gpx').name).toBe('Méta');
    const noName = `<trk><trkseg><trkpt lat="1" lon="1"/><trkpt lat="1.1" lon="1.1"/></trkseg></trk>`;
    expect(parseGpx(wrap(noName), 'Tour du Mont.GPX').name).toBe('Tour du Mont');
  });

  it('rejette un XML invalide', () => {
    expect(() => parseGpx('<gpx><trk>', 'cassé.gpx')).toThrow(GpxError);
  });

  it('rejette un fichier vide ou non GPX', () => {
    expect(() => parseGpx('   ', 'vide.gpx')).toThrow(/vide/);
    expect(() => parseGpx('<kml></kml>', 'autre.gpx')).toThrow(/pas un fichier GPX/);
  });

  it('rejette un GPX sans tracé exploitable', () => {
    const wptOnly = '<wpt lat="45" lon="6"><name>Refuge</name></wpt>';
    expect(() => parseGpx(wrap(wptOnly), 'wpt.gpx')).toThrow(/aucun tracé/);
    const onePoint = '<trk><trkseg><trkpt lat="45" lon="6"/></trkseg></trk>';
    expect(() => parseGpx(wrap(onePoint), 'un.gpx')).toThrow(/aucun tracé/);
  });
});

describe('trackFingerprint', () => {
  it('est identique pour un même tracé et différent sinon', () => {
    const a = parseGpx(wrap(TRK), 'a.gpx').segments;
    const b = parseGpx(wrap(TRK.replace('Lac Blanc', 'Autre nom')), 'b.gpx').segments;
    const c = parseGpx(wrap(RTE), 'c.gpx').segments;
    expect(trackFingerprint(a)).toBe(trackFingerprint(b));
    expect(trackFingerprint(a)).not.toBe(trackFingerprint(c));
  });
});
