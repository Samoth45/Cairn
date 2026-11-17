# Backlog — idées en attente

Les étapes 1 à 6 du cahier des charges sont terminées : ces idées peuvent maintenant être
traitées, **une à la fois et seulement sur demande de l'utilisateur**. Avant d'en commencer
une, en faire une spec dans `docs/specs/` (modèle : `docs/specs/README.md`), puis la retirer
d'ici une fois validée.

## Simplification des tracés très denses à l'import

Traces Strava, montres GPS : ~1 point/s, ex. 30 000 points pour 23 km.

- Supprimer les points quasi alignés (type Douglas-Peucker, tolérance de quelques mètres, en
  tenant compte de l'altitude) → typiquement 2 000–3 000 points sans différence visible.
- But : alléger IndexedDB et le dessin de la carte (le temps de calcul
  n'est pas un problème : ~60 ms pour 30 000 points).
- **Garde-fou** : calculer l'empreinte (`id`) sur le fichier d'origine **avant** simplification,
  pour que le dédoublonnage continue de fonctionner.
- Contexte : le cas d'usage principal est la préparation de randos à partir de GPX légers de
  sites de randonnée ; les traces Strava (rando déjà faite, partagée par quelqu'un) sont
  secondaires. Leur profil paraît plus lisse (altitude barométrique/corrigée par Strava, points
  denses) : normal.

## Montées de version majeures en attente

Relevées par `npm outdated` le 17/11/2026 (lors du passage à Vitest 5), volontairement non
faites. Une à la fois, chacune avec sa spec, en lisant les notes de version :

- **Vite 6 → 8** et **`@vitejs/plugin-react` 4 → 6** (la v6 exige Vite 8) : à faire ensemble.
  Vérifier `manualChunks` (`vite.config.ts`), le polling du serveur dev, le build Vercel et
  Vitest 5 (accepte Vite 6.4 à 8).
- **TypeScript 5.8 → 7** : vérifier la compatibilité de `typescript-eslint` et de `tsc -b`.
- **`globals` 16 → 17** (configuration ESLint).
- **`dexie-react-hooks` 1 → 4** : vérifier `useLiveQuery` (`useTracks`) et la compatibilité
  avec Dexie 4.
