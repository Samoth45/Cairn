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
faites, puis traitées par lots le 17/11/2026 (`docs/specs/montees-de-version.md` : globals 17,
dexie-react-hooks 4, TypeScript 6.0, Vite 8). Il ne reste que :

- **TypeScript 6.0 → 7** : en attente de `typescript-eslint`. Au 17/11/2026, sa version 8.73
  exige `typescript <6.1.0`, car TS 7, le compilateur réécrit en Go, n'a pas la même API JS.
  Notre code passe déjà `tsc -b` avec TS 7.0.2, essayé sur une copie jetable : la montée se
  résumera à changer la version quand `typescript-eslint` l'acceptera. Surveiller ses notes de
  version.

## Migration de l'interface vers Tailwind CSS v4 + shadcn/ui

**Spec : `docs/specs/migration-ui.md`** (rédigée et tranchée le 18/11/2026).
**Avancement : lots 0 et 1 faits le 19/11/2026** (base Tailwind + shadcn, contrastes ; police
Geist, boutons, pastilles, icônes Lucide) ; prochain : lot 2. Budget JS : 15,9 kB gzip
consommés sur 30 (cf. spec, résultat du lot 1).

- **Objectif** : remplacer `src/styles.css` (1 804 lignes) par Tailwind v4 et des composants
  shadcn/ui (Radix), sans changer le fonctionnement.
- **Changements visibles voulus** : la police Geist et des contrastes corrigés.
- **Plan** : 10 lots (0 à 9), une branche et une PR par lot vers `develop`, recette sur la
  preview Vercel, version 1.1.0 à la fin.
- **Prérequis du lot 4** : la liste des problèmes de l'interface mobile, à ajouter ici par
  l'utilisateur.
- À traiter **un lot à la fois, sur demande** : « implémente le lot N de
  docs/specs/migration-ui.md ».
