# Réorganisation du panneau latéral (stats + météo)

Statut : réalisée

## Objectif
Le panneau latéral est encombré : les blocs « Statistiques » et « Météo » sont empilés au-dessus
de la liste des tracés, et le tableau météo (jusqu'à 8 points d'altitude) repousse la liste loin
vers le bas. On regroupe les deux blocs en un seul panneau à onglets et on allège le tableau
météo, pour garder sous les yeux l'essentiel du tracé sélectionné **et** la liste des tracés.

## Comportement attendu

### Panneau à onglets
- Quand un tracé est sélectionné, un seul bloc remplace les deux blocs actuels, **en haut** de la
  zone défilante (même place qu'aujourd'hui), la liste « Tracés » restant dessous.
- En tête du bloc : le **nom du tracé** (avec son liseré de couleur, comme le titre actuel des
  stats), commun aux deux onglets ; puis deux onglets **« Stats » | « Météo »**.
- **Stats** : contenu actuel de `TrackStats` (grille, point culminant, source des altitudes,
  bouton « Télécharger le GPX »), sans le titre déplacé dans l'en-tête.
- **Météo** : contenu actuel de `WeatherPanel` (modèle et heure de mise à jour, « Actualiser »,
  **bloc soleil**, bouton « 🌡 Tableau météo par altitude », navigation horaire, résumé,
  tableau par point), avec le tableau allégé (ci-dessous).
- **Onglet ouvert** : le dernier choisi, mémorisé dans les paramètres (persisté) ; il reste le même
  d'un tracé à l'autre et après rechargement. Par défaut : **Stats**.
- Aucun tracé sélectionné : pas de bloc (comme aujourd'hui).
- Onglets accessibles : `role="tablist"` / `tab` / `tabpanel`, `aria-selected`, flèches ← → pour
  passer d'un onglet à l'autre ; style cohérent avec les onglets principaux et le mode sombre
  (variables CSS uniquement).

### Tableau météo allégé
- Par défaut, n'afficher que les **points clés** : ceux qui ont un rôle (Sommet, Départ, Point
  bas ; un point peut en cumuler plusieurs, donc 1 à 3 lignes), dans l'ordre actuel (du plus haut
  au plus bas).
- S'il existe des points intermédiaires, un lien **« Voir les N points »** (N = total) sous le
  tableau les déplie à leur place ; une fois déplié, **« Points clés seulement »** les replie.
- S'il n'y a aucun point intermédiaire : pas de lien.
- Dépliage non persisté : chaque nouvelle sélection de tracé repart replié.
- L'onglet principal « Météo » (heatmap par altitude) est inchangé et montre toujours tous les
  points.

### Mobile (tiroir)
- Même organisation dans le tiroir ; onglets assez grands pour le doigt.
- Comportements inchangés : « Point culminant » ferme le tiroir et centre la carte ; « Tableau
  météo par altitude » ouvre l'onglet principal Météo.

## Contraintes
- Nouveau réglage dans `Settings` : `sidePanelTab: 'stats' | 'weather'` (défaut `'stats'`), à
  ajouter à `DEFAULT_SETTINGS` **et** à `normalizeSettings` (valeur absente ou invalide → défaut),
  avec un test. Il ne figure pas dans la boîte de dialogue des paramètres.
- La prévision continue d'être chargée même onglet Stats ouvert (`useWeather` reste dans `App`) :
  l'heure sélectionnée, la coloration du tracé et les infobulles des points météo sur la carte
  ne dépendent pas de l'onglet du panneau.
- Les sélecteurs utilisés par les sondes headless (`.sidebar-header .icon-btn`, `.track-item`,
  `button[aria-label="Météo"]` des onglets principaux) ne doivent pas devenir ambigus : les
  onglets du panneau ont des libellés/aria-labels distincts de ceux des onglets principaux.
- Pas de nouvelle dépendance ; fonctions pures (ex. filtrage des points clés) dans `src/lib` avec
  tests.

## Hors périmètre
- Déplacer le panneau ailleurs que dans la barre latérale (sous la carte, flottant…).
- Rendre la liste des tracés repliable.
- Modifier le contenu des statistiques ou de la météo (hors allègement du tableau).
- Changer la sélection des points météo (`selectWeatherPoints`).

## Comment tester
- Importer `samples/lac-exemple.gpx` (et un GPX à fort dénivelé pour avoir des points
  intermédiaires), sélectionner un tracé : un seul bloc avec le nom, onglets Stats | Météo,
  Stats ouvert par défaut ; la liste des tracés est visible juste dessous.
- Onglet Météo : bloc soleil, navigation horaire, tableau limité aux points clés ; « Voir les N
  points » déplie tout, « Points clés seulement » replie. Tracé avec peu de dénivelé : pas de lien.
- Choisir Météo, sélectionner un autre tracé puis recharger la page : l'onglet Météo reste ouvert ;
  le tableau repart replié.
- Onglet Stats ouvert : la coloration du tracé et les infobulles météo de la carte fonctionnent.
- Clavier : Tab jusqu'aux onglets, flèches ← → pour basculer.
- Mobile (DevTools, < 768 px) : même organisation dans le tiroir.
- Mode sombre : onglets et bloc lisibles.
