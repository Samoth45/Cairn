import { describe, expect, it } from 'vitest';
import { BackupError, backupFileName, buildBackup, mergeTracks, parseBackup } from './backup';
import type { Track } from '../types';

const track = (id: string, name = id): Track => ({
  id,
  name,
  color: '#ff0000',
  visible: true,
  fileName: `${id}.gpx`,
  createdAt: 1,
  segments: [
    [
      [45, 6, 1000],
      [45.1, 6.1, null],
    ],
  ],
});

describe('sauvegarde', () => {
  it('fait un aller-retour export → import', () => {
    const backup = buildBackup([track('a'), track('b')], { baseLayer: 'otm', selectedTrackId: 'b' });
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.tracks).toEqual(backup.tracks);
    expect(parsed.settings).toEqual({ baseLayer: 'otm', selectedTrackId: 'b' });
  });

  it('rejette un fichier qui n’est pas une sauvegarde Cairn', () => {
    expect(() => parseBackup('pas du json')).toThrow(BackupError);
    expect(() => parseBackup('{"foo":1}')).toThrow(/pas une sauvegarde Cairn/);
    expect(() => parseBackup('{"app":"cairn"}')).toThrow(/tracés manquante/);
  });

  it('ignore les tracés mal formés', () => {
    const json = JSON.stringify({ app: 'cairn', tracks: [track('ok'), { id: 1 }, { id: 'x', name: 'x', segments: [[['a']]] }] });
    expect(parseBackup(json).tracks.map((t) => t.id)).toEqual(['ok']);
  });

  it('fusionne sans dupliquer', () => {
    const { toAdd, skipped } = mergeTracks([track('a')], [track('a', 'renommé'), track('b'), track('b')]);
    expect(toAdd.map((t) => t.id)).toEqual(['b']);
    expect(skipped).toBe(2);
  });

  it('nomme le fichier avec la date', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('cairn-sauvegarde-2026-01-05.json');
  });
});
