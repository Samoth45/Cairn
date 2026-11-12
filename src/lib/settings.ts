import { DEFAULT_DIN, DEFAULT_SETTINGS, type DinSpeeds, type Settings } from '../types';

function positive(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Complète et valide des paramètres partiels (base IndexedDB, sauvegarde importée…)
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
    din: {
      flatKmh: positive(din.flatKmh, DEFAULT_DIN.flatKmh),
      ascentMh: positive(din.ascentMh, DEFAULT_DIN.ascentMh),
      descentMh: positive(din.descentMh, DEFAULT_DIN.descentMh),
    },
  };
}
