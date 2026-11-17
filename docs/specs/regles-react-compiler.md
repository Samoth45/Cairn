# Règles « React Compiler » d'eslint-plugin-react-hooks

Statut : réalisée

## Objectif
`eslint-plugin-react-hooks` 7 ajoute à sa config `recommended` les règles issues du React
Compiler (lecture de ref pendant le rendu, `setState` synchrone dans un effet, mémoïsation
manuelle non préservable…). Elles signalent 10 erreurs dans du code qui fonctionne. On corrige
ces endroits pour activer la config complète : le lint détecte alors ces motifs fragiles dans le
code futur. Le React Compiler lui-même n'est **pas** activé dans le build.

## Comportement attendu
Aucun changement visible, sauf un détail assumé :
- Un tracé sans altitudes **en attente** (import de plusieurs GPX sans altitudes, récupérés un à
  la fois) affiche « altitudes en cours de récupération » dès l'import, et plus seulement quand
  son tour arrive.

Corrections, sans modifier le comportement :
- `eslint.config.js` : `reactHooks.configs.flat.recommended` à la place des deux règles
  activées à la main.
- `App.tsx` : emprise initiale de la carte en état React (posé une fois au premier rendu
  chargé, mise à jour d'état pendant le rendu) au lieu d'une ref lue pendant le rendu.
  `departureMinutes`, `startIndex` et `departureSun` deviennent des `useMemo` : ce sont des
  dépendances de `forecastRuns` et `hoverInfo`, et la règle `preserve-manual-memoization`
  refuse une mémoïsation qui dépend de valeurs recalculées à chaque rendu.
- `DropZone.tsx` : la ref du callback `onFiles` est mise à jour dans un effet, pas pendant le
  rendu.
- `ElevationProfile.tsx` : le point survolé est mémorisé avec le profil auquel il appartient ;
  un autre profil → aucun survol (plus de remise à zéro dans un effet). L'effet ne garde que
  l'effacement du marqueur de la carte.
- `useElevationFetcher.ts` : le statut « loading » est déduit (tracé qui attend ses altitudes
  sans statut « done » / « error ») au lieu d'être posé dans l'effet.
- `useWeather.ts` : le résultat est mémorisé avec la requête (tracé, clé, actualisation) qui
  l'a produit ; prévision, chargement et erreur sont déduits pendant le rendu (aucun
  `setState` synchrone dans l'effet, qui ne fait plus que lancer la requête).
- `useAllForecasts.ts` : non signalé par les règles, inchangé.

## Contraintes
- Lint : 0 erreur, 0 avertissement (`--max-warnings=0`), avec la config complète.
- Pas de `eslint-disable` pour les nouvelles règles (sauf impossibilité justifiée en
  commentaire).
- Aucun changement de dépendance ni de `package.json`.
- Comportements à préserver : ancienne prévision affichée pendant le rechargement, annulation
  de la requête si le tracé change, retour à « aucun survol » au changement de tracé, un seul
  appel d'altitudes à la fois, relance après erreur.

## Hors périmètre
- Activer le React Compiler (`babel-plugin-react-compiler`) dans Vite.
- Retirer les `useMemo` / `useCallback` manuels.

## Comment tester
- `/verifier` : tests, lint (config complète), build.
- Météo : changer de tracé, de modèle, « Actualiser » → l'ancienne prévision reste affichée
  pendant le chargement, puis la nouvelle ; couper le réseau → message d'erreur.
- Altitudes : importer `samples/` route sans altitudes (plusieurs à la fois) → « en cours de
  récupération », puis statistiques complètes ; en hors-ligne → erreur et bouton « Réessayer ».
- Profil : survoler, puis changer de tracé → plus de curseur ni de marqueur sur la carte.
- Glisser-déposer un GPX sur la fenêtre → voile puis import.
- Recharger la page → la carte s'ouvre sur le tracé sélectionné (emprise initiale).
- Survol du tracé coloré et du profil sur le build (`npm run preview`, StrictMode).
