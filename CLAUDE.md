# CLAUDE.md — Cairn

Application web perso de planification de randonnées en montagne : import de GPX, carte,
statistiques, météo détaillée par altitude pour choisir le meilleur jour / horaire.

## Où trouver quoi

- `docs/cahier-des-charges.md` — cahier des charges d'origine (étapes 1 à 6, **toutes réalisées
  et validées**). Référence figée : ne plus le modifier.
- `docs/historique.md` — ce qui a été réalisé à chaque étape, ajouts et corrections.
- `docs/specs/` — une spec courte par nouvelle fonctionnalité (modèle : `docs/specs/README.md`).
- `README.md` — présentation du projet pour un visiteur / recruteur (pas un guide
  d'installation) ; captures dans `docs/images/` (faites par l'utilisateur, compressées avec
  pngquant + oxipng dans un conteneur jetable). Le garder à jour quand une fonctionnalité
  visible ou un choix technique qu'il cite change.
- `docs/backlog.md` — idées en attente (simplification des GPX denses, montées de version
  majeure en attente : TypeScript 7, bloqué par `typescript-eslint` ; problèmes de l'interface
  mobile, liste à compléter). Migration UI Tailwind v4 + shadcn/ui **terminée** (10 lots,
  version 1.1.0, bilan dans `docs/specs/migration-ui.md`, texte intégral archivé dans
  `docs/archives/` : **ne pas le lire sans raison**).
- `docs/recette/` — recette visuelle d'une interface : captures avant/après du build
  (conteneur jetable, météo rejouée, horloge figée) et mesure des contrastes ; mode d'emploi
  dans son `README.md`.
- `docs/deploiement.md` — détail Vercel, Node, lockfile, test du build, CI/CD (mise en place des secrets Vercel).
- `src/lib/CLAUDE.md` — décisions de calcul (stats, pentes, soleil, météo le long du tracé, score).
- `src/services/CLAUDE.md` — API Open-Meteo (altitudes, prévisions) et cache.
- `src/components/CLAUDE.md` — pièges Leaflet, carte, onglets, état partagé.
  **À lire aussi avant de modifier `App.tsx`** (onglets, `HourSelection`, jour de départ, survol).

## Règles de travail (demandées par l'utilisateur)

- **Travail par étapes** : à la fin de chaque étape ou fonctionnalité, s'arrêter, expliquer
  comment tester, **attendre la validation** avant de continuer.
- **Tout passe par Docker**, jamais npm/node sur l'hôte (multi-postes Windows/macOS/Linux) :
  `docker compose run --rm dev <commande>`.
