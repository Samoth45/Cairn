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

## Règles « React Compiler » d'eslint-plugin-react-hooks

Découvert lors du passage à ESLint 10 (17/11/2026). `eslint-plugin-react-hooks` 7 (requis par
ESLint 10) ajoute à sa config `recommended` 13 règles issues du React Compiler. Pour l'instant,
`eslint.config.js` n'active que `rules-of-hooks` et `exhaustive-deps` (comme avant). Activer la
config complète signale 10 erreurs dans du code qui fonctionne :

- `preserve-manual-memoization` : 5 mémoïsations de `App.tsx` (l. ~150, 178, 200).
- `refs` : lecture d'une ref pendant le rendu (`App.tsx` l. ~431, `DropZone.tsx`).
- `set-state-in-effect` : `ElevationProfile.tsx` (remise à zéro du survol),
  `useElevationFetcher.ts` (statut « loading »), `useWeather.ts` (remise à zéro sans tracé).

Corriger ces endroits puis passer à `reactHooks.configs.recommended`. À retester ensuite :
météo, altitudes, profil, glisser-déposer.

## Vitest 3 : vulnérabilités signalées par `npm audit`

`npm audit` : 3 vulnérabilités (2 critiques `tinypool`, 1 modérée `@vitest/mocker`), via
`vitest@3`. Outils de test uniquement (rien dans le build déployé). Correctif : Vitest 4 ou 5
(changement majeur) — vérifier la compatibilité avec Vite 6 (Vitest récent peut exiger Vite 7+,
cf. `npm outdated` : Vite 8, `@vitejs/plugin-react` 6, TypeScript 7 disponibles).
