# Historique de réalisation

Ce qui a été fait, étape par étape, par rapport au cahier des charges
(`docs/cahier-des-charges.md`). Toutes les étapes ont été validées par l'utilisateur.

- [x] **Étape 1** — carte (IGN / OpenTopoMap), import GPX multiple (bouton + glisser-déposer),
  IndexedDB, panneau des tracés, sélection/zoom, erreurs, export/import de sauvegarde JSON
  (supprimé ensuite, voir plus bas).
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
- [x] **Étape 5** — panneau « Colorer le tracé » sur la carte (Aucune / Température / Rafales /
  Pluie, jour, heure de départ, légende, arrivée estimée, alerte arrivée après le coucher) ;
  heures de passage DIN par tronçons de 100 m recalées sur la durée totale ; tracé sélectionné
  découpé en lignes colorées (météo interpolée en altitude et dans le temps) ; infobulle de
  passage au survol du tracé ou du profil (appui au doigt). Validée.
- [x] **Étape 6** — onglet « ★ Meilleur jour » : tableau tracés × 7 jours, score 0–100 coloré
  (rouge → vert) sur la fenêtre de rando (heure de départ + durée DIN), icônes des principales
  pénalités, détail au survol, ★ meilleur jour (jusqu'à J+4), jours lointains atténués +
  avertissement de fiabilité, clic = onglet Météo de ce tracé ce jour-là ; poids des pénalités
  réglables dans les paramètres ; prévisions de tous les tracés (cache 1 h, 2 requêtes en
  parallèle). Validée. Dernière étape du cahier des charges. Correction ensuite : pas de
  referrer vers OpenTopoMap en local (tuiles « Generic referrer detected »).
- [x] **Préparation du déploiement Vercel** (faite avant l'étape 5 à la demande de
  l'utilisateur, pour qu'il pousse et vérifie le déploiement à chaque étape) — `vercel.json`,
  `.nvmrc`, `engines`, script `preview`, README. Validée. Détail : `docs/deploiement.md`.
- [x] **Passage de Node 22 à Node 26** (14/11/2026, demandé par l'utilisateur).

## Après le cahier des charges

Les nouvelles fonctionnalités ont chacune leur spec dans `docs/specs/`. Ajouter ici une ligne
par fonctionnalité validée.

- [x] **Suppression de la sauvegarde JSON** (15/11/2026) — export/import et pied de panneau
  « Sauvegarde » retirés : l'app n'est utilisée que sur Vercel, les GPX sont réimportés en cas
  de changement de navigateur. Retéléchargement GPX conservé, données IndexedDB intactes.
  Spec : `docs/specs/suppression-sauvegarde.md`.
- [x] **Mode sombre** (15/11/2026, sans spec : consignes du backlog suffisantes) — bouton ☾ / ☀
  à gauche de ⚙, réglage `theme` (Système par défaut, suivi en direct ; Clair ; Sombre) aussi
  dans les Paramètres (section « Apparence »), sans flash au chargement (copie localStorage lue
  par `index.html`). Interface seulement : fonds de carte intacts, contrôles et infobulles
  Leaflet assombris ; couleurs d'interface en variables CSS. Au passage : listes déroulantes
  des Paramètres qui étaient tronquées.
- [x] **Réorganisation du panneau latéral** (16/11/2026) — stats et météo du tracé sélectionné
  regroupées en un seul bloc à onglets « Stats | Météo » (nom du tracé en en-tête, onglet
  mémorisé dans `Settings.sidePanelTab`, flèches ← → au clavier), au-dessus de la liste des
  tracés. Tableau météo du panneau limité aux points clés (Sommet, Départ, Point bas), lien
  « Voir les N points » pour déplier. Spec : `docs/specs/reorganisation-panneau.md`.
- [x] **Intégration continue** (17/11/2026, sans spec) — workflow GitHub Actions
  `.github/workflows/ci.yml` (job « Lint, test & build ») à chaque push et sur les PR : `npm ci`,
  tests, lint, build, sans Docker (Node lu dans `.nvmrc`), exécution précédente annulée.
  Lint désormais bloquant sur les avertissements (`--max-warnings=0`). Réglage Vercel
  « Deployment Checks » pour ne promouvoir en production qu'après la CI : `docs/deploiement.md`.
- [x] **Dépendances dépréciées** (17/11/2026, sans spec) — ESLint 10 (+ `@eslint/js` 10,
  `eslint-plugin-react-hooks` 7, `eslint-plugin-react-refresh` 0.5, `typescript-eslint` 8.73),
  `eslint.config.js` passé à `defineConfig` (`tseslint.config` dépréciée), mêmes règles
  qu'avant (seules `rules-of-hooks` et `exhaustive-deps` de React Hooks : les règles du React
  Compiler de la v7 sont au backlog). jsdom 31 (plus de `whatwg-encoding`). Plus aucun
  avertissement « deprecated » à `npm ci`. Vulnérabilités de Vitest 3 notées au backlog.
- [x] **Refonte du README** (17/11/2026) — README de présentation (visiteur / recruteur) :
  en-tête avec badges et lien vers https://cairn-gpx.vercel.app/, fonctionnalités par onglet
  avec captures (`docs/images/`, compressées), choix techniques justifiés, schémas Mermaid,
  difficultés résolues, méthode de développement agentique ; développement local en bloc
  repliable. Licence MIT (`LICENSE`), version 1.0.0. Pas de capture mobile (interface mobile
  à revoir). Spec : `docs/specs/refonte-readme.md`.
- [x] **Règles « React Compiler » du lint** (17/11/2026) — config `recommended` complète
  d'`eslint-plugin-react-hooks` 7 activée, les 10 erreurs corrigées sans `eslint-disable` :
  état déduit pendant le rendu au lieu de `setState` dans les effets (`useWeather`, survol du
  profil, statut des altitudes), plus de ref lue pendant le rendu (`DropZone`, emprise
  initiale de la carte), dépendances des mémoïsations de `App` mémoïsées. Seul effet visible :
  un tracé en file d'attente d'altitudes s'affiche « en cours de récupération » dès l'import.
  Spec : `docs/specs/regles-react-compiler.md`.
- [x] **Vitest 5** (17/11/2026) — `vitest` 3.2 → 5.1 (accepte Vite 6.4 : Vite inchangé), installé
  explicitement (pas de `npm audit fix --force`). `npm audit` : 0 vulnérabilité (3 avant :
  `tinypool`, `@vitest/mocker`). Aucun changement de tests ni de configuration ; bundle de
  production identique. Autres montées majeures (Vite 8, TypeScript 7…) notées au backlog.
  Spec : `docs/specs/vitest-5.md`.
- [x] **Déploiement continu** (17/11/2026) — workflow `ci.yml` renommé « CI/CD » : après le job
  « Lint, test & build », la CLI Vercel (65.17.0) déploie une preview sur les PR (environnement
  GitHub `preview`, ignoré pour les forks) et la production sur `main` (environnement
  `production`, lien `cairn-gpx.vercel.app`, `concurrency` sans annulation). Déploiement Git de
  Vercel coupé (`git.deploymentEnabled: false`). README : badge unique « CI/CD ». Mise en place
  des secrets et réglages Vercel : `docs/deploiement.md`. Spec : `docs/specs/deploiement-continu.md`.
- [x] **globals 17** (17/11/2026) — lot 1 de `docs/specs/montees-de-version.md` : `globals`
  16.5 → 17.14 (configuration ESLint). Globales des AudioWorklets et `DisposableStack`
  retirées de `browser` (non utilisées). Lint et bundle inchangés. Nouvelle alerte `npm audit`
  sur picomatch (sans correctif) consignée dans `docs/deploiement.md` et au backlog.
- [x] **dexie-react-hooks 4** (17/11/2026) — lot 2 de `docs/specs/montees-de-version.md` :
  `dexie-react-hooks` 1.1.7 → 4.4.0 (Dexie 4.4.7). `useLiveQuery` inchangé (vérifié en comparant
  les paquets npm). Contrôle headless sur le build : la liste suit la base (import, masquage,
  renommage, suppression, rechargement).
- [x] **TypeScript 6.0** (17/11/2026) — lot 3 de `docs/specs/montees-de-version.md` :
  `typescript` 5.8.3 → 6.0.3, sans changement de code ni de `tsconfig`. TypeScript 7 essayé
  (`tsc -b` OK) mais bloqué par `typescript-eslint` (`<6.1.0`) : noté au backlog.
- [x] **Vite 8** (17/11/2026) — lot 4, le dernier, de `docs/specs/montees-de-version.md`
  (spec réalisée) : `vite` 6.4 → 8.3.8 (Rolldown, Oxc, Lightning CSS) et `@vitejs/plugin-react`
  4.7 → 6.3. `manualChunks` remplacé par `rolldownOptions.output.codeSplitting` (chunk
  `leaflet`). Build 5× plus rapide, JS −11 kB. CSS Leaflet dans un fichier à part, chargé avant
  le nôtre. Contrôlés : headless sur le build, hot reload sous Docker, `vercel build`, image
  nginx. esbuild n'est plus installé.
- [x] **Migration UI — lot 0** (19/11/2026) — base Tailwind CSS v4 + shadcn/ui (Radix, preset
  Nova) sans changement visible (captures 0 différence sur 20), puis contrastes corrigés
  (`--muted-foreground`, `--faint`, `--night-foreground`, nouveau `--input` pour les contours
  de champs). Ancienne feuille dans `src/styles/legacy.css` (couche `legacy`), tokens shadcn
  dans `src/index.css`, surcharges Leaflet dans `src/styles/leaflet.css`. Outil de recette
  visuelle `docs/recette/` (build, météo rejouée, horloge figée). Spec :
  `docs/specs/migration-ui.md`.
