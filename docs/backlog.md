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

## Dépendances dépréciées

Signalées par `npm ci` sous Node 26 / npm 11 ; elles fonctionnent encore. Sans lien avec Node 26.

- `eslint@9` : « no longer supported ». Passer à ESLint 10 ; vérifier la compatibilité de
  `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` et adapter
  `eslint.config.js` si besoin.
- `whatwg-encoding@3.1.1` (« Use @exodus/bytes instead ») : dépendance transitive de `jsdom`
  (environnement des tests) ; se règle en mettant `jsdom` à jour, pas directement.

Après mise à jour : `npm install` dans le conteneur, puis `/verifier` (tests, lint, build).
