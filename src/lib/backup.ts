import type { BackupFile, Point, Settings, Track } from '../types';
import { normalizeSettings } from './settings';

export function buildBackup(tracks: Track[], settings: Settings, now = new Date()): BackupFile {
  return { app: 'cairn', version: 1, exportedAt: now.toISOString(), tracks, settings };
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `cairn-sauvegarde-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

function isPoint(p: unknown): p is [number, number, number | null | undefined] {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    typeof p[0] === 'number' &&
    typeof p[1] === 'number' &&
    (p[2] === null || p[2] === undefined || typeof p[2] === 'number')
  );
}

function isTrackLike(t: unknown): t is Partial<Track> & Pick<Track, 'id' | 'name' | 'segments'> {
  if (!t || typeof t !== 'object') return false;
  const o = t as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    Array.isArray(o.segments) &&
    o.segments.length > 0 &&
    o.segments.every((s) => Array.isArray(s) && s.every(isPoint))
  );
}

/** Valide et normalise un fichier de sauvegarde. Lève BackupError si invalide. */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("le fichier n'est pas un JSON valide");
  }
  if (!data || typeof data !== 'object' || (data as { app?: unknown }).app !== 'cairn') {
    throw new BackupError("ce fichier n'est pas une sauvegarde Cairn");
  }
  const d = data as Partial<BackupFile>;
  if (!Array.isArray(d.tracks)) throw new BackupError('liste de tracés manquante');

  const now = Date.now();
  const tracks: Track[] = d.tracks.filter(isTrackLike).map((t, i) => ({
    id: t.id,
    name: t.name,
    color: typeof t.color === 'string' ? t.color : '#e6194b',
    visible: t.visible !== false,
    fileName: typeof t.fileName === 'string' ? t.fileName : '',
    createdAt: typeof t.createdAt === 'number' ? t.createdAt : now + i,
    segments: t.segments.map((s) => s.map((p): Point => [p[0], p[1], p[2] ?? null])),
    ...(t.elevationSource === 'gpx' || t.elevationSource === 'dem' ? { elevationSource: t.elevationSource } : {}),
  }));

  const settings: Settings = normalizeSettings(d.settings);

  return { app: 'cairn', version: 1, exportedAt: String(d.exportedAt ?? ''), tracks, settings };
}

/** Fusion : ne garde du backup que les tracés absents (comparaison par id). */
export function mergeTracks(existing: Track[], incoming: Track[]): { toAdd: Track[]; skipped: number } {
  const known = new Set(existing.map((t) => t.id));
  const toAdd: Track[] = [];
  let skipped = 0;
  for (const t of incoming) {
    if (known.has(t.id)) {
      skipped++;
    } else {
      known.add(t.id);
      toAdd.push(t);
    }
  }
  return { toAdd, skipped };
}
