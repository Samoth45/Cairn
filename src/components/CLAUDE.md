# src/components — UI et carte Leaflet

Ces règles valent aussi pour `src/App.tsx` (état partagé, onglets, sélection d'heure).

## Composants

MapView (fonds, polylines 3 couches, marqueurs sommet / survol / points météo, AutoResize),
FitBounds, Sidebar (zone défilante : TrackPanel + liste), TrackPanel (onglets Stats | Météo du
tracé sélectionné), TrackItem, TrackStats, WeatherPanel
(+ bloc soleil, bouton vers le tableau), WeatherView (onglet Météo, heatmap), WeatherPointTooltip,
ForecastControl (panneau de coloration, en bas à gauche de la carte), PassageTooltip,
SummaryView (onglet « Meilleur jour »), ElevationProfile (SVG), SettingsDialog, HoverMarker,
DropZone, Toasts, ErrorBoundary, CairnLogo.

## Carte Leaflet

- **Renderer canvas** (`tolerance: 8` pour le clic au doigt), le tracé sélectionné est dessiné
  en dernier. Tracés en 3 couches (ombre noire + liseré blanc + couleur) pour le contraste.
  Fond IGN : maxNativeZoom 19 ; OpenTopoMap : maxNativeZoom 17.
- **Tous les marqueurs** (sommet, points météo, survol du profil) sont dans le pane Leaflet
  `cairn-markers` (z-index 450, rendu SVG) : sur le canvas des tracés, l'ordre de dessin = ordre
  d'ajout, et un tracé importé/réaffiché après un marqueur le recouvrait.
- **react-leaflet : `interactive={false}` en prop, jamais dans `pathOptions`.** `pathOptions` est
  appliqué par `setStyle` *après* l'ajout à la carte ; or Leaflet lit `interactive` à
  l'insertion (classe `leaflet-interactive` des chemins SVG). Dans `pathOptions`, la forme reste
  cliquable **en production seulement** (en dev, le StrictMode retire puis réinsère chaque couche,
  ce qui masque le bug). Bug réel corrigé : le marqueur de survol passait sous la souris et volait
  le survol du tracé coloré (infobulle qui clignote, curseur « main ouverte »).
- **Marqueur « Point culminant » = point météo « Sommet »** (mêmes coordonnées) : un seul
  marqueur (le noir), dont l'infobulle porte la météo ; le rond blanc du sommet n'est pas dessiné,
  sinon l'un masque l'autre au survol.
- **Mode coloré** : le liseré du tracé sélectionné devient **sombre** (sinon 0 °C, quasi blanc,
  disparaît sur le liseré blanc). Calcul des lignes colorées : voir `src/lib/CLAUDE.md`.
- **OpenTopoMap refuse les referrers `localhost` / `127.0.0.1`** : il renvoie des tuiles (HTTP 200)
  barrées de « Generic referrer detected. Please contact us: otm@top-o-map.com ». Vérifié : sans
  referrer, avec l'adresse Vercel ou une IP du réseau local, les tuiles sont normales. D'où
  `otmReferrerPolicy` (`lib/referrer.ts`) : `referrerPolicy: 'no-referrer'` sur la couche OTM
  **uniquement** quand la page est servie en boucle locale ; en ligne, referrer par défaut du
  navigateur (identifie honnêtement le site, comme l'attend OpenTopoMap). L'IGN accepte localhost.
- **Contrôles** : échelle et zoom en bas à droite, panneau de prévision en bas à gauche,
  bouton « ⛰ Profil » en haut à gauche (sous le bouton Cairn sur mobile).

## Dev ≠ prod (StrictMode)

Tout comportement de carte (survol, clics, couches) doit être vérifié aussi sur le build
(`npm run preview`).

Pour mesurer sans navigateur à l'écran : un conteneur jetable `node:26-alpine` +
`apk add chromium` + `puppeteer-core`, sur le réseau `cairn_default`, en visant l'IP des
conteneurs (Vite refuse les noms d'hôte inconnus) ; la carte Leaflet se retrouve via l'arbre
React (`memoizedProps.value.map`), les pixels du tracé via `getImageData` du canvas.
**Ne rien installer dans le projet pour ça.**

## Navigation et état partagé (App.tsx)

- **Onglets** : Carte / Météo (tracé sélectionné requis) / Meilleur jour (au moins un tracé).
  Sur mobile, icônes seules (`.tab-text` masqué, libellés en `aria-label`).
- **Onglets Carte / Météo** (`mainView` dans App, forcé à `map` sans tracé sélectionné) : la
  carte reste montée mais `hidden` ; `FitBounds` reçoit `active` et diffère le zoom tant que la
  carte est masquée (sinon Leaflet calcule sur une taille nulle). Le profil n'est affiché qu'en
  vue Carte.
- **Heure météo affichée** : état `HourSelection` dans App, lié à la clé de la prévision ; une
  sélection d'une autre prévision est ignorée → retour à l'heure courante au changement de tracé.
- **Jour affiché dans le tableau = jour de l'heure sélectionnée** (une seule source de vérité :
  `HourSelection`). Changer de jour garde la même heure (ou midi si hors 6–21 h).
- **Clic sur une case du « Meilleur jour »** (`openTrackDay` dans App) : `selectTrack`,
  `HourSelection` sur ce jour à l'heure de départ (bornée à 6–21 h) avec la clé de la prévision
  du tracé (identique à celle de `useWeather` : mêmes points, même modèle), jour de départ de
  l'étape 5 = ce jour, onglet Météo.
- **Jour de départ** : choix explicite (état App, non persisté) s'il est couvert par la
  prévision, sinon le jour affiché dans le panneau/tableau météo. Heure de départ et variable :
  persistées dans `Settings`.
- **Survol** : le store `useHoverPoint` porte `d` (distance) ; profil et tracé coloré l'alimentent,
  `HoverMarker` affiche l'infobulle de passage (`renderInfo`) seulement en mode coloré. Clic sur le
  tracé coloré = infobulle (pas de nouveau zoom) ; clic sur le fond de carte = fermeture.

## Lint React Hooks (règles du React Compiler)

La config `recommended` complète d'`eslint-plugin-react-hooks` 7 est active (le compilateur
lui-même ne l'est pas). Motifs retenus pour la respecter (spec `regles-react-compiler.md`) :
- **Pas de `setState` synchrone dans un effet** : mémoriser un résultat avec ce qui l'a produit
  (requête, profil…) et déduire l'état pendant le rendu (`useWeather`, survol
  d'`ElevationProfile`, statut « loading » de `useElevationFetcher`).
- **Pas de ref lue ou écrite pendant le rendu** : ref de callback mise à jour dans un effet ;
  valeur fixée une fois → état posé pendant le rendu (emprise initiale dans `App`).
- **Dépendances d'un `useMemo` / `useCallback`** : elles-mêmes mémoïsées si elles sont
  calculées (objets ou appels de fonctions), sinon `preserve-manual-memoization`.

## Mode sombre

- `Settings.theme` : `'system'` (défaut, suit l'appareil en direct) | `'light'` | `'dark'`. Le
  bouton ☾ / ☀ (à gauche de ⚙) enregistre le thème opposé à celui affiché ; on ne revient à
  `'system'` que par les Paramètres (section « Apparence » : Système / Clair / Sombre, appliqué
  à « Enregistrer » comme les autres réglages ; « Valeurs par défaut » remet Système).
- Thème appliqué par `<html data-theme="light|dark">`. Copie du réglage dans localStorage
  (`cairn-theme`) lue par un script inline de `index.html` **avant** le premier rendu : sans
  elle, flash du thème clair (IndexedDB arrive trop tard). La source de vérité reste `Settings`.
- **Toutes les couleurs d'interface passent par les variables de `:root`** (redéfinies sous
  `:root[data-theme='dark']`) : ne plus écrire de couleur en dur dans `styles.css`. Les
  couleurs de données (températures, scores, pentes, tracés) ne changent pas ; leurs cases
  « sans donnée » utilisent `var(--nodata-bg)` / `var(--muted)` (styles en ligne).
- **La carte reste intacte** (choix de l'utilisateur) : seuls les contrôles et infobulles Leaflet
  sont assombris (fin de `styles.css`) ; tuiles et marqueurs gardent leurs couleurs.

## Panneau du tracé sélectionné (TrackPanel)

- Un seul bloc en haut de la barre latérale : nom du tracé, puis onglets **Stats | Météo**
  (onglet persisté dans `Settings.sidePanelTab`, défaut Stats). Les deux contenus restent
  montés (l'inactif est `hidden`) ; la prévision est chargée par `App` quel que soit l'onglet
  (coloration et infobulles de la carte en dépendent).
- Les onglets du panneau ont pour aria-label « Stats du tracé » / « Météo du tracé » : ne pas
  reprendre « Météo », déjà utilisé par l'onglet principal (sélecteurs des sondes, lecteurs d'écran).
- Tableau météo du panneau : points clés seulement (`isKeyPoint`), « Voir les N points » pour
  déplier ; dépliage non persisté (repart replié à chaque tracé via la `key` de `WeatherPanel`).
  L'onglet principal Météo montre toujours tous les points.

## Responsive

Panneau latéral fixe ≥ 768 px, tiroir + bouton flottant en dessous.
