import type { Point } from '../types';
import { applyElevations, planElevationQueries } from '../lib/elevation';

const ENDPOINT = 'https://api.open-meteo.com/v1/elevation';
/** Limite de l'API Open-Meteo Elevation. */
export const MAX_COORDS_PER_REQUEST = 100;

export class ElevationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ElevationError';
  }
}

/** Altitudes (m) d'une liste de coordonnées, par lots de 100 requêtes séquentielles. */
export async function fetchElevations(coords: Array<[lat: number, lon: number]>, signal?: AbortSignal): Promise<number[]> {
  const out: number[] = [];
  for (let start = 0; start < coords.length; start += MAX_COORDS_PER_REQUEST) {
    const batch = coords.slice(start, start + MAX_COORDS_PER_REQUEST);
    const params = new URLSearchParams({
      latitude: batch.map(([lat]) => lat.toFixed(5)).join(','),
      longitude: batch.map(([, lon]) => lon.toFixed(5)).join(','),
    });
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}?${params}`, { signal });
    } catch {
      throw new ElevationError('service d’altitude injoignable (connexion internet ?)');
    }
    if (res.status === 429) throw new ElevationError('trop de requêtes vers le service d’altitude, réessayez dans une minute');
    if (!res.ok) throw new ElevationError(`le service d’altitude a répondu par une erreur (${res.status})`);
    const data = (await res.json().catch(() => null)) as { elevation?: unknown } | null;
    if (!data || !Array.isArray(data.elevation) || data.elevation.length !== batch.length) {
      throw new ElevationError('réponse inattendue du service d’altitude');
    }
    out.push(...data.elevation.map((v) => (typeof v === 'number' ? v : NaN)));
  }
  return out;
}

/**
 * Remplace les altitudes d'un tracé par celles du modèle numérique de terrain :
 * densifie si besoin, interroge des points régulièrement espacés et interpole le reste.
 */
export async function fetchTrackElevations(segments: Point[][], signal?: AbortSignal): Promise<Point[][]> {
  const plan = planElevationQueries(segments);
  const coords = plan.queries.map(([s, i]): [number, number] => [plan.segments[s][i][0], plan.segments[s][i][1]]);
  const values = await fetchElevations(coords, signal);
  if (!values.some(Number.isFinite)) throw new ElevationError('aucune altitude disponible pour ce tracé');
  return applyElevations(plan, values);
}
