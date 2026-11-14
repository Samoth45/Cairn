# CLAUDE.md — Cairn

Application web perso de planification de randonnées en montagne : import de GPX, carte,
statistiques, météo détaillée par altitude pour choisir le meilleur jour / horaire.
**Cahier des charges complet (étapes 1 à 6) : [prompt.md](prompt.md)** — à relire avant chaque étape.

## Règles de travail (demandées par l'utilisateur)

- **Développement étape par étape** dans l'ordre de `prompt.md`. À la fin de chaque étape :
  s'arrêter, expliquer comment tester, **attendre la validation** avant l'étape suivante.
- **Tout passe par Docker**, jamais npm/node sur l'hôte (multi-postes Windows/macOS/Linux) :
  `docker compose run --rm dev <commande>`.
- Interface **entièrement en français** (textes, messages d'erreur, noms de fichiers exportés).
  Les commentaires du code sont aussi en français.
- Aucune API nécessitant une clé : uniquement des services gratuits et ouverts (IGN Géoplateforme,
  OpenTopoMap, Open-Meteo).
- Ne pas commiter sans demande explicite. Ne jamais pousser sur Git (le push déclenche un
  déploiement Vercel).

## Routine de vérification (fin de chaque étape, avant de rendre la main)

Toujours dans le conteneur, dans cet ordre ; tout doit passer sans erreur ni avertissement :

```bash
docker compose run --rm dev npm test          # tests unitaires (Vitest)
docker compose run --rm dev npm run lint      # ESLint (0 erreur, 0 warning)
docker compose run --rm dev npm run build     # tsc -b + vite build = ce que Vercel exécute
```

Le build de production est **obligatoire** : Vercel échoue sur toute erreur TypeScript ou de
build, même si le serveur dev (qui ne vérifie pas les types) fonctionne. Lire aussi ses
avertissements (chunks vides, taille…). Puis vérifier que le serveur dev compile les modules
modifiés (`curl http://localhost:5173/src/...` → 200). Dans le compte rendu à l'utilisateur,
indiquer le résultat des trois commandes.

## État d'avancement

- [x] **Étape 1** — carte (IGN / OpenTopoMap), import GPX multiple (bouton + glisser-déposer),
  IndexedDB, panneau des tracés, sélection/zoom, erreurs, export/import de sauvegarde JSON.
  Validée par l'utilisateur. Ajustement ensuite : tracés dessinés en 3 couches
  (ombre noire + liseré blanc + couleur) pour le contraste.
- [x] **Étape 2** — statistiques (distance, D+/D- avec hystérésis 5 m, min/max, point culminant),
  altitudes via Open-Meteo Elevation si manquantes, durée DIN 33466 (vitesses réglables),
  profil altimétrique SVG avec marqueur synchronisé sur la carte. Validée.
- [x] **Étape 2bis** (ajoutée à la demande de l'utilisateur) — pentes en % (survol du profil,
  remplissage coloré par classe de pente + légende, pentes max montée/descente dans les stats)
  et retéléchargement de chaque tracé en GPX (altitudes corrigées incluses). Validée.
- [x] **Étape 3** — service météo Open-Meteo (`services/weather.ts`), points d'échantillonnage
  (≤ 8, fusion < 200 m), cache mémoire + IndexedDB 1 h, bouton « Actualiser », choix du modèle
  dans les paramètres. Vue compacte provisoire (`WeatherPanel`, navigation heure par heure)
  + points météo sur la carte. Validée.
- [x] **Étape 3bis** (ajoutée à la demande de l'utilisateur) — lever/coucher du soleil au départ
  (durée du jour, départ conseillé au plus tard, alerte si rando plus longue que le jour, heures
  de nuit signalées) et météo du point dans les infobulles des points météo de la carte.
  Corrections ensuite : marqueur « Point culminant » fusionné avec le point météo du sommet,
  marqueurs dans un pane au-dessus des tracés. Validée.
- [x] **Étape 4** — onglets Carte / Météo ; vue `WeatherView` : 7 jours (pastille ⚠ si alerte),
  heatmap points × heures 6 h–21 h (température bleu→rouge centrée sur 0, ressenti, flèche de
  vent, 💧 > 0,2 mm, ⚡ orage), lignes temps / nébulosité / risque de pluie / isotherme / inversion,
  badge « Inversion probable », alertes, heures de nuit grisées, clic sur une heure = heure
  affichée sur la carte. Validée.
- [ ] **Étape 5** — tracé coloré selon la prévision à l'heure de passage. ← prochaine étape
- [ ] Étape 6 — score « meilleur jour ».
- [x] **Préparation du déploiement Vercel** (section en fin de `prompt.md`, faite avant
  l'étape 5 à la demande de l'utilisateur, pour qu'il pousse et vérifie le déploiement à
  chaque étape) — `vercel.json`, `.nvmrc`, `engines`, script `preview`, README. Validée.

## Idées pour après la fin des étapes

À ne pas implémenter avant que les étapes 1 à 6 soient terminées (décision de l'utilisateur).

- **Simplification des tracés très denses à l'import** (traces Strava, montres GPS : ~1 point/s,
  ex. 30 000 points pour 23 km). Supprimer les points quasi alignés (type Douglas-Peucker,
  tolérance de quelques mètres, en tenant compte de l'altitude) → typiquement 2 000–3 000 points
  sans différence visible. But : alléger IndexedDB, la sauvegarde JSON et le dessin de la carte
  (le temps de calcul n'est pas un problème : ~60 ms pour 30 000 points).
  Garde-fou : calculer l'empreinte (`id`) sur le fichier d'origine **avant** simplification,
  pour que le dédoublonnage continue de fonctionner.
  Contexte : le cas d'usage principal est la préparation de randos à partir de GPX légers de
  sites de randonnée ; les traces Strava (rando déjà faite, partagée par quelqu'un) sont secondaires.
  Leur profil paraît plus lisse (altitude barométrique/corrigée par Strava, points denses) : normal.

## Commandes

```bash
docker compose up dev                          # http://localhost:5173, hot reload (polling)
docker compose up --build prod                 # http://localhost:8080 (nginx, fallback SPA)
docker compose run --rm dev npm test           # Vitest (jsdom)
docker compose run --rm dev npm run lint       # ESLint
docker compose run --rm dev npm run build      # tsc -b + vite build (sert de typecheck)
docker compose run --rm dev npm install <pkg>  # puis : docker compose up --build -V dev
docker compose run --rm -p 4173:4173 dev sh -c "npm run build && npm run preview"  # build servi comme en prod
```

Si Docker répond « failed to connect to the docker API » : Docker Desktop n'est pas lancé
(`C:\Program Files\Docker\Docker\Docker Desktop.exe` sur le poste Windows).

`-V` est indispensable après un ajout de dépendance : `node_modules` vit dans un volume
anonyme qui sinon reste périmé. Sous Windows, le shell Bash de l'outil gère mal certains
heredocs longs contenant des apostrophes : préférer l'outil Write pour créer les fichiers.

## Déploiement Vercel

Le projet est importé dans Vercel depuis le dépôt Git. **Vercel construit depuis les sources
(`npm ci` puis `npm run build`, sortie `dist/`) et ne lance pas Docker.** La configuration Docker
doit rester intacte (dev et prod locale). L'utilisateur pousse lui-même après chaque étape
validée. Mis en place (détail dans `prompt.md`) :

- `vercel.json` à la racine : `framework: vite`, `buildCommand: npm run build`,
  `outputDirectory: dist`, `installCommand: npm ci`, rewrite `/(.*)` → `/index.html` (SPA,
  équivalent de `docker/nginx.conf`), `Cache-Control: public, max-age=31536000, immutable`
  sur `/assets/(.*)`.
- Node 22 partout : `"engines": { "node": "22.x" }` dans `package.json` + `.nvmrc` (`22`),
  aligné sur l'image `node:22-alpine`.
- `package-lock.json` versionné et à jour (requis par `npm ci`).
- Contraintes à respecter dans tout le code, dès maintenant :
  - pas de `base` dans `vite.config.ts` (app servie à la racine du domaine) ;
  - aucune URL `localhost` codée en dur ; toutes les API et tuiles en **HTTPS**
    (sinon « mixed content » en production) ;
  - **aucune variable d'environnement** : si une devient nécessaire, le signaler à l'utilisateur ;
  - les options `server.*` de Vite (host, polling) ne concernent que le dev.
- Tester le build comme Vercel : le script `preview` inclut `--host 0.0.0.0 --port 4173
  --strictPort` ; le port est publié à la volée (pas de changement de `docker-compose.yml`) :
  `docker compose run --rm -p 4173:4173 dev sh -c "npm run build && npm run preview"` →
  http://localhost:4173 (le fallback SPA de `vite preview` est actif).
- Vérifier la cohérence du lockfile comme Vercel : `docker compose run --rm dev npm ci --dry-run`.
  Après toute modification de `package.json`, resynchroniser avec
  `docker compose run --rm dev npm install --package-lock-only`. Le lockfile, généré sous
  Alpine, contient bien les binaires natifs Linux glibc (`@rollup/rollup-linux-x64-gnu`,
  `@esbuild/linux-x64`) dont Vercel a besoin.
- `.vercel/` (dossier local de la CLI Vercel) est dans `.gitignore`.
- Seule URL en `http://` du code : le namespace XML GPX `http://www.topografix.com/GPX/1/1`
  (identifiant obligatoire, jamais appelé) — ce n'est pas du mixed content.
- README : section « Déploiement sur Vercel » (build depuis les sources via `vercel.json`, push
  sur la branche principale = production, autres branches = previews, données stockées dans le
  navigateur → la version déployée démarre vide, importer la sauvegarde JSON).
- Fin de cette tâche : ne rien pousser ; lister les fichiers créés/modifiés, expliquer le test
  avec `npm run preview`, s'arrêter.

## Stack

Vite 6 + React 19 + TypeScript strict, Leaflet 1.9 + react-leaflet 5, `@tmcw/togeojson`,
Dexie 4 + `dexie-react-hooks`, Vitest + jsdom + fake-indexeddb. Graphiques : **SVG maison**
(pas de recharts), cf. `ElevationProfile.tsx` ; garder ce choix pour les étapes suivantes.

## Architecture

```
src/
  types.ts            Point = [lat, lon, ele|null], Track (elevationSource?), Settings
                      (baseLayer, selectedTrackId, showProfile, din, weatherModel), DEFAULT_SETTINGS
  db/db.ts            Dexie 'cairn' : v1 tables tracks (id, createdAt) et settings (key='app') ;
                      v2 table weather (trackId) = CachedForecast. getSettings / updateSettings
                      (via normalizeSettings). Nouvelle table → db.version(3)
  hooks/
    useTracks.ts            useLiveQuery (l'UI suit la base) + actions : import GPX, renommer,
                            couleur, visibilité, suppression, export/import de sauvegarde
    useElevationFetcher.ts  récupère en arrière-plan (1 tracé à la fois) les altitudes manquantes,
                            statut par tracé (loading/error/done) + retry
    useWeather.ts           prévision du tracé sélectionné via weatherCache ; { forecast, loading,
                            error, refresh } ; AbortController si le tracé change
    useHoverPoint.ts        mini-store (useSyncExternalStore) de la position survolée sur le profil,
                            pour ne pas re-rendre l'app à chaque mouvement de souris
  lib/                fonctions pures + tests (*.test.ts)
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
    download.ts       downloadText(contenu, nom, mime) (GPX, sauvegarde JSON)
    weatherPoints.ts  selectWeatherPoints(profile) → WeatherPoint[] (lat, lon, ele, d, roles
                      summit/start/lowest), triés du plus haut au plus bas ; rolesLabel ; weatherPointsKey
    time.ts           parisHourKey (heure de Paris au format des séries Open-Meteo), formatClock, formatAgo
    wmo.ts            codes WMO → libellé FR + pictogramme, isThunderstorm
    sun.ts            sunTimes(jour, lat, lon) (calcul astronomique local), daylightInfo (durée du
                      jour, départ au plus tard = coucher − durée DIN, longerThanDay), isNightHour,
                      parisMinutes
    forecast.ts       HourSelection {key, index}, currentHourIndex, resolveHourIndex, formatForecastHour
    weatherTable.ts   forecastDays, dayHourIndices (6–21 h), indexForDay, tempColor (+ TEMP_LEGEND),
                      detectInversion / inversionExplanation, computeAlerts (rafales > 50 au sommet,
                      orage, ressenti < −5, isotherme < sommet), formatHourRanges, summitIndex
    din.ts            dinDurationHours(distanceKm, D+, D-, speeds)
    settings.ts       normalizeSettings (valeurs par défaut + validation, base et sauvegarde)
    format.ts         formatage FR (km, m, durée « 5 h 15 », coordonnées, « – » si null)
    ticks.ts          graduations rondes pour les graphiques
    backup.ts         buildBackup, parseBackup (validation), mergeTracks (fusion par id)
    colors.ts         palette cyclique des tracés
  services/
    elevation.ts      Open-Meteo Elevation : lots de 100, ElevationError (message FR),
                      fetchTrackElevations(segments) → segments densifiés avec altitudes
    weather.ts        Open-Meteo Forecast : HOURLY_VARS, buildForecastUrl, parseForecastResponse,
                      fetchForecast → ForecastData { times, points: PointSeries[], primary[] },
                      WeatherError, MODEL_LABELS
    weatherCache.ts   getTrackForecast(trackId, points, model, {force}) : mémoire → IndexedDB →
                      réseau, TTL 1 h ; peekTrackForecast ; deleteTrackForecast (appelé à la suppression)
  components/         MapView (fonds, polylines 3 couches, marqueurs sommet / survol / points météo,
                      AutoResize), FitBounds, Sidebar (zone défilante stats + météo + liste),
                      TrackItem, TrackStats, WeatherPanel (+ bloc soleil, bouton vers le tableau),
                      WeatherView (onglet Météo, heatmap), WeatherPointTooltip,
                      ElevationProfile (SVG), SettingsDialog, HoverMarker, DropZone, Toasts,
                      ErrorBoundary, CairnLogo
  App.tsx             orchestration : sélection, analyse mémoïsée du tracé sélectionné, zoom
                      (fitRequest avec nonce), toasts, tiroir mobile, profil, paramètres, durée DIN,
                      heure météo affichée (hourSelection) partagée panneau ↔ infobulles carte
docker/nginx.conf     fallback SPA + cache long sur /assets
samples/              GPX fictifs pour tests manuels (trk avec ele, rte sans ele, invalide)
```

## Décisions importantes

- **id d'un tracé = empreinte de ses coordonnées** (pas un UUID) → dédoublonnage à l'import
  GPX et à la fusion de sauvegarde. Pas de `crypto.subtle` : indisponible en HTTP hors
  localhost (test depuis le téléphone via l'IP du PC).
- **Un fichier GPX = un tracé**, chaque `trkseg` / `rte` devient un segment de `segments`.
  Les `wpt` sont ignorés. Nom : `metadata/name` → nom du 1er trk/rte → nom de fichier.
- **Altitudes** : absente = `null`. Si < 80 % des points en ont, on interroge Open-Meteo
  Elevation (MNT ~90 m) : segments densifiés si les points sont trop espacés (routes),
  ≤ 1500 points interrogés (espacement ≥ 50 m), le reste interpolé ; **toutes** les
  altitudes sont remplacées (cohérence) et le tracé stocké avec `elevationSource: 'dem'`
  → jamais de nouvel appel. Au-delà de 80 %, les trous sont seulement interpolés.
  L'id du tracé reste l'empreinte des coordonnées d'origine (dédoublonnage inchangé).
- **Statistiques calculées à la volée** (non stockées) : dépendent des segments ; la durée
  DIN dépend aussi des paramètres. Les sauts entre segments ne comptent pas en distance ;
  le D+/D- est calculé par segment.
- **Pentes** : toujours calculées sur une fenêtre de 100 m (jamais point à point, trop bruité),
  par segment pour les pentes max. Classe de couleur selon la valeur absolue.
- **GPX exporté** : contient les segments stockés (densifiés si altitudes Open-Meteo). Le
  réimporter crée donc un nouveau tracé (empreinte différente), c'est attendu.
- **Météo, modèle Météo-France** : `meteofrance_seamless` ne fournit jamais
  `precipitation_probability` ni `freezing_level_height` et s'arrête vers J+4 (vérifié sur l'API
  réelle). On envoie donc `models=meteofrance_seamless,best_match` dans **la même requête**
  (variables suffixées `_<modèle>`) et chaque valeur = Météo-France ?? best_match.
  `ForecastData.primary[h]` indique si l'heure vient d'AROME/ARPEGE. Avec `best_match` seul,
  les nulls éventuels restent null → afficher « – » (formatTemp/formatWind/… le font).
- **Points météo** calculés seulement quand les altitudes sont définitives (pas pendant la
  récupération Open-Meteo Elevation), sinon double requête. Le cache est invalidé si le
  modèle ou les points changent (clé `modèle|points`). Le cache n'est pas dans la sauvegarde JSON.
- Les séries horaires sont en heure locale de Paris (`timezone=Europe/Paris`) : comparer avec
  `parisHourKey()`, ne pas convertir avec le fuseau du navigateur.
- **Soleil calculé localement** (pas via l'API : marche pour tout jour, sans réseau, avant
  l'arrivée de la météo), au point de départ, horizon astronomique (−0,833°) sans relief ni
  altitude ; écart ≤ 2 min avec Open-Meteo `daily=sunrise,sunset` (testé). Une heure est « de
  nuit » si son milieu est avant le lever ou après le coucher.
- **Tous les marqueurs** (sommet, points météo, survol du profil) sont dans le pane Leaflet
  `cairn-markers` (z-index 450, rendu SVG) : sur le canvas des tracés, l'ordre de dessin = ordre
  d'ajout, et un tracé importé/réaffiché après un marqueur le recouvrait.
- Tests : le DOMParser de jsdom est très lent sur les gros GPX (~1 min pour 30 000 points,
  contre quelques centaines de ms dans le navigateur) → ne pas parser de gros fichiers dans les tests.
- **Marqueur « Point culminant » = point météo « Sommet »** (mêmes coordonnées) : un seul
  marqueur (le noir), dont l'infobulle porte la météo ; le rond blanc du sommet n'est pas dessiné,
  sinon l'un masque l'autre au survol.
- **Onglets Carte / Météo** (`mainView` dans App, forcé à `map` sans tracé sélectionné) : la
  carte reste montée mais `hidden` ; `FitBounds` reçoit `active` et diffère le zoom tant que la
  carte est masquée (sinon Leaflet calcule sur une taille nulle). Le profil n'est affiché qu'en vue Carte.
- **Jour affiché dans le tableau = jour de l'heure sélectionnée** (une seule source de vérité :
  `HourSelection`). Changer de jour garde la même heure (ou midi si hors 6–21 h). Pour l'étape 6
  (« ouvrir la vue météo de ce tracé ce jour-là ») : sélectionner le tracé, `setMainView('weather')`
  et une `HourSelection` sur ce jour (attention : la clé de prévision doit être celle du tracé).
- **Inversion** : chaque point est comparé aux températures 850/700 hPa de sa propre maille ;
  850 hPa seulement pour les points ≤ 1 300 m, 700 hPa pour les points ≤ 2 700 m, plus le cas
  700 hPa > 850 hPa ; marge 1 °C ; la plus marquée est retenue. Lignes du haut du tableau et
  alertes rafales/isotherme = point « Sommet ».
- **Heure météo affichée** : état `HourSelection` dans App, lié à la clé de la prévision ; une
  sélection d'une autre prévision est ignorée → retour à l'heure courante au changement de tracé.
- La sauvegarde/les paramètres anciens sont complétés par `normalizeSettings` : toujours
  ajouter un nouveau réglage là et dans `DEFAULT_SETTINGS`.
- Les paramètres (`Settings`) sont persistés en base et inclus dans la sauvegarde JSON :
  y ajouter les futurs réglages (vitesses DIN, modèle météo, poids du score).
- Carte : renderer canvas (`tolerance: 8` pour le clic au doigt), le tracé sélectionné est
  dessiné en dernier. Fond IGN : maxNativeZoom 19 ; OpenTopoMap : maxNativeZoom 17.
- Responsive : panneau latéral fixe ≥ 768 px, tiroir + bouton flottant en dessous.
- Vite : `server.watch.usePolling: true` (hot reload avec volumes Windows/macOS).
