/** Libellés français et pictogrammes des codes météo WMO utilisés par Open-Meteo. */
const WMO: Record<number, [label: string, icon: string]> = {
  0: ['Ciel clair', '☀️'],
  1: ['Peu nuageux', '🌤️'],
  2: ['Partiellement nuageux', '⛅'],
  3: ['Couvert', '☁️'],
  45: ['Brouillard', '🌫️'],
  48: ['Brouillard givrant', '🌫️'],
  51: ['Bruine légère', '🌦️'],
  53: ['Bruine', '🌦️'],
  55: ['Bruine forte', '🌧️'],
  56: ['Bruine verglaçante', '🌧️'],
  57: ['Bruine verglaçante forte', '🌧️'],
  61: ['Pluie faible', '🌦️'],
  63: ['Pluie', '🌧️'],
  65: ['Pluie forte', '🌧️'],
  66: ['Pluie verglaçante', '🌧️'],
  67: ['Pluie verglaçante forte', '🌧️'],
  71: ['Neige faible', '🌨️'],
  73: ['Neige', '🌨️'],
  75: ['Neige forte', '❄️'],
  77: ['Grains de neige', '🌨️'],
  80: ['Averses faibles', '🌦️'],
  81: ['Averses', '🌧️'],
  82: ['Averses violentes', '⛈️'],
  85: ['Averses de neige', '🌨️'],
  86: ['Averses de neige fortes', '❄️'],
  95: ['Orage', '⛈️'],
  96: ['Orage avec grêle', '⛈️'],
  99: ['Orage avec forte grêle', '⛈️'],
};

export function wmoLabel(code: number | null | undefined): string {
  return code == null ? '–' : (WMO[code]?.[0] ?? `Code ${code}`);
}

export function wmoIcon(code: number | null | undefined): string {
  return code == null ? '–' : (WMO[code]?.[1] ?? '❔');
}

export function isThunderstorm(code: number | null | undefined): boolean {
  return code != null && code >= 95 && code <= 99;
}