- Interface **entièrement en français** (textes, messages d'erreur, noms de fichiers exportés).
  Les commentaires du code sont aussi en français.
- Aucune API nécessitant une clé : uniquement des services gratuits et ouverts (IGN Géoplateforme,
  OpenTopoMap, Open-Meteo).
- Ne pas commiter sans demande explicite. **Ne jamais pousser sur Git** (le push déclenche un
  déploiement Vercel).
- Créer les fichiers avec l'outil Write plutôt qu'avec des heredocs Bash (mal gérés sous Windows
  quand ils sont longs et contiennent des apostrophes).

## Vérification (fin de chaque étape, avant de rendre la main)

Lancer **`/verifier`** : tests, lint (0 erreur, 0 avertissement) et **build de production
obligatoire** en une commande (`scripts/verifier.sh`, sortie courte), puis contrôle du serveur
dev. Indiquer le résultat des trois étapes dans le compte rendu.

**CI/CD** : GitHub Actions rejoue tests, lint et build à chaque push ; si tout passe, la CLI
Vercel déploie (preview sur les PR, production sur `main`). Détail : `docs/deploiement.md`.

**Dev ≠ prod (StrictMode)** : tout comportement de carte (survol, clics, couches) doit être
vérifié aussi sur le build : sonde puppeteer par `sh docs/recette/run.sh sonde <script.mjs>`
(cf. `src/components/CLAUDE.md`).

## Contraintes de déploiement (à respecter dans tout le code)

Détail et procédures : `docs/deploiement.md`.

- Le déploiement (CLI Vercel dans GitHub Actions) construit depuis les sources (`npm ci` puis
  `npm run build`, sortie `dist/`, réglages de `vercel.json`) et ne lance pas Docker. La configuration Docker doit rester intacte (dev et prod locale).
- Pas de `base` dans `vite.config.ts` (app servie à la racine du domaine) ; aucune URL
  `localhost` codée en dur ; toutes les API et tuiles en **HTTPS** (sinon « mixed content »).
- **Aucune variable d'environnement** : si une devient nécessaire, le signaler à l'utilisateur.
- Node 26 : toujours changer ensemble `Dockerfile`, `engines` de `package.json` et `.nvmrc`.
- Après toute modification de `package.json` : resynchroniser le lockfile avec
  `docker compose run --rm dev npm install --package-lock-only` (requis par `npm ci`).

## Commandes

```bash
docker compose up dev                          # http://localhost:5173, hot reload (polling)
docker compose up --build prod                 # http://localhost:8080 (nginx, fallback SPA)
docker compose run --rm dev npm test           # Vitest (jsdom)
docker compose run --rm dev npm run lint       # ESLint
docker compose run --rm dev npm run build      # tsc -b + vite build (sert de typecheck)
docker compose run --rm dev npm install <pkg>  # puis : docker compose up --build -V dev
docker compose run --rm -p 4173:4173 dev sh -c "npm run build && npm run preview"  # build servi comme en prod
docker compose run --rm dev npm ci --dry-run   # cohérence du lockfile, comme Vercel
```

`-V` est indispensable après un ajout de dépendance : `node_modules` vit dans un volume
anonyme qui sinon reste périmé. Les conteneurs `docker compose run --rm dev` repartent aussi
des `node_modules` **de l'image** : après un `npm install`, reconstruire (`docker compose build
dev`, ou le `up --build -V` ci-dessus) avant de lancer tests/lint, sinon ils tournent sur les
anciennes versions.

Vite : `server.watch.usePolling: true` (hot reload avec volumes Windows/macOS). Les options
`server.*` ne concernent que le dev.

## Stack

Node 26 / npm 11 (image `node:26-alpine`), Vite 8 (Rolldown) + React 19 + TypeScript 6.0 strict, Leaflet 1.9 +
react-leaflet 5, `@tmcw/togeojson`, Dexie 4 + `dexie-react-hooks` 4, Vitest 5 + jsdom 31 +
fake-indexeddb, ESLint 10 (`defineConfig` ; config `recommended` complète de React Hooks 7, règles du React
Compiler comprises, cf. `src/components/CLAUDE.md`).
Graphiques : **SVG maison** (pas de recharts), cf. `ElevationProfile.tsx` ; garder ce choix.
Styles : **Tailwind CSS v4** (`@tailwindcss/vite`) + **shadcn/ui** (Radix, preset Nova, icônes
Lucide, police Geist), tout en utilitaires dans le JSX (migration terminée au 20/11/2026,
`docs/specs/migration-ui.md`) ; conventions et pièges dans `src/components/CLAUDE.md`. Alias `@` → `src` (Vite + `tsconfig.json` + `tsconfig.app.json`).

## Architecture

```
src/
  types.ts            Point = [lat, lon, ele|null], Track, Settings, DEFAULT_SETTINGS
  db/db.ts            Dexie 'cairn' : tracks, settings (v1), weather (v2) ; nouvelle table →
                      db.version(3). getSettings / updateSettings (via normalizeSettings)
  hooks/              useTracks (useLiveQuery : l'UI suit la base ; actions sur les tracés),
                      useElevationFetcher (altitudes manquantes en arrière-plan), useWeather
                      (prévision du tracé sélectionné), useAllForecasts (tous les tracés, onglet
                      « Meilleur jour »), useHoverPoint (survol hors React), useTheme
                      (`<html data-theme>`) ; détail en tête de chaque fichier
  lib/                fonctions pures + tests (*.test.ts) — détail dans src/lib/CLAUDE.md ;
                      utils.ts = cn() de shadcn (seule exception d'interface)
  services/           elevation.ts, weather.ts, weatherCache.ts — détail dans src/services/CLAUDE.md
  components/         UI et carte — détail dans src/components/CLAUDE.md ; ui/ = composants
                      shadcn (ajoutés par le CLI, components.json)
  index.css           entrée CSS : Tailwind, police, tokens clair/sombre, @theme, échelle des
                      superpositions (z-*), base (hauteur de ligne, curseur des boutons)
  styles/leaflet.css  surcharges Leaflet, hors couche (seul CSS maison avec index.css)
  App.tsx             orchestration : sélection, analyse mémoïsée du tracé sélectionné, zoom
                      (fitRequest avec nonce), toasts, tiroir mobile, profil, paramètres, durée DIN,
                      heure météo affichée (hourSelection) partagée panneau ↔ infobulles carte
docker/nginx.conf     fallback SPA + cache long sur /assets
scripts/verifier.sh   tests + lint + build en un conteneur, sortie courte (commande /verifier)
samples/              GPX fictifs pour tests manuels (trk avec ele, rte sans ele, invalide)
```

## Décisions transverses

- **id d'un tracé = empreinte de ses coordonnées** (pas un UUID) → dédoublonnage à l'import
  GPX. Pas de `crypto.subtle` : indisponible en HTTP hors
  localhost (test depuis le téléphone via l'IP du PC).
- **Un fichier GPX = un tracé**, chaque `trkseg` / `rte` devient un segment de `segments`.
  Les `wpt` sont ignorés. Nom : `metadata/name` → nom du 1er trk/rte → nom de fichier.
- **Altitudes** : absente = `null`. Si < 80 % des points en ont, on interroge Open-Meteo
  Elevation (MNT ~90 m) : segments densifiés si les points sont trop espacés (routes),
  ≤ 1500 points interrogés (espacement ≥ 50 m), le reste interpolé ; **toutes** les
  altitudes sont remplacées (cohérence) et le tracé stocké avec `elevationSource: 'dem'`
  → jamais de nouvel appel. Au-delà de 80 %, les trous sont seulement interpolés.
  L'id du tracé reste l'empreinte des coordonnées d'origine (dédoublonnage inchangé).
- **Heure de Paris** : les séries horaires sont en heure locale de Paris
  (`timezone=Europe/Paris`) : comparer avec `parisHourKey()`, ne jamais convertir avec le
  fuseau du navigateur.
- **Paramètres** : les `Settings` sont persistés en base (vitesses DIN, modèle météo,
  coloration, heure de départ, poids du score, thème, onglet du panneau). Tout nouveau réglage : l'ajouter à
  `DEFAULT_SETTINGS` **et** à `normalizeSettings` (qui complète les paramètres anciens).
- **Version** : SemVer dans `package.json` (1.0.0 au 17/11/2026, + lockfile resynchronisé) ;
  fonctionnalité → mineure, correction → correctif. Le tag Git `vX.Y.Z` (badge du README) est
  posé par l'utilisateur au moment de pousser. Licence MIT (`LICENSE`).
- **Pas de sauvegarde JSON** (supprimée, cf. `docs/specs/suppression-sauvegarde.md`) : les
  données vivent dans IndexedDB du navigateur ; pour changer de navigateur, réimporter les GPX.
