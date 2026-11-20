# Migration de l'interface vers Tailwind CSS v4 + shadcn/ui

Statut : **terminée** — spec validée le 18/11/2026, lots 0 à 9 faits les 19 et 20/11/2026,
version 1.1.0 (tag `v1.1.0`).

> **Version courte.** Le texte intégral (état des lieux, plan détaillé, résultat de chaque
> lot, 1 400 lignes) est archivé dans
> [`docs/archives/migration-ui-complet.md`](../archives/migration-ui-complet.md). **Ne pas le
> lire sans raison précise** : il est volumineux (90 ko) et tout ce qui reste utile est ici ou
> dans `src/components/CLAUDE.md` (conventions de code).

## Ce qui a été fait

Une feuille `src/styles.css` de 1 804 lignes (20 tailles de police, 22 espacements,
13 ombres, 4 `!important`) remplacée par **Tailwind CSS v4** (configuration en CSS) et des
composants **shadcn/ui** (Radix), en 10 lots, chacun sur sa branche, avec PR vers `develop`,
recette sur la preview Vercel et captures avant/après comparées au pixel près
(`docs/recette/`).

- **Changements visibles voulus** : police **Geist** (au lieu de la police système) et
  contrastes corrigés (mesurés par `docs/recette/contrastes.mjs`). Le reste est identique, aux
  arrondis près.
- **Fonctionnement inchangé**, hormis quelques gains d'accessibilité : navigation au clavier
  dans les jours de la météo, contour de focus sur les cases de score et la pastille de couleur.

| Lot | Contenu |
| --- | --- |
| 0 | Base Tailwind + shadcn, tokens clair/sombre, contrastes corrigés, outil de captures |
| 1 | Police Geist, boutons, pastilles, icônes Lucide |
| 2 | Fenêtre Paramètres (Dialog), champs, `<select>` natif |
| 3 | Notifications, zone de dépôt, échelle des superpositions (`z-*`) |
| 4 | Panneau latéral, liste des tracés (Checkbox), tiroir mobile (conservé, sans Sheet) |
| 5 | Panneau du tracé : Card, Tabs, Table, Alert |
| 6 | Onglets de vue, panneau de coloration, profil, infobulles de la carte |
| 7 | Onglet « Meilleur jour » (Table, cases de score) |
| 8 | Onglet « Météo » par altitude (ToggleGroup, Alert, Table), `ViewShell` partagé |
| 9 | `legacy.css` supprimé, base (hauteur de ligne, curseur), version 1.1.0 |

## Décisions du propriétaire (18-19/11/2026)

| # | Question | Décision |
| --- | --- | --- |
| Q1 | Migrer ? | Migration complète, lots 0 à 9 |
| Q2 | Fidélité au pixel | Normaliser sur les échelles de Tailwind, écarts de 1 à 2 px acceptés |
| Q3 | Base shadcn | Radix UI |
| Q4 | Icônes | Lucide, importées une par une |
| Q5 | Listes déroulantes | **`<select>` natif stylé** (`NativeSelect`), pas le Select de Radix (+15,7 kB gzip, hors budget) ; révisé le 19/11 |
| Q6 | Notifications | Composant maison, pas de Sonner |
| Q7 | Tiroir et problèmes mobiles | La liste n'existait pas : lot 4 fait **sans correction mobile** ; les problèmes mobiles sont au backlog |
| Q8 | Prettier, Playwright | Non (Prettier : bénéfice cosmétique, mêlé à la migration ; Playwright : ~300 Mo, non supporté sur Alpine). Captures par puppeteer en conteneur jetable |
| Q9 | Police | Geist, hébergée avec le site (`@fontsource-variable/geist`, sous-ensemble latin) |
| Q10 | Météo des captures | Réponse Open-Meteo enregistrée et rejouée (`docs/recette/fixtures/`) |
| Q11 | Contrastes | Corrigés au lot 0 |
| Q12 | Budget JS | **+50 kB gzip** (relevé de 30 le 19/11) ; consommé : **+42,0 kB** |
| Q13 | Version | 1.1.0 |
| Q14 | Rythme | Une branche et une PR par lot, branches supprimées à la fusion |
| Q15 | `BACKLOG-spec-migration-ui.md` | Résumé au backlog puis fichier supprimé |

## Bilan chiffré

| | Avant | Après |
| --- | --- | --- |
| Feuilles CSS maison | 1 (1 804 lignes, 262 règles, 187 classes) | 2 : `src/index.css` (tokens, base) et `src/styles/leaflet.css` ; 333 lignes, 23 règles, 14 classes (Leaflet) |
| `!important` / media queries | 4 / 2 | 0 / 0 (un seul point de rupture : `max-md:`) |
| `style={{…}}` | 14, couleurs de données | 14, couleurs ou dimensions de données |
| Valeurs arbitraires `[…]` | 0 | 10, dans les composants de Cairn |
| Composants `ui/` (shadcn) | 0 | 14 : alert, badge, button, card, checkbox, dialog, input, label, native-select, radio-group, table, tabs, toggle, toggle-group |
| CSS du build | 22,19 kB (5,34 gzip) | 75,22 kB (13,33 gzip), Tailwind compris |
| JS de l'app (gzip) | 127,71 kB | 169,74 kB = 148,62 + 21,12 (chunk `radix`) : **+42,0 kB** |
| Temps de build | 0,6 s | 1,5 s |

Dépendances ajoutées : `radix-ui`, `lucide-react`, `cn`, `class-variance-authority`,
`tw-animate-css`, `@fontsource-variable/geist` ; en développement `tailwindcss`,
`@tailwindcss/vite`, `shadcn`. `npm audit` : 4 failles modérées dans le CLI `shadcn` (outil de
développement, hors du site).

## Pièges retenus (détail dans `src/components/CLAUDE.md`)

- **Preflight de Tailwind** : plus de marge, de bordure ni de taille de titre sur les éléments
  HTML ; hauteur de ligne imposée à 1,5 sur `html` (remise à `normal` dans la couche `base`) ;
  curseur par défaut sur les boutons (main rétablie).
- **Superpositions** : jamais le `z-50` de shadcn, il passe sous les contrôles de Leaflet.
- **Tableaux à colonne figée** : `border-separate`, bordures sur les cellules.
- **Éléments `ui/` retouchés** (commentaires « Cairn ») : button, badge, dialog, input,
  native-select, radio-group, checkbox, tabs, alert, toggle.
- **Outil de recette** : `sh docs/recette/run.sh capture <nom>` puis `compare <a> <b>`.
  Référence actuelle : `docs/recette/captures/lot9-apres`.
