# src/services — appels réseau (Open-Meteo)

Toutes les URL en **HTTPS**, aucune clé API, aucune variable d'environnement.
Les calculs purs (choix des points, interpolation…) restent dans `src/lib/`.

## Fichiers

```
elevation.ts      Open-Meteo Elevation : lots de 100, ElevationError (message FR),
                  fetchTrackElevations(segments) → segments densifiés avec altitudes
weather.ts        Open-Meteo Forecast : HOURLY_VARS, buildForecastUrl, parseForecastResponse,
                  fetchForecast → ForecastData { times, points: PointSeries[], primary[] },
                  WeatherError, MODEL_LABELS
weatherCache.ts   getTrackForecast(trackId, points, model, {force}) : mémoire → IndexedDB →
                  réseau, TTL 1 h ; peekTrackForecast ; deleteTrackForecast (appelé à la suppression)
```

## Décisions

- **Altitudes** : règles de déclenchement et de remplacement dans le CLAUDE.md racine
  (« Décisions transverses »). Côté service : lots de 100 coordonnées par requête.
- **Modèle Météo-France** : `meteofrance_seamless` ne fournit jamais
  `precipitation_probability` ni `freezing_level_height` et s'arrête vers J+4 (vérifié sur l'API
  réelle). On envoie donc `models=meteofrance_seamless,best_match` dans **la même requête**
  (variables suffixées `_<modèle>`) et chaque valeur = Météo-France ?? best_match.
  `ForecastData.primary[h]` indique si l'heure vient d'AROME/ARPEGE. Avec `best_match` seul,
  les nulls éventuels restent null → afficher « – » (formatTemp/formatWind/… le font).
- **Points météo** calculés seulement quand les altitudes sont définitives (pas pendant la
  récupération Open-Meteo Elevation), sinon double requête.
- **Cache** : TTL 1 h ; invalidé si le modèle ou les points changent (clé `modèle|points`).
- Les séries sont demandées avec `timezone=Europe/Paris` : voir « Heure de Paris » dans le
  CLAUDE.md racine.
