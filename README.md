# Cairn

Application web personnelle de planification de randonnées en montagne : import de tracés
GPX, carte IGN / OpenTopoMap, statistiques et profil altimétrique, météo détaillée par altitude.
Tout tourne dans le navigateur (pas de backend), les données sont stockées dans IndexedDB.

**Seul prérequis : Docker** (Docker Desktop sous Windows / macOS, Docker Engine + plugin
Compose sous Linux). Rien d'autre à installer, ni Node ni npm.

## Démarrage rapide

```bash
git clone <url-du-dépôt> cairn && cd cairn
docker compose up dev
```

Ouvrir http://localhost:5173 . Le hot reload est actif : toute modification dans `src/`
recharge la page (le watcher fonctionne en polling, compatible avec les volumes
Windows / macOS).

Depuis un téléphone sur le même réseau : http://IP-DU-PC:5173

## Production

```bash
docker compose up --build prod
```

Ouvrir http://localhost:8080 (nginx sert le build statique ; toutes les routes renvoient
`index.html`).

## Commandes courantes

Toutes les commandes passent par le conteneur, jamais par npm sur l'hôte :

| Action | Commande |
| --- | --- |
| Lancer les tests | `docker compose run --rm dev npm test` |
| Linter | `docker compose run --rm dev npm run lint` |
| Vérifier le build (typecheck inclus) | `docker compose run --rm dev npm run build` |
| Tester le build comme en production | `docker compose run --rm -p 4173:4173 dev sh -c "npm run build && npm run preview"` puis http://localhost:4173 |
| Ajouter une dépendance | `docker compose run --rm dev npm install <paquet>` |
| Arrêter | `docker compose down` |

Après l'ajout d'une dépendance (`package.json` et `package-lock.json` sont mis à jour sur
l'hôte), reconstruire l'image et renouveler le volume `node_modules` :

```bash
docker compose up --build -V dev
```

`node_modules` vit dans un volume anonyme du conteneur et n'est jamais mélangé avec l'hôte.

## Fichiers d'exemple

Le dossier `samples/` contient des GPX fictifs pour tester l'import : un tracé `trk` avec
altitudes, une route `rte` sans altitude et un fichier volontairement invalide.

## Organisation du code

```
src/
  components/   interface (carte, panneau des tracés, glisser-déposer, notifications)
  hooks/        accès aux données (useTracks)
  lib/          calculs purs : parsing GPX, empreinte, emprise, sauvegarde (+ tests)
  db/           base IndexedDB (Dexie)
  services/     appels aux API externes Open-Meteo (altitudes, prévisions météo + cache)
docker/         configuration nginx
```

## Sauvegarde

« Exporter » produit un fichier `cairn-sauvegarde-AAAA-MM-JJ.json` contenant tous les
tracés et les paramètres. « Importer » le recharge en fusionnant : un tracé déjà présent
(mêmes coordonnées) n'est pas dupliqué. Pratique pour passer d'un poste à l'autre, les
données IndexedDB étant propres à chaque navigateur.

## Déploiement sur Vercel

Le projet est relié à Vercel depuis le dépôt Git.

- **Vercel construit depuis les sources, pas avec Docker.** Il exécute `npm ci` puis
  `npm run build` avec Node 22 et publie le dossier `dist/`. Cette configuration est
  versionnée dans [`vercel.json`](vercel.json) (avec la redirection de toutes les routes vers
  `index.html` et le cache longue durée des fichiers `/assets/`), la version de Node dans
  `package.json` (`engines`) et `.nvmrc`. Docker reste l'environnement de développement et de
  prod locale, inchangé.
- **Un push sur la branche principale déclenche un déploiement en production** ; un push sur
  toute autre branche crée un déploiement de prévisualisation (URL propre à la branche).
- **Avant de pousser**, vérifier que le build passe (Vercel échoue sur la moindre erreur
  TypeScript) et le tester avec `npm run preview` (voir « Commandes courantes »).
- **Aucune variable d'environnement** n'est nécessaire : toutes les API utilisées sont
  gratuites, sans clé, et appelées en HTTPS.
- **Les données restent dans le navigateur** (IndexedDB) : la version déployée démarre vide,
  même si vous avez des tracés en local. Exportez une sauvegarde JSON depuis votre version
  locale (« Sauvegarde → Exporter ») et importez-la dans la version déployée. Chaque navigateur
  et chaque appareil a ses propres données.

## Crédits

Fonds de carte : © IGN (Géoplateforme) ; © OpenTopoMap, © contributeurs OpenStreetMap.
