import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings, updateSettings } from '../db/db';
import { parseGpx, GpxError } from '../lib/gpx';
import { trackFingerprint } from '../lib/hash';
import { pickColor } from '../lib/colors';
import { buildBackup, mergeTracks, parseBackup } from '../lib/backup';
import type { Settings, Track } from '../types';

export interface ImportReport {
  added: Track[];
  errors: string[];
}

export interface BackupImportReport {
  added: number;
  skipped: number;
}

/** Accès aux tracés et paramètres persistés dans IndexedDB, avec les actions associées. */
export function useTracks() {
  const tracks = useLiveQuery(() => db.tracks.orderBy('createdAt').toArray(), []);
  const settings = useLiveQuery(() => getSettings(), []);

  const importGpxFiles = useCallback(async (files: File[]): Promise<ImportReport> => {
    const errors: string[] = [];
    const added: Track[] = [];
    let colorIndex = await db.tracks.count();
    const seen = new Set<string>();

    const results = await Promise.allSettled(
      files.map(async (file) => ({ file, text: await file.text() })),
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const file = files[i];
      if (r.status === 'rejected') {
        errors.push(`${file.name} : lecture du fichier impossible`);
        continue;
      }
      if (!/\.gpx$/i.test(file.name)) {
        errors.push(`${file.name} : ignoré (seuls les fichiers .gpx sont acceptés)`);
        continue;
      }
      try {
        const parsed = parseGpx(r.value.text, file.name);
        const id = trackFingerprint(parsed.segments);
        const existing = seen.has(id) ? undefined : await db.tracks.get(id);
        if (seen.has(id) || existing) {
          errors.push(`${file.name} : déjà importé${existing ? ` (« ${existing.name} »)` : ''}`);
          continue;
        }
        seen.add(id);
        const track: Track = {
          id,
          name: parsed.name,
          color: pickColor(colorIndex++),
          visible: true,
          fileName: file.name,
          createdAt: Date.now() + i,
          segments: parsed.segments,
        };
        await db.tracks.add(track);
        added.push(track);
      } catch (e) {
        const msg = e instanceof GpxError ? e.message : "erreur inattendue lors de l'import";
        if (!(e instanceof GpxError)) console.error(e);
        errors.push(`${file.name} : ${msg}`);
      }
    }
    return { added, errors };
  }, []);

  const renameTrack = useCallback(async (id: string, name: string) => {
    const clean = name.trim();
    if (clean) await db.tracks.update(id, { name: clean });
  }, []);

  const setTrackColor = useCallback(async (id: string, color: string) => {
    await db.tracks.update(id, { color });
  }, []);

  const setTrackVisible = useCallback(async (id: string, visible: boolean) => {
    await db.tracks.update(id, { visible });
  }, []);

  const deleteTrack = useCallback(async (id: string) => {
    await db.transaction('rw', db.tracks, db.settings, async () => {
      await db.tracks.delete(id);
      const s = await getSettings();
      if (s.selectedTrackId === id) await updateSettings({ selectedTrackId: undefined });
    });
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => updateSettings(patch), []);

  const exportBackup = useCallback(async () => {
    const [all, s] = await Promise.all([db.tracks.orderBy('createdAt').toArray(), getSettings()]);
    return buildBackup(all, s);
  }, []);

  const importBackup = useCallback(async (text: string): Promise<BackupImportReport> => {
    const backup = parseBackup(text); // lève BackupError si invalide
    return db.transaction('rw', db.tracks, db.settings, async () => {
      const existing = await db.tracks.toArray();
      const { toAdd, skipped } = mergeTracks(existing, backup.tracks);
      await db.tracks.bulkAdd(toAdd);
      // Les paramètres de la sauvegarde sont restaurés, sauf la sélection
      // si elle pointe vers un tracé inexistant.
      const ids = new Set([...existing, ...toAdd].map((t) => t.id));
      const sel = backup.settings.selectedTrackId;
      await updateSettings({
        ...backup.settings,
        selectedTrackId: sel && ids.has(sel) ? sel : (await getSettings()).selectedTrackId,
      });
      return { added: toAdd.length, skipped };
    });
  }, []);

  return {
    tracks,
    settings,
    loading: tracks === undefined || settings === undefined,
    importGpxFiles,
    renameTrack,
    setTrackColor,
    setTrackVisible,
    deleteTrack,
    setSettings,
    exportBackup,
    importBackup,
  };
}
