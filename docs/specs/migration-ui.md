# Migration de l'interface vers Tailwind CSS v4 + shadcn/ui

Statut : en cours (spec validée le 18/11/2026, décisions en §9) — lots 0 à 8 faits (19-20/11/2026)

Source : `docs/BACKLOG-spec-migration-ui.md`. Cette spec ne migre rien : elle sert de feuille de
route. Chaque lot du §5 est une tâche autonome, exécutable par Claude Code dans une session
dédiée, et vérifiable visuellement par le propriétaire du projet.

Mesures relevées le 17/11/2026 sur `develop` (commit `6f7a51c`, Vite 8.3.8).

---

## 1. Résumé

- **Pourquoi** : tout le style tient dans une seule feuille `src/styles.css` de 1 804 lignes.
  On y trouve 20 tailles de police, 22 valeurs d'espacement et 13 ombres différentes, des
  motifs recopiés et un bloc mobile coupé en deux. La faire évoluer coûte cher.
- **Quoi** : passer à **Tailwind CSS v4**, dont la configuration s'écrit en CSS, et à
  **shadcn/ui**, des composants Radix copiés dans le projet. La migration se fait en 10 lots
  (0 à 9), chacun laissant le site fonctionnel et déployable.
- **Résultat attendu** : les couleurs, tailles et espacements forment un jeu de valeurs nommées
  et réduit (des *design tokens*). Les boutons, champs, onglets et fenêtres deviennent des
  composants communs. Il ne reste du CSS à part que pour la carte Leaflet et les graphiques.
  **Aucun changement de fonctionnement.**

> **Pourquoi migrer quand même (Q1).** L'audit est plus favorable que ce qu'annonçait le
> backlog. Le CSS est déjà organisé (variables, mode sombre complet), et on n'a trouvé **aucune
> règle morte** (§2.3). Le gain porte donc sur la cohérence, la facilité d'évolution et une
> stack moderne, pas sur un grand ménage. Le propriétaire a choisi la migration complète en
> connaissance de cause.
>
> **Deux changements visibles sont voulus** : la police **Geist** à la place de la police
> système (Q9), et des contrastes corrigés là où ils sont insuffisants (Q11). Tout le reste
> doit rester identique, aux arrondis près (Q2).

---

## 2. État des lieux (Epic 1)

### 2.1 Cartographie (story 1.1)

**Technique**
- Le projet est en **TypeScript strict**, sans aucun fichier JavaScript.
  - `tsconfig.json` ne fait que référencer `tsconfig.app.json` (code de `src`) et
    `tsconfig.node.json` (`vite.config.ts`).
  - **Il n'y a aucun alias de chemin** (`paths` absent), donc tous les imports sont relatifs.
- `vite.config.ts` contient :
  - le plugin `react()` ;
  - les réglages du serveur dev (polling) ;
  - un `codeSplitting` qui sépare Leaflet dans son propre fichier ;
  - la configuration Vitest (jsdom).

**Versions**

| Élément | Version |
| --- | --- |
| React / React DOM | 19 (`^19.1.0`) |
| Vite | 8.3.8 (Rolldown, Lightning CSS) |
| `@vitejs/plugin-react` | 6.3.0 |
| TypeScript | 6.0.3 |
| Node | 26 (`Dockerfile` : `node:26-alpine` ; `.nvmrc` : `26` ; `engines` : `26.x`) |
| Leaflet / react-leaflet | 1.9 / 5 |

**Fichiers de style**
- **Point d'entrée CSS** : `src/main.tsx:3`, `import 'leaflet/dist/leaflet.css'`, puis
  `src/main.tsx:4`, `import './styles.css'`. Ce sont les deux seules feuilles.
- **Styles en ligne** (`style={{…}}`) : 14 occurrences dans 7 fichiers. Toutes portent des
  **couleurs de données** calculées : tracé, pente, température, score. Elles doivent rester en
  ligne (§2.4).

| Fichier | Lignes |
| --- | --- |
| `ElevationProfile.tsx` | 112, 118, 130 |
| `ForecastControl.tsx` | 70 |
| `MapView.tsx` | 266 |
| `SummaryView.tsx` | 121, 158, 205 |
| `TrackItem.tsx` | 43 |
| `TrackPanel.tsx` | 41 |
| `WeatherView.tsx` | 277, 326, 336, 379 |

- **Script en ligne** dans `index.html` : il pose le thème clair ou sombre (`data-theme`) avant
  le premier affichage, d'après `localStorage`.

**Écran → composants → CSS utilisé.** Toutes les règles viennent de `src/styles.css` ; la
colonne de droite donne les plages de lignes concernées.

| Écran / zone | Composants (`src/components/`, sauf `App.tsx`) | Règles de `src/styles.css` |
| --- | --- | --- |
| Socle (toute l'app) | `App.tsx`, `main.tsx`, `ErrorBoundary` | variables 1-77 ; base 79-95 ; mise en page 97-109, 743-752 ; états chargement/erreur 1035-1053 ; utilitaires `.muted` 739, `.link-btn` 1444-1457, `.spinner-text` 1459-1476 |
| Barre latérale | `Sidebar`, `TrackItem`, `CairnLogo` | 754-948 (dont les boutons `.btn`, `.icon-btn`) ; mobile 1056-1094 |
| Panneau du tracé | `TrackPanel`, `TrackStats`, `WeatherPanel` | 1104-1199 ; météo du panneau 1201-1319 ; soleil 1321-1355 ; mobile 1680-1687 |
| Onglet **Carte** | `MapView`, `FitBounds`, `HoverMarker`, `ForecastControl`, `ElevationProfile`, `PassageTooltip`, `WeatherPointTooltip` | onglets Carte/Météo/Meilleur jour 354-394 ; panneau de coloration 111-203 ; infobulles 1357-1399 ; pentes 1415-1442 ; profil 1478-1574 ; mobile 1657-1678, 1689-1738 ; Leaflet en sombre 1741-1803 |
| Onglet **Météo** | `WeatherView` | 396-737 ; mobile 1700-1706 |
| Onglet **Meilleur jour** | `SummaryView` | 205-352 ; mobile 1726-1733 |
| Mobile (tiroir) | `App.tsx` (bouton, fond grisé), `Sidebar` | 950-969 ; 1056-1101 |
| Fenêtre Paramètres | `SettingsDialog` | 1401-1413, 1576-1654 |
| Superpositions | `DropZone`, `Toasts` | 971-991 ; 993-1033 ; mobile 1096-1101 |

**Ailleurs dans `src/`** :
- `hooks/` : 7 hooks ;
- `lib/` : fonctions de calcul pures et testées ;
- `services/` : réseau et cache ;
- `db/` : base Dexie.

Rien de visuel dans ces dossiers, donc rien n'y est concerné par la migration.

### 2.2 Métriques « avant » (story 1.2)

**Comment ces chiffres ont été obtenus**
- Feuille de style : analyse de `src/styles.css` par un script PostCSS en lecture seule, lancé
  dans le conteneur.
- Bundle : `npm run build`, configuration inchangée.

| Métrique | Avant | Après (§10) |
| --- | --- | --- |
| Feuilles CSS maison | 1 (`src/styles.css`) | |
| Lignes de CSS maison | 1 804 | |
| Règles / sélecteurs / déclarations | 262 / 275 / 959 | |
| Classes CSS distinctes | 187 | |
| Variables de couleur (`:root`) | 32, redéfinies en sombre (44-77) | |
| Couleurs littérales distinctes | 66 (61 dans les variables, 5 en dur : 976, 1013, 1581, 1771, 1791) | |
| Valeurs d'espacement distinctes | 22 | |
| Tailles de police distinctes | 20 | |
| Rayons d'angle distincts | 9 | |
| Ombres distinctes | 13 | |
| Niveaux de superposition (`z-index`) | 8 | |
| Media queries | 2, **même point de rupture** `max-width: 767px` (1056 et 1656) | |
| `!important` | 4 | |
| `style={{…}}` dans le JSX | 14 (7 fichiers) | |
| Build : CSS maison | 22,19 kB (5,34 kB gzip) | |
| Build : CSS Leaflet | 15,09 kB (6,36 kB gzip) | |
| Build : JS de l'app | 397,55 kB (127,71 kB gzip) | |
| Build : JS Leaflet | 167,42 kB (49,36 kB gzip) | |
| Build : runtime | 0,59 kB | |
| Dépendances UI | 0 | |

Le build tourne sans aucune modification de configuration.

### 2.3 Qualité du CSS (story 1.3) — problèmes classés par priorité

**Priorité 1 — source de bugs ou d'incohérences**

1. **Bloc mobile coupé en deux** : `@media (max-width: 767px)` apparaît en 1056-1102 **et** en
   1656-1739. Les réglages mobiles d'un même composant sont donc dispersés.
2. **Déclaration écrasée sans le vouloir** : dans le second bloc mobile, `.view-tabs button`
   est défini deux fois. Le `padding: 5px 10px` de la ligne 1697 est remplacé par le
   `padding: 5px 12px` de la ligne 1722, donc la ligne 1697 ne sert à rien.
3. **4 `!important`**, chacun là pour gagner une bataille de spécificité :
   - `.st-cell` (285) et `.wt-cell` (654) contre `.wtable th, .wtable td { padding: 0 }`
     (547-551) ;
   - `.sun-advice` (1347) et `.sun-warning` (1352) contre `.sun p { margin: 0 }` (1331).
4. **Règle qui dépend de l'ordre et de la spécificité** : `.field.field-select` (1401-1404).
   Le commentaire de la ligne 1401 l'explique : sans cette spécificité, `.field` (1616),
   déclaré plus bas, l'emporte.

**Priorité 2 — doublons et motifs recopiés**

5. **Champs de saisie stylés 5 fois** de la même façon (`font: inherit`, `padding`, bordure,
   rayon de 6 px) :
   - `.fc-panel select, .fc-panel input` (136) ;
   - `.sview-departure input` (212) ;
   - `.track-name-input` (892) ;
   - `.field select` (1406) ;
   - `.field input` (1625).
6. **Onglets « pilule » écrits deux fois** : `.view-tabs` (355-388) et `.track-panel-tabs`
   (1113-1142). L'état actif est identique dans les deux (380 = 1134, bloc détecté comme
   doublon exact).
7. **Contrôle flottant sur la carte**, même fond, même ombre `0 1px 5px rgba(0,0,0,.3)` et même
   arrondi, recopié 4 fois : `.view-tabs` (366), `.panel-toggle` (963), `.profile-open`
   (1572), et `.fc-panel` (121, avec une ombre presque identique).
8. **Petit libellé en capitales** (taille 0.68–0.8rem, `uppercase`, espacement des lettres)
   recopié 4 fois : `.track-list-header` (792), `.stats-grid dt` (1161), `.weather-summary dt`
   (1267), `.weather-table th` (1288).
9. **Doublons exacts** :
   - `.stable` (229) = `.wtable` (540) ;
   - `.map-area` (743) = `.profile-chart` (1518) ;
   - `.st-cell.clickable .st-btn:hover` (307) = `.wt-cell.selected` (681).
10. **Encadré « avertissement »** identique (fond `--warn-bg`, bordure `--warn-border`,
    rayon de 8 px) : `.sview-warning` (220) et `.sun` (1322).
11. **Pastilles** : `.badge` (496) et `.count` (803) font la même chose avec des valeurs
    différentes.

**Priorité 2 — valeurs « magiques »**

12. **20 tailles de police**. Les plus fréquentes : 0.8rem et 0.85rem (×13 chacune), 0.75rem
    (×9), 0.7rem (×7). Certaines sont à peine différentes : 0.65 / 0.68 / 0.7 / 0.72 rem, ou
    0.8 / 0.82 / 0.85 / 0.88 rem. On trouve aussi un `10.5px` isolé (1537).
13. **22 espacements**. La plupart tombent sur la grille Tailwind de 2 et 4 px : 8 px (×36),
    6 px (×33), 10 px (×32), 4 px (×21). Hors grille : 3, 5, 7 et 9 px. Il y a aussi des
    positions spéciales (58, 60, 64 px) qui dépendent de la hauteur des contrôles de la carte.
14. **13 ombres**, avec des noirs translucides écrits en dur : `rgba(0,0,0,.3)` ×6,
    `rgba(0,0,0,.25)`, `.18`, `.35`, `.6`.
15. **Le fond sombre est recopié en dur** au lieu de passer par `var(--panel)` :
    `rgba(30,36,40,.8)` (1791) et `rgba(30,36,40,.7)` (1800).
16. **8 niveaux de superposition** sans échelle documentée : 2, 1000, 1001, 1050, 1100, 2500,
    3000, 4000.

