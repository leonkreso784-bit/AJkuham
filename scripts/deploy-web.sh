#!/usr/bin/env bash
# Deploy frontenda (web/) na Railway servis kuhai-web.
#
# ZASTO OVAKO: `railway up` iz web/ uploada CIJELI repo (korijen, gdje je .railway link),
# pa servis dobije backend i padne na "Env nije u redu". Zato kopiramo web/ u folder
# izvan repoa, linkamo ga na servis i deployamo odatle. (2026-10-08, 14:45)
#
# Pokretanje iz korijena repoa (Git Bash):  bash scripts/deploy-web.sh
# Nakon deploya: https://kuhai-web-production.up.railway.app  (build+start ~1 min)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${TMPDIR:-/tmp}/kuhai-web-deploy"
PROJECT_ID="381157da-303a-4bad-92f3-2e43043ac9af"

echo "== build check"
(cd "$ROOT/web" && npm run build >/dev/null)

echo "== kopija web/ u $DEST (bez node_modules, dist, .env.local)"
rm -rf "$DEST"; mkdir -p "$DEST"
(cd "$ROOT/web" && tar --exclude=node_modules --exclude=dist --exclude=.env.local -cf - .) | (cd "$DEST" && tar -xf -)

cd "$DEST"
railway link -p "$PROJECT_ID" -e production -s kuhai-web >/dev/null
railway up --service kuhai-web -d
echo "== gotovo; provjeri: curl -s -o /dev/null -w '%{http_code}' https://kuhai-web-production.up.railway.app/"
