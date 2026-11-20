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

Pour mesurer sans navigateur à l'écran : écrire une sonde puppeteer (dans le dossier
temporaire) et la lancer sur le build par **`sh docs/recette/run.sh sonde <script.mjs>`**
(conteneur jetable, Chromium, URL du build en argument, GPX de test dans `/samples` ; mode
d'emploi dans `docs/recette/README.md`). La carte Leaflet se retrouve via l'arbre React
(`memoizedProps.value.map`), les pixels du tracé via `getImageData` du canvas. **Ne rien
installer dans le projet pour ça.**

## Navigation et état partagé (App.tsx)

- **Onglets** : Carte / Météo (tracé sélectionné requis) / Meilleur jour (au moins un tracé).
  Sur mobile, icônes seules (libellés masqués, `aria-label` conservés).
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

## Styles : Tailwind CSS v4 + shadcn/ui

Toute l'interface est en utilitaires dans le JSX (migration terminée le 20/11/2026, bilan dans
`docs/specs/migration-ui.md`). Recette visuelle : `docs/recette/` (captures avant/après sur le
build, à relancer pour tout changement d'interface d'ampleur).

**Fichiers CSS** (les seuls)
- `src/index.css` : entrée Tailwind, police Geist (`@font-face`, sous-ensemble latin),
  tokens (`:root` + `[data-theme='dark']`), `@theme inline`, variante `dark:` sur `data-theme`
  (pas de classe `.dark`), `@utility z-*`. L'espace fine des milliers (U+202F) n'est pas dans
  Geist : elle vient de la police de repli, c'est normal. Couche `base` : hauteur de ligne `normal` sur `html`
  (le preflight impose 1,5), **main sur les boutons** (Tailwind v4 laisse le curseur par
  défaut), page sans défilement.
- `src/styles/leaflet.css` : surcharges de Leaflet, **hors couche** (sinon elles perdraient
  contre `leaflet.css`, lui aussi hors couche) ; reprend la police par `--theme(--font-sans)`.

**Règles de code**
- **Preflight** : les éléments HTML (`h1`, `p`, `ul`, `button`, `fieldset`…) n'ont ni marge, ni
  bordure, ni taille de titre : tout par utilitaires (`my-4`, `text-xl font-bold`…).
  `fieldset` : `border-solid` et `min-w-0`. Liseré d'un seul côté : `border-0 border-l-4`.
- **Hauteur de ligne** : `text-sm`, `text-base`… imposent 1,43 / 1,5, plus que le `normal` de
  la page. Dans les blocs denses (stats, tableaux) : `text-sm/tight`, `leading-tight`.
- **Tokens** : noms shadcn. **`--accent` = fond de sélection**, le vert principal est
  **`--primary`** ; `--muted-foreground` = texte discret, `--muted` = fond discret ;
  `--input` = contour des champs (contraste 3:1), pas un fond ; `--border` = séparateurs.
  Contrastes mesurés par `docs/recette/contrastes.mjs`.
- **Pas de couleur en dur** dans une classe : un token. Couleurs de **données** (températures,
  scores, pentes, tracés) en `style` en ligne. Valeurs arbitraires `[…]` à éviter.
- **`cn()`** (`src/lib/utils.ts`) pour les classes conditionnelles ; pas de gabarits `${…}`.
  **`@apply`** interdit dans les composants (toléré dans `leaflet.css`).
- **Mobile** : un seul point de rupture, `max-md:` (< 768 px) / `md:`.
- **Ordre des classes** (pas de Prettier) : position, boîte, espacement, typographie,
  couleurs, états, puis `max-md:` et `dark:` (seulement pour une vraie exception : les tokens
  changent seuls).
- **Extraire** dès qu'une combinaison revient 3 fois ou porte un sens. Partagés dans
  `src/components/classes.ts` : `LABEL_CAPS`, `SUB_LINE`, `MAP_CONTROL` (contrôle posé sur la
  carte), `TIP` (infobulles de la carte), `FULL_SCREEN_MESSAGE`, `SPINNER`.
- **Icônes** : Lucide, importées une par une. Emojis et symboles de **données** (météo, ▲)
  restent du texte. `IconButton` : ghost 28 px (32 px mobile), toujours un `aria-label`, icône
  Lucide en enfant (16 px, déjà `aria-hidden`) ; suppression : `hover:text-destructive`.
- **Superpositions** : `z-map-control` (1000), `z-map-tabs`, `z-backdrop`, `z-sidebar`,
  `z-toast`, `z-dropzone`, `z-modal` (4000), `z-popover` (4100). **Jamais le `z-50` de
  shadcn** : il passe sous les contrôles de Leaflet (800 à 1000) ; le remplacer dans le
  fichier `ui/` (cf. `dialog.tsx`).
