import type { DinSpeeds } from '../types';

/**
 * Durée de marche selon la méthode DIN 33466, en heures :
 * max(temps horizontal, temps vertical) + la moitié du plus petit des deux.
 */
export function dinDurationHours(distanceKm: number, ascentM: number, descentM: number, speeds: DinSpeeds): number {
  const horizontal = distanceKm / speeds.flatKmh;
  const vertical = ascentM / speeds.ascentMh + descentM / speeds.descentMh;
  return Math.max(horizontal, vertical) + Math.min(horizontal, vertical) / 2;
}
