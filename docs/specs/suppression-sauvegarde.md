# Suppression de la sauvegarde JSON

Statut : réalisée

## Objectif
La sauvegarde JSON (export / import avec fusion) ne sert plus : l'application n'est utilisée
que dans sa version Vercel, et les GPX sont réimportés en cas de changement de navigateur.
On retire la fonctionnalité pour alléger le code et l'interface.

## Comportement attendu
- Le pied du panneau latéral « Sauvegarde · Exporter · Importer » disparaît.
- Plus aucun moyen d'exporter ou d'importer un fichier `cairn-sauvegarde-*.json`.
- Le retéléchargement de chaque tracé en GPX (bouton du tracé) fonctionne comme avant.

## Contraintes
- Données existantes intactes : tracés, paramètres et cache météo restent dans IndexedDB
  (aucune migration de base).
- `normalizeSettings` est conservé : il complète aussi les paramètres stockés en base.
- `id` = empreinte des coordonnées : toujours utilisé pour le dédoublonnage à l'import GPX.

## Hors périmètre
- Toute autre forme de synchronisation entre navigateurs.

## Comment tester
- Panneau latéral : plus de pied « Sauvegarde » ; la liste des tracés occupe la place libérée.
- Recharger la page : tracés et paramètres toujours présents.
- Bouton de téléchargement d'un tracé : le GPX est téléchargé.
- Réimporter un GPX déjà présent : message « déjà importé » (dédoublonnage inchangé).
