import { gpx as gpxToGeoJson } from '@tmcw/togeojson';
import type { Point } from '../types';

export class GpxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GpxError';
  }
}

export interface ParsedGpx {
  name: string;
  segments: Point[][];
}

function isValidCoord(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function toSegment(coords: number[][]): Point[] {
  const seg: Point[] = [];
  for (const [lon, lat, ele] of coords) {
    if (!isValidCoord(lat, lon)) continue;
    seg.push([lat, lon, typeof ele === 'number' && Number.isFinite(ele) ? ele : null]);
  }
  return seg;
}

export function fileBaseName(fileName: string): string {
  return fileName.replace(/\.gpx$/i, '').trim() || 'Tracé sans nom';
}

/**
 * Analyse le contenu d'un fichier GPX : récupère toutes les traces (trk/trkseg)
 * et les routes (rte). Lève une GpxError avec un message en français sinon.
 */
export function parseGpx(text: string, fileName: string): ParsedGpx {
  if (!text.trim()) throw new GpxError('fichier vide');

  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new GpxError('XML invalide (fichier corrompu ou pas au format GPX)');
  }
  if (doc.documentElement?.localName !== 'gpx') {
    throw new GpxError("ce n'est pas un fichier GPX (élément <gpx> manquant)");
  }

  let collection: ReturnType<typeof gpxToGeoJson>;
  try {
    collection = gpxToGeoJson(doc);
  } catch {
    throw new GpxError('impossible de lire le contenu GPX');
  }

  const segments: Point[][] = [];
  let firstFeatureName: string | undefined;

  for (const feature of collection.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    let lines: number[][][];
    if (geom.type === 'LineString') lines = [geom.coordinates];
    else if (geom.type === 'MultiLineString') lines = geom.coordinates;
    else continue; // waypoints ignorés

    let added = false;
    for (const line of lines) {
      const seg = toSegment(line);
      if (seg.length >= 2) {
        segments.push(seg);
        added = true;
      }
    }
    const fname: unknown = feature.properties?.name;
    if (added && !firstFeatureName && typeof fname === 'string' && fname.trim()) {
      firstFeatureName = fname.trim();
    }
  }

  if (segments.length === 0) {
    throw new GpxError('aucun tracé trouvé (ni <trk> ni <rte> avec au moins 2 points)');
  }

  const metaName = Array.from(doc.getElementsByTagName('metadata'))[0]
    ?.getElementsByTagName('name')[0]
    ?.textContent?.trim();
  return { name: metaName || firstFeatureName || fileBaseName(fileName), segments };
}
