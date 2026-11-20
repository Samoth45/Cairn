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

## Problèmes de l'interface mobile

Sortis de la migration de l'interface vers Tailwind CSS + shadcn/ui (terminée le 20/11/2026,
`docs/specs/migration-ui.md` ; le lot 4 a migré le panneau et le tiroir sans correction
mobile, décision du propriétaire).

- **Liste à ajouter ici par l'utilisateur**, puis spec à part.
- Piste : tiroir en **Sheet** de shadcn (piège du focus, Échap, animation) si un problème le
  demande ; la Dialog de Radix est déjà dans le chunk `radix`, le coût serait faible.
- Recette sur un vrai téléphone avec la preview Vercel.
