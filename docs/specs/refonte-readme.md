# Refonte du README

Statut : réalisée

## Objectif
Le README actuel est un guide d'installation. Le site est déployé : le README doit maintenant
**présenter le projet** à un visiteur ou un recruteur (en français), montrer ce que fait
l'application, justifier les choix techniques et mettre en avant la méthode :
**développement 100 % agentique avec Claude Code** (objectif principal du projet, aucune ligne
de code écrite à la main).

## Décisions prises (questions du 17/11/2026)
- **URL en ligne** : `https://cairn-gpx.vercel.app/` (renseignée par l'utilisateur ; définie une seule fois,
  en lien de référence `[site]` en bas du README).
- **Dépôt rendu public** → badges dynamiques (shields.io), cassés tant qu'il reste privé.
- **Version** : passage à **1.0.0** (`package.json`, puis lockfile resynchronisé) ;
  l'utilisateur crée le tag Git `v1.0.0` (ou une Release GitHub) au moment de pousser.
  Ensuite SemVer : fonctionnalité → mineure, correction → correctif.
- **Licence MIT** au **nom réel** de l'utilisateur : **RABILLON Thomas**.

## Comportement attendu

### Plan du README

1. **En-tête** (centré)
   - Logo `public/cairn.svg`, titre « Cairn », accroche d'une ligne :
     « Planifier une rando en montagne avec la météo **à l'altitude où l'on marche**, pas
     celle de la vallée. »
   - Badges (ligne 1, état) : CI (GitHub Actions, job « Lint, test & build »), déploiement
     Vercel (`github/deployments/…/Production`), version (`github/v/tag`), licence.
   - Badges (ligne 2, technos, statiques) : React 19, TypeScript, Vite, Leaflet, Docker,
     Node 26.
   - **Bouton/lien « Essayer Cairn en ligne → »** bien visible, puis capture principale.
   - Mention courte : sans compte, sans backend, données gardées dans le navigateur.
2. **Le problème** (3-4 lignes) : la météo de la vallée ne dit rien de celle du sommet (écart
   de température, vent, isotherme 0 °C, inversions) ; il faut savoir *quand* passer *où*.
