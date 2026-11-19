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
- **Toutes les couleurs d'interface passent par les tokens de `src/index.css`** (`:root`,
  redéfinis sous `:root[data-theme='dark']`) : pas de couleur en dur. Les couleurs de données
  (températures, scores, pentes, tracés) ne changent pas ; leurs cases « sans donnée »
  utilisent `var(--nodata)` / `var(--muted-foreground)` (styles en ligne, `lib/score.ts`,
  `lib/weatherTable.ts`).
- **La carte reste intacte** (choix de l'utilisateur) : seuls les contrôles et infobulles Leaflet
  sont assombris (`src/styles/leaflet.css`) ; tuiles et marqueurs gardent leurs couleurs.

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

## Styles : Tailwind CSS v4 + shadcn/ui (migration en cours)

Migration par lots, cf. `docs/specs/migration-ui.md` (lots 0 à 2 faits : base, police
Geist, boutons, pastilles, icônes, fenêtre Paramètres). Recette visuelle : `docs/recette/` (captures avant/après
sur le build).

- **Fichiers CSS** :
  - `src/index.css` : entrée ; ordre des couches `theme, base, legacy, components, utilities` ;
    tokens (`:root` + `[data-theme='dark']`), `@theme inline`, variante `dark:` sur
    `data-theme` (pas de classe `.dark`) ;
  - `src/styles/legacy.css` : l'ancienne feuille, dans la couche `legacy`, que chaque lot
    vide ; elle commence par un bloc qui rétablit les styles du navigateur effacés par le
    preflight, **sauf** pour les éléments shadcn (`[data-slot]`) ;
  - `src/styles/leaflet.css` : surcharges de Leaflet, **hors couche** (sinon elles perdraient
    contre `leaflet.css`, lui aussi hors couche).
- **Tokens** : noms shadcn. **Attention : `--accent` = fond de sélection** (l'ancien
  `--selected`), le vert principal est **`--primary`** ; **`--muted-foreground`** = texte
  discret (l'ancien `--muted`), `--muted` = fond discret. `--input` = contour des champs
  (contraste 3:1), distinct de `--border` (séparateurs). Contrastes vérifiés par
  `docs/recette/contrastes.mjs`.
- **Dossiers** : `src/components/ui/` = composants shadcn, ajoutés **uniquement par le CLI**
  (`npx shadcn@latest add …` dans le conteneur ; retouches minimes et commentées) ;
  `src/components/` = composants métier, qui composent les `ui/` sans redéfinir leur style de
  base.
- **`cn()`** (`src/lib/utils.ts`, réexporte le paquet `cn` de shadcn) pour combiner des classes
  conditionnelles ou accepter un `className` ; pas de gabarits `${…}` à la main. Seule
  exception d'interface dans `src/lib/` (fonctions pures).
- **Extraire un composant** dès qu'une combinaison de classes revient 3 fois ou porte un sens
  (ex. `MapControl` pour les contrôles flottants sur la carte).
- **`@apply`** interdit dans les composants ; toléré dans les CSS dédiés (Leaflet) pour du DOM
  qu'on ne contrôle pas.
- **Pas de couleur en dur** dans une classe (`bg-[#…]`) : un token. Couleurs de **données** en
  `style` en ligne. Valeurs arbitraires (`p-[7px]`) à éviter : si une valeur revient, en faire
  un token.
- **Mobile** : un seul point de rupture, `max-md:` (< 768 px) / `md:`.
- **Ordre des classes** (pas de Prettier) : position, boîte, espacement, typographie, couleurs,
  états, puis variantes `max-md:` et `dark:`. `dark:` seulement pour une vraie exception (les
  tokens changent seuls avec `data-theme`).
- **Dépendances** : `shadcn` (CLI + `shadcn/tailwind.css`) en devDependency ; `radix-ui`,
  `lucide-react`, `cn`, `class-variance-authority`, `tw-animate-css` ; police Geist
  (`@fontsource-variable/geist`).
- **Police Geist** : `@font-face` dans `src/index.css` (sous-ensemble **latin** seulement, pris
  dans le paquet), `--font-sans` ; `legacy.css` et `leaflet.css` (infobulles de la carte) la
  reprennent par `--theme(--font-sans)`. L'espace fine des milliers (U+202F) n'est pas dans
  Geist : elle vient de la police de repli, c'est normal.
- **Boutons** (`ui/button.tsx`, retouché, repères « Cairn ») : `default` = bouton principal
  (vert, gras, survol `--primary-hover`) ; `outline` = bouton neutre (ancien `.btn`) ; `ghost`
  = bouton icône discret ; `link` + taille **`inline`** = bouton-lien dans le texte (taille et
  graisse du texte autour, aligné à gauche) ; taille `lg` = 40 px (« Importer des GPX »). Les
  boutons ont une **hauteur fixe et pas de retour à la ligne** : pour un libellé long, ajouter
  `h-auto min-h-8 py-1.5 whitespace-normal` (ex. « Télécharger le GPX (altitudes corrigées) »).
- **`IconButton`** (`src/components/IconButton.tsx`) : bouton icône (ghost, 28 px, 32 px sur
  mobile) ; toujours un `aria-label`, l'icône Lucide en enfant (taille 16 px par défaut, déjà
  `aria-hidden`). Suppression : `className="hover:text-destructive"`.
- **Pastilles** (`ui/badge.tsx`) : variantes ajoutées `muted` (compteur de tracés) et
  `warning` (« Inversion probable », tokens `--warning-*`).
- **Icônes** : Lucide, importées une par une (`import { X } from 'lucide-react'`). Les emojis
  et symboles de **données** restent du texte (météo, ▲ du sommet, onglets de vue jusqu'au lot 6).
- **Lint** : la règle `react-refresh/only-export-components` est coupée pour
  `src/components/ui/` (les fichiers shadcn exportent aussi leurs variantes cva).
- **Superpositions** : utilitaires `z-map-control` (1000), `z-map-tabs`, `z-backdrop`,
  `z-sidebar`, `z-toast`, `z-dropzone`, `z-modal` (4000), `z-popover` (4100), déclarés par
  `@utility` dans `src/index.css`. **Jamais le `z-50` de shadcn** : il passe sous les contrôles
  de Leaflet (800 à 1000) ; le remplacer dans le fichier `ui/` (cf. `dialog.tsx`).
- **Listes déroulantes** : `<select>` natif stylé (`ui/native-select.tsx`), **pas le Select de
  Radix** (15,7 kB gzip, écarté au lot 2, spec Q5). Sur mobile : menu du téléphone.
- **Champs** (`Input`, `NativeSelect`) : fond `bg-card` (retouché ; `--input` est la couleur du
  contour, pas un fond) et texte 16 px sur mobile (pas de zoom automatique sur iPhone).
- **Fenêtre (`Dialog`)** : montée par le parent seulement quand elle est ouverte (`open`
  toujours vrai, `onOpenChange(false)` → fermer) ; c'est ce qui remet les brouillons à zéro.
  Sans `DialogTrigger`, Radix ne rend pas le focus au bouton d'ouverture : mémoriser
  `document.activeElement` à l'ouverture et le refocaliser dans `onCloseAutoFocus` ; mettre le
  focus sur la fenêtre (et non le 1er champ) dans `onOpenAutoFocus`, sinon le clavier s'ouvre
  sur mobile. Modèle : `SettingsDialog.tsx`.
- **`fieldset` / `legend` / `p` hors shadcn** : le bloc de compatibilité de `legacy.css` leur
  rend les styles du navigateur (bordure `groove`, marges) ; les utilitaires gagnent, mais
  préciser `border-solid`, `m-0`, `min-w-0`.
- **Chunk `radix`** (`vite.config.ts`) : primitives Radix et leurs dépendances (focus, blocage
  du défilement) à part, comme Leaflet. Y ajouter toute nouvelle dépendance de ce type.
