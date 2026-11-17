# Déploiement sur Vercel

Les contraintes à respecter dans le code sont résumées dans le CLAUDE.md racine ; ce fichier
donne le détail de ce qui est en place et les procédures.

## Principe

Le projet est importé dans Vercel depuis le dépôt Git. **Vercel construit depuis les sources
(`npm ci` puis `npm run build`, sortie `dist/`) et ne lance pas Docker.** La configuration Docker
doit rester intacte (dev et prod locale). L'utilisateur pousse lui-même après chaque étape
validée : ne jamais pousser.

## Ce qui est en place

- **`vercel.json`** à la racine : `framework: vite`, `buildCommand: npm run build`,
  `outputDirectory: dist`, `installCommand: npm ci`, rewrite `/(.*)` → `/index.html` (SPA,
  équivalent de `docker/nginx.conf`), `Cache-Control: public, max-age=31536000, immutable`
  sur `/assets/(.*)`.
- **Node 26 (LTS) partout** : `"engines": { "node": "26.x" }` dans `package.json` + `.nvmrc`
  (`26`), aligné sur l'image `node:26-alpine` (npm 11). Passage de 22 à 26 demandé par
  l'utilisateur le 14/11/2026 ; Vercel prend en charge 26.x (version par défaut depuis le
  29/10/2026), 24.x et 22.x. Toujours changer ces trois endroits ensemble (Dockerfile,
  engines, .nvmrc).
- **`package-lock.json`** versionné et à jour (requis par `npm ci`). Le lockfile, généré sous
  Alpine, contient bien les binaires natifs Linux glibc (`@rollup/rollup-linux-x64-gnu`,
  `@esbuild/linux-x64`) dont Vercel a besoin.
- `.vercel/` (dossier local de la CLI Vercel) est dans `.gitignore`.
- **README** : section « Déploiement sur Vercel » (build depuis les sources via `vercel.json`,
  push sur la branche principale = production, autres branches = previews, données stockées
  dans le navigateur → la version déployée démarre vide, réimporter les GPX).

## Contraintes de code

- Pas de `base` dans `vite.config.ts` (app servie à la racine du domaine).
- Aucune URL `localhost` codée en dur ; toutes les API et tuiles en **HTTPS** (sinon « mixed
  content » en production).
- **Aucune variable d'environnement** : si une devient nécessaire, le signaler à l'utilisateur.
- Les options `server.*` de Vite (host, polling) ne concernent que le dev.
- Seule URL en `http://` du code : le namespace XML GPX `http://www.topografix.com/GPX/1/1`
  (identifiant obligatoire, jamais appelé) — ce n'est pas du mixed content.

## Intégration continue (GitHub Actions)

- **`.github/workflows/ci.yml`** : à chaque push (toutes branches) et sur les pull requests,
  job « Lint, test & build » sur `ubuntu-latest` : `npm ci`, `npm test`, `npm run lint`, `npm run build`
  (même routine que `/verifier`). Sans Docker, comme Vercel : Node lu dans `.nvmrc`
  (`actions/setup-node`, cache npm). La règle « tout passe par Docker » concerne les postes
  de dev, pas la CI.
- **Lint sans avertissement** : le script `lint` est `eslint . --max-warnings=0` (échoue aussi
  en local et dans `/verifier`).
- Un nouveau push sur la même branche (ou la même PR) annule l'exécution en cours.
- **Le nom du job (« Lint, test & build ») est celui du « check » GitHub** sélectionné dans Vercel (voir
  ci-dessous) : le renommer impose de mettre à jour le réglage Vercel.
- Versions d'actions : `actions/checkout@v7`, `actions/setup-node@v7` (dernières majeures au
  17/11/2026). Workflow validé par `actionlint` et rejoué dans un conteneur `node:26` (Debian,
  glibc, comme le runner Ubuntu).

### Production bloquée tant que la CI échoue (Vercel « Deployment Checks »)

Vercel crée toujours le déploiement, mais ne l'affecte au domaine de production qu'une fois
les checks GitHub réussis (puis automatiquement). Les previews ne sont pas concernées. En cas
d'urgence : « Force Promote » depuis la page du déploiement. Fonction ouverte à tous les
projets liés à GitHub (changelog Vercel du 09/10/2025) ; l'offre Hobby n'est pas citée
nommément : à confirmer dans l'interface.

Réglage (une fois, après un premier passage de la CI pour que le check existe) :
1. Vercel → projet → **Settings → Git** : le projet est bien lié au dépôt GitHub.
2. **Settings → Environments → Production** : l'alias automatique de production est activé.
3. **Settings → Build and Deployment → Deployment Checks → Add Checks** → fournisseur
   **GitHub** → sélectionner le check **Lint, test & build**.
4. Côté GitHub, rien d'obligatoire. Facultatif : protection de la branche principale
   (Settings → Branches / Rulesets → « Require status checks to pass » → « Lint, test & build ») pour
   interdire une fusion de PR tant que la CI échoue.

## Procédures

- **Tester le build comme Vercel** : le script `preview` inclut `--host 0.0.0.0 --port 4173
  --strictPort` ; le port est publié à la volée (pas de changement de `docker-compose.yml`) :
  `docker compose run --rm -p 4173:4173 dev sh -c "npm run build && npm run preview"` →
  http://localhost:4173 (le fallback SPA de `vite preview` est actif).
- **Vérifier la cohérence du lockfile comme Vercel** : `docker compose run --rm dev npm ci --dry-run`.
- **Après toute modification de `package.json`** : resynchroniser avec
  `docker compose run --rm dev npm install --package-lock-only`.

## Avertissements connus

- npm 11 affiche `npm warn install-scripts … esbuild@0.25.12 (postinstall: node install.js)`
  « not yet covered by allowScripts » : simple avertissement (le script s'exécute encore),
  esbuild fonctionne (vérifié). Si une future version de npm bloque ces scripts, approuver
  avec `npm install-scripts approve esbuild` (non fait : pas demandé).
- `npm audit` : 0 vulnérabilité depuis le passage à Vitest 5 (17/11/2026, cf.
  `docs/specs/vitest-5.md`).
