# Historique de réalisation

Ce qui a été fait, étape par étape, par rapport au cahier des charges
(`docs/cahier-des-charges.md`). Toutes les étapes ont été validées par l'utilisateur.

- [x] **Étape 1** — carte (IGN / OpenTopoMap), import GPX multiple (bouton + glisser-déposer),
  IndexedDB, panneau des tracés, sélection/zoom, erreurs, export/import de sauvegarde JSON
  (supprimé ensuite, voir plus bas).
  Validée par l'utilisateur. Ajustement ensuite : tracés dessinés en 3 couches
  (ombre noire + liseré blanc + couleur) pour le contraste.
- [x] **Étape 2** — statistiques (distance, D+/D- avec hystérésis 5 m, min/max, point culminant),
  altitudes via Open-Meteo Elevation si manquantes, durée DIN 33466 (vitesses réglables),
  profil altimétrique SVG avec marqueur synchronisé sur la carte. Validée.
- [x] **Étape 2bis** (ajoutée à la demande de l'utilisateur) — pentes en % (survol du profil,
  remplissage coloré par classe de pente + légende, pentes max montée/descente dans les stats)
  et retéléchargement de chaque tracé en GPX (altitudes corrigées incluses). Validée.
- [x] **Étape 3** — service météo Open-Meteo (`services/weather.ts`), points d'échantillonnage
  (≤ 8, fusion < 200 m), cache mémoire + IndexedDB 1 h, bouton « Actualiser », choix du modèle
  dans les paramètres. Vue compacte provisoire (`WeatherPanel`, navigation heure par heure)
  + points météo sur la carte. Validée.
- [x] **Étape 3bis** (ajoutée à la demande de l'utilisateur) — lever/coucher du soleil au départ
  (durée du jour, départ conseillé au plus tard, alerte si rando plus longue que le jour, heures
  de nuit signalées) et météo du point dans les infobulles des points météo de la carte.
  Corrections ensuite : marqueur « Point culminant » fusionné avec le point météo du sommet,
  marqueurs dans un pane au-dessus des tracés. Validée.
- [x] **Étape 4** — onglets Carte / Météo ; vue `WeatherView` : 7 jours (pastille ⚠ si alerte),
  heatmap points × heures 6 h–21 h (température bleu→rouge centrée sur 0, ressenti, flèche de
  vent, 💧 > 0,2 mm, ⚡ orage), lignes temps / nébulosité / risque de pluie / isotherme / inversion,
  badge « Inversion probable », alertes, heures de nuit grisées, clic sur une heure = heure
  affichée sur la carte. Validée.
- [x] **Étape 5** — panneau « Colorer le tracé » sur la carte (Aucune / Température / Rafales /
  Pluie, jour, heure de départ, légende, arrivée estimée, alerte arrivée après le coucher) ;
  heures de passage DIN par tronçons de 100 m recalées sur la durée totale ; tracé sélectionné
  découpé en lignes colorées (météo interpolée en altitude et dans le temps) ; infobulle de
  passage au survol du tracé ou du profil (appui au doigt). Validée.
- [x] **Étape 6** — onglet « ★ Meilleur jour » : tableau tracés × 7 jours, score 0–100 coloré
  (rouge → vert) sur la fenêtre de rando (heure de départ + durée DIN), icônes des principales
  pénalités, détail au survol, ★ meilleur jour (jusqu'à J+4), jours lointains atténués +
  avertissement de fiabilité, clic = onglet Météo de ce tracé ce jour-là ; poids des pénalités
  réglables dans les paramètres ; prévisions de tous les tracés (cache 1 h, 2 requêtes en
  parallèle). Validée. Dernière étape du cahier des charges. Correction ensuite : pas de
  referrer vers OpenTopoMap en local (tuiles « Generic referrer detected »).
- [x] **Préparation du déploiement Vercel** (faite avant l'étape 5 à la demande de
  l'utilisateur, pour qu'il pousse et vérifie le déploiement à chaque étape) — `vercel.json`,
  `.nvmrc`, `engines`, script `preview`, README. Validée. Détail : `docs/deploiement.md`.
- [x] **Passage de Node 22 à Node 26** (14/11/2026, demandé par l'utilisateur).

## Après le cahier des charges

Les nouvelles fonctionnalités ont chacune leur spec dans `docs/specs/`. Ajouter ici une ligne
par fonctionnalité validée.

- [x] **Suppression de la sauvegarde JSON** (15/11/2026) — export/import et pied de panneau
  « Sauvegarde » retirés : l'app n'est utilisée que sur Vercel, les GPX sont réimportés en cas
  de changement de navigateur. Retéléchargement GPX conservé, données IndexedDB intactes.
  Spec : `docs/specs/suppression-sauvegarde.md`.
- [x] **Mode sombre** (15/11/2026, sans spec : consignes du backlog suffisantes) — bouton ☾ / ☀
  à gauche de ⚙, réglage `theme` (Système par défaut, suivi en direct ; Clair ; Sombre) aussi
  dans les Paramètres (section « Apparence »), sans flash au chargement (copie localStorage lue
  par `index.html`). Interface seulement : fonds de carte intacts, contrôles et infobulles
  Leaflet assombris ; couleurs d'interface en variables CSS. Au passage : listes déroulantes
  des Paramètres qui étaient tronquées.
- [x] **Réorganisation du panneau latéral** (16/11/2026) — stats et météo du tracé sélectionné
  regroupées en un seul bloc à onglets « Stats | Météo » (nom du tracé en en-tête, onglet
  mémorisé dans `Settings.sidePanelTab`, flèches ← → au clavier), au-dessus de la liste des
  tracés. Tableau météo du panneau limité aux points clés (Sommet, Départ, Point bas), lien
  « Voir les N points » pour déplier. Spec : `docs/specs/reorganisation-panneau.md`.
