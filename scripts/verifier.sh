#!/bin/sh
# Routine de vérification de Cairn (commande /verifier), à lancer DANS le conteneur :
#
#   docker compose run --rm dev sh scripts/verifier.sh [ci] 2>&1 | grep -v "Container cairn"
#
# Tests, lint puis build dans un seul conteneur. Sortie volontairement courte (une ligne par
# étape) pour économiser le contexte de l'agent ; à la première erreur, affiche la fin de la
# sortie complète et s'arrête (code 1). Option « ci » : vérifie aussi le lockfile comme
# Vercel (`npm ci --dry-run`), à faire quand package.json a changé.
export NO_COLOR=1 FORCE_COLOR=0
OUT=/tmp/verifier.txt
ESC=$(printf '\033')

# $1 : nom de l'étape ; le reste : la commande.
step() {
  name=$1
  shift
  if "$@" >"$OUT" 2>&1; then
    sed -i "s/${ESC}\[[0-9;]*m//g" "$OUT"
    return 0
  fi
  sed -i "s/${ESC}\[[0-9;]*m//g" "$OUT"
  echo "ÉCHEC $name"
  tail -n 60 "$OUT"
  exit 1
}

step tests npm test
echo "OK tests : $(grep -E '^ *Tests ' "$OUT" | sed 's/^ *//')"

step lint npm run lint
echo "OK lint : 0 erreur, 0 avertissement"

step build npm run build
# Avertissements de Vite / Rolldown (taille de chunk, chunk vide…) : jamais attendus.
warnings=$(grep -iE '\(!\)|warn' "$OUT")
echo "OK build : $(grep -E 'built in' "$OUT" | sed 's/^ *//')"
grep -E 'assets/(index|radix)-' "$OUT" | sed -E 's/^dist\/assets\/([a-z]+)-[^.]+\.([a-z]+) +/  \1.\2 /'
if [ -n "$warnings" ]; then
  echo "AVERTISSEMENTS du build :"
  echo "$warnings"
fi

if [ "$1" = ci ]; then
  step lockfile npm ci --dry-run
  echo "OK lockfile : npm ci --dry-run"
fi
