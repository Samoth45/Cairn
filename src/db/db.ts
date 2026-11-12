import Dexie, { type EntityTable } from 'dexie';
import type { Settings, Track } from '../types';
import { normalizeSettings } from '../lib/settings';

interface SettingsRow extends Settings {
  key: 'app';
}

export const db = new Dexie('cairn') as Dexie & {
  tracks: EntityTable<Track, 'id'>;
  settings: EntityTable<SettingsRow, 'key'>;
};

db.version(1).stores({
  tracks: 'id, createdAt',
  settings: 'key',
});

export async function getSettings(): Promise<Settings> {
  return normalizeSettings(await db.settings.get('app'));
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...normalizeSettings({ ...current, ...patch }), key: 'app' });
}
