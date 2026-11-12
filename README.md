# Cairn

Application web personnelle de planification de randonnées en montagne : import de tracés
GPX, carte IGN / OpenTopoMap et, à terme, statistiques et météo détaillée par altitude.
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

## Crédits

Fonds de carte : © IGN (Géoplateforme) ; © OpenTopoMap, © contributeurs OpenStreetMap.
