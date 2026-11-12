# Projet : Cairn, application de planification de randonnées (météo montagne)

## Contexte
L'application s'appelle « Cairn » (nom affiché dans l'en-tête, le titre de la page
et le favicon : un petit cairn stylisé en SVG).
Je veux une application web personnelle pour organiser mes randonnées en montagne.
J'importe des fichiers GPX trouvés sur internet. L'application affiche les tracés
sur une carte, calcule leurs statistiques et affiche des prévisions météo détaillées
par altitude, pour que je choisisse le meilleur jour et le meilleur horaire.
L'interface est entièrement en français.

## Stack et contraintes
- Vite + React + TypeScript, sans backend : tout tourne dans le navigateur.
- Carte : Leaflet (via react-leaflet).
- Parsing GPX : @tmcw/togeojson (ou DOMParser natif si plus simple).
- Stockage local persistant des tracés : IndexedDB (via idb-keyval ou Dexie).
- Graphiques : bibliothèque légère (recharts) ou SVG maison.
- Pas de clé API nécessaire : toutes les API utilisées sont gratuites et ouvertes.
- Code propre et modulaire : un dossier `services/` pour les appels API,
  `lib/` pour les calculs (géo, dénivelé, horaires), `components/` pour l'UI.
- Interface responsive : utilisable sur ordinateur et sur téléphone.

## Docker
Je travaille sur plusieurs postes (Windows, macOS, Linux) : tout l'environnement
doit tourner dans Docker. Je ne veux rien installer en local à part Docker.
- `Dockerfile` multi-stage, image de base `node:22-alpine` :
  - stage `dev` : serveur Vite avec hot reload, lancé avec `--host 0.0.0.0`.
  - stage `build` : `npm run build`.
  - stage `prod` : `nginx:alpine` qui sert le dossier `dist`, avec une config
    nginx qui renvoie `index.html` pour toutes les routes (SPA).