3. **Fonctionnalités, par onglet** (texte court + capture pour chacun) :
   - **Carte** : import GPX (glisser-déposer, multi-fichiers), fonds IGN / OpenTopoMap,
     statistiques (distance, D+/D−, durée DIN 33466, pentes max), profil altimétrique coloré
     par pente, tracé coloré par la météo au moment du passage (température, rafales, pluie),
     altitudes complétées automatiquement si le GPX n'en a pas.
   - **Météo** : tableau heure par heure par altitude (jusqu'à 8 points le long du tracé),
     isotherme, inversions de température, alertes, lever/coucher du soleil et heure de départ
     au plus tard.
   - **Meilleur jour** : score par jour et par tracé (pluie, orage, rafales, nuages, froid,
     poids réglables), fiabilité selon l'échéance.
   - En plus : mode sombre, mobile (tiroir), retéléchargement GPX avec altitudes corrigées.
4. **Choix techniques et pourquoi** (tableau « Choix | Pourquoi ») :
   - Pas de backend, IndexedDB (Dexie) — gratuit, privé, hébergement statique.
   - API gratuites sans clé (IGN Géoplateforme, OpenTopoMap, Open-Meteo) — aucun secret,
     aucune variable d'environnement.
   - Une seule requête météo multi-points, deux modèles fusionnés (Météo-France AROME/ARPEGE
     complété par `best_match` pour les variables et échéances qu'il ne fournit pas).
   - Points météo choisis par altitude (sommet, départ, point bas, paliers ~400 m), puis
     interpolation en altitude et en temps le long du tracé.
   - Durée DIN 33466, recalée par tronçons pour obtenir les heures de passage.
   - Soleil calculé localement (marche hors ligne, pour tout jour ; écart ≤ 2 min avec l'API).
   - Graphiques en SVG maison (pas de bibliothèque de graphiques).
   - Empreinte des coordonnées comme identifiant (dédoublonnage à l'import).
   - Docker pour le développement multi-postes ; Vercel construit depuis les sources.
5. **Architecture** : schéma **Mermaid** (navigateur : composants React → hooks → `lib`
   (calculs purs testés) / `services` (réseau + cache) → IndexedDB ; services externes : tuiles
   IGN/OTM, Open-Meteo Forecast/Elevation ; GitHub → CI + Vercel).
6. **Difficultés résolues** (4-5, format « problème → cause → solution », 3 lignes chacune) :
   - Tracé cliquable seulement en production : `interactive` lu à l'insertion par Leaflet,
     masqué en dev par le StrictMode.
   - Tuiles OpenTopoMap barrées en local : refus des referrers `localhost` → pas de referrer
     en boucle locale uniquement.
   - Heures de passage incohérentes : la formule DIN n'est pas additive → recalage sur la
     durée totale.
   - Météo-France sans probabilité de pluie ni isotherme, et limitée à ~J+4 → fusion des
     deux modèles dans la même requête.
   - Flash du thème clair au chargement : réglage en IndexedDB trop tardif → copie
     localStorage lue avant le premier rendu.
7. **Méthode : développement 100 % agentique avec Claude Code** (section la plus développée) :
   - Objectif et règle du jeu : aucune ligne de code écrite à la main ; rôle humain = besoin,
     décisions, validation.
   - Boucle de travail : **backlog → spec → implémentation → vérification → validation
     humaine → documentation → commit** (schéma Mermaid simple).
   - Spec-driven : cahier des charges en 6 étapes, puis une spec courte par fonctionnalité
     (`docs/specs/`), questions posées avant d'écrire.
   - Humain dans la boucle : arrêt à chaque étape, rien n'est commité sans demande, **jamais
     de push par l'agent** (le push déclenche le déploiement).
   - Mémoire du projet : `CLAUDE.md` hiérarchiques (racine, `src/lib`, `src/services`,
     `src/components`), journal `docs/historique.md`, décisions durables consignées.
   - `/verifier` comme définition de « terminé » : tests, lint sans avertissement, build de
     production, contrôle du serveur ; la même routine tourne en CI.
   - Vérification autonome du rendu : navigateur headless (puppeteer) dans un conteneur
     jetable, captures relues par l'agent, tests sur le build (dev ≠ prod).
   - Garde-fous : tout dans Docker, pas d'API à clé, `CLAUDE.local.md` par poste, incidents
     transformés en règles.
   - Quelques chiffres (calculés au moment de la rédaction) : nombre de tests, de specs, de
     commits.
8. **Développement local** dans un bloc repliable `<details>` : prérequis Docker, `docker
   compose up dev`, commandes test/lint/build, lien vers `docs/deploiement.md`.
9. **Crédits et licence** : © IGN (Géoplateforme), © OpenTopoMap, © contributeurs
   OpenStreetMap, données météo Open-Meteo (CC BY 4.0) ; licence MIT (lien `LICENSE`).

### Captures (faites par l'utilisateur)
Dossier **`docs/images/`**, PNG, fenêtre de bureau ~1400 × 850 sauf mobile. Le README les
référence dès maintenant ; tant qu'elles manquent, l'image est cassée (à faire avant le push).

| Fichier | Ce qu'elle doit montrer |
| --- | --- |
| `carte.png` (capture principale) | Onglet Carte, fond IGN, un tracé de montagne sélectionné **coloré par la température**, infobulle de passage ouverte, profil affiché, panneau Stats ouvert. |
| `meteo.png` | Onglet Météo : tableau par altitude d'un jour avec contrastes (inversion ou isotherme visible), bloc soleil. |
| `meilleur-jour.png` | Onglet Meilleur jour avec 2-3 tracés, un ★ meilleur jour visible. |
| `sombre.png` | Même vue que `carte.png` en mode sombre (section « Et aussi »). |

Pas de capture mobile (décision du 17/11/2026) : l'interface mobile a des problèmes à régler
(l'utilisateur les détaillera dans le backlog) ; le README ne met pas la version mobile en avant.

### Autres fichiers
- **`LICENSE`** : texte MIT standard, « Copyright (c) 2026 <nom réel> ».
- **`package.json`** : `"version": "1.0.0"` (+ lockfile resynchronisé).
- Le contenu « Déploiement sur Vercel » de l'ancien README est déjà dans
  `docs/deploiement.md` : le README y renvoie au lieu de le recopier.

## Contraintes
- Tout en français ; ton factuel, phrases courtes, pas de superlatifs.
- Rendu GitHub : Mermaid, `<details>`, `<p align="center">` ; vérifier qu'aucun lien relatif
  n'est cassé.
- Les affirmations techniques doivent correspondre au code et aux CLAUDE.md (pas d'invention).
- Chemins des badges : dépôt `Samoth45/Cairn`.

## Hors périmètre
- Faire les captures (l'utilisateur), créer le tag ou la Release, rendre le dépôt public,
  pousser.
- Version anglaise du README.
- Modifier l'application.

## Comment tester
- Prévisualiser le README dans VS Code (Ctrl+Maj+V) : structure, tableau, `<details>`.
- Après le push (dépôt public) : affichage GitHub, schémas Mermaid rendus, badges verts, liens
  et images OK.
