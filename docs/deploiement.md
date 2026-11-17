# Déploiement sur Vercel

Les contraintes à respecter dans le code sont résumées dans le CLAUDE.md racine ; ce fichier
donne le détail de ce qui est en place et les procédures.

## Principe

**Le déploiement part de GitHub Actions** (workflow « CI/CD », cf. plus bas) : la CLI Vercel
construit depuis les sources (`npm ci` puis `npm run build`, sortie `dist/`) sur le runner,
puis envoie le résultat à Vercel, **seulement si la CI passe**. Docker n'intervient pas. La
configuration Docker doit rester intacte (dev et prod locale). Le déploiement Git automatique
de Vercel est coupé (`vercel.json`). L'utilisateur pousse lui-même après chaque étape validée :
ne jamais pousser.

## Ce qui est en place

- **`vercel.json`** à la racine : `git.deploymentEnabled: false` (Vercel ne déploie plus de
  lui-même à chaque push), `framework: vite`, `buildCommand: npm run build`,
  `outputDirectory: dist`, `installCommand: npm ci`, rewrite `/(.*)` → `/index.html` (SPA,
  équivalent de `docker/nginx.conf`), `Cache-Control: public, max-age=31536000, immutable`
  sur `/assets/(.*)`.
- **Node 26 (LTS) partout** : `"engines": { "node": "26.x" }` dans `package.json` + `.nvmrc`
  (`26`), aligné sur l'image `node:26-alpine` (npm 11). Passage de 22 à 26 demandé par
  l'utilisateur le 14/11/2026 ; Vercel prend en charge 26.x (version par défaut depuis le
  29/10/2026), 24.x et 22.x. Toujours changer ces trois endroits ensemble (Dockerfile,
  engines, .nvmrc).
- **`package-lock.json`** versionné et à jour (requis par `npm ci`). Le lockfile, généré sous
  Alpine, contient bien les binaires natifs Linux glibc dont Vercel et la CI ont besoin. Depuis
  Vite 8 : `@rolldown/binding-linux-x64-gnu` et `lightningcss-linux-x64-gnu`. Rollup et
  esbuild ne sont plus installés.
- `.vercel/` (dossier local de la CLI Vercel) est dans `.gitignore`.
- Données stockées dans le navigateur : la version déployée démarre vide, réimporter les GPX.

## Contraintes de code

- Pas de `base` dans `vite.config.ts` (app servie à la racine du domaine).
- Aucune URL `localhost` codée en dur ; toutes les API et tuiles en **HTTPS** (sinon « mixed
  content » en production).
- **Aucune variable d'environnement** : si une devient nécessaire, le signaler à l'utilisateur.
- Les options `server.*` de Vite (host, polling) ne concernent que le dev.
- Seule URL en `http://` du code : le namespace XML GPX `http://www.topografix.com/GPX/1/1`
  (identifiant obligatoire, jamais appelé) — ce n'est pas du mixed content.

## CI/CD (GitHub Actions)

Un seul workflow, **`.github/workflows/ci.yml`** (« CI/CD »), déclenché à chaque push (toutes
branches) et sur les pull requests. `needs:` ne fonctionne qu'à l'intérieur d'un workflow : CI
et CD sont donc dans le même fichier, et le badge « CI/CD » du README (`ci.yml`, branche
`main`) n'est vert que si les tests **et** la mise en production passent.

- **`checks` (« Lint, test & build »)** sur `ubuntu-latest` : `npm ci`, `npm test`,
  `npm run lint`, `npm run build` (même routine que `/verifier`). Sans Docker, Node lu dans
  `.nvmrc` (`actions/setup-node`, cache npm). La règle « tout passe par Docker » concerne les
  postes de dev, pas la CI.
- **`deploy-preview`** : sur `pull_request`, après `checks`, environnement GitHub `preview`
  (lien « View deployment » = URL unique renvoyée par `vercel deploy`, visible sur la PR).
  Ignoré pour les PR venant d'un fork (pas d'accès aux secrets).
