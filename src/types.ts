/** Point d'un tracé : latitude, longitude, altitude (null si absente du GPX). */
export type Point = [lat: number, lon: number, ele: number | null];

/** Origine des altitudes : fichier GPX ou modèle numérique de terrain (Open-Meteo). */
export type ElevationSource = 'gpx' | 'dem';

export interface Track {
  /** Empreinte des coordonnées d'origine : sert aussi au dédoublonnage. */
  id: string;
  name: string;
  color: string;
  visible: boolean;
  fileName: string;
  createdAt: number;
  /** Un segment par trkseg / rte. */
  segments: Point[][];
  /** Absent tant que les altitudes manquantes n'ont pas été récupérées. */
  elevationSource?: ElevationSource;
}

export type BaseLayerId = 'ign' | 'otm';

/** Vitesses de la méthode DIN 33466. */
export interface DinSpeeds {
  /** Vitesse horizontale à plat, en km/h. */
  flatKmh: number;
  /** Vitesse verticale en montée, en m/h. */
  ascentMh: number;
  /** Vitesse verticale en descente, en m/h. */
  descentMh: number;
}

/** Modèle météo Open-Meteo. */
export type WeatherModel = 'meteofrance_seamless' | 'best_match';

/** Thème de l'interface : « system » suit le réglage de l'appareil. */
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  baseLayer: BaseLayerId;
  selectedTrackId?: string;
  showProfile: boolean;
  din: DinSpeeds;
  weatherModel: WeatherModel;
  /** Variable de coloration du tracé selon la prévision (étape 5). */
  trackColoring: 'none' | 'temperature' | 'gusts' | 'precipitation';
  /** Heure de départ habituelle, « HH:MM » (heure de Paris). */
  departureTime: string;
  /** Poids des pénalités du score « meilleur jour » (étape 6), en points retirés au maximum. */
  scoreWeights: ScoreWeights;
  /** Thème clair / sombre de l'interface (la carte n'est pas modifiée). */
  theme: Theme;
  /** Onglet ouvert du panneau du tracé sélectionné (barre latérale). */
  sidePanelTab: SidePanelTab;
}

export type SidePanelTab = 'stats' | 'weather';

export interface ScoreWeights {
  rain: number;
  storm: number;
  gusts: number;
  clouds: number;
  cold: number;
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = { rain: 35, storm: 40, gusts: 25, clouds: 15, cold: 20 };

export const DEFAULT_DIN: DinSpeeds = { flatKmh: 4, ascentMh: 300, descentMh: 500 };

export const DEFAULT_SETTINGS: Settings = {
  baseLayer: 'ign',
  showProfile: true,
  din: DEFAULT_DIN,
  weatherModel: 'meteofrance_seamless',
  trackColoring: 'none',
  departureTime: '08:00',
  scoreWeights: DEFAULT_SCORE_WEIGHTS,
  theme: 'system',
  sidePanelTab: 'stats',
};
