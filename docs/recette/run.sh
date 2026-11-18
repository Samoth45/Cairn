#!/bin/sh
# Recette visuelle de la migration UI (docs/specs/migration-ui.md, §6). À lancer depuis la
# racine du projet, sous Git Bash (Windows) ou un shell POSIX :
#
#   sh docs/recette/run.sh record           enregistre les réponses Open-Meteo (une fois, lot 0)
#   sh docs/recette/run.sh capture <nom>    build + preview, puis captures dans docs/recette/captures/<nom>
#   sh docs/recette/run.sh compare <avant> <après>   rapport dans docs/recette/captures/rapport-<avant>-<après>
#
# Rien n'est installé dans le projet : chromium, puppeteer-core, pixelmatch et pngjs vivent dans
# un conteneur node:26-alpine jetable. Les captures sont ignorées par Git.
set -e
export MSYS_NO_PATHCONV=1
ROOT=$(pwd -W 2>/dev/null || pwd)
CMD=$1
NET=cairn_default
PREVIEW=cairn-recette-preview

tools() {
  # $1 : commande node à lancer dans le conteneur jetable (dossier de travail /work)
  docker run --rm --network "$NET" \
    -v "$ROOT/docs/recette:/recette" -v "$ROOT/samples:/samples:ro" \
    node:26-alpine sh -c "apk add --no-cache chromium font-noto font-noto-symbols font-noto-emoji >/dev/null 2>&1 \
      && mkdir -p /work && cd /work && npm init -y >/dev/null \
      && npm i puppeteer-core@24 pixelmatch@7 pngjs@7 --loglevel=error >/dev/null 2>&1 \
      && cp /recette/*.mjs . && $1"
}

start_preview() {
  docker rm -f "$PREVIEW" >/dev/null 2>&1 || true
  docker compose run -d --rm --name "$PREVIEW" dev sh -c "npm run build && npm run preview" >/dev/null
  i=0
  until docker logs "$PREVIEW" 2>&1 | grep -q "Local:"; do
    i=$((i + 1)); [ $i -gt 90 ] && { docker logs "$PREVIEW"; exit 1; }; sleep 2
  done
  IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$PREVIEW")
  URL="http://$IP:4173/"
}

stop_preview() { docker stop "$PREVIEW" >/dev/null 2>&1 || true; }

case "$CMD" in
  record)
    start_preview; trap stop_preview EXIT
    tools "node capture.mjs record $URL /recette/captures/enregistrement"
    ;;
  capture)
    [ -n "$2" ] || { echo "usage : run.sh capture <nom>"; exit 2; }
    start_preview; trap stop_preview EXIT
    rm -rf "docs/recette/captures/$2"
    tools "node capture.mjs replay $URL /recette/captures/$2"
    ;;
  compare)
    [ -n "$3" ] || { echo "usage : run.sh compare <avant> <après>"; exit 2; }
    tools "node compare.mjs /recette/captures/$2 /recette/captures/$3 /recette/captures/rapport-$2-$3"
    ;;
  *)
    echo "usage : run.sh record | capture <nom> | compare <avant> <après>"; exit 2
    ;;
esac
