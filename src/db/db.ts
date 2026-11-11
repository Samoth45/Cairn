import Dexie, { type EntityTable } from 'dexie';
import type { Settings, Track } from '../types';
import { DEFAULT_SETTINGS } from '../types';

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
  const row = await db.settings.get('app');
  if (!row) return { ...DEFAULT_SETTINGS };
  const { baseLayer, selectedTrackId } = row;
  return { ...DEFAULT_SETTINGS, baseLayer, selectedTrackId };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, key: 'app' });
}
