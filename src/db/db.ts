import Dexie, { type EntityTable } from 'dexie';
import type { Settings, Track, WeatherModel } from '../types';
import type { WeatherPoint } from '../lib/weatherPoints';
import type { ForecastData } from '../services/weather';
import { normalizeSettings } from '../lib/settings';

interface SettingsRow extends Settings {
  key: 'app';
}

/** Prévision météo mise en cache pour un tracé. */
export interface CachedForecast {
  trackId: string;
  /** Modèle + points : si l'un change, le cache n'est plus valable. */
  key: string;
  model: WeatherModel;
  fetchedAt: number;
  points: WeatherPoint[];
  data: ForecastData;
}

export const db = new Dexie('cairn') as Dexie & {
  tracks: EntityTable<Track, 'id'>;
  settings: EntityTable<SettingsRow, 'key'>;
  weather: EntityTable<CachedForecast, 'trackId'>;
};

db.version(1).stores({
  tracks: 'id, createdAt',
  settings: 'key',
});

// v2 : cache des prévisions météo (étape 3).
db.version(2).stores({
  weather: 'trackId',
});

export async function getSettings(): Promise<Settings> {
  return normalizeSettings(await db.settings.get('app'));
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...normalizeSettings({ ...current, ...patch }), key: 'app' });
}