**Priorité 3 — risques de collision avec Tailwind**

17. **Noms de classes génériques** :
    - `.muted` (739), `.count` (803), `.empty` (812), `.hint` (1639), `.badge` (496) ;
    - dans le profil SVG : `.grid`, `.axis`, `.cursor` (1530-1545).

    **`.grid` est aussi une classe Tailwind** (`display: grid`). Tailwind la générera dès
    qu'il trouvera le mot `grid` dans le code, et elle s'appliquera aux lignes du profil.
    C'est sans effet visible sur un `<line>` SVG, mais c'est un piège à éviter : renommer
    en lot 6.

**Règles mortes**

18. **Aucune règle morte trouvée.** Les classes `rel-*` et `walert-*`, qui paraissaient
    inutilisées, sont construites dynamiquement dans `SummaryView.tsx:110,201` et
    `WeatherView.tsx:170`.

    À l'inverse, 7 classes du JSX n'ont aucune règle CSS : `stats`, `sview`,
    `track-panel-body`, `wday-name`, `wt-arrow`, `wt-col`, `slope-unit`. Ce sont des noms
    sans effet, à supprimer pendant la migration.

**Responsive et mode sombre**

19. **Un seul point de rupture**, 767 px. Il correspond exactement au préfixe Tailwind `max-md:`
    (moins de 768 px).
20. **Mode sombre complet**, entièrement par variables (44-77), piloté par
    `<html data-theme>`. Les contrôles Leaflet ont leur propre adaptation au thème sombre
    (1741-1803).

### 2.4 Zones sensibles (story 1.4) — à ne pas migrer naïvement

| Zone | Dépendance et chargement du CSS | Recommandation |
| --- | --- | --- |
| **Carte** | Leaflet 1.9 + react-leaflet 5. `leaflet/dist/leaflet.css` est importé en `main.tsx:3`, avant notre feuille, et sort dans un fichier à part au build. Les tracés sont dessinés sur un canvas, sans CSS. | **Garder le CSS de Leaflet intact.** Le *preflight* de Tailwind (sa remise à zéro des styles, §4) impose `max-width: 100%` et `display: block` aux `img`/`svg` : ça casse les tuiles et les marqueurs de Leaflet. Parade au lot 0. |
| **Leaflet en mode sombre** | Surcharges `[data-theme='dark'] .leaflet-*` (1741-1803) | Les déplacer **telles quelles** dans un CSS dédié `src/styles/leaflet.css`. |
| **Infobulles de la carte** | `.leaflet-tooltip.wx-tooltip-wrap` (1358), classe passée par prop à react-leaflet (`MapView.tsx:279,292`, `HoverMarker.tsx:28`). Le contenu est du JSX rendu dans le DOM de Leaflet. | Laisser l'enveloppe en CSS dédié et passer le **contenu** en Tailwind (`WeatherPointTooltip`, `PassageTooltip`). |
| **Profil altimétrique** | SVG maison (`ElevationProfile.tsx`), classes `.grid`, `.axis`, `.cursor`, `.summit-mark` (1530-1551). Couleurs de pente en ligne. | Garder le SVG. Ses classes passent en utilitaires Tailwind (`stroke-border`, `fill-muted-foreground`…) ou dans un CSS dédié. **Renommer `.grid`.** Pas de bibliothèque de graphiques (règle du CLAUDE.md). |
| **Couleurs de données** | 14 `style={{…}}` (§2.1) : températures, pentes, scores, couleurs des tracés | **Restent en ligne** : ce sont des valeurs calculées, pas des styles d'interface. |
| **Tableau météo (heatmap)** | `.wtable` (540-684) : colonne figée (`position: sticky`, 554-567), filtre « nuit » (672), contours de sélection | Migrer en dernier (lot 8), avec captures avant/après. Garder `sticky` et `filter`. |
| **Animations** | Rotation de `.spinner-text` (1459-1476), glissement du tiroir mobile (1064) | Utiliser `animate-spin` et `transition-transform` de Tailwind. Rien de spécial. |
| **Thème avant le premier affichage** | Script en ligne de `index.html` + `useTheme` (`data-theme`) | shadcn suppose une classe `.dark` par défaut. Il faut déclarer une variante sombre basée sur `data-theme` (§3.3). **Ne pas toucher au script.** |
| **Pastille de couleur des tracés** | `<input type="color">` invisible posé sur une pastille (`.track-color input`, 871-878) | Garder ce mécanisme. Le recopier en utilitaires Tailwind. |

---

## 3. Cible (Epic 2)

### 3.1 Design tokens (story 2.1)

**Attention aux noms.** Chez shadcn, `--accent` désigne le **fond de survol ou de sélection**
et `--muted` un **fond discret**. Chez nous, `--accent` est la couleur principale (le vert) et
`--muted` est une couleur de **texte**. Faire correspondre les noms tels quels inverserait les
rôles : il faut suivre le tableau ci-dessous.

**Correspondance des couleurs (valeurs actuelles en clair / sombre)**

