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
- Ne pas commiter sans demande explicite.

## État d'avancement

- [x] **Étape 1** — carte (IGN / OpenTopoMap), import GPX multiple (bouton + glisser-déposer),
  IndexedDB, panneau des tracés, sélection/zoom, erreurs, export/import de sauvegarde JSON.
  Validée par l'utilisateur. Ajustement ensuite : tracés dessinés en 3 couches
  (ombre noire + liseré blanc + couleur) pour le contraste.
- [x] **Étape 2** — statistiques (distance, D+/D- avec hystérésis 5 m, min/max, point culminant),
  altitudes via Open-Meteo Elevation si manquantes, durée DIN 33466 (vitesses réglables),
  profil altimétrique SVG avec marqueur synchronisé sur la carte. **En attente de validation.**
- [ ] **Étape 3** — service météo Open-Meteo (`services/weather.ts`), points d'échantillonnage, cache 1 h.
  ← prochaine étape
- [ ] Étape 4 — tableau heatmap météo par altitude.
- [ ] Étape 5 — tracé coloré selon la prévision à l'heure de passage.
- [ ] Étape 6 — score « meilleur jour ».

## Commandes

```bash
docker compose up dev                          # http://localhost:5173, hot reload (polling)
docker compose up --build prod                 # http://localhost:8080 (nginx, fallback SPA)
docker compose run --rm dev npm test           # Vitest (jsdom)
docker compose run --rm dev npm run lint       # ESLint
docker compose run --rm dev npm run build      # tsc -b + vite build (sert de typecheck)
docker compose run --rm dev npm install <pkg>  # puis : docker compose up --build -V dev
```

`-V` est indispensable après un ajout de dépendance : `node_modules` vit dans un volume
anonyme qui sinon reste périmé. Sous Windows, le shell Bash de l'outil gère mal certains
heredocs longs contenant des apostrophes : préférer l'outil Write pour créer les fichiers.

## Stack

Vite 6 + React 19 + TypeScript strict, Leaflet 1.9 + react-leaflet 5, `@tmcw/togeojson`,
Dexie 4 + `dexie-react-hooks`, Vitest + jsdom + fake-indexeddb. Graphiques : **SVG maison**
(pas de recharts), cf. `ElevationProfile.tsx` ; garder ce choix pour les étapes suivantes.

## Architecture

```
src/
  types.ts            Point = [lat, lon, ele|null], Track (elevationSource?), Settings
                      (baseLayer, selectedTrackId, showProfile, din), DEFAULT_SETTINGS
  db/db.ts            Dexie 'cairn' v1 : tables tracks (id, createdAt) et settings (key='app')
                      ; getSettings / updateSettings (via normalizeSettings). Nouvelles tables → db.version(2)
  hooks/
    useTracks.ts            useLiveQuery (l'UI suit la base) + actions : import GPX, renommer,
                            couleur, visibilité, suppression, export/import de sauvegarde
    useElevationFetcher.ts  récupère en arrière-plan (1 tracé à la fois) les altitudes manquantes,
                            statut par tracé (loading/error/done) + retry
    useHoverPoint.ts        mini-store (useSyncExternalStore) de la position survolée sur le profil,
                            pour ne pas re-rendre l'app à chaque mouvement de souris
  lib/                fonctions pures + tests (*.test.ts)
    gpx.ts            parseGpx(text, fileName) → { name, segments } ou GpxError (message FR)
    hash.ts           trackFingerprint(segments) : FNV-1a double (64 bits) des coords arrondies
    geo.ts            haversine, cumulativeDistances, trackBounds
    elevation.ts      couverture, needsElevation (< 80 % de points avec altitude), interpolation
                      des trous, densify, planElevationQueries / applyElevations
    stats.ts          elevationGain (hystérésis 5 m), analyzeTrack → { stats, profile },
                      nearestProfileIndex
    din.ts            dinDurationHours(distanceKm, D+, D-, speeds)
    settings.ts       normalizeSettings (valeurs par défaut + validation, base et sauvegarde)
    format.ts         formatage FR (km, m, durée « 5 h 15 », coordonnées, « – » si null)
    ticks.ts          graduations rondes pour les graphiques
    backup.ts         buildBackup, parseBackup (validation), mergeTracks (fusion par id)
    colors.ts         palette cyclique des tracés
  services/
    elevation.ts      Open-Meteo Elevation : lots de 100, ElevationError (message FR),
                      fetchTrackElevations(segments) → segments densifiés avec altitudes
  components/         MapView (fonds, polylines 3 couches, marqueurs sommet / survol, AutoResize),
                      FitBounds, Sidebar, TrackItem, TrackStats, ElevationProfile (SVG),
                      SettingsDialog, HoverMarker, DropZone, Toasts, ErrorBoundary, CairnLogo
  App.tsx             orchestration : sélection, analyse mémoïsée du tracé sélectionné, zoom
                      (fitRequest avec nonce), toasts, tiroir mobile, profil, paramètres
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
- La sauvegarde/les paramètres anciens sont complétés par `normalizeSettings` : toujours
  ajouter un nouveau réglage là et dans `DEFAULT_SETTINGS`.
- Les paramètres (`Settings`) sont persistés en base et inclus dans la sauvegarde JSON :
  y ajouter les futurs réglages (vitesses DIN, modèle météo, poids du score).
- Carte : renderer canvas (`tolerance: 8` pour le clic au doigt), le tracé sélectionné est
  dessiné en dernier. Fond IGN : maxNativeZoom 19 ; OpenTopoMap : maxNativeZoom 17.
- Responsive : panneau latéral fixe ≥ 768 px, tiroir + bouton flottant en dessous.
- Vite : `server.watch.usePolling: true` (hot reload avec volumes Windows/macOS).
