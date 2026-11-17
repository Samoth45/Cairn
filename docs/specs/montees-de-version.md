# Montées de version majeures (globals, dexie-react-hooks, TypeScript, Vite)

Statut : à faire

## Objectif
`npm outdated` (17/11/2026) signale quatre dépendances en retard d'une version majeure.
Elles ne doivent pas prendre de retard, mais sans casser le build Vercel ni le confort
de développement sous Docker. On les monte **par lots indépendants**, du moins risqué au plus
risqué. Pour chaque lot : implémentation, `/verifier`, validation, puis commit.

## Décisions prises (questions du 17/11/2026)
- **Une spec, quatre lots.** L'utilisateur demande « implémente le lot N ». Les lots peuvent
  être faits un par un, dans n'importe quel ordre, mais l'ordre ci-dessous est conseillé.
- **TypeScript : 6.0, pas 7.** `typescript-eslint` 8.73, sa dernière version, exige
  `typescript >=4.8.4 <6.1.0`. TypeScript 7 est le compilateur réécrit en Go, sans la même API
  JS. TS 7 reste au backlog jusqu'à ce que `typescript-eslint` l'accepte.

## État de départ (17/11/2026)
| Paquet | Installé | Cible | Utilisé dans |
| --- | --- | --- | --- |
| `globals` | 16.5.0 | 17.x (17.14.0) | `eslint.config.js` (`globals.browser`) |
| `dexie-react-hooks` | 1.1.7 | 4.x (4.4.0) | `src/hooks/useTracks.ts` (`useLiveQuery`) |
| `typescript` | 5.8.3 (`~5.8.3`) | 6.0.x (6.0.3) | `tsc -b`, `typescript-eslint` |
| `vite` | 6.4.6 | 8.x (8.3.8) | dev, build, preview, Vitest |
| `@vitejs/plugin-react` | 4.7.0 | 6.x (6.3.0) | `vite.config.ts` (`react()` sans option) |

Contexte utile : Dexie 4.4.7, Node 26, Vitest 5.1 (accepte Vite `^6.4 || ^7 || ^8`),
`vite.config.ts` en `manualChunks` objet (chunk `leaflet`), `src/vite-env.d.ts` →
`/// <reference types="vite/client" />`.

## Lots

### Lot 1 — `globals` 16 → 17 (réalisé le 17/11/2026)
**Résultat** : 17.14.0.
- Seule rupture annoncée : les globales des AudioWorklets sortent de `browser`.
- Comparaison des deux versions de `browser` : 10 retirées (`sampleRate`, `currentTime`,
  `currentFrame`, `registerProcessor`, `AudioWorkletGlobalScope`, `AudioWorkletProcessor`,
  `WorkletGlobalScope`, plus `DisposableStack`, `AsyncDisposableStack` et `SuppressedError`,
  qui sont des globales du langage) et 55 ajoutées. Aucune globale retirée n'est utilisée dans
  `src`.
- Lint à 0 avertissement, bundle identique.

- Mettre `^17` dans `package.json`.
- Lire les notes de version : les clés d'environnement renommées ou retirées.
- Vérifier que `globals.browser` couvre toujours ce que le code utilise : le lint doit
  rester à 0 erreur, 0 avertissement.
- Risque : faible, la dépendance ne sert qu'au lint.

### Lot 2 — `dexie-react-hooks` 1 → 4 (réalisé le 17/11/2026)
**Résultat** : 4.4.0, avec Dexie 4.4.7.
- Les notes de version ne décrivent pas les ruptures. La comparaison des deux paquets npm montre
  que `useLiveQuery` garde la même signature et le même fonctionnement : seul `liveQuery(…)`
  devient `Dexie.liveQuery(…)`.
- Les dépendances requises passent à `dexie >=4.2.0-alpha.1 <5` et `react >=16`, sans
  `@types/react`.
- Nouveaux hooks non utilisés : `useSuspendingLiveQuery`, `useDocument`…
- Contrôle headless sur le build : import, masquage, renommage, suppression et rechargement OK,
  sans erreur dans la console.

- Mettre `^4` dans `package.json`. La v4 exige `dexie >=4.2.0-alpha.1 <5` (installé :
  4.4.7, OK).
- Lire les notes de version et vérifier la signature et le comportement de `useLiveQuery`
  (valeur `undefined` pendant le chargement, mise à jour à chaque écriture).
- Test manuel : importer, renommer, masquer et supprimer un tracé. La liste et la carte suivent
  la base sans rechargement.
- Risque : faible à moyen. Toute l'interface dépend de `useLiveQuery`.

### Lot 3 — TypeScript 5.8 → 6.0 (réalisé le 17/11/2026)
**Résultat** : 6.0.3 (`~6.0.3`), partagé avec `typescript-eslint` 8.73.
- Aucun changement de code ni de `tsconfig`. Aucun nouveau défaut ne nous touche, aucune
  option dépréciée n'est utilisée, et le lint ne signale pas de version non prise en charge.
- `tsc -b --force` (les deux projets) passe sans erreur. Bundle identique.
- **Bilan TS 7** : `tsc -b --force` passe aussi avec TypeScript 7.0.2, essayé sur une copie
  jetable. Le seul blocage est `typescript-eslint` (`<6.1.0`), noté au backlog.