- **`deploy-production`** : sur un push vers `main`, après `checks`, environnement GitHub
  `production` (lien = `https://cairn-gpx.vercel.app/` ; l'URL unique est dans les logs).
  `concurrency: deploy-production` sans annulation.
- **Étapes de déploiement** : CLI Vercel figée (`vercel@65.17.0`, à monter à la main), puis
  `vercel pull --environment=<preview|production>` → `vercel build` (`--prod`) →
  `vercel deploy --prebuilt` (`--prod`). `vercel build` lit `vercel.json` (commandes, rewrite
  SPA, en-têtes de cache : vérifié dans `.vercel/output/config.json`).
- **Secrets** (dépôt GitHub → Settings → Secrets and variables → Actions) : `VERCEL_TOKEN`,
  `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Sans eux, les jobs de déploiement échouent et **plus
  rien n'est déployé** (Vercel ne déploie plus de lui-même) : les créer avant de pousser.
- **Annulation** : un nouveau push sur la même branche (ou la même PR) annule l'exécution en
  cours, sauf sur `main` où les exécutions sont mises en file (une mise en production n'est
  jamais coupée).
- **Lint sans avertissement** : le script `lint` est `eslint . --max-warnings=0` (échoue aussi
  en local et dans `/verifier`).
- Versions d'actions : `actions/checkout@v7`, `actions/setup-node@v7` (dernières majeures au
  17/11/2026). Workflow validé par `actionlint`.

### Mise en place (une fois, avant le premier push)

**Vercel**
1. **Identifiants du projet** : Vercel → projet → **Settings → General** → copier
   **Project ID** (`prj_…`) → secret `VERCEL_PROJECT_ID`. Puis réglages du compte ou de
   l'équipe propriétaire du projet → **Settings → General** → copier **Team ID** (`team_…`)
   → secret `VERCEL_ORG_ID`. Variante : `vercel link` puis lire `.vercel/project.json`
   (`projectId`, `orgId` ; dossier ignoré par Git).
2. **Token** : avatar → **Account Settings → Tokens** → **Create** : nom
   `github-actions-cairn`, portée (*scope*) = l'équipe qui possède le projet, expiration
   **1 an** (noter la date de renouvellement ; un token expiré fait échouer le déploiement).
   Copier la valeur (affichée une seule fois) → secret `VERCEL_TOKEN`.
3. **Variables d'environnement** (Settings → Environment Variables) : aucune n'est nécessaire
   (l'app n'en utilise pas). `vercel pull` récupère ce qui y est défini : la liste doit rester
   vide pour Preview et Production.
4. **Deployment Checks** (Settings → Build and Deployment) : **retirer** le check
   « Lint, test & build ». Il servait à bloquer la production tant que la CI échouait ; c'est
   désormais le `needs: checks` du workflow qui le fait.
5. **Dépôt Git lié** (Settings → Git) : le **garder**. Avec `deploymentEnabled: false`, il ne
   déclenche plus rien ; il reste utile pour rattacher les déploiements à leur commit et pour
   réactiver le déploiement Git en une ligne si besoin. Le déconnecter n'apporterait rien.
6. **À vérifier** :
   - *Ignored Build Step* (Settings → Build and Deployment) : vide. Il ne concerne que les
     déploiements Git, mais un reste de configuration prêterait à confusion.
   - *Deployment Protection* (Settings → Deployment Protection) : par défaut, les previews
     sont protégées par **Vercel Authentication**. Le lien « View deployment » de la PR
     demande alors une connexion Vercel. C'est acceptable pour un usage perso ; sinon, choisir
     « Only Production Deployments » ou désactiver la protection.
   - *Domaines* (Settings → Domains) : `cairn-gpx.vercel.app` est rattaché à **Production**.
     `vercel deploy --prod` l'affecte automatiquement au nouveau déploiement.

**GitHub**
1. **Secrets** : Settings → Secrets and variables → Actions → **New repository secret** pour
   chacun des trois.
2. **Environnements** : `preview` et `production` sont créés automatiquement au premier
   déploiement. Facultatif : Settings → Environments → `production` → **Deployment branches
   and tags** → *Selected branches* → `main`, et éventuellement **Required reviewers** pour
   valider chaque mise en production à la main.
3. Facultatif : protection de `main` (Rulesets → « Require status checks to pass » →
   « Lint, test & build ») pour interdire une fusion de PR tant que la CI échoue.

## Procédures

- **Tester le build comme Vercel** : le script `preview` inclut `--host 0.0.0.0 --port 4173
  --strictPort` ; le port est publié à la volée (pas de changement de `docker-compose.yml`) :
  `docker compose run --rm -p 4173:4173 dev sh -c "npm run build && npm run preview"` →
  http://localhost:4173 (le fallback SPA de `vite preview` est actif).
- **Vérifier la cohérence du lockfile comme Vercel** : `docker compose run --rm dev npm ci --dry-run`.
- **Après toute modification de `package.json`** : resynchroniser avec
  `docker compose run --rm dev npm install --package-lock-only`.

## Avertissements connus

- L'avertissement npm 11 `install-scripts … esbuild` (« not yet covered by allowScripts ») a
  disparu avec Vite 8, qui n'installe plus esbuild. Si un autre paquet à script
  d'installation le déclenche, approuver avec `npm install-scripts approve <paquet>`.
- `npm audit` : 0 vulnérabilité après le passage à Vitest 5 (17/11/2026, cf.
  `docs/specs/vitest-5.md`), puis **11 « high »** le soir même (12 depuis Vite 8 :
  `@vitejs/plugin-react` 6 dépend de Vite, ce qui ajoute une ligne). Elles viennent toutes de la
  nouvelle alerte GHSA-fc5q-39xc-vjpf : un ReDoS sur les extglobs de **picomatch, toutes
  versions**. picomatch est tiré par Vite (via `tinyglobby` / `fdir`) et par
  `typescript-eslint`. Il ne sert qu'au développement et au build : il n'est pas livré dans
  le bundle. Aucun correctif n'existe encore : `npm audit fix --force` rétrograderait Vite en
  6.2.7, **ne pas le lancer**. À suivre au backlog.