| Variable actuelle (ligne) | Clair | Sombre | Token cible |
| --- | --- | --- | --- |
| `--bg` (2/45) | #f6f5f1 | #14181b | `--background` |
| `--text` (5/48) | #22292f | #e2e6e8 | `--foreground`, `--card-foreground`, `--popover-foreground` |
| `--panel` (3/46) | #ffffff | #1e2428 | `--card`, `--popover`, `--input-background`¹ |
| `--border` (4/47) | #e2e0d8 | #343c42 | `--border`, `--input` |
| `--muted` (6/49) | #6b7378 | #9ba4aa | `--muted-foreground` |
| *(nouveau)* | = `--bg` | = `--bg` | `--muted` (fond discret : `.count`, survol de ligne) |
| `--accent` (7/50) | #2f6f4f | #6cbf93 | `--primary`, `--ring` |
| `--on-accent` (11/54) | #ffffff | #0f2219 | `--primary-foreground` |
| `--accent-hover` (8/51) | #255a40 | #86cfa7 | `--primary-hover`¹ (shadcn utilise `primary/90` : cf. Q2) |
| `--selected` (9/52) | #eaf3ee | #213a2d | `--accent` (fond de sélection), `--accent-foreground` = `--foreground` |
| *(nouveau)* | = `--panel` | = `--panel` | `--secondary` (bouton neutre `.btn`), `--secondary-foreground` = `--foreground` |
| `--danger` (10/53) | #b3261e | #f28b82 | `--destructive` |
| `--warn-bg`, `--warn-border`, `--badge-*`, `--warn-text` (16-20) | | | `--warning`, `--warning-border`, `--warning-foreground`¹ (fusion de `--badge-*` avec `--warn-*` : cf. Q2) |
| `--error-bg` (21) | | | `--destructive-muted`¹ |
| `--info-bg`, `--info-border`, `--info-text` (22-24) | | | `--info`, `--info-border`, `--info-foreground`¹ |
| `--gold` (25), `--faint` (26) | | | `--gold`¹, `--faint`¹ |
| `--gauge-*`, `--night-*`, `--nodata-bg`, `--cell-sep`, `--swatch-outline` (27-33) | | | gardés tels quels, en tokens propres à l'app¹ (préfixe `--color-` dans `@theme`) |
| `--panel-glass`, `--overlay-glass` (13-14) | | | `--card-glass`, `--overlay-glass`¹ |
| *(n'existe pas)* | | | `--chart-*`, `--sidebar-*` de shadcn : **non utilisés** |

¹ Token propre à Cairn : il n'existe pas chez shadcn et s'ajoute à côté des siens.

**Rayons d'angle**

shadcn calcule ses rayons à partir de `--radius` : `sm` = `--radius` − 4 px, `md` = − 2 px,
`lg` = `--radius`, `xl` = + 4 px. Avec **`--radius: 0.625rem`** (10 px) :

| Valeur actuelle | Token cible | Écart |
| --- | --- | --- |
| 6 px ×7 | `rounded-sm` | aucun |
| 8 px ×9 | `rounded-md` | aucun |
| 10 px ×4 | `rounded-lg` | aucun |
| 12 px (1593) | `rounded-xl` (14 px) | +2 px |
| 2–3 px | `rounded-xs` (2 px) | jusqu'à −1 px |
| 16 px | `rounded-2xl` | aucun |
| 999 px et 50 % | `rounded-full` | aucun |

**Ombres** : 3 niveaux au lieu de 13.

| Niveau | Valeur | Remplace |
| --- | --- | --- |
| `shadow-float` | `0 1px 5px rgb(0 0 0 / .3)` | contrôles sur la carte (121, 366, 963, 1572) |
| `shadow-overlay` | `0 4px 16px rgb(0 0 0 / .18)` | notifications (1013), tiroir mobile (1065) |
| `shadow-modal` | `0 10px 40px rgb(0 0 0 / .3)` | fenêtre (1595) |

Les ombres en `inset` (contours de sélection 332, 461, 662, 678, 846) deviennent des `ring-*` ou
des `outline-*` Tailwind. Elles restent liées aux couleurs.

**Superpositions** : une échelle nommée, sans changer l'ordre actuel.

| Token | Valeur | Usage actuel |
| --- | --- | --- |
| `z-map-control` | 1000 | 116, 956, 1567 |
| `z-map-tabs` | 1001 | 360 |
| `z-backdrop` | 1050 | 1084 |
| `z-sidebar` | 1100 | 762 |
| `z-toast` | 2500 | 998 |
| `z-dropzone` | 3000 | 975 |
| `z-modal` | 4000 | 1580 |
| `z-popover` | 4100 | nouveau : menus et popovers éventuels (au-dessus de la carte **et** de la fenêtre Paramètres) ; inutilisé depuis le choix du `<select>` natif (Q5) |

Ces valeurs doivent rester **au-dessus de 1000**, car les contrôles de Leaflet sont à
`z-index` 800-1000. Le `z-index: 2` de la colonne figée (558) reste local.

**Tailles de police** : 7 tailles au lieu de 20. La racine reste à 16 px.

| Token | Taille | Remplace | Écart max |
| --- | --- | --- | --- |
| `text-2xs`¹ | 0.6875rem (11 px) | 0.65, 0.68, 0.7, 0.72 rem, 10.5 px | 0,6 px |
| `text-xs` | 0.75rem (12 px) | 0.75, 0.78 rem | 0,5 px |
| `text-sm` | 0.875rem (14 px) | 0.8, 0.82, 0.85, 0.88, 0.9 rem | **+1,2 / −0,4 px** |
| `text-base` | 1rem | 0.95, 1, 1.05 rem | 0,8 px |
| `text-lg` | 1.125rem | 1.1, 1.15, 1.2 rem | 1,2 px |
| `text-xl` | 1.25rem | 1.35rem (titre) | 1,6 px |
| `text-2xl` | 1.5rem | 1.5rem (icône d'infobulle) | aucun |

Le passage de 0.8rem à `text-sm` agrandit **26 textes** d'environ 1 px. C'est un choix visible :
cf. Q2.

**Espacements** : on prend l'échelle Tailwind, dont le pas est de 4 px avec des demi-pas.
Exemples : `1` = 4 px, `1.5` = 6 px, `2.5` = 10 px.
- Les valeurs 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40 et 48 px existent telles quelles.
- Les valeurs hors grille sont arrondies à 1 px près : 3 → 4 (ou `0.5` + bordure), 5 → 4 ou
  6, 7 → 8, 9 → 8. Cf. Q2.
- Les positions liées aux contrôles de la carte (58, 60, 64 px) deviennent des valeurs nommées
  (`--map-controls-offset`) plutôt que des nombres isolés.

**Police : Geist** (Q9), une police libre (licence OFL) de Vercel.
- **Hébergée avec le site**, par le paquet npm `@fontsource-variable/geist` : un seul fichier
  variable `woff2`, qui couvre toutes les graisses. On n'appelle **aucun service externe**
  (pas de Google Fonts). Le site n'ajoute donc aucune dépendance réseau, et la police
  s'affiche même hors ligne une fois le site en cache.
- **Repli** sur la pile système actuelle (ligne 36) tant que la police n'est pas chargée
  (`font-display: swap`).
- **Chiffres en colonnes** : `font-variant-numeric: tabular-nums` est utilisé partout dans les
  tableaux, et Geist le prend en charge.
- **Effet attendu** : Geist est plus étroite ou plus large selon les caractères que les
  polices système. Les textes tronqués (`…`) peuvent couper à un autre endroit : noms de
  tracés, onglets, en-têtes du tableau météo. C'est à contrôler par capture au lot 1.
- **Poids** : environ 30 à 70 kB de fichier de police selon les sous-ensembles retenus. On
  garde le latin seulement, l'interface étant en français. Ce poids est **hors budget JS**
  (Q12) mais il est mesuré.

**Bloc de thème proposé (dans la spec seulement, pas dans le code)**

```css
@import 'tailwindcss';
@import './styles/legacy.css' layer(legacy);   /* pendant la transition, cf. §4 */

/* Mode sombre piloté par <html data-theme="dark"> (script d'index.html + useTheme). */
@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));

:root {
  --radius: 0.625rem;
  --background: #f6f5f1;   --foreground: #22292f;
  --card: #ffffff;         --card-foreground: #22292f;
  --popover: #ffffff;      --popover-foreground: #22292f;
  --primary: #2f6f4f;      --primary-foreground: #ffffff;  --primary-hover: #255a40;
  --secondary: #ffffff;    --secondary-foreground: #22292f;
  --muted: #f6f5f1;        --muted-foreground: #6b7378;
  --accent: #eaf3ee;       --accent-foreground: #22292f;
  --destructive: #b3261e;  --destructive-muted: #fdecea;
  --border: #e2e0d8;       --input: #e2e0d8;  --ring: #2f6f4f;
  --warning: #fff8e6;      --warning-border: #f3e0b0;  --warning-foreground: #8a5300;
  --info: #e8f1fb;         --info-border: #2f6fb3;     --info-foreground: #1f4f8a;
  --gold: #b8860b;         --faint: #9aa0a6;
  --card-glass: rgb(255 255 255 / .96);  --overlay-glass: rgb(255 255 255 / .92);
  --gauge: #eef2f5;  --gauge-fill: #b8c4cc;
  --night: #eceef3;  --night-foreground: #8a8f99;  --night-accent: #3949ab;
  --nodata: #eceae4; --cell-sep: rgb(255 255 255 / .6);  --swatch-outline: rgb(0 0 0 / .25);
  --sidebar-w: 320px;
  color-scheme: light;
}

[data-theme='dark'] {
  --background: #14181b;   --foreground: #e2e6e8;
  --card: #1e2428;         --card-foreground: #e2e6e8;
  --popover: #1e2428;      --popover-foreground: #e2e6e8;
  --primary: #6cbf93;      --primary-foreground: #0f2219;  --primary-hover: #86cfa7;
  --secondary: #1e2428;    --secondary-foreground: #e2e6e8;
  --muted: #14181b;        --muted-foreground: #9ba4aa;
  --accent: #213a2d;       --accent-foreground: #e2e6e8;
  --destructive: #f28b82;  --destructive-muted: #3e2321;
  --border: #343c42;       --input: #343c42;  --ring: #6cbf93;
  --warning: #362f1e;      --warning-border: #5e4e28;  --warning-foreground: #f0c674;
  --info: #1b2c3f;         --info-border: #5b9bdc;     --info-foreground: #9cc4f0;
  --gold: #e3b341;         --faint: #6f787e;
  --card-glass: rgb(30 36 40 / .96);  --overlay-glass: rgb(30 36 40 / .92);
  --gauge: #2a3135;  --gauge-fill: #56636b;
  --night: #181c20;  --night-foreground: #6f767f;  --night-accent: #a5adff;
  --nodata: #2c3236; --cell-sep: rgb(30 36 40 / .7);  --swatch-outline: rgb(255 255 255 / .3);
  color-scheme: dark;
}

/* Expose les variables à Tailwind : bg-primary, text-muted-foreground, border-border… */
@theme inline {
  --color-background: var(--background);  --color-foreground: var(--foreground);
  --color-card: var(--card);              --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);        --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);        --color-primary-foreground: var(--primary-foreground);
  --color-primary-hover: var(--primary-hover);
  --color-secondary: var(--secondary);    --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);            --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);          --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive); --color-destructive-muted: var(--destructive-muted);
  --color-border: var(--border);  --color-input: var(--input);  --color-ring: var(--ring);
  --color-warning: var(--warning);  --color-warning-border: var(--warning-border);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);  --color-info-border: var(--info-border);
  --color-info-foreground: var(--info-foreground);
  --color-gold: var(--gold);  --color-faint: var(--faint);
  --color-card-glass: var(--card-glass);  --color-overlay-glass: var(--overlay-glass);
  --color-gauge: var(--gauge);  --color-gauge-fill: var(--gauge-fill);
  --color-night: var(--night);  --color-night-foreground: var(--night-foreground);
  --color-night-accent: var(--night-accent);
  --color-nodata: var(--nodata);  --color-cell-sep: var(--cell-sep);
  --color-swatch-outline: var(--swatch-outline);
  --radius-xs: 2px;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --text-2xs: 0.6875rem;
  --shadow-float: 0 1px 5px rgb(0 0 0 / .3);
  --shadow-overlay: 0 4px 16px rgb(0 0 0 / .18);
  --shadow-modal: 0 10px 40px rgb(0 0 0 / .3);
  --font-sans: 'Geist Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
```

**Mode sombre** : les valeurs sombres proposées sont **exactement les valeurs actuelles**. Rien
ne change à l'œil. Les deux seules nouveautés sont `--muted` et `--secondary`, qui reprennent
des couleurs déjà présentes.

**Contrastes (Q11, corrigés au lot 0)** : au lot 0, on mesure le contraste de chaque couple
texte/fond, dans les deux thèmes, avec la formule WCAG 2.x (calcul par script, sans outil à
installer). Tout couple utilisé pour du texte et sous **4,5:1** est assombri en clair, ou
éclairci en sombre, juste assez pour passer ce seuil. On garde la même teinte : seule la
luminosité change.
- Candidats probables : `--muted-foreground` (#6b7378 sur #f6f5f1) et `--faint` (#9aa0a6).
- Les nouvelles valeurs remplacent celles du bloc ci-dessus, et le tableau de correspondance
  est complété par une colonne « corrigée ».
- Les contours d'éléments d'interface (bordures de champs, cases) visent **3:1**.

### 3.2 Éléments d'interface → composants shadcn (story 2.2)

| Élément actuel (fichier) | Composant shadcn | Remarques |
| --- | --- | --- |
| `.btn`, `.btn.primary`, `.btn.small` (921-948, 1196) : import, actualiser, télécharger, actions de la fenêtre | **Button** (`default`, `secondary`/`outline`, taille `sm`) | La variante `default` utilise `bg-primary` et `hover:bg-primary-hover`. |
| `.icon-btn` (901-918) : renommer, supprimer, thème, paramètres, fermer | **Button** `variant="ghost" size="icon"` | Variante `danger` au survol : classe `hover:text-destructive`. Icônes **Lucide** (Q4) : `Moon`/`Sun` (thème), `Settings`, `X` (fermer), `Pencil` (renommer), `Download`, `Trash2`, `ChevronLeft`/`ChevronRight` (navigation d'heure). La correspondance exacte de chaque caractère actuel est à relever au lot 1. |
| `.link-btn` (1444-1457), `.weather-more` | **Button** `variant="link"` | |
| Onglets Carte / Météo / Meilleur jour (`.view-tabs`, `App.tsx`) | **Tabs** (`TabsList` en pilule) | Ils pilotent l'affichage (`mainView`) ; les vues restent montées comme aujourd'hui. Libellés masqués sur mobile : `max-md:sr-only`. |
| Onglets Stats / Météo du tracé (`TrackPanel.tsx`) | **Tabs** | Ils remplacent la gestion clavier maison (←/→/Début/Fin). **Garder** les `aria-label` « Stats du tracé » / « Météo du tracé ». |
| Fenêtre Paramètres (`SettingsDialog.tsx`, 1576-1654) | **Dialog** + **Input** + **Label** + **NativeSelect** + **RadioGroup** (thème Système/Clair/Sombre) | Le comportement « appliqué à Enregistrer » ne change pas. Les `fieldset`/`legend` restent, stylés en Tailwind. |
| Champs : `.field input` (1625), `.track-name-input` (892), heure de départ (`.fc-panel input`, `.sview-departure input`) | **Input** | `type="time"` et `type="number"` sont conservés. |
| Listes déroulantes : modèle météo, variable de coloration (`.field select`, `.fc-panel select`) | **NativeSelect** (`<select>` natif stylé, Q5 révisée au lot 2) | Le menu reste celui du navigateur ou du téléphone : pas de *portal* ni de `z-index` à gérer. Le Select de Radix, essayé au lot 2, coûtait 15,7 kB gzip. |
| Case « visible » d'un tracé (`.track-toggle`, 853) | **Checkbox** | |
| Pastille de couleur (`.track-color`, 860-878) | *aucun équivalent* | Composant maison en Tailwind, en gardant l'`<input type="color">` invisible. |
| Bloc du tracé sélectionné (`.track-panel`, 1105) | **Card** | |
| Tableau météo du panneau (`.weather-table`, 1282-1310), tableau « Meilleur jour » (`.stable`) | **Table** | Les cases colorées restent en `style` en ligne. |
| Tableau météo par altitude (`.wtable`, 540-684) | *pas d'équivalent direct* | Composant maison : colonne figée, cases colorées, nuit, sélection. **Table** ne sert que de base. |
| Pastilles « inversion » (`.badge`, 496), compteur de tracés (`.count`, 803), jours (`.wday-chip`, 446) | **Badge** (badge, compteur) ; **ToggleGroup** ou boutons pour les jours | Les jours forment une liste de choix exclusifs : ToggleGroup convient. |
| Alertes météo (`.walert`, 520-531), avertissement « Meilleur jour » (`.sview-warning`, 220), bloc soleil (`.sun`, 1322) | **Alert** (variantes `destructive`, `info`, `warning` à ajouter) | |
| Notifications (`Toasts.tsx`, 994-1033) | *composant maison* en Tailwind (Q6) | Pas de Sonner. On garde le fonctionnement actuel : succès/erreur, liste d'erreurs d'import, fermeture. Réutiliser les tokens et le style d'**Alert**. |
| Tiroir mobile (`.sidebar` < 768 px + `.backdrop` + `.panel-toggle`) | **Sheet** (côté gauche), **à décider au lot 4** | Le Sheet gère le piège du focus et la touche Échap. Le choix final est fait au lot 4, avec la liste des problèmes mobiles que le propriétaire ajoutera au backlog (Q7). |
| Infobulles natives (`title=…` sur les boutons, en-têtes de jours, badges) | **Tooltip** (facultatif) | Les `title` actuels marchent. Les remplacer n'est pas nécessaire. |
| Zone de dépôt (`DropZone.tsx`, 972-991) | *aucun* | Composant maison en Tailwind. |
| Panneau de coloration sur la carte (`ForecastControl.tsx`, 112-203) | **Card** + **Select** + **Input** | Légende de couleurs maison. |
| Infobulles de la carte (`WeatherPointTooltip`, `PassageTooltip`) | *aucun* | L'enveloppe reste Leaflet ; le contenu passe en Tailwind. |
| Profil altimétrique (`ElevationProfile.tsx`) | *aucun* | Le SVG maison est gardé. L'en-tête (légende des pentes) passe en Tailwind. |
| Spinner (`.spinner-text`, 1459) | *aucun* (icône Lucide `LoaderCircle` + `animate-spin`) | |
| Séparateurs (bordures de l'en-tête et de la liste) | **Separator** (facultatif) | |

**Composants à ajouter avec le CLI**, chacun au lot qui l'utilise :

```bash
npx shadcn@latest add button badge input label checkbox card tabs dialog \
  radio-group native-select table alert toggle-group separator
# au lot 4, selon la liste des problèmes mobiles (Q7) : sheet
# facultatif : tooltip
```

Pas de `sonner` (Q6).

Tous ces appels passent par Docker (cf. §4).

### 3.3 Conventions (story 2.3)

Cette section est rédigée pour être recopiée dans `src/components/CLAUDE.md` à la fin du lot 0.

- **Dossiers**
  - `src/components/ui/` : composants shadcn, ajoutés **uniquement par le CLI**. Les retouches
    y restent minimes et signalées par un commentaire.
  - `src/components/` : composants métier. Ils composent les `ui/` et ne redéfinissent pas
    leur style de base.
- **`cn()`** (`src/lib/utils.ts`, créé par shadcn) : à utiliser pour combiner des classes
  conditionnelles ou accepter un `className` venu du parent. Ne pas construire de gabarits
  `${…}` à la main. Ce fichier est la seule exception d'interface dans `src/lib/`, qui reste
  réservé aux fonctions pures.
- **Quand extraire un composant** : dès qu'une même combinaison de classes revient **3 fois**,
  ou qu'elle porte un sens (exemple : `MapControl` pour les contrôles flottants sur la carte).
- **`@apply`** : interdit dans les composants, sauf dans les CSS dédiés de la liste suivante,
  pour styler du DOM qu'on ne contrôle pas (Leaflet).
- **Seuls fichiers CSS autorisés à la fin** :
  - `src/index.css` : imports Tailwind, thème, variante sombre ;
  - `src/styles/leaflet.css` : surcharges et thème sombre de Leaflet, enveloppe des
    infobulles ;
  - éventuellement `src/styles/profile.css`, si le SVG du profil reste en classes CSS.
- **Couleurs** : jamais de couleur en dur dans une classe (`bg-[#…]`). On passe par un token.
  Les **couleurs de données** (températures, pentes, scores, tracés) restent en `style` en
  ligne.
- **Valeurs arbitraires** (`p-[7px]`) : à éviter. Si une valeur revient, en faire un token.
- **Mobile** : un seul point de rupture, avec `max-md:` (moins de 768 px) ou `md:`.
- **Ordre des classes** : pas d'outil automatique (le projet n'a pas Prettier, cf. Q8). L'ordre
  à suivre est le suivant : position, boîte, espacement, typographie, couleurs, états,
  variantes `max-md:` et `dark:`.
- **Mode sombre** : les tokens changent seuls avec `data-theme`. On n'écrit `dark:` que pour
  une vraie exception.

---

## 4. Installation de la base (story 3.1)

Toutes les commandes passent par **Docker**, jamais par l'hôte. Le Git Bash de Windows
réécrit les chemins commençant par `/` : préfixer les commandes par `MSYS_NO_PATHCONV=1`
(cf. `CLAUDE.local.md`).

**Procédure**

1. **Dépendances**

   ```bash
   docker compose run --rm dev npm install tailwindcss @tailwindcss/vite
   ```

   Ensuite, au moment du `shadcn init` : `class-variance-authority`, `clsx`,
   `tailwind-merge`, `lucide-react` (Q4) et `tw-animate-css`. Les primitives Radix arrivent
   avec chaque composant ajouté.

   La police Geist (`@fontsource-variable/geist`, Q9) est installée **au lot 1**, pas au
   lot 0 : celui-ci doit rester sans changement visible, à part les contrastes.
2. **Plugin Vite** : dans `vite.config.ts`, `plugins: [react(), tailwindcss()]`. Ne pas
   toucher aux réglages `server.*`, `codeSplitting` et `test`.
3. **Alias `@` → `src`**, exigé par shadcn. Le projet n'en a aucun aujourd'hui, il faut
   l'ajouter à trois endroits :
   - `tsconfig.json` : `compilerOptions.paths` `{"@/*": ["./src/*"]}`. Le CLI shadcn lit ce
     fichier.
   - `tsconfig.app.json` : les mêmes `paths`. Pas de `baseUrl`, déprécié depuis TypeScript 6 ;
     les `paths` relatifs suffisent.
   - `vite.config.ts` : `resolve.alias` `{ '@': path.resolve(__dirname, 'src') }`, ou
     `resolve.tsconfigPaths` si Vite 8 le permet. À vérifier au moment du lot.
4. **CSS d'entrée** :
   - Renommer `src/styles.css` en `src/styles/legacy.css`.
   - Créer `src/index.css` (Tailwind, `@import './styles/legacy.css' layer(legacy)`, bloc de
     thème du §3.1).
   - Dans `main.tsx`, importer `leaflet.css` **puis** `index.css`.
5. **`npx shadcn@latest init`** dans le conteneur :
   - bibliothèque de base **Radix** (Q3), style « new-york », couleur de base neutre ;
   - CSS : `src/index.css`, variables CSS : oui ;
   - **refuser** le remplacement des variables par celles de shadcn, puisqu'on garde le bloc
     du §3.1 ;
   - résultat : création de `components.json` et `src/lib/utils.ts`.
6. **Reconstruire l'image** : `docker compose build dev`, puis `docker compose up --build -V
   dev`. Le `-V` est indispensable, sinon le volume `node_modules` reste périmé.
7. **Resynchroniser le lockfile**, puis `npm ci --dry-run`, puis `/verifier` complet.

**Vercel et CI** : rien à changer. `npm ci` puis `npm run build` installent et compilent
Tailwind comme le reste, et il n'y a aucune variable d'environnement. Contrôler quand même :
- `vercel build` hors ligne, comme au lot CD ;
- la présence, dans le lockfile, des binaires natifs Linux de `@tailwindcss/oxide`
  (`@tailwindcss/oxide-linux-x64-gnu`), au même titre que ceux de Rolldown.

**Coexistence avec l'ancien CSS : conflits et parades**

| Conflit | Effet | Parade |
| --- | --- | --- |
| Le **preflight** (remise à zéro de Tailwind) impose `img, svg { display: block; max-width: 100% }` | Tuiles et icônes Leaflet déformées ou décalées | Dans `src/styles/leaflet.css` : `.leaflet-container img, .leaflet-container svg { max-width: none; max-height: none; display: initial }`. Les règles de Leaflet, hors couche, l'emportent déjà. Vérifier par capture. |
| Le preflight retire les **bordures et le fond** des `button`, `input`, `select` et la **marge** des titres, listes et `fieldset` | Les éléments pas encore migrés perdent leur aspect natif | L'ancienne feuille, importée dans la couche `legacy` placée **après** `base`, redonne leurs styles aux classes existantes. Les éléments sans classe sont à lister et à vérifier au lot 0 : `h1`/`h2`, `ul` de `Toasts`, `fieldset`. |
| **Ordre des couches** : une règle hors couche bat toutes les règles en couche | Si l'ancienne feuille restait hors couche, elle écraserait les utilitaires Tailwind ajoutés pendant la migration | Ordre explicite `@layer theme, base, legacy, components, utilities;`. Les utilitaires gagnent toujours, et l'ancienne feuille garde ses règles tant qu'on ne les remplace pas. |
| Les **variables** portent le même nom avec un sens différent (`--accent`, `--muted`) | Couleurs inversées pendant la transition | Au lot 0, dans la couche `legacy`, renommer l'usage des anciennes variables : `--accent` devient `--primary`, et `--muted` (texte) devient `--muted-foreground`. Chercher et remplacer dans `legacy.css`, puis faire des captures. |
| Thème sombre : shadcn attend `.dark` | Les composants shadcn restent clairs en mode sombre | `@custom-variant dark` sur `[data-theme='dark']` (§3.1). Ne pas toucher à `index.html`. |
| La classe utilitaire `grid` de Tailwind tombe sur `.grid` du profil SVG | Aucun effet visible, mais confusion | Renommer en `profile-grid` (lot 6). |
| Les variables `--radius`, `--shadow-*` et `--text-*` pourraient entrer en collision avec celles de Tailwind | Arrondis ou tailles inattendus | Les déclarer **uniquement** dans `@theme`, avec les noms du §3.1. |

---

## 5. Plan de migration par lots (story 3.2)

Les lots vont du moins risqué au plus risqué, et chacun laisse le site fonctionnel et
déployable. **Démarrage de chaque lot** :
1. lire cette spec (§3 et le lot) et `src/components/CLAUDE.md` ;
2. créer la branche du lot (§7) ;
3. faire les captures « avant » (§6).

**Fin de chaque lot** :
1. `/verifier` et `npm ci --dry-run` ;
2. captures « après » et recette (§6) ;
3. mettre à jour les métriques de suivi (lignes de `legacy.css`, poids CSS et JS) ;
4. attendre la validation, puis faire le commit.

### Lot 0 — Base Tailwind + shadcn, contrastes corrigés (M)
- **Fichiers** : `package.json` et lockfile, `vite.config.ts`, `tsconfig.json`,
  `tsconfig.app.json`, `src/main.tsx`, `src/index.css` (nouveau), `src/styles.css` →
  `src/styles/legacy.css`, `src/styles/leaflet.css` (nouveau : lignes 1741-1803 et 1358-1362
  déplacées), `components.json`, `src/lib/utils.ts`.
- **Travail** :
  - procédure du §4 ;
  - renommage des variables dans `legacy.css` ;
  - parade du preflight pour Leaflet ;
  - variante sombre ;
  - conventions (§3.3) recopiées dans `src/components/CLAUDE.md` ;
  - **contrastes (Q11)** : mesure WCAG de tous les couples texte/fond dans les deux thèmes,
    puis correction des valeurs sous 4,5:1, en dernier commit du lot pour isoler ce
    changement visible ;
  - **outil de captures** (§6) : écriture de la sonde et enregistrement de la réponse météo
    de référence (Q10).
- **CSS supprimé** : aucun, il est seulement déplacé.
- **Composants shadcn** : aucun.
- **Fini quand** :
  - avant la correction des contrastes, les captures avant/après sont **identiques** dans les
    2 thèmes et aux 2 largeurs (tolérance : anticrénelage) ;
  - après, seules les couleurs corrigées diffèrent, avec un tableau « avant → après » des
    valeurs et des rapports de contraste ;
  - le build passe et `vercel build` passe.

**Résultat du lot 0 (réalisé le 19/11/2026, branche `ui/lot-0-base`)**
- **Captures** : base Tailwind + shadcn = **0 différence sur 20** par rapport à « avant ».
  L'outil est reproductible : deux passages du même code donnent 0 différence.
- **Compatibilité avec le preflight** : on n'a pas eu à lister les éléments un par un. Le haut
  de `legacy.css` applique `all: revert` aux éléments que le preflight remet à zéro (titres,
  paragraphes, listes, tableaux, champs, boutons…), avec une spécificité nulle (`:where`) et
  **sauf** pour les composants shadcn (`:not([data-slot])`). Les styles du navigateur
  reviennent ainsi pour l'ancienne interface, et toute règle de `legacy.css` l'emporte.
- **Leaflet** : rien de cassé, captures identiques. La règle de sécurité
  `max-width: none` sur `.leaflet-container img, svg` est en place.
- **`shadcn init`** avec `-t vite -b radix -p nova` (preset Nova = Radix, Lucide, Geist).
  Retouches :
  - ses couleurs grises par défaut sont remplacées par nos tokens ;
  - son bloc `.dark`, ses tokens graphiques et sidebar sont retirés ;
  - son `button.tsx` est retiré (prévu au lot 1) ;
  - la CLI `shadcn` est passée en **devDependency** : elle ne sert qu'à fournir
    `shadcn/tailwind.css` au build, et elle entraîne environ 250 paquets.
  - `cn()` vient du paquet officiel `cn` (dépôt shadcn-ui/cn), qui remplace `clsx` +
    `tailwind-merge`.
  - La police Geist est installée mais pas branchée (lot 1).
- **Contrastes (Q11)** : 12 couples sous le seuil, tous corrigés (`docs/recette/contrastes.mjs`
  : 0 sous le seuil).

  | Token | Clair (avant → après) | Sombre (avant → après) |
  | --- | --- | --- |
  | `--muted-foreground` | #6b7378 → #666d72 (4,27 → 4,64:1 au pire) | inchangé (4,85:1) |
  | `--faint` | #9aa0a6 → #6b6f73 (2,42 → 4,63:1) | #6f787e → #858c91 (3,49 → 4,61:1) |
  | `--night-foreground` | #8a8f99 → #676b72 (2,80 → 4,64:1) | #6f767f → #7f858d (3,73 → 4,60:1) |
  | `--input` (nouveau, contour des champs) | = `--border` #e2e0d8 → #8c8b86 (1,21 → 3,13:1) | #343c42 → #6a7074 (1,40 → 3,11:1) |

  `--border` (séparateurs, décoratifs) ne change pas. Les 4 règles de champs de `legacy.css`
  passent de `var(--border)` à `var(--input)`. Effet sur les captures : moins de 0,3 % des
  pixels sur la plupart des vues (0,7 % au plus, Paramètres mobile).
- **Mesures** :

  | | Avant | Après le lot 0 |
  | --- | --- | --- |
  | JS de l'app (gzip) | 127,71 kB | 127,72 kB (budget Q12 : +0,01 kB sur 30) |
  | CSS de l'app | 22,19 kB (5,34 gzip) | 40,25 kB (9,08 gzip) : preflight, tokens, utilitaires |
  | CSS Leaflet | 15,09 kB | 15,09 kB |
  | Lignes de CSS maison | 1 804 | 1 679 (`legacy.css`) + 82 (`leaflet.css`) + 189 (`index.css`) |

- **`npm audit`** : l'alerte picomatch a disparu. Il reste 4 « moderate » sur `minimatch`,
  tirées par la CLI `shadcn` (devDependency, rien dans le site), cf. `docs/deploiement.md`.

### Lot 1 — Police Geist, boutons, icônes et pastilles (M)
- **Fichiers** : `package.json` (`@fontsource-variable/geist`), `src/main.tsx` (import de la
  police), `src/index.css` (`--font-sans`), `Sidebar.tsx`, `TrackItem.tsx`, `TrackStats.tsx`,
  `WeatherPanel.tsx`, `SettingsDialog.tsx` (boutons seuls), `App.tsx` (boutons « Profil » et
  « Cairn »), `ElevationProfile.tsx` (bouton fermer).
- **Travail** :
  1. **Police Geist** (Q9), en premier commit, avec des captures dédiées. Contrôler les
     troncatures (noms de tracés, onglets, en-têtes du tableau météo) et l'alignement des
     chiffres.
  2. Remplacer `.btn`, `.icon-btn`, `.link-btn`, `.badge` et `.count` par Button et Badge.
  3. **Icônes Lucide** (Q4) à la place des caractères ☾ ☀ ⚙ ✕ ✎, etc. Garder les
     `aria-label` et les `title` actuels.
- **CSS supprimé** : 496-509, 803-810, 901-948, 1196-1199, 1444-1457.
- **Composants shadcn** : `button`, `badge`.

**Résultat du lot 1 (réalisé le 19/11/2026, branche `ui/lot-1-police-boutons`)**
- **Police Geist** : `@font-face` maison dans `src/index.css`, qui ne garde que le sous-ensemble
  latin du paquet (29,4 kB ; italique 31 kB, chargée seulement si affichée). Appliquée aussi
  aux infobulles et contrôles de Leaflet (avant : Helvetica). Captures : pas de nouvelle
  troncature ; les jours de la vue Météo mobile tiennent même sur une ligne. L'espace fine des
  milliers (U+202F) est absente de Geist et vient de la police de repli, comme avant.
- **Boutons** : variantes shadcn retouchées (repères « Cairn » dans `ui/button.tsx`) :
  `default` vert et gras avec `--primary-hover`, `outline` = ancien `.btn`, `ghost` = ancien
  `.icon-btn`, nouvelle taille `inline` pour les boutons-liens, `lg` à 40 px. Composant
  `IconButton` (28 px, 32 px sur mobile). Pastilles : variantes `muted` (compteur) et
  `warning` (inversion) ; `--badge-bg` / `--badge-border` fusionnés dans `--warning-*` (Q2).
- **Icônes Lucide** : `Moon`/`Sun`, `Settings`, `X`, `Pencil`, `Download`, `Trash2`,
  `ChevronLeft`/`ChevronRight`, `Thermometer` (tableau météo), `Mountain` (bouton « Profil »).
  Gardés en texte : le ▲ du sommet (même symbole que la carte et le profil), les emojis météo
  et les onglets de vue (lot 6).
- **Hors des fichiers prévus** : les boutons de `Toasts`, `ErrorBoundary`, `SummaryView` et
  `WeatherView` sont migrés aussi, pour pouvoir supprimer `.btn` et `.icon-btn`. Règle ESLint
  `react-refresh/only-export-components` coupée pour `src/components/ui/`.
- **Écarts visibles (Q2)** : boutons icônes un peu plus larges (le nom des tracés se coupe une
  lettre plus tôt) ; boutons de la fenêtre Paramètres tous à 32 px (« Enregistrer » faisait
  40 px) ; « Voir les 3 points » en 14 px (12,8 avant) ; contour de focus visible au clavier.
- **Correction pendant la recette** : les boutons shadcn ont une hauteur fixe et ne passent pas à
  la ligne ; « Télécharger le GPX (altitudes corrigées) » débordait sur PC. Ce bouton a une
  hauteur libre et autorise le retour à la ligne.
- **Mesures** :

  | | Après le lot 0 | Après le lot 1 |
  | --- | --- | --- |
  | JS de l'app (gzip) | 127,72 kB | 143,62 kB (budget Q12 : **+15,9 kB sur 30**, relevé ensuite à 50) |
  | CSS de l'app | 40,25 kB (9,08 gzip) | 50,75 kB (10,71 gzip) |
  | Police | — | 29,4 kB (+ 31 kB d'italique si affichée) |
  | Lignes de CSS maison | 1 679 + 82 + 189 | 1 542 (`legacy.css`) + 88 + 207 |

  La hausse du JS vient surtout du paquet `cn` (environ 10,8 kB gzip, installé au lot 0 mais
  utilisé pour la première fois), puis de Lucide, `Slot` de Radix et cva. Alternatives
  mesurées : `clsx` + `tailwind-merge` 8,5 kB, `cn build` (tables compilées par un plugin
  Vite) 7,8 kB ; gain trop faible pour en changer. Les composants restants (Dialog, Select,
  Tabs…) devraient ajouter 20 à 25 kB, au-delà du budget de 30 kB : **budget relevé à +50 kB
  gzip** le 19/11/2026 (Q12). Le Select de Radix, d'abord gardé (Q5), a été remplacé au
  lot 2 par le `<select>` natif.

### Lot 2 — Fenêtre Paramètres et champs (M)
- **Fichiers** : `SettingsDialog.tsx`.
- **Travail** : Dialog, Input, Label, RadioGroup (thème), **Select de Radix** (Q5) pour le
  modèle météo (remplacé en cours de lot par le `<select>` natif, cf. résultat).
  - Vérifier sur mobile (390 px) : ouverture au doigt, fermeture et défilement de la liste.
  - Le menu doit s'afficher au-dessus de la fenêtre (`z-popover`).
  - **Garder** : Enregistrer, Valeurs par défaut, Annuler, Échap et le clic hors de la
    fenêtre.
  - Vérifier que le focus revient bien au bouton ⚙ à la fermeture.
- **CSS supprimé** : 1401-1413, 1576-1654.
- **Composants shadcn** : `dialog`, `input`, `label`, `radio-group`, `select`.

**Résultat du lot 2 (réalisé le 19/11/2026, branche `ui/lot-2-parametres`)**
- **Fenêtre** : Dialog de Radix (`open` toujours vrai, montée par `App` seulement quand elle est
  ouverte), Input, Label, RadioGroup pour le thème (Système / Clair / Sombre au lieu d'une
  liste). `fieldset`/`legend` gardés, en Tailwind (`border-solid`, `m-0`, `min-w-0` : le
  bloc de compatibilité de `legacy.css` leur rend les styles du navigateur).
- **Liste du modèle météo : `<select>` natif** (`native-select` de shadcn, Q5 révisée). Le
  Select de Radix a été implémenté puis retiré : il coûtait **15,7 kB gzip** (Radix Select,
  `floating-ui`, popper) et menait le total à +50,8 kB.
- **Focus** : Radix met le focus sur le 1er champ à l'ouverture (clavier ouvert sur mobile) :
  il est mis sur la fenêtre. Radix ne rend le focus qu'à un `DialogTrigger`, que nous n'avons
  pas : la fenêtre mémorise l'élément actif à l'ouverture (⚙) et le lui rend.
- **Superpositions** : utilitaires `z-map-control` … `z-modal`, `z-popover` (échelle du
  §3.1) dans `index.css` ; la fenêtre et son voile sont en `z-modal`.
- **Retouches des fichiers shadcn** (commentées) : fond `bg-card` des champs (et non
  `bg-input/30` en sombre, `--input` étant notre couleur de contour), voile noir 35 % sans
  flou, `shadow-modal`, hauteur bornée avec défilement, « Close » → « Fermer », texte 16 px
  sur mobile pour la liste (pas de zoom sur iPhone).
- **Build** : primitives Radix et dépendances (focus, blocage du défilement) dans un chunk
  `radix` (`vite.config.ts`), sinon le chunk de l'app dépassait 500 kB (avertissement).
- **Recette** : sonde headless sur le build (PC et mobile) : Échap, clic dehors, focus rendu
  à ⚙, choix du modèle, Enregistrer, Valeurs par défaut, Annuler, aucune erreur console.
  Captures : seules les 4 vues Paramètres changent. L'outil attend désormais
  `[role="dialog"]` (et plus `.modal`).
- **Écarts visibles** : fenêtre de 448 px (440 avant) ; champs en 16 px sur mobile ; thème en
  boutons radio ; liste du modèle plus large (nom complet sur PC).
- **Mesures** :

  | | Après le lot 1 | Après le lot 2 |
  | --- | --- | --- |
  | JS de l'app (gzip) | 143,62 kB | 162,87 kB = 143,93 (app) + 18,94 (`radix`) ; budget Q12 : **+35,2 kB sur 50** |
  | CSS de l'app | 50,75 kB (10,71 gzip) | 60,07 kB (12,33 gzip) |
  | Lignes de CSS maison | 1 542 + 88 + 207 | 1 448 (`legacy.css`) + 88 + 235 |

### Lot 3 — Superpositions : notifications et zone de dépôt (S)
- **Fichiers** : `Toasts.tsx`, `DropZone.tsx`.
- **Travail** :
  - **notifications maison** (Q6) en Tailwind, avec le même fonctionnement : succès/erreur,
    liste d'erreurs défilante, fermeture ; style inspiré d'Alert ;
  - zone de dépôt en Tailwind ;
  - échelle `z-*` (§3.1).
- **CSS supprimé** : 971-1033, 1096-1101.
- **Composants shadcn** : aucun.

**Résultat du lot 3 (réalisé le 19/11/2026, branche `ui/lot-3-superpositions`)**
- **Notifications** (`Toasts.tsx`) : même fonctionnement (succès / erreur, liste d'erreurs
  défilante au-delà de 30 % de l'écran, fermeture, toute la largeur sur mobile), en
  utilitaires Tailwind : `z-toast`, `shadow-overlay`, bordure gauche `border-primary` ou
  `border-destructive`. Pas de Sonner (Q6).
- **Zone de dépôt** (`DropZone.tsx`) : `z-dropzone`, voile `bg-primary/25`, cadre pointillé.
- **Écarts visibles (Q2)** : texte des notifications 14 px (14,4 avant), d'où une
  notification un peu plus étroite ; titre de la zone de dépôt 18 px (19,2 avant), arrondi
  18 px (16 avant) ; en sombre, le voile prend le vert du thème sombre (avant : le vert du
  thème clair, codé en dur).
- **Recette** : 6 captures sur 20 diffèrent (notification « 2 tracés importés », 0,08 à
  0,17 % des pixels). Sonde headless sur le build : 25 fichiers invalides → liste de 25
  erreurs qui défile, bordure rouge, fermeture ; glisser simulé → voile au-dessus de la carte.
- **Mesures** :

  | | Après le lot 2 | Après le lot 3 |
  | --- | --- | --- |
  | JS de l'app (gzip) | 162,87 kB | 163,14 kB = 144,20 + 18,94 (`radix`) ; budget : **+35,4 kB sur 50** |
  | CSS de l'app | 60,07 kB (12,33 gzip) | 60,45 kB (12,38 gzip) |
  | Lignes de `legacy.css` | 1 448 | 1 377 |

### Lot 4 — Barre latérale, liste des tracés, tiroir et problèmes mobiles (L)
- **Prérequis (Q7)** : le propriétaire a ajouté au backlog la liste des problèmes de
  l'interface mobile. **Ne pas commencer ce lot sans elle.** Si elle n'existe pas encore,
  faire les lots 5 à 8 d'abord : ils ne dépendent pas de celui-ci.
- **Fichiers** : `Sidebar.tsx`, `TrackItem.tsx`, `App.tsx` (tiroir, fond grisé, bouton
  d'ouverture), `CairnLogo.tsx`, plus les fichiers concernés par la liste mobile.
- **Travail** :
  1. Relire la liste des problèmes mobiles et, pour chacun, décider s'il est traité dans ce
     lot. **En faire une courte annexe de cette spec, validée par le propriétaire avant
     d'écrire du code.**
  2. Choisir le tiroir : **Sheet** de shadcn (focus, Échap, animation) ou tiroir actuel
     retouché, selon ce que demandent les problèmes mobiles.
  3. Checkbox de visibilité.
  4. Pastille de couleur maison.
  5. Renommage sur place (Input).
  6. Sélection (`bg-accent` + liseré `primary`).
  7. Corrections mobiles retenues.
- **CSS supprimé** : 754-900, 950-969, 1056-1094.
- **Composants shadcn** : `checkbox`, `input`, `separator` (+ `sheet` selon le point 2).
- **Risque** : élevé sur mobile (focus, fermeture au choix d'un tracé, défilement). Recette sur
  un vrai téléphone avec la preview Vercel.

**Résultat du lot 4 (réalisé le 20/11/2026, branche `ui/lot-4-barre-laterale`)**
- **Q7 révisée** : la liste des problèmes mobiles n'existant pas, le propriétaire a choisi de
  **migrer sans correction mobile** ; les problèmes mobiles feront l'objet d'une spec à part
  (backlog). Pas d'annexe (point 1).
- **Tiroir (point 2)** : **tiroir actuel retouché**, pas le Sheet (rien ne demande encore le
  piège du focus ni Échap). `aside` avec `data-open`, glissement `max-md:-translate-x-full` →
  `data-[open=true]:translate-x-0`, ombre `shadow-drawer` (nouveau token), fond grisé
  `bg-black/30 z-backdrop`, bouton « Cairn » en `MAP_CONTROL` (`md:hidden`). Fonctionnement
  inchangé (fermeture au fond grisé et au choix d'un tracé).
- **Liste** : Checkbox de shadcn (retouchée : fond `bg-card`, sans `bg-input/30` en sombre)
  au lieu de la case native ; pastille de couleur maison (sélecteur natif invisible par-dessus,
  **contour au focus clavier**, nouveau) ; renommage en Input (`border-primary`) ; sélection
  `bg-accent` + liseré `inset 3px` vert, pas de survol sur la ligne sélectionnée ; nom grisé
  si le tracé est masqué. Separator non ajouté (bordures suffisantes).
- **Outil de captures** : sélecteurs du tiroir et de la liste par `aside[aria-label="Tracés"]`
  (anciennes classes gardées en repli).
- **Écarts visibles** : case à cocher shadcn (le nom du tracé se décale d'environ 7 px, sans
  les marges de la case native) ; titre « Cairn » 20 px (21,6 avant), « TRACÉS » 12 px (12,8).
- **Recette** : par rapport aux captures finales du lot 8, différences de quelques pixels
  seulement (liste, titre ; « Heure » centré du lot 8 sur mobile). Sonde headless sur le
  build : tiroir (ouverture, fond grisé, fermeture au choix d'un tracé), visibilité,
  renommage (Entrée, Échap), sélection, panneau fixe sur PC, aucune erreur console.
- **Mesures** :

  | | Après le lot 8 | Après le lot 4 |
  | --- | --- | --- |
  | JS de l'app (gzip) | 168,26 kB | 169,58 kB = 148,46 + 21,12 (`radix`) ; budget : **+41,9 kB sur 50** |
  | CSS de l'app | 74,48 kB (13,65 gzip) | 75,43 kB (13,56 gzip) |
  | Lignes de `legacy.css` | 291 | 106 |

### Lot 5 — Panneau du tracé : Stats et Météo (M)
- **Fichiers** : `TrackPanel.tsx`, `TrackStats.tsx`, `WeatherPanel.tsx`.
- **Travail** :
  - Card ;
  - Tabs, en gardant les `aria-label` et la persistance de `sidePanelTab` ;
  - grilles de statistiques ;
  - tableau des points clés (Table) et « Voir les N points » ;
  - navigation d'heure ;
  - bloc soleil (Alert `warning`) ;
  - libellés en capitales factorisés.
- **CSS supprimé** : 1104-1195, 1201-1355, 1680-1687.
- **Composants shadcn** : `card`, `tabs`, `table`, `alert`.

**Résultat du lot 5 (réalisé le 19/11/2026, branche `ui/lot-5-panneau-trace`)**
- **Panneau** (`TrackPanel.tsx`) : Card (retouchée à l'appel : fond `bg-background`, bordure,
  sans `ring` ni `overflow-hidden`) ; Tabs de Radix à la place de la gestion clavier maison
  (← → Début Fin), `aria-label` gardés, `sidePanelTab` persisté, deux contenus montés
  (`forceMount` + `data-[state=inactive]:hidden`).
- **Variante `pill`** ajoutée à `ui/tabs.tsx` (fond carte, contour, onglet actif vert) : à
  réutiliser pour les onglets principaux (lot 6). Fond `bg-input/30` de l'onglet actif en
  sombre retiré.
- **Libellés en capitales factorisés** : `LABEL_CAPS` (et `SUB_LINE`, seconde ligne discrète)
  dans `src/components/classes.ts` ; composants locaux `Stat` (TrackStats) et `Summary`
  (WeatherPanel).
- **Tableau des points** : Table de shadcn (lignes séparées comme avant, sans survol).
- **Bloc soleil** : Alert, nouvelle variante `warning` (`--warning-*`), `role="note"` (et non
  `alert`, qui ferait annoncer le bloc à chaque rendu).
- **Piège rencontré** : les tailles Tailwind (`text-sm`, `text-base`) imposent une hauteur de
  ligne (1,43 ; 1,5) plus grande que `normal` : le panneau grandissait. Hauteurs resserrées
  (`text-sm/tight`, `text-base/tight`, `leading-tight`). Autre piège : un `h2` hors shadcn
  garde la bordure `medium` du navigateur (bloc de compatibilité) : `border-0` avant
  `border-l-4`.
- **Écarts visibles (Q2)** : onglets Stats / Météo un peu plus hauts (panneau Météo +12 px
  environ) ; titre 16 px (15,2 avant) ; bloc soleil 14 px (12,8 avant) ; statistiques un peu
  plus compactes.
- **Recette** : 15 captures sur 20 diffèrent (panneau latéral seulement). Sonde headless des
  onglets : clavier, aria, deux panneaux montés, onglet retrouvé après rechargement, aucune
  erreur console.
- **Mesures** :

  | | Après le lot 3 | Après le lot 5 |
  | --- | --- | --- |
  | JS de l'app (gzip) | 163,14 kB | 165,09 kB = 145,51 + 19,58 (`radix`) ; budget : **+37,4 kB sur 50** |
  | CSS de l'app | 60,45 kB (12,38 gzip) | 72,80 kB (13,96 gzip) |
  | Lignes de `legacy.css` | 1 377 | 1 142 |

### Lot 6 — Contrôles posés sur la carte et profil (M)
- **Fichiers** : `App.tsx` (onglets Carte/Météo/Meilleur jour), `ForecastControl.tsx`,
  `ElevationProfile.tsx`, `WeatherPointTooltip.tsx`, `PassageTooltip.tsx`.
- **Travail** :
  - composant `MapControl`, pour le fond, l'ombre `shadow-float` et l'arrondi ;
  - Tabs principaux (icônes seules sur mobile) ;
  - panneau de coloration (Card, **NativeSelect** (`<select>` natif, Q5),
    Input) ;
  - en-tête du profil et légende des pentes ;
  - contenu des infobulles ;
  - classes du SVG renommées ou passées en utilitaires.
- **Ne pas toucher** : `MapView.tsx`, sauf les classes passées aux infobulles. Les règles
  Leaflet du `src/components/CLAUDE.md` restent valables (`interactive={false}` en prop,
  pane `cairn-markers`).
- **CSS supprimé** : 103-203, 354-394, 1364-1399, 1415-1442, 1478-1574, 1657-1678, 1689-1724,
  1735-1738.
- **Composants shadcn** : `tabs`, `card` (`input` et `native-select` déjà ajoutés au lot 2).
- **Vérification obligatoire sur le build** (`npm run preview`) : survol, clic sur un tracé,
  infobulles. Le mode dev se comporte autrement à cause du StrictMode.

**Résultat du lot 6 (réalisé le 19/11/2026, branche `ui/lot-6-carte-profil`)**
- **Onglets principaux** (`App.tsx`) : Tabs de Radix, variante `pill`, sans `TabsContent` (les
  vues restent rendues comme avant) ; icônes Lucide `Map`, `Thermometer`, `Star` (libellés
  masqués sur mobile, `aria-label` gardés). **Activation manuelle** (`activationMode="manual"`) :
  les flèches déplacent le focus, Entrée / Espace changent de vue (pas de reconstruction des
  vues lourdes à chaque flèche). Onglets désactivés : `disabled:pointer-events-auto` pour garder
  leur infobulle (`title`).
- **`MapControl`** : réalisé en classes partagées (`MAP_CONTROL` dans
  `src/components/classes.ts` : `absolute z-map-control bg-card shadow-float`) plutôt qu'en
  composant, les contrôles étant des éléments différents (liste d'onglets, Card, Button).
- **Panneau de coloration** (`ForecastControl.tsx`) : Card, NativeSelect, Input. Largeur
  **320 px** (290 avant) et contrôles en 14 px aussi sur mobile : sinon le jour et l'heure de
  départ étaient coupés. `native-select` accepte `selectClassName` (classes du `<select>`).
- **Profil** (`ElevationProfile.tsx`) : en-tête, légende des pentes et SVG en utilitaires
  (`stroke-border`, `fill-muted-foreground`, `fill-foreground stroke-card`…) ; masquage
  mobile pendant le survol par `max-md:hidden` conditionnel. Bouton « Profil » : Button.
- **Infobulles** (`WeatherPointTooltip`, `PassageTooltip`) : classes partagées `TIP`.
- **Recette** : 19 captures sur 20 diffèrent (onglets du haut, panneau de la carte : 0,001 à
  3,4 % des pixels). Sonde headless **sur le build** : infobulles du point météo et du
  passage, lecture du profil au survol, fermeture / réouverture du profil, onglets au
  clavier, infobulle de l'onglet désactivé, aucune erreur console. L'outil de captures vise
  maintenant les onglets par leur rôle (`[aria-label="Vue"] [role="tab"]`).
- **Écarts visibles (Q2)** : panneau de coloration plus large ; textes du panneau et des
  infobulles en 14 px (12,8 avant) ; icônes Lucide dans les onglets et les listes.
- **Mesures** :

  | | Après le lot 5 | Après le lot 6 |
  | --- | --- | --- |
  | JS de l'app (gzip) | 165,09 kB | 166,13 kB = 146,55 + 19,58 (`radix`) ; budget : **+38,4 kB sur 50** |
  | CSS de l'app | 72,80 kB (13,96 gzip) | 70,99 kB (13,59 gzip) |
  | Lignes de `legacy.css` | 1 142 | 791 |

### Lot 7 — Onglet « Meilleur jour » (M)
- **Fichiers** : `SummaryView.tsx`.
- **Travail** :
  - Table ;
  - cases de score en boutons (couleur en ligne conservée) ;
  - étoile du meilleur jour ;
  - fiabilité (`rel-medium`, `rel-low`) ;
  - avertissement (Alert) ;
  - champ d'heure de départ (Input) ;
  - clic sur une case vers l'onglet Météo (comportement inchangé).
- **CSS supprimé** : 205-352, 1726-1733.
- **Composants shadcn** : `table`, `alert`, `input`.

**Résultat du lot 7 (réalisé le 20/11/2026, branche `ui/lot-7-meilleur-jour`)**
- **Tableau** (`SummaryView.tsx`) : Table de shadcn dans un cadre arrondi (`border`,
  `rounded-lg`, `bg-card`), `border-separate` et bordures sur les cellules (pas de bordure de
  ligne, dernière ligne sans bordure basse). `aria-label="Scores par jour"` (l'outil de
  captures l'attend à la place de `.stable`).
- **Cases de score** : boutons en utilitaires, couleur du score en style en ligne (donnée) ;
  meilleur jour `inset-ring-2 inset-ring-gold` + étoile `text-gold` ; fiabilité moyenne
  `opacity-80`, faible `opacity-45 saturate-50` ; contour au survol (`enabled:hover:outline`)
  et **au focus clavier** (nouveau).
- **En-têtes de jours** : fiabilité moyenne en `text-muted-foreground`, faible en
  `text-faint italic` + « peu fiable ».
- **Avertissement** : Alert `warning`, `role="note"`. **Heure de départ** : Input
  (`shrink-0`, 14 px sur mobile : sinon l'heure était coupée).
- **Laissé au lot 8** : en-tête, légende et notes gardent les classes `wview-*`, partagées
  avec la vue Météo.
- **Écart visible** : la **colonne des tracés est entièrement figée** au défilement
  horizontal (avant, seul l'en-tête « Tracé » l'était) ; en-têtes de jours 14 px (12,8 avant),
  avertissement 14 px (13,1 avant).
- **Recette** : par rapport aux captures finales du lot 6, seules les 4 vues « Meilleur jour »
  changent (la comparaison avec les captures « avant » du lot montrait aussi la notification
  « 2 tracés importés » capturée à un autre moment de son apparition : aléa de l'outil). Sonde
  headless sur le build (mobile) : clic sur une case → onglet Météo, colonne figée, aucune
  erreur console.
- **Mesures** :

  | | Après le lot 6 | Après le lot 7 |
  | --- | --- | --- |
  | JS de l'app (gzip) | 166,13 kB | 166,48 kB = 146,90 + 19,58 (`radix`) ; budget : **+38,8 kB sur 50** |
  | CSS de l'app | 70,99 kB (13,59 gzip) | 71,63 kB (13,64 gzip) |
  | Lignes de `legacy.css` | 791 | 633 |

### Lot 8 — Onglet « Météo » par altitude (L)
- **Fichiers** : `WeatherView.tsx`.
- **Travail** :
  - jours (ToggleGroup) ;
  - alertes (Alert `destructive` / `info`) ;
  - badge « inversion » ;
  - **tableau maison** : colonne figée, cases colorées en ligne, nuit (`filter`), heure
    sélectionnée, jauge de nuages ;
  - légende ;
  - notes.
- **CSS supprimé** : 396-741, 1700-1706.
- **Composants shadcn** : `toggle-group`, `alert`, `badge`.
- **Risque** : élevé, c'est le cœur métier. Faire des captures par jour, de jour et de nuit,
  dans les 2 thèmes.

**Résultat du lot 8 (réalisé le 20/11/2026, branche `ui/lot-8-meteo`)**
- **Jours** : ToggleGroup de Radix (`type="single"`, `aria-label="Jour"`), variante Cairn
  `chip` ajoutée à `ui/toggle.tsx` (contour, fond `accent` et liseré vert pour le jour
  affiché). Re-cliquer le jour affiché ne le désélectionne pas (valeur vide ignorée).
  **Nouveau** : navigation au clavier (flèches, puis Espace ou Entrée).
- **Alertes** : Alert `role="note"`, liseré gauche ; variantes retouchées dans
  `ui/alert.tsx` : `destructive` (fond `destructive-muted`, texte normal, au lieu du texte
  rouge de shadcn, inutilisé ailleurs) et `info` ajoutée (isotherme sous le sommet).
- **Tableau** : Table de shadcn dans un cadre arrondi, `border-separate`, colonne des
  libellés figée, `aria-label="Météo par altitude et par heure"` (l'outil de captures l'attend
  à la place de `.wtable`). Priorités de fond des cases d'en-tête reprises de l'ancienne
  feuille (heure affichée > nuit > alerte d'isotherme) par `cn()` (fonction `headState`).
  Cases : couleur en ligne (donnée), nuit `brightness-88 saturate-35`, alerte
  `inset-ring-2 inset-ring-destructive`, heure affichée `outline-primary`.
- **Habillage partagé** : `src/components/ViewShell.tsx` (`ViewSection`, `ViewHeader`,
  `ViewPlaceholder`, `ViewFooter` avec légende et notes), utilisé par la Météo et par
  « Meilleur jour » : plus aucune classe `wview-*`. Classes sans style retirées au passage
  (`wday-name`, `wt-col`, `wt-arrow`, `muted`).
- **Écarts visibles** (mineurs) : tailles Tailwind (titre 20 px au lieu de 19,2, sous-titre
  14 au lieu de 14,4, température des cases 16 au lieu de 16,8) ; lignes d'en-tête du
  tableau ~2 px plus serrées.
- **Recette** : capture ajoutée à l'outil (Météo au 3e jour, `3-meteo-jour3`). 12 captures sur
  24 diffèrent, toutes Météo et Meilleur jour ; « Heure » décentré corrigé à la comparaison.
  Sonde headless sur le build (mobile) : jour à la souris et au clavier, re-clic sans effet,
  clic sur une heure, colonne figée, aucune erreur console.
- **Mesures** :

  | | Après le lot 7 | Après le lot 8 |
  | --- | --- | --- |
  | JS de l'app (gzip) | 166,48 kB | 168,26 kB = 147,98 + 20,28 (`radix`) ; budget : **+40,6 kB sur 50** |
  | CSS de l'app | 71,63 kB (13,64 gzip) | 74,48 kB (13,65 gzip) |
  | Lignes de `legacy.css` | 633 | 291 |

### Lot 9 — Nettoyage final (S)
- **Fichiers** : `src/styles/legacy.css` (supprimé), `src/index.css`, `src/main.tsx`,
  `src/components/CLAUDE.md`, `CLAUDE.md` (Stack, Architecture), `README.md` (choix
  techniques, badge Tailwind), `docs/historique.md`.
- **Travail** :
  - supprimer ce qui reste de `legacy.css` : base 79-95, mise en page 97-101, états globaux
    1035-1053, `.muted` 739, spinner 1459-1476, après les avoir migrés ;
  - retirer la couche `legacy` ;
  - supprimer les classes sans style (`stats`, `sview`, `track-panel-body`, `wday-name`,
    `wt-arrow`, `wt-col`, `slope-unit`) ;
  - relever les métriques « après » (§10) ;
  - **version 1.1.0** (Q13) dans `package.json` et le lockfile. Le tag `v1.1.0` est posé par
    le propriétaire au moment de pousser sur `main`.
- **Composants shadcn** : aucun.

---

## 6. Vérification et recette (story 3.3)

**Outillage recommandé : captures automatiques avant/après.** On reprend la méthode déjà
utilisée sur le projet : puppeteer et Chromium dans un **conteneur jetable**
(`node:26-alpine` + polices Noto), sur le réseau `cairn_default`, contre le build servi en
`preview`. **Rien n'est installé dans le projet** (règle de `src/components/CLAUDE.md`).

- **Matrice** :
  - 5 vues : Carte avec un tracé sélectionné et coloré, Météo, Meilleur jour, Paramètres
    ouverts, tiroir mobile ouvert ;
  - × 2 thèmes ;
  - × 2 largeurs (1 400 × 850 et 390 × 844).

  Soit **20 captures par passage**, avec les mêmes GPX de `samples/` et une heure fixée.
- **Comparaison** : différence de pixels entre « avant » et « après », avec un seuil pour
  l'anticrénelage. On produit une **page HTML côte à côte** que le propriétaire ouvre sans lire
  de code.
- **Prévision figée (Q10)** : la météo change d'une heure à l'autre, donc les captures
  rejouent une **réponse Open-Meteo enregistrée**.
  - Au lot 0, la sonde enregistre une fois les réponses des API Prévisions et Altitudes pour
    les GPX de `samples/`, dans `docs/recette/fixtures/`.
  - À chaque passage, elle intercepte les requêtes vers `api.open-meteo.com` et renvoie ces
    réponses (interception de requêtes de puppeteer). Elle fige aussi l'heure du navigateur
    sur celle de l'enregistrement, pour que l'heure courante et les jours affichés ne bougent
    pas.
  - **Aucun changement dans l'application.**
  - Les tuiles de la carte, elles, restent réelles. Elles peuvent varier un peu : il faut
    masquer la zone de la carte dans la comparaison de pixels, ou appliquer un seuil plus
    tolérant.
- **Polices** : il faut installer `font-noto` et `font-noto-symbols` dans le conteneur. Sans
  elles, les glyphes ☾ ⚙ ✕ sont invisibles (constaté le 17/11/2026).
- **Coût / bénéfice** :
  - Coût : environ ½ session pour écrire le script la première fois (dans `docs/` ou dans le
    scratchpad), puis quelques minutes par lot.
  - Bénéfice : les régressions d'un pixel ou de couleur sont détectées sans tout relire, et la
    validation devient visuelle.
  - Alternative écartée : Playwright installé dans le projet (Q8, raisons au §9).
- **Où ranger l'outil** :
  - le script de capture et de comparaison, les réponses enregistrées et la page de
    comparaison vont dans `docs/recette/` ;
  - les captures elles-mêmes vont dans un dossier ignoré par Git, pour ne pas alourdir le
    dépôt.

  Le script n'est ni une dépendance du projet ni du code de l'app : il tourne dans le
  conteneur jetable.
- **Lien de preview Vercel** : chaque PR de lot produit un déploiement « preview » (CD en
  place). Le propriétaire peut tester le lot en ligne, depuis son téléphone, avant la fusion.

**Parcours critiques à retester à chaque lot (checklist manuelle, en plus des captures)**

1. **Import** : importer `samples/lac-exemple.gpx` et `samples/route-sans-altitude.gpx` avec
   le bouton, puis par glisser-déposer. Importer `samples/invalide.gpx` doit afficher un
   message d'erreur. Réimporter le même fichier doit afficher « déjà importé ».
2. **Liste** : sélectionner, masquer, renommer (Entrée valide, Échap annule), changer la
   couleur, supprimer (avec confirmation).
3. **Carte** :
   - cliquer sur un tracé le sélectionne ;
   - le survol du profil affiche le marqueur sur la carte ;
   - colorer le tracé par température, puis cliquer dessus doit afficher l'infobulle de
     passage ;
   - changer de fond de carte (IGN / OpenTopoMap).
4. **Météo par altitude** :
   - onglet Météo : jours, alertes, tableau qui défile horizontalement avec la première colonne
     fixe ;
   - un clic sur une heure met à jour la carte et le panneau.
5. **Meilleur jour** : les scores et l'étoile s'affichent ; un clic sur une case ouvre l'onglet
   Météo au bon jour.
6. **Paramètres** : modifier une vitesse et enregistrer : la durée change. « Valeurs par
   défaut » et le thème Système / Clair / Sombre fonctionnent.
7. **Rechargement** : les tracés et les réglages sont conservés.
   - Le backlog cite « sauvegarde/chargement JSON ». **Cette fonction n'existe plus** : elle a
     été supprimée, cf. `docs/specs/suppression-sauvegarde.md`. La persistance passe par le
     navigateur, d'où ce parcours de rechargement.
8. **Mobile** (390 px) : ouvrir et fermer le tiroir, les onglets en icônes, le profil réduit,
   et les notifications sur toute la largeur.
9. **Mode sombre** : mêmes écrans, aucune zone blanche, contrôles Leaflet sombres.

**Checklist de recette par lot** : les points ci-dessous sont à cocher par le propriétaire à
chaque lot.
- [ ] Les captures avant/après ne montrent que les différences annoncées dans le lot.
- [ ] Les parcours 1 à 9 sont OK sur la preview Vercel.
- [ ] Le focus clavier est visible (Tab) sur tout élément touché par le lot.
- [ ] Rien ne change à 390 px de large par rapport à avant, sauf si c'est annoncé.

**Accessibilité**

- **Focus clavier** : aujourd'hui, seuls les onglets du panneau ont un contour de focus
  explicite (1139-1142). Les composants shadcn en apportent un partout (`ring`). C'est un
  **progrès**, mais il change l'aspect : à montrer au propriétaire.
- **Contrastes** : à **mesurer** au lot 0 avec un outil de calcul WCAG, car ces valeurs ne sont
  que des estimations. Deux points à surveiller :
  - `--muted-foreground` #6b7378 sur `--background` #f6f5f1 est **à la limite du seuil AA**
    (4,5:1) pour le petit texte ;
  - `--faint` #9aa0a6 sur blanc est sous ce seuil. Il n'est utilisé que pour les jours peu
    fiables (350) et les boutons désactivés.

  Décision Q11 : **correction au lot 0** (cf. §3.1). À chaque lot suivant, tout nouveau couple
  texte/fond introduit par un composant shadcn est mesuré de la même façon.

---

## 7. Risques et retour arrière (story 3.4)

| Risque | Probabilité | Impact | Parade |
| --- | --- | --- | --- |
| Le preflight casse l'affichage de Leaflet (tuiles, icônes, contrôles) | Forte sans parade | Fort | Règle dédiée dans `leaflet.css` (§4), captures de la carte au lot 0 |
| Régressions visuelles discrètes (espacements, tailles) | Moyenne | Moyen | Captures avant/après à chaque lot ; écarts d'arrondi annoncés à l'avance (Q2) |
| Inversion de sens des variables `--accent` / `--muted` | Moyenne | Moyen | Renommage au lot 0 dans `legacy.css`, contrôlé par capture |
| Composants shadcn clairs en mode sombre | Forte sans variante | Moyen | `@custom-variant dark` sur `data-theme` (§3.1) |
| Le bundle JS grossit (Radix, dont Select, et Lucide) | Certaine | Faible à moyen | **Budget de +50 kB gzip au total** par rapport au §2.2 (Q12 ; 30 kB au départ, relevé après le lot 1). Mesure à chaque lot dans le compte rendu (JS gzip, avant et après le lot). Si un lot fait dépasser le budget : s'arrêter et le signaler avant de continuer. Importer les icônes Lucide une par une (jamais tout le paquet). |
| La police Geist change la largeur des textes | Certaine | Faible | Captures dédiées au lot 1 (troncatures, tableaux) ; repli sur la police système pendant le chargement |
| Les menus Select de Radix s’ouvrent sous la carte ou sous la fenêtre | Écarté | — | Select de Radix abandonné au lot 2 pour le `<select>` natif (Q5) ; `z-popover` reste dans l’échelle pour un menu futur |
| Changement de comportement : focus, clavier, Échap, tiroir mobile | Moyenne | Moyen | Parcours 2, 6 et 8 manuels, et test au clavier |
| Comportement différent entre le dev et le build (StrictMode, carte) | Moyenne | Fort | Recette faite **sur le build** (preview locale ou Vercel), pas sur le serveur dev |
| Dérive du design (valeurs arbitraires, couleurs en dur qui reviennent) | Moyenne | Faible | Conventions du §3.3 dans `CLAUDE.md`, relecture en fin de lot |
| Migration abandonnée à mi-chemin (deux systèmes qui cohabitent longtemps) | Moyenne | Moyen | Chaque lot est fini et déployable ; la couche `legacy` peut rester tant qu'il le faut |
| Binaire natif Tailwind absent sur Vercel ou en CI | Faible | Fort | Vérifier le lockfile et lancer `vercel build` hors ligne au lot 0 |
| Le Git Bash réécrit les chemins (`/app/…`) dans les commandes Docker | Moyenne | Faible | `MSYS_NO_PATHCONV=1` (`CLAUDE.local.md`) |

**Stratégie Git (Q14 : une branche par lot, aucun retour arrière sur `main`)**

- **Une branche par lot**, créée depuis `develop` à jour : `ui/lot-0-base`,
  `ui/lot-1-police-boutons`, `ui/lot-2-parametres`, etc. Claude Code la crée au début du lot.
- **Commits** : atomiques (un commit par composant ou par étape), messages en anglais comme
  aujourd'hui. Le dernier commit du lot met à jour la doc : spec, historique, métriques.
- **Validation sans toucher à `main`**
  1. Le propriétaire pousse la branche du lot et ouvre une PR vers `develop`. Claude Code
     **ne pousse jamais**.
  2. La CI tourne, puis une **preview Vercel** est déployée (job `deploy-preview`).
  3. La recette (§6) se fait **sur la preview**.
  4. Si tout est bon : fusion dans `develop`, puis **suppression de la branche du lot** par le
     propriétaire.
- **`main` ne reçoit que du validé.** On ne fusionne `develop` dans `main` qu'aux moments
  choisis par le propriétaire : à la fin de la migration (version 1.1.0), ou après un lot
  jugé publiable. Comme chaque lot a déjà été testé en preview, il n'y a **jamais de retour
  arrière à faire sur `main`**.
- **Si un lot pose problème**
  - Avant la fusion dans `develop` : corriger sur la branche du lot, ou l'abandonner.
    `develop` et `main` ne sont pas touchés.
  - Après la fusion dans `develop` mais avant `main` : `git revert` du commit de fusion du lot
    **sur `develop`**. `main` n'a rien vu.
  - Comme la couche `legacy` garde l'ancien style, annuler un lot laisse les autres
    fonctionnels. Annuler le lot 0 (la base) retire Tailwind entièrement : à ne faire qu'avant
    les lots suivants.
- **Ordre** : un seul lot à la fois. La branche du lot suivant part de `develop` après la
  fusion du précédent, jamais de la branche d'un lot non fusionné.

---

## 8. Hors périmètre

- Aucune refonte fonctionnelle : pas de nouvel écran, pas de nouveau réglage, pas de
  changement de parcours.
- Pas de changement du modèle de données (IndexedDB, `Settings`, `Track`) ni des calculs
  (`src/lib`, `src/services`).
- Carte : le moteur reste Leaflet, et on ne touche ni au fond de carte ni au tracé sur canvas.
- Profil : on ne remplace pas le SVG maison par une bibliothèque de graphiques.
- On ne retouche pas les couleurs de données (températures, pentes, scores).
- Pas de nouvelle charte graphique : les couleurs actuelles sont conservées, sauf les
  corrections de contraste (Q11). La seule nouveauté de style est la police Geist (Q9).
- Pas d'internationalisation.
- Pas de Prettier ni de Playwright dans le projet (Q8).

Les **problèmes de l'interface mobile** que le propriétaire décrira au backlog **sont dans le
périmètre** : ils sont intégrés au lot 4 (Q7).

---

## 9. Décisions du propriétaire (18/11/2026)

Toutes les questions ouvertes ont été tranchées. Elles gardent leur numéro, car le reste de la
spec y renvoie.

| # | Question | Décision | Effet dans la spec |
| --- | --- | --- | --- |
| Q1 | Faut-il migrer ? | **Migration complète**, lots 0 à 9 | Tout le plan du §5 |
| Q2 | Fidélité au pixel ou normalisation ? | **Normaliser** (§3.1) en acceptant des écarts de 1 à 2 px | Écarts annoncés dans chaque lot |
| Q3 | Base des composants shadcn | **Radix UI** | `shadcn init` (§4) |
| Q4 | Icônes | **Lucide** (`lucide-react`) | Lot 1 ; importées une par une |
| Q5 | Listes déroulantes | ~~Select de Radix~~ → **`<select>` natif stylé** (`NativeSelect` de shadcn), **révisé le 19/11/2026** au lot 2 : le Select de Radix (15,7 kB gzip à lui seul) faisait dépasser le budget de 50 kB | Lots 2 et 6 ; sur mobile, menu du téléphone |
| Q6 | Notifications | **Composant maison** en Tailwind, pas de Sonner | Lot 3 |
| Q7 | Tiroir et problèmes mobiles | **Attendre la liste des problèmes mobiles** et l'intégrer au lot 4 | Lot 4 bloqué tant que la liste n'existe pas ; les lots 5 à 8 peuvent passer avant |
| Q8 | Prettier et Playwright dans le projet | **Non** pour les deux | Explication ci-dessous |
| Q9 | Police | **Geist**, hébergée avec le site (`@fontsource-variable/geist`) | §3.1, lot 1 |
| Q10 | Météo figée pour les captures | **Réponse Open-Meteo enregistrée et rejouée** | §6, préparé au lot 0 |
| Q11 | Contrastes insuffisants | **Corriger au lot 0** | §3.1, lot 0 (dernier commit) |
| Q12 | Budget de poids JS | **+50 kB gzip au maximum** (127,71 → 177,7 kB), mesuré à chaque lot. Fixé à +30 kB le 18/11/2026, **relevé le 19/11/2026** après le lot 1 (+15,9 kB, surtout le paquet `cn`) : les composants restants n'auraient pas tenu dans 30 kB. Au lot 2, le Select de Radix menait à +50,8 kB : remplacé par le `<select>` natif (Q5) plutôt que de relever encore le budget | §7 ; arrêt et signalement en cas de dépassement |
| Q13 | Version finale | **1.1.0** | Lot 9 |
| Q14 | Rythme | **Une branche et une PR par lot**, jamais de retour arrière sur `main` ; branches supprimées par le propriétaire à la fusion | §7 |
| Q15 | Fichier `docs/BACKLOG-spec-migration-ui.md` | **Résumé dans `docs/backlog.md`** avec un renvoi vers cette spec, puis **supprimé une fois la spec validée** | Fait à la validation de la spec |

**Pourquoi « non » à Prettier et à Playwright (Q8)**

*Prettier* est un outil qui remet en forme tout le code selon des règles fixes : indentation,
guillemets, longueur des lignes. Son extension `prettier-plugin-tailwindcss` trie en plus les
classes Tailwind dans un ordre standard. Il n'apporterait rien ici, pour quatre raisons.
1. **Il sert aux humains qui lisent le code.** Le propriétaire ne lit pas le code, et l'agent
   n'a pas besoin que les classes soient triées pour les comprendre. Le seul bénéfice réel
   serait des différences de code un peu plus courtes entre deux versions.
2. **Le premier passage toucherait presque tous les fichiers.** Le projet n'a jamais utilisé
   Prettier : il reformaterait d'un coup des milliers de lignes, sans rien changer au
   fonctionnement. Ces changements se mêleraient à ceux de la migration et rendraient chaque
   lot plus dur à relire et à annuler.
3. **C'est un outil de plus à faire tourner partout** : dans `/verifier`, dans la CI (sinon le
   code dérive), et dans le Docker de chaque poste. Une étape de plus peut échouer, pour un
   bénéfice purement cosmétique.
4. **Il ne trouve aucun bug.** ESLint, déjà en place à zéro avertissement, et TypeScript
   strict font le travail qui compte. L'ordre des classes est fixé par une convention écrite
   (§3.3), que l'agent suit.

Si l'envie vient plus tard, on pourra l'ajouter dans un lot à part, isolé, après la migration.

*Playwright* est un outil de tests de navigateur, une alternative à puppeteer.
- **Il alourdirait l'image Docker et la CI** : environ 300 Mo de navigateurs. De plus, il
  n'est pas pris en charge officiellement sur Alpine Linux, la base de l'image du projet.
- **La méthode actuelle donne déjà le résultat voulu** : puppeteer et Chromium dans un
  conteneur jetable, éprouvés sur ce projet, sans rien installer dans le projet ni rien
  télécharger à chaque build.

---

## 10. Métriques « après » (à relever au lot 9)

On reprend exactement le tableau du §2.2 et on remplit la colonne « Après ». On y ajoute :

| Métrique supplémentaire | Avant | Après |
| --- | --- | --- |
| Lignes de CSS restantes (`index.css` + `styles/*.css`) | 1 804 | |
| Composants `ui/` (shadcn) | 0 | |
| Valeurs arbitraires `[…]` dans le JSX | 0 | |
| Couleurs en dur dans le JSX (hors couleurs de données) | 0 | |
| Dépendances UI ajoutées (et poids gzip) | — | |
| Temps de build | 0,6 s | |

Méthode : le même script d'analyse que pour le §2.2, appliqué aux CSS restants, et
`npm run build` sans changement de configuration.

---

## Annexe — Suivi des stories du backlog

- [x] **1.1 Cartographie**
  - Une seule feuille maison de 1 804 lignes, plus la feuille de Leaflet.
  - 14 styles en ligne, tous des couleurs de données.
  - TypeScript strict sans alias.
  - React 19, Vite 8.3.8, Node 26.
- [x] **1.2 Métriques**
  - 262 règles, 66 couleurs littérales, 22 espacements, 20 tailles de police.
  - 2 media queries sur le même point de rupture.
  - CSS du build : 22,19 kB + 15,09 kB (Leaflet).
- [x] **1.3 Qualité**
  - Aucune règle morte.
  - Problèmes réels : bloc mobile coupé en deux avec une déclaration écrasée, 4
    `!important`, champs et onglets recopiés, échelles de valeurs trop larges.
- [x] **1.4 Zones sensibles**
  - Leaflet face au preflight, thème sombre de Leaflet.
  - Profil SVG (`.grid`), couleurs de données, tableau météo (colonne figée).
  - Thème posé avant l'affichage.
- [x] **2.1 Tokens**
  - Correspondance complète, avec l'inversion de sens de `--accent` et `--muted` signalée.
  - Mode sombre aux valeurs actuelles.
  - 7 tailles de police, 3 ombres, 7 niveaux de superposition.
- [x] **2.2 Composants**
  - 15 composants shadcn, dont `select`, plus `sheet` à décider au lot 4 et `tooltip`
    facultatif. Pas de `sonner`.
  - 5 éléments maison : pastille de couleur, tableau météo, zone de dépôt, infobulles, profil.
- [x] **2.3 Conventions**
  - Section §3.3, prête pour `src/components/CLAUDE.md`.
- [x] **3.1 Installation**
  - Procédure en 7 étapes via Docker, avec l'alias `@` à créer.
  - Coexistence par couche `legacy` et parades au preflight.
- [x] **3.2 Lots**
  - 10 lots (0 à 9), du moins au plus risqué, chacun déployable.
- [x] **3.3 Vérification**
  - Captures automatiques en conteneur jetable, avec une page de comparaison.
  - 9 parcours critiques.
  - Le parcours « sauvegarde JSON » n'existe plus.
- [x] **3.4 Risques**
  - 11 risques recensés.
  - Une branche par lot, PR avec preview Vercel, `git revert` du commit de fusion.
- [x] **4.1 Rédaction** : ce document.
- [x] **4.2 Relecture**
  - Points de vigilance ci-dessous.
  - Les numéros de ligne du JSX ne sont donnés que là où ils ont été relevés. Les autres
    renvois se font par fichier, à préciser au début de chaque lot.

**Points de vigilance relevés à la relecture**
- **Lignes de CSS** : les numéros cités dans les lots se réfèrent à `src/styles.css` au commit
  `6f7a51c`. Ils changent dès le lot 0 (renommage en `legacy.css`), et chaque lot doit les
  relocaliser par nom de classe.
- **Points non vérifiés**, à faire au lot 0 :
  - le mécanisme exact d'alias de Vite 8 (`resolve.alias` ou option native) ;
  - les questions posées par `shadcn init` ;
  - le comportement réel du preflight sur Leaflet.
- **Contrastes** : ce sont des estimations, à mesurer.