- `docker-compose.yml` avec deux services :
  - `dev` : port 5173, code source monté en volume pour le hot reload,
    `node_modules` dans un volume anonyme (pour ne pas mélanger avec l'hôte).
    Active le polling du watcher Vite (`server.watch.usePolling: true`), sinon
    le hot reload ne marche pas avec les volumes sous Windows et macOS.
  - `prod` : port 8080, image nginx construite.
- `.dockerignore` (node_modules, dist, .git).
- Toutes les commandes (installer une dépendance, lancer les tests, le linter)
  passent par `docker compose run --rm dev ...`. N'exécute jamais npm directement
  sur l'hôte.
- `README.md` expliquant comment lancer le projet en dev et en prod sur un
  nouveau poste en une ou deux commandes.

## Méthode de travail
Développe étape par étape, dans l'ordre ci-dessous. À la fin de chaque étape,
arrête-toi, explique-moi comment tester, et attends ma validation avant de continuer.

---

## Étape 1 : carte et import des GPX
- Carte plein écran avec un sélecteur de fond de carte :
  - Plan IGN (Géoplateforme, sans clé) :
    `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`
    (attribution : © IGN)
  - OpenTopoMap : `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png`
    (attribution : © OpenTopoMap, © contributeurs OpenStreetMap)
- Import de plusieurs fichiers GPX à la fois, par bouton et par glisser-déposer.
  Pas de limite au nombre de tracés.
- Chaque tracé est sauvegardé dans IndexedDB et rechargé au démarrage.
- Panneau latéral listant les tracés : nom (tiré du GPX ou du nom de fichier,
  modifiable), couleur, case pour afficher/masquer, bouton supprimer.
- Clic sur un tracé (liste ou carte) → il est sélectionné et la carte zoome dessus.
- Gère proprement les GPX contenant des `trk` et/ou des `rte`, et les fichiers
  invalides (message d'erreur clair, sans planter l'app).
- Export / import de sauvegarde : un bouton exporte tous les tracés et les
  paramètres dans un fichier JSON, un autre réimporte ce fichier (avec fusion :
  ne pas dupliquer un tracé déjà présent).

## Étape 2 : statistiques et profil altimétrique
- Pour chaque tracé, calcule : distance (haversine), D+, D-, altitude min,
  altitude max, coordonnées et altitude du point culminant.
- Calcul du D+/D- avec lissage : n'additionne une variation que si elle dépasse
  un seuil (hystérésis d'environ 5 m), sinon le bruit GPS gonfle le résultat.
- Si le GPX n'a pas d'altitudes (ou s'il en manque beaucoup), récupère-les via
  l'API Open-Meteo Elevation :
  `https://api.open-meteo.com/v1/elevation?latitude=..,..&longitude=..,..`
  (100 coordonnées maximum par requête : rééchantillonne le tracé et découpe
  en lots). Sauvegarde les altitudes obtenues pour ne pas refaire l'appel.
- Durée estimée selon la méthode DIN 33466 : 4 km/h à plat, 300 m/h en montée,
  500 m/h en descente ; temps total = max(temps horizontal, temps vertical)
  + la moitié du plus petit des deux. Les vitesses sont réglables dans les paramètres.
- Affiche les statistiques dans le panneau du tracé sélectionné.
- Profil altimétrique (altitude en fonction de la distance) sous la carte.
  Survoler le profil affiche un marqueur à la position correspondante sur la carte.

## Étape 2bis : améliorations des statistiques et du profil
- Pourcentages de pente :
  - au survol du profil altimétrique, afficher la pente (en %) au point survolé,
    à côté de la distance et de l'altitude ; calculée sur une fenêtre glissante
    (~100 m) pour ne pas être faussée par le bruit des altitudes ;
  - colorer le remplissage du profil par classes de pente (douce → très raide),
    avec une petite légende ;
  - ajouter aux statistiques la pente maximale en montée et en descente.
- Retéléchargement des GPX : un bouton par tracé exporte un fichier GPX 1.1
  (nom, segments, altitudes). Pour un tracé dont les altitudes ont été récupérées
  via Open-Meteo, le fichier contient la version « corrigée » (avec altitudes).

## Étape 3 : récupération de la météo
- Service `services/weather.ts` utilisant l'API Open-Meteo Forecast :
  `https://api.open-meteo.com/v1/forecast`
- Points d'échantillonnage par tracé : départ, point culminant, point le plus bas
  s'il diffère nettement du départ, et des points intermédiaires environ tous les
  400 m de dénivelé entre le plus bas et le plus haut. 8 points maximum ; fusionne
  les points distants de moins de 200 m en altitude.
- Une seule requête par tracé : Open-Meteo accepte plusieurs points séparés par
  des virgules dans `latitude`, `longitude` et `elevation` (passer l'altitude réelle
  de chaque point pour que la température soit corrigée), et renvoie un tableau.
- Paramètres :
  - `hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,freezing_level_height,temperature_850hPa,temperature_700hPa`
  - `timezone=Europe/Paris`, `forecast_days=7`
  - `models=meteofrance_seamless` par défaut (AROME/ARPEGE, bon en relief),
    avec possibilité de passer à `best_match` dans les paramètres.
- Certaines variables peuvent être nulles selon le modèle ou l'échéance :
  gère ce cas dans l'UI (afficher « – » plutôt que planter).
- Cache en mémoire et dans IndexedDB : ne pas refaire un appel pour le même tracé
  avant 1 heure. Bouton « Actualiser » pour forcer.

## Étape 4 : tableau météo par altitude (vue principale)
- Pour le tracé sélectionné, sélecteur de jour (les 7 jours à venir).
- Tableau en heatmap : une ligne par point d'échantillonnage (libellé : altitude
  + « Départ » / « Sommet » le cas échéant, le sommet en haut), une colonne par
  heure de 6h à 21h.
- Chaque case : fond coloré selon la température (échelle bleu → rouge centrée
  sur 0°C), température en grand, ressenti en petit, flèche de vent orientée avec
  sa vitesse, et icône de pluie si précipitations > 0,2 mm.
- Au-dessus du tableau, une ligne par heure : isotherme 0°C, nébulosité,
  probabilité de précipitations et pictogramme du temps (codes WMO).
- Indicateur d'inversion de température : compare température à 850 hPa (~1500 m)
  et à 700 hPa (~3000 m) avec la température au sol corrigée. Si l'air est plus
  chaud en altitude qu'en dessous, affiche un badge « Inversion probable » avec
  une courte explication au survol.
- Fais ressortir les alertes : rafales > 50 km/h au sommet, orage (codes WMO 95-99),
  ressenti < -5°C, isotherme 0°C sous le point culminant.

## Étape 5 : tracé coloré selon la prévision
- L'utilisateur choisit le jour et l'heure de départ.
- À partir de la durée DIN 33466 calculée segment par segment, estime l'heure de
  passage en chaque point du tracé.
- Colore le tracé sur la carte selon la variable choisie : température, rafales
  ou précipitations. Pour chaque segment, utilise la prévision du point
  d'échantillonnage le plus proche en altitude, à l'heure estimée de passage
  (interpolation linéaire en altitude entre les deux points les plus proches
  si possible).
- Légende de couleurs sur la carte.
- Survoler le tracé affiche : heure estimée de passage, altitude, température,
  vent, pluie.

## Étape 6 : score « meilleur jour »
- Pour chaque tracé et chaque jour des 7 prochains, calcule un score de 0 à 100
  sur la fenêtre de rando (heure de départ + durée estimée). Pénalités : pluie,
  orage, rafales au sommet, nébulosité forte au sommet, froid extrême.
  Poids réglables dans les paramètres.
- Vue récapitulative : tableau tracés × jours avec le score coloré.
  Clic sur une case → ouvre la vue météo de ce tracé ce jour-là.
- Mention claire que la fiabilité baisse fortement au-delà de 3 à 5 jours
  (atténuer visuellement les jours lointains).

---

## Pour commencer
Initialise le projet, installe les dépendances et réalise l'étape 1.
Puis arrête-toi et explique-moi comment lancer et tester l'application.