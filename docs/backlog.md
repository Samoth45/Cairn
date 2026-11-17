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

## Refonte du README

Le README actuel est un guide d'installation. Le site est déployé : le README doit
maintenant présenter le projet, pour un visiteur ou un recruteur (en français).
Prérequis : l'intégration continue (pour le badge des tests).

Contenu souhaité :
- En-tête : logo Cairn, accroche, badges, **lien vers la version en ligne** bien visible,
  capture principale.
- Le problème (la météo en vallée ne dit rien de celle du sommet) et les fonctionnalités,
  par onglet (Carte, Météo, Meilleur jour).
- Choix techniques **avec leur justification** (pas de backend, API sans clé, requête
  météo multi-points et fusion des modèles, DIN 33466, soleil calculé localement,
  SVG maison, Docker multi-postes…) + schéma d'architecture en Mermaid.
- Quelques difficultés techniques résolues et leur explication (les plus parlantes).
- **Méthode : développement 100 % agentique avec Claude Code**, objectif principal du
  projet : je n'ai pas écrit une ligne de code. Détailler l'organisation mise en place
  (spec-driven, humain dans la boucle, CLAUDE.md hiérarchiques, journal des décisions,
  `/verifier` comme définition de « terminé », garde-fous, vérification autonome
  du rendu par puppeteer, backlog → spec → implémentation → validation).
- Développement local réduit à l'essentiel, dans un bloc repliable `<details>`.
- Crédits (IGN, OpenTopoMap/OSM, Open-Meteo) et licence.

Badges : technos (React, TypeScript, Vite, Leaflet, Docker, Node 26), état du
déploiement Vercel, CI (tests), licence, version.

À prévoir :
- **Emplacements pour les captures** : je les ferai moi-même. Prévoir un dossier
  (ex. `docs/images/`), des noms de fichiers explicites et, pour chacune, ce qu'elle
  doit montrer.
- **Licence MIT** : ajouter le fichier `LICENSE`.
- **Version** : proposer une façon de versionner (tag Git `v1.0.0`, version de
  `package.json`) pour le badge.
- Écrire une spec avant d'implémenter : me proposer le plan du README et la liste
  des captures pour validation.