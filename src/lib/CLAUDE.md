# src/lib — fonctions pures (calculs)

Règle : uniquement des fonctions pures, testées (`*.test.ts` à côté du fichier).
Aucun appel réseau ici (→ `src/services/`).

## Fichiers

```
gpx.ts            parseGpx(text, fileName) → { name, segments } ou GpxError (message FR)
hash.ts           trackFingerprint(segments) : FNV-1a double (64 bits) des coords arrondies
geo.ts            haversine, cumulativeDistances, trackBounds
elevation.ts      couverture, needsElevation (< 80 % de points avec altitude), interpolation
                  des trous, densify, planElevationQueries / applyElevations
stats.ts          elevationGain (hystérésis 5 m), analyzeTrack → { stats (dont pentes max),
                  profile }, nearestProfileIndex
slope.ts          eleAt, slopeAt (fenêtre 100 m), maxSlopes, SLOPE_CLASSES (< 5, 5–10,
                  10–15, 15–25, > 25 %), slopeRuns (tronçons colorés du profil)
gpxExport.ts      buildGpx(track) → GPX 1.1 (1 trk, 1 trkseg par segment), gpxFileName
download.ts       downloadText(contenu, nom, mime) (retéléchargement GPX)
referrer.ts       isLoopbackHost, otmReferrerPolicy (pas de referrer vers OpenTopoMap en local)
weatherPoints.ts  selectWeatherPoints(profile) → WeatherPoint[] (lat, lon, ele, d, roles
                  summit/start/lowest), triés du plus haut au plus bas ; rolesLabel ; weatherPointsKey
time.ts           parisHourKey (heure de Paris au format des séries Open-Meteo), nextDays,
                  formatClock, formatAgo
wmo.ts            codes WMO → libellé FR + pictogramme, isThunderstorm
sun.ts            sunTimes(jour, lat, lon) (calcul astronomique local), daylightInfo (durée du
                  jour, départ au plus tard = coucher − durée DIN, longerThanDay), isNightHour,
                  parisMinutes
forecast.ts       HourSelection {key, index}, currentHourIndex, resolveHourIndex, formatForecastHour
weatherTable.ts   forecastDays, dayHourIndices (6–21 h), indexForDay, tempColor (+ TEMP_LEGEND),
                  detectInversion / inversionExplanation, computeAlerts (rafales > 50 au sommet,
                  orage, ressenti < −5, isotherme < sommet), formatHourRanges, summitIndex
trackForecast.ts  passageHours (DIN par tronçons de 100 m, recalé sur la durée totale),
                  parseClock / formatClockMinutes, departureIndex (indice horaire fractionnaire),
                  makeWeatherSampler(data, points) → (ele, f) => WeatherSample | null,
                  colorOf / LEGENDS / GUST_CLASSES / PRECIP_CLASSES, coloredRuns,
                  nearestProfileIndexByLatLng
score.ts          computeDayScore(input, weights) → { score, penalties, coverage } | null,
                  gravités (rain/gust/cloud/coldSeverity), PENALTY_LABELS / ICONS, scoreColor,
                  reliability(échéance)
din.ts            dinDurationHours(distanceKm, D+, D-, speeds)
settings.ts       normalizeSettings (valeurs par défaut + validation des paramètres stockés)
format.ts         formatage FR (km, m, durée « 5 h 15 », coordonnées, « – » si null)
ticks.ts          graduations rondes pour les graphiques
colors.ts         palette cyclique des tracés
theme.ts          resolveTheme (réglage + préférence système), toggledTheme, THEME_LABELS,
                  THEME_STORAGE_KEY
```

## Décisions

### Statistiques, pentes, export
- **Statistiques calculées à la volée** (non stockées) : dépendent des segments ; la durée
  DIN dépend aussi des paramètres. Les sauts entre segments ne comptent pas en distance ;
  le D+/D- est calculé par segment.
