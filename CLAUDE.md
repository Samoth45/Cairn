# CLAUDE.md — Cairn

Application web perso de planification de randonnées en montagne : import de GPX, carte,
statistiques, météo détaillée par altitude pour choisir le meilleur jour / horaire.
**Cahier des charges complet (étapes 1 à 6) : [prompt.md](prompt.md)** — à relire avant chaque étape.

## Règles de travail (demandées par l'utilisateur)

- **Développement étape par étape** dans l'ordre de `pormpt.md`. À la fin de chaque étape :
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
- [ ] **Étape 2** — statistiques (distance, D+/D- avec hystérésis ~5 m, min/max, point culminant),
  altitudes via Open-Meteo Elevation si manquantes, durée DIN 33466, profil altimétrique
  avec marqueur synchronisé sur la carte. ← **prochaine étape**
- [ ] Étape 3 — service météo Open-Meteo (`services/weather.ts`), points d'échantillonnage, cache 1 h.
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
Dexie 4 + `dexie-react-hooks`, Vitest + jsdom + fake-indexeddb. Graphiques (étape 2+) :
recharts ou SVG maison, au choix (le cahier des charges autorise les deux).

## Architecture

```
src/
  types.ts            Point = [lat, lon, ele|null], Track, Settings, BackupFile, DEFAULT_SETTINGS
  db/db.ts            Dexie 'cairn' v1 : tables tracks (id, createdAt) et settings (key='app')
                      ; getSettings / updateSettings. Nouvelles tables → db.version(2)
  hooks/useTracks.ts  useLiveQuery (l'UI suit la base) + actions : import GPX, renommer,
                      couleur, visibilité, suppression, export/import de sauvegarde
  lib/                fonctions pures + tests (*.test.ts)
    gpx.ts            parseGpx(text, fileName) → { name, segments } ou GpxError (message FR)
    hash.ts           trackFingerprint(segments) : FNV-1a double (64 bits) des coords arrondies
    geo.ts            trackBounds ; accueillera haversine / dénivelé (étape 2)
    backup.ts         buildBackup, parseBackup (validation), mergeTracks (fusion par id)
    colors.ts         palette cyclique des tracés
  services/           appels API externes (vide pour l'instant : elevation, weather à venir)
  components/         MapView (fonds, polylines, rendu canvas), FitBounds, Sidebar, TrackItem,
                      DropZone, Toasts, ErrorBoundary, CairnLogo
  App.tsx             orchestration : sélection, zoom (fitRequest avec nonce), toasts, tiroir mobile
docker/nginx.conf     fallback SPA + cache long sur /assets
samples/              GPX fictifs pour tests manuels (trk avec ele, rte sans ele, invalide)
```

## Décisions importantes

- **id d'un tracé = empreinte de ses coordonnées** (pas un UUID) → dédoublonnage à l'import
  GPX et à la fusion de sauvegarde. Pas de `crypto.subtle` : indisponible en HTTP hors
  localhost (test depuis le téléphone via l'IP du PC).
- **Un fichier GPX = un tracé**, chaque `trkseg` / `rte` devient un segment de `segments`.
  Les `wpt` sont ignorés. Nom : `metadata/name` → nom du 1er trk/rte → nom de fichier.
- Altitude absente = `null` dans `Point` (prévu pour le complément Open-Meteo Elevation à
  l'étape 2 ; sauvegarder les altitudes récupérées dans le tracé pour ne pas rappeler l'API).
- Les paramètres (`Settings`) sont persistés en base et inclus dans la sauvegarde JSON :
  y ajouter les futurs réglages (vitesses DIN, modèle météo, poids du score).
- Carte : renderer canvas (`tolerance: 8` pour le clic au doigt), le tracé sélectionné est
  dessiné en dernier. Fond IGN : maxNativeZoom 19 ; OpenTopoMap : maxNativeZoom 17.
- Responsive : panneau latéral fixe ≥ 768 px, tiroir + bouton flottant en dessous.
- Vite : `server.watch.usePolling: true` (hot reload avec volumes Windows/macOS).
