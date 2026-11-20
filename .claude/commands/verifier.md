---
description: Routine de vérification de fin d'étape (tests, lint, build, serveur dev)
---

Lance la routine de vérification de Cairn. Tout se fait dans le conteneur, jamais sur l'hôte.
Tout doit passer **sans erreur ni avertissement**. À la première erreur : corrige-la si elle
vient de mes modifications, puis relance la routine depuis le début ; sinon, arrête-toi et
explique.

1. Tests, lint et build en une commande (un seul conteneur, sortie courte) :
   `docker compose run --rm dev sh scripts/verifier.sh 2>&1 | grep -v "Container cairn"`
   - ajoute l'argument `ci` (`… verifier.sh ci …`) si `package.json` a changé : cohérence du
     lockfile, comme Vercel (`npm ci --dry-run`) ;
   - une ligne `OK` par étape ; `ÉCHEC <étape>` suivi de la fin de la sortie complète sinon ;
   - le build est celui de Vercel (`tsc -b` + `vite build`), **obligatoire** : le serveur dev
     ne vérifie pas les types. Toute ligne « AVERTISSEMENTS du build » est un échec.
2. Serveur dev : vérifie qu'il compile les modules modifiés
   (`curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/src/<module>` → 200).
   Un `.css` importé par `index.css` (ex. `leaflet.css`) ne se teste pas seul : tester
   `src/index.css`.
3. Si la carte est concernée (survol, clics, couches) : rappelle-moi de tester aussi le build
   avec `docker compose run --rm -p 4173:4173 dev sh -c "npm run build && npm run preview"`
   → http://localhost:4173 (dev ≠ prod à cause du StrictMode).

Compte rendu final : tests (nombre passés), lint (erreurs/avertissements), build (succès,
avertissements éventuels), puis les points 2 et 3 s'ils s'appliquent.

$ARGUMENTS