- **Pentes** : toujours calculées sur une fenêtre de 100 m (jamais point à point, trop bruité),
  par segment pour les pentes max. Classe de couleur selon la valeur absolue.
- **GPX exporté** : contient les segments stockés (densifiés si altitudes Open-Meteo). Le
  réimporter crée donc un nouveau tracé (empreinte différente), c'est attendu.

### Soleil
- **Calculé localement** (pas via l'API : marche pour tout jour, sans réseau, avant l'arrivée
  de la météo), au point de départ, horizon astronomique (−0,833°) sans relief ni altitude ;
  écart ≤ 2 min avec Open-Meteo `daily=sunrise,sunset` (testé). Une heure est « de nuit » si
  son milieu est avant le lever ou après le coucher.

### Tableau météo
- **Inversion** : chaque point est comparé aux températures 850/700 hPa de sa propre maille ;
  850 hPa seulement pour les points ≤ 1 300 m, 700 hPa pour les points ≤ 2 700 m, plus le cas
  700 hPa > 850 hPa ; marge 1 °C ; la plus marquée est retenue. Lignes du haut du tableau et
  alertes rafales/isotherme = point « Sommet ».

### Météo le long du tracé (étape 5)
- **Heures de passage** : DIN appliquée par tronçons de 100 m sur l'altitude interpolée
  (`eleAt`), puis **recalée** pour que le temps total = durée DIN des statistiques (la somme
  des DIN par tronçon n'est pas égale à la DIN globale : max + min/2 n'est pas additif).
- **Temps = indice horaire fractionnaire** dans `ForecastData.times` (heure de Paris) :
  départ = indice de `${jour}T00:00` + minutes/60 ; passage = départ + heures écoulées. Aucune
  conversion de fuseau. Hors des séries → `null` → tronçon gris (`NO_DATA_COLOR`).
- **Interpolation** : linéaire en altitude entre les deux points de prévision qui encadrent
  l'altitude (point le plus proche au-delà), et linéaire entre les deux heures ; direction du
  vent et code WMO = point et heure les plus proches.
- **Lignes colorées** : morceaux ≤ 100 m (tracés peu denses subdivisés), couleur prise au milieu
  du morceau, morceaux consécutifs de même classe fusionnés, jamais de ligne entre deux segments
  (`ProfilePoint.seg`). Température : pas de 1 °C via `tempColor` (même échelle que le tableau) ;
  rafales et pluie : classes. (Rendu sur la carte : voir `src/components/CLAUDE.md`.)

### Score « meilleur jour » (étape 6)
- **Score** = 100 − Σ (gravité 0–1 × poids). Pluie, orage et froid : météo à l'endroit où se
  trouve le randonneur, toutes les 15 min de marche (même échantillonneur que la coloration du
  tracé). Rafales et nébulosité : série du point « Sommet » sur les heures de la fenêtre.
- **Gravités** : pluie cumulée 0 → 5 mm (ou risque moyen × 0,6) ; orage 1 pendant la rando,
  0,5 dans les 2 h autour ; rafales max 30 → 70 km/h ; nébulosité moyenne 50 → 100 % ;
  ressenti minimal −5 → −20 °C.
- **Poids par défaut** : pluie 35, orage 40, rafales 25, nébulosité 15, froid 20 (0 = ignoré,
  max 100).
- Score `null` si la prévision ne couvre rien ; `coverage` < 1 → astérisque. Heure de départ =
  `settings.departureTime` (la même qu'à l'étape 5) pour tous les jours.
- **Fiabilité** : J0–J+2 bonne, J+3–J+4 moyenne (opacité 0,8), au-delà faible (opacité 0,45,
  « peu fiable ») ; le ★ meilleur jour n'est choisi que parmi J0–J+4.

## Tests

- Le DOMParser de jsdom est très lent sur les gros GPX (~1 min pour 30 000 points, contre
  quelques centaines de ms dans le navigateur) → ne pas parser de gros fichiers dans les tests.
