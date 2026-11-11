/** Point d'un tracé : latitude, longitude, altitude (null si absente du GPX). */
export type Point = [lat: number, lon: number, ele: number | null];

export interface Track {
  /** Empreinte des coordonnées : sert aussi au dédoublonnage. */
  id: string;
  name: string;
  color: string;
  visible: boolean;
  fileName: string;
  createdAt: number;
  /** Un segment par trkseg / rte. */
  segments: Point[][];
}

export type BaseLayerId = 'ign' | 'otm';

export interface Settings {
  baseLayer: BaseLayerId;
  selectedTrackId?: string;
}

export const DEFAULT_SETTINGS: Settings = { baseLayer: 'ign' };

export interface BackupFile {
  app: 'cairn';
  version: 1;
  exportedAt: string;
  tracks: Track[];
  settings: Settings;
}