- **Dépendances** : `radix-ui`, `lucide-react`, `cn`, `class-variance-authority`,
  `tw-animate-css`, `@fontsource-variable/geist` ; `shadcn` (CLI) en devDependency. Chunk
  `radix` à part dans `vite.config.ts` (y ajouter toute dépendance de ce type). Lint :
  `react-refresh/only-export-components` coupée pour `ui/`.

**Composants shadcn** : `src/components/ui/`, ajoutés **uniquement par le CLI** (`npx
shadcn@latest add …` dans le conteneur ; retouches minimes, repérées par « Cairn » en
commentaire). Les composants métier (`src/components/`) composent les `ui/` sans redéfinir
leur style de base.
- **Button** : `default` principal (vert, gras, survol `--primary-hover`) ; `outline` neutre ; `ghost` icône ; `link` +
  taille `inline` = lien dans le texte ; `lg` = 40 px. Hauteur fixe, pas de retour à la ligne :
  pour un libellé long, `h-auto min-h-8 py-1.5 whitespace-normal`.
- **Badge** : variantes `muted` (compteur) et `warning`. **Alert** : `warning`, `destructive`
  (fond teinté), `info` ; `role="note"` pour une simple information (sinon annoncée par les
  lecteurs d'écran à chaque rendu).
- **Listes déroulantes** : `<select>` natif stylé (`native-select.tsx`), **pas le Select de
  Radix** (+15,7 kB gzip). `className` va au conteneur, `selectClassName` au `<select>`.
- **Champs** (`Input`, `NativeSelect`, `Checkbox`) : fond `bg-card` (retouché : pas de
  `bg-input/30`, `--input` est un contour). `Input` et `NativeSelect` : texte 16 px sur mobile
  (pas de zoom iPhone). `Checkbox` : `onCheckedChange={(v) => …(v === true)}` (la valeur peut
  être `'indeterminate'`).
- **Dialog** : montée par le parent seulement quand elle est ouverte (`open` toujours vrai) ;
  c'est ce qui remet les brouillons à zéro. Sans `DialogTrigger`, mémoriser
  `document.activeElement` et le refocaliser dans `onCloseAutoFocus` ; focus sur la fenêtre
  (pas le 1er champ) dans `onOpenAutoFocus`, sinon le clavier s'ouvre sur mobile. Modèle :
  `SettingsDialog.tsx`.
- **Tabs** : variante `pill` (panneau du tracé) ; contenus gardés montés : `forceMount` +
  `data-[state=inactive]:hidden`. Onglets principaux (`App.tsx`) : sans `TabsContent`,
  `activationMode="manual"` (les flèches ne changent pas de vue à chaque pas) ; onglet
  désactivé avec `title` : `disabled:pointer-events-auto` (sinon pas d'infobulle).
- **ToggleGroup** `type="single"`, variante `chip` (jours de la Météo) : ignorer la valeur
  vide dans `onValueChange` (re-clic sur l'élément actif).
- **Table** : sans survol si les lignes ne sont pas cliquables (`hover:bg-transparent`).
  Tableau à colonne figée (`SummaryView`, `WeatherView`) : `border-separate border-spacing-0`
  (en `border-collapse`, les cellules `sticky` perdent leurs bordures), bordures sur les
  cellules, cellule figée `sticky left-0 z-2 bg-card` ; états cumulables d'une case combinés
  par `cn()` dans l'ordre de priorité, la dernière classe de fond l'emportant (`headState`).
  Un `Input` dans une ligne flexible : `shrink-0` (son `min-w-0` le laisse sinon couper la
  valeur).

**Composants de mise en page**
- **Vues plein écran** (Météo, Meilleur jour) : habillage dans `ViewShell.tsx` (`ViewSection`,
  `ViewHeader`, `ViewPlaceholder`, `ViewFooter`) ; toute nouvelle vue du même type le reprend.
- **Tiroir mobile** (`Sidebar.tsx`) : pas de Sheet ; `aside` avec `data-open`, glissement par
  `max-md:-translate-x-full` / `max-md:data-[open=true]:translate-x-0`, ombre `shadow-drawer` ;
  fond grisé et bouton « Cairn » dans `App.tsx`. L'outil de captures le repère par
  `aside[aria-label="Tracés"]`.
- **Profil SVG** : couleurs par utilitaires (`stroke-border`, `fill-muted-foreground`…),
  épaisseurs et pointillés en attributs (`strokeWidth`, `strokeDasharray`).
