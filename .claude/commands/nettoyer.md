---
description: Audit du projet pour réduire le contexte lu par l'agent (propose, n'applique qu'après validation)
---

Fais un audit du projet Cairn pour limiter ce que tu lis à chaque session, **sans perdre de
contexte utile**. Tu proposes, le propriétaire valide, puis tu appliques. **Ne supprime ni ne
réécris rien avant sa validation.** Ne touche pas au code source (`src/**/*.ts(x)`, hors
commentaires périmés) : un remaniement de code est une décision à part.

## 1. Mesurer (sans rien modifier)

- Chargé à **chaque session** : `CLAUDE.md`, `CLAUDE.local.md`, l'index de la mémoire
  (`MEMORY.md`) — taille en ko.
- Lu **à la demande** : `src/*/CLAUDE.md`, `docs/*.md`, `docs/specs/*.md` — lignes et ko.
- Encombrement : `docs/recette/captures/` (dossiers, Mo), branches locales fusionnées dans
  `main` (`git branch --merged main`), branches distantes supprimées (`git fetch --prune`).
- Compare avec les chiffres du dernier passage s'ils figurent dans `docs/historique.md`.

## 2. Repérer

- **Specs terminées et volumineuses** (> 15 ko) : candidates à l'archivage dans
  `docs/archives/` (texte intégral, avertissement « ne pas lire sans raison » en tête), avec une
  version courte à leur place (statut, décisions, bilan). Modèle : `docs/specs/migration-ui.md`.
- **Mentions périmées** dans les `CLAUDE.md` et les docs : classes, fichiers, commandes,
  composants ou sections qui n'existent plus. **Vérifie chacune par une recherche** dans le code
  avant de la signaler.
- **Doublons** : une même information dans `CLAUDE.md` et dans un autre document (garder le
  détail à un seul endroit, un renvoi ailleurs).
- **Historique des lots ou des étapes** dans les fichiers de règles (« au lot 3… ») : il a sa
  place dans `docs/historique.md`, pas dans un `CLAUDE.md`.
- **Entrées terminées** encore dans `docs/backlog.md`.
- **Captures** de recette autres que la référence en cours, **branches** fusionnées.

## 3. Proposer

Un tableau : élément, action proposée, gain estimé (ko ou Mo), risque. Puis **attends la
validation**, ligne par ligne si besoin (outil de question à choix multiple).

Règles pour les propositions :
- **Ne jamais supprimer une règle qui dit pourquoi** (cause d'un bug, piège, contrainte) : la
  raccourcir, la déplacer, mais garder la raison.
- Ne pas toucher à `docs/cahier-des-charges.md` (référence figée) ni au `README.md` (vitrine,
  hors du contexte de travail) sauf mention périmée.
- Ne pas interdire la lecture des captures (`.claude/settings.json`) : elles servent à la
  recette visuelle.

## 4. Appliquer (après validation)

- Sur une branche `chore/nettoyage-<date>` créée depuis `develop` à jour.
- Déplacements de fichiers par `git mv` (garde l'historique).
- Suppressions sur disque : PowerShell `Remove-Item -LiteralPath` sur des chemins complets
  vérifiés comme étant dans le projet, jamais enchaînées après une commande d'inspection ;
  branches par `git branch -d` (refuse une branche non fusionnée). Les branches distantes sont
  supprimées par le propriétaire.
- Mettre à jour les renvois vers les fichiers déplacés (`grep` du nom).
- Ajouter une courte entrée dans `docs/historique.md` avec les tailles avant / après.
- Compte rendu : tableau avant / après, ce qui n'a pas été fait et pourquoi. **Commits
  seulement sur demande, jamais de push.**

$ARGUMENTS
