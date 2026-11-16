---
description: Routine de vérification de fin d'étape (tests, lint, build, serveur dev)
---

Lance la routine de vérification de Cairn. Tout se fait dans le conteneur, jamais sur l'hôte,
dans cet ordre. Tout doit passer **sans erreur ni avertissement**. À la première erreur :
corrige-la si elle vient de mes modifications, puis relance la routine depuis le début ;
sinon, arrête-toi et explique.

1. `docker compose run --rm dev npm test` — tests unitaires (Vitest).
2. `docker compose run --rm dev npm run lint` — ESLint, 0 erreur, 0 warning.
3. `docker compose run --rm dev npm run build` — `tsc -b` + `vite build`, c'est ce que Vercel
   exécute. **Obligatoire** : le serveur dev ne vérifie pas les types. Lis aussi les
   avertissements du build (chunks vides, taille…).
4. Serveur dev : vérifie qu'il compile les modules modifiés
   (`curl http://localhost:5173/src/<chemin du module>` → 200 pour chacun).
5. Si `package.json` a changé : `docker compose run --rm dev npm ci --dry-run` (cohérence du
   lockfile, comme Vercel).
6. Si la carte est concernée (survol, clics, couches) : rappelle-moi de tester aussi le build
   avec `docker compose run --rm -p 4173:4173 dev sh -c "npm run build && npm run preview"`
   → http://localhost:4173 (dev ≠ prod à cause du StrictMode).

Compte rendu final : le résultat de chacune des trois commandes (tests : nombre passés ;
lint : erreurs/warnings ; build : succès et avertissements éventuels), puis les points 4 à 6
s'ils s'appliquent.

$ARGUMENTS
