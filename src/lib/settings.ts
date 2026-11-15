import {
  DEFAULT_DIN,
  DEFAULT_SCORE_WEIGHTS,
  DEFAULT_SETTINGS,
  type DinSpeeds,
  type ScoreWeights,
  type Settings,
} from '../types';

function positive(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Complète et valide des paramètres partiels (lus dans IndexedDB, éventuellement anciens)
 * en retombant sur les valeurs par défaut pour tout champ absent ou invalide.
 */
export function normalizeSettings(raw: unknown): Settings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const din = (o.din && typeof o.din === 'object' ? o.din : {}) as Partial<Record<keyof DinSpeeds, unknown>>;
  return {
    baseLayer: o.baseLayer === 'otm' || o.baseLayer === 'ign' ? o.baseLayer : DEFAULT_SETTINGS.baseLayer,
    selectedTrackId: typeof o.selectedTrackId === 'string' ? o.selectedTrackId : undefined,
    showProfile: typeof o.showProfile === 'boolean' ? o.showProfile : DEFAULT_SETTINGS.showProfile,
    weatherModel:
      o.weatherModel === 'best_match' || o.weatherModel === 'meteofrance_seamless'
        ? o.weatherModel
        : DEFAULT_SETTINGS.weatherModel,
    trackColoring: (['none', 'temperature', 'gusts', 'precipitation'] as const).includes(o.trackColoring as never)
      ? (o.trackColoring as Settings['trackColoring'])
      : DEFAULT_SETTINGS.trackColoring,
    scoreWeights: Object.fromEntries(
      (Object.keys(DEFAULT_SCORE_WEIGHTS) as Array<keyof ScoreWeights>).map((k) => {
        const v = (o.scoreWeights as Partial<Record<keyof ScoreWeights, unknown>> | undefined)?.[k];
        // Un poids peut valoir 0 (pénalité désactivée), jusqu'à 100.
        return [k, typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : DEFAULT_SCORE_WEIGHTS[k]];
      }),
    ) as unknown as ScoreWeights,
    theme: o.theme === 'light' || o.theme === 'dark' || o.theme === 'system' ? o.theme : DEFAULT_SETTINGS.theme,
    departureTime:
      typeof o.departureTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(o.departureTime)
        ? o.departureTime
        : DEFAULT_SETTINGS.departureTime,
    din: {
      flatKmh: positive(din.flatKmh, DEFAULT_DIN.flatKmh),
      ascentMh: positive(din.ascentMh, DEFAULT_DIN.ascentMh),
      descentMh: positive(din.descentMh, DEFAULT_DIN.descentMh),
    },
  };
}
