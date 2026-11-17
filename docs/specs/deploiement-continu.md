# Déploiement continu (CD) : Vercel via GitHub Actions + GitHub Deployments

Statut : réalisée

## Objectif
Aujourd'hui, Vercel déploie lui-même à chaque push grâce à son intégration Git. La CI GitHub
Actions tourne à côté, et aucun « GitHub Deployment » n'apparaît dans GitHub : ni dans l'onglet
Deployments, ni dans le panneau Environments, ni sur les PR. On veut déployer **depuis GitHub
Actions avec la CLI Vercel**, **seulement si la CI passe**, et voir chaque déploiement dans
GitHub.

## Décisions prises (questions du 17/11/2026)
- **Un seul workflow** : `.github/workflows/ci.yml`. Les jobs de déploiement y sont ajoutés, car
  `needs:` ne fonctionne qu'à l'intérieur d'un même workflow. Le workflow est renommé
  **« CI/CD »** ; le job de CI garde son nom « Lint, test & build ».
- **Un seul badge « CI/CD »** dans le README, sur `ci.yml`, branche `main`. Il est vert seulement
  si les tests **et** la mise en production passent. Il remplace l'ancien badge « tests » et le
  badge « site en ligne » (`img.shields.io/website`).
- **URL affichée pour la production** (`environment.url`, lien « View deployment ») : le domaine
  stable `https://cairn-gpx.vercel.app/`. L'URL unique du déploiement est écrite dans les logs du
  job. Pour les previews, c'est l'URL unique renvoyée par `vercel deploy`.

## Comportement attendu

### Workflow `ci.yml` (« CI/CD »)
Les déclencheurs ne changent pas : push sur toutes les branches, et pull requests.

- **`checks`** (« Lint, test & build ») : inchangé.
- **`deploy-preview`** (« Déploiement preview ») :
  - Tourne sur `pull_request`, avec `needs: checks`, dans l'environnement GitHub `preview`.
  - Il est **ignoré** (pas en échec) pour les PR venant d'un fork, qui n'ont pas accès aux
    secrets.
- **`deploy-production`** (« Déploiement production ») :
  - Tourne sur un `push` vers `main`, avec `needs: checks`, dans l'environnement GitHub
    `production`.
  - Son `concurrency` est `deploy-production` sans annulation : deux mises en production ne
    tournent jamais en même temps, et une mise en production en cours n'est jamais
    interrompue.
- **Étapes de déploiement** :
  1. checkout ;
  2. Node lu dans `.nvmrc` ;
  3. CLI Vercel installée à une version figée ;
  4. `vercel pull --yes --environment=<preview|production>` ;
  5. `vercel build` (avec `--prod` pour la production) ;
  6. `vercel deploy --prebuilt` (avec `--prod` pour la production). L'URL renvoyée est
     récupérée dans un output de step.
- **Secrets** : `VERCEL_TOKEN`, `VERCEL_ORG_ID` et `VERCEL_PROJECT_ID`. Le workflow ne fait que
  les référencer ; c'est l'utilisateur qui les crée.
- **Annulation automatique** : un nouveau push annule toujours l'exécution obsolète, **sauf sur
  `main`**. Là, les exécutions sont mises en file, pour ne jamais couper une mise en production
  en cours.

### Vercel
- `vercel.json` reçoit `"git": { "deploymentEnabled": false }`, ce qui arrête les déploiements
  automatiques de Vercel à chaque push. Le reste de la configuration ne change pas : le
  framework, les commandes, la sortie `dist`, le rewrite SPA et les en-têtes de cache sont
  toujours lus par `vercel build`.

### README
- Un seul badge « CI/CD » remplace les badges « tests » et « vercel / en ligne ».
- Le badge et le schéma d'architecture décrivent le nouveau chemin :
  GitHub → Actions (CI puis CD) → Vercel.

## Contraintes
- Aucune variable d'environnement applicative : `vercel pull` n'en récupère aucune.
- Docker n'est pas concerné. La règle « tout passe par Docker » s'applique aux postes de dev,
  pas à la CI.
- Toute règle « ne jamais pousser » reste vraie : le CD se déclenche au push fait par
  l'utilisateur.
- Workflow validé avec `actionlint`.

## Hors périmètre (étapes manuelles pour l'utilisateur, listées à la fin)
- `vercel link` ou les réglages du projet pour obtenir orgId et projectId, création du token,
  ajout des 3 secrets dans GitHub.
- Règles de protection de l'environnement `production` : branche `main` seulement, validation
  manuelle éventuelle.
- Les « Deployment Checks » de Vercel deviennent inutiles : il faut les retirer.
- Pas de preview pour les PR venant d'un fork.

## Comment tester
- Ouvrir une PR : la CI passe, puis « Déploiement preview » tourne. La PR affiche « This branch
  was successfully deployed » avec le lien de la preview.
- Fusionner sur `main` : la CI passe, puis « Déploiement production » tourne. L'onglet
  Deployments du dépôt affiche `production` avec le lien `cairn-gpx.vercel.app`.
- Faire échouer la CI sur une branche, par exemple avec un test cassé : aucun job de
  déploiement ne tourne.
- Vercel → Deployments : plus aucun déploiement « Git » automatique, seulement ceux de la CLI.
- Badge « CI/CD » du README : vert après une mise en production réussie.
