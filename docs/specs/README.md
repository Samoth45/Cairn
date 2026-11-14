# Specs des nouvelles fonctionnalités

Le cahier des charges d'origine (`docs/cahier-des-charges.md`) est terminé et figé.
Chaque nouvelle fonctionnalité a sa propre spec, courte, dans ce dossier :
`docs/specs/<nom-court>.md` (ex. `simplification-gpx.md`, `eslint-10.md`).

## Utilisation

1. Écrire la spec (ou demander à Claude d'en rédiger une à partir d'une idée du backlog,
   puis la relire).
2. Demander : « implémente docs/specs/<nom>.md ».
3. Claude s'arrête à la fin, lance `/verifier`, explique comment tester et attend la validation.
4. Une fois validée : mettre `Statut : réalisée` dans la spec, ajouter une ligne dans
   `docs/historique.md`, retirer l'idée de `docs/backlog.md`. Si la fonctionnalité a imposé
   une décision durable, l'ajouter au CLAUDE.md concerné (racine ou `src/*/CLAUDE.md`).

## Modèle

```markdown
# <Titre de la fonctionnalité>

Statut : à faire | en cours | réalisée

## Objectif
Pourquoi, en 2-3 phrases. Cas d'usage principal.

## Comportement attendu
- Ce que l'utilisateur voit / fait.
- Cas limites et messages d'erreur (en français).

## Contraintes
- Ce qui ne doit pas changer (ex. id = empreinte du fichier d'origine).
- Performances, compatibilité avec la sauvegarde JSON, paramètres à ajouter…

## Hors périmètre
- Ce qu'on ne fait pas cette fois.

## Comment tester
- Fichiers d'exemple, manipulations, résultat attendu.
```