- Mettre `~6.0.3` dans `package.json`, en gardant le `~` actuel : pas de montée mineure
  automatique.
- Nouveaux défauts de TS 6.0 qui nous concernent :
  - `types` vaut maintenant `[]` par défaut : les paquets `@types/*` ne sont plus inclus
    d'office. Vérifier `@types/geojson` et `@types/leaflet`. `vite/client` est déjà référencé
    explicitement, et les tests importent `vitest` explicitement. Si une erreur apparaît,
    ajouter `types` dans le `tsconfig` concerné.
  - `strict` et `noUncheckedSideEffectImports` deviennent vrais par défaut, mais ils sont déjà
    explicites chez nous. `lib.dom.iterable` est fusionné dans `lib.dom` : `"DOM.Iterable"`
    reste accepté.
- Options dépréciées (`baseUrl`, `moduleResolution node`, `downlevelIteration`…) : aucune n'est
  utilisée. **Ne pas** ajouter `ignoreDeprecations`.
- Vérifier que `typescript-eslint` accepte cette version (pas d'avertissement « unsupported
  TypeScript version » au lint).
- Bilan dans la spec : ce qu'il faudra changer pour TS 7. Mettre à jour l'entrée du backlog
  « TypeScript 7 » avec la raison du blocage.
- Risque : moyen. Les erreurs de types apparaissent au build, donc elles sont détectées.

### Lot 4 — Vite 6 → 8 et `@vitejs/plugin-react` 4 → 6 (ensemble)
La v6 du plugin exige Vite 8, et Vite 8 remplace Rollup et esbuild par Rolldown et Oxc.

- **`manualChunks` objet n'existe plus** dans Vite 8 (la forme fonction est dépréciée).
  - Le remplacer par `build.rolldownOptions.output.codeSplitting.groups`, avec un groupe
    `leaflet` dont le `test` vaut `/node_modules[\\/](react-)?leaflet[\\/]/`.
  - `build.rollupOptions` est renommé `build.rolldownOptions` (l'ancien nom est déprécié).
  - Il faut garder un chunk Leaflet séparé et aucun avertissement de build. Rolldown crée un
    chunk `runtime` quand `groups` est utilisé : c'est normal.
- **`react()` sans option** : Babel est retiré du plugin v6 et Fast Refresh passe par Oxc.
  Il n'y a rien à migrer (pas d'option `babel`, pas de React Compiler).
- **Navigateurs cibles par défaut** : ils passent à Chrome 111 / Firefox 114 / Safari 16.4.
  C'est acceptable pour une app perso récente. À signaler dans le compte rendu.
- **Minification** : Oxc pour le JS, Lightning CSS pour le CSS. Comparer les tailles du bundle
  avant et après, et vérifier le rendu (thème sombre, styles Leaflet).
- **Serveur dev** : vérifier que le polling (`server.watch.usePolling`) donne toujours le hot
  reload sous Docker Windows. Vérifier aussi le module `vitest/config` référencé en tête de
  `vite.config.ts`.
- **Prod** :
  - `npm run build` et `npm run preview`, avec un contrôle headless sur le build : carte,
    survol du profil, clic sur un tracé (dev ≠ prod).
  - `vercel build` hors ligne dans un conteneur jetable, comme pour le CD : il doit garder le
    rewrite SPA et le cache sur `/assets`.
  - `docker compose up --build prod`.
- **Après** : badge « Vite » du README (6 → 8), ligne Stack du `CLAUDE.md` racine, et retrait
  de la mention de Vite 6 dans `docs/backlog.md`.
- Risque : élevé. C'est le cœur de la chaîne de build.

## Contraintes (tous les lots)
- Tout dans Docker. Après `npm install`, reconstruire l'image (`docker compose build dev` ou
  `up --build -V dev`) avant tests et lint. Vérifier les versions effectivement installées
  avec `npm ls`.
- Resynchroniser le lockfile, puis `npm ci --dry-run`.
- Pas de `npm audit fix --force`, pas d'autre montée que celle du lot.
- `/verifier` complet : tests, lint à 0 avertissement, build sans avertissement.
- Aucun changement de comportement visible attendu. Toute différence doit être signalée.

## Hors périmètre
- TypeScript 7, qui attend la prise en charge par `typescript-eslint`.
- Les montées mineures et correctives (ex. `@tmcw/togeojson` 7.1.3 → 7.1.4), sauf si un lot
  les impose.
- Le React Compiler (`react({ compiler: true })`) et les autres nouveautés.

## Comment tester (par lot)
- `/verifier`, et `npm ls <paquet>` pour la version installée.
- Lot 2 : manipulations de la liste des tracés (import, renommage, visibilité, suppression,
  rechargement de la page).
- Lot 4 :
  - `docker compose up dev`, puis modifier un fichier : le hot reload doit fonctionner.
  - Build servi en `preview` sur http://localhost:4173 : carte, profil, météo, thème sombre.
  - Onglet Réseau : présence du chunk `leaflet`.
