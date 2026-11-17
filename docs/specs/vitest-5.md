# Vitest 5 : vulnérabilités signalées par `npm audit`

Statut : réalisée

## Objectif
`npm audit` signale 3 vulnérabilités (2 critiques `tinypool`, 1 modérée `@vitest/mocker`),
toutes amenées par `vitest@3.2.7`. Elles ne concernent que les outils de test : rien dans le
build déployé. On passe à Vitest 5 pour revenir à un audit propre, sans monter Vite.

## Comportement attendu
- Aucun changement dans l'application.
- `npm audit` : **0 vulnérabilité**.
- Les 115 tests (13 fichiers) passent, sans modification de leur contenu si possible.

État vérifié le 17/11/2026 (`npm view`) :

| Version          | Vite accepté                 | Node accepté                     | Vulnérable |
|------------------|------------------------------|----------------------------------|------------|
| vitest 3.2.7 (actuelle) | —                     | —                                | oui (`tinypool`, `@vitest/mocker`) |
| vitest 4.1.12    | `^6.0.0 \|\| ^7 \|\| ^8`      | `^20 \|\| ^22 \|\| >=24`          | non (plus de `tinypool`, `@vitest/mocker` 4.1.12) |
| **vitest 5.1.0** (retenue) | `^6.4.0 \|\| ^7 \|\| ^8` | `^22.12 \|\| ^24 \|\| >=26`  | non |

Vite 6.4.6 installé et Node 26 → Vitest 5.1 compatible, **Vite reste en 6** (c'est la version
proposée par `npm audit fix --force`). Repli : Vitest 4.1.12 si Vitest 5 pose un problème non
trivial.

## Contraintes
- Une seule dépendance changée : `vitest` (`^3.2.4` → `^5.1.0`), en devDependency. Ne pas
  utiliser `npm audit fix --force` (il pourrait toucher d'autres paquets) : installer la version
  explicitement dans le conteneur, puis resynchroniser le lockfile
  (`npm install --package-lock-only`) et reconstruire l'image (`docker compose build dev`).
- Configuration de test inchangée sauf nécessité : `test` dans `vite.config.ts`
  (`environment: 'jsdom'`, `setupFiles` avec `fake-indexeddb/auto`) et
  `/// <reference types="vitest/config" />`. Les tests n'utilisent que
  `vi.stubGlobal` / `vi.unstubAllGlobals` (pas de mocks de modules).
- jsdom 31 et fake-indexeddb conservés (Vitest accepte toute version de jsdom).
- `npm run build` (`tsc -b`) doit passer : les types de Vitest sont référencés dans
  `vite.config.ts`.
- CI GitHub Actions et Vercel : `npm ci` doit passer (vérifier avec `npm ci --dry-run`) ;
  Vercel n'exécute pas les tests mais installe les devDependencies.
- Mettre à jour les mentions de Vitest 3 : `CLAUDE.md` (Stack, ligne du backlog),
  `docs/deploiement.md` (ligne `npm audit`), README si une version y est citée.
- Version de l'application : outillage seulement → pas de changement de version (comme la
  montée d'ESLint 10), sauf avis contraire.

## Hors périmètre
- Vite 7/8, `@vitejs/plugin-react` 6 (exige Vite 8), TypeScript 7, `globals` 17,
  `dexie-react-hooks` 4 : autres montées majeures signalées par `npm outdated`, à traiter
  séparément si besoin (à noter au backlog).
- Couverture de code, mode navigateur de Vitest.

## Comment tester
- `docker compose run --rm dev npm audit` → `found 0 vulnerabilities`.
- `/verifier` : tests (115 passés), lint, build, `npm ci --dry-run` (package.json modifié).
- `docker compose run --rm dev npx vitest --version` → 5.1.x (image bien reconstruite).
- Application : aucune vérification fonctionnelle nécessaire (rien dans le bundle), un coup
  d'œil à `npm run preview` suffit.
