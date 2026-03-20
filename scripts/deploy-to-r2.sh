#!/bin/bash
#
# VibePub R2 Deploy Script
# Clone a GitHub repo and upload all files to R2 bucket under apps/{slug}/
#
# Usage:
#   ./scripts/deploy-to-r2.sh <repo_url> <slug> [tag]
#
# Examples:
#   ./scripts/deploy-to-r2.sh https://github.com/user/qr-generator qr-generator
#   ./scripts/deploy-to-r2.sh https://github.com/user/qr-generator qr-generator v1.0
#
set -euo pipefail

VIBEPUB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CF_TOKEN="$(cat ~/.config/cloudflare/vibepub_token)"
WRANGLER="npx wrangler"
TMPDIR_BASE="/tmp/vibepub-r2-deploy"

REPO_URL="${1:?Usage: deploy-to-r2.sh <repo_url> <slug> [tag]}"
SLUG="${2:?Usage: deploy-to-r2.sh <repo_url> <slug> [tag]}"
TAG="${3:-}"

cd "$VIBEPUB_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Deploying to R2: $SLUG"
echo "   Repo: $REPO_URL${TAG:+ @ $TAG}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CLONE_DIR="$TMPDIR_BASE/$SLUG"
rm -rf "$CLONE_DIR"
mkdir -p "$TMPDIR_BASE"

# Clone the repo
echo "📦 Cloning..."
if [ -n "$TAG" ]; then
  git clone --depth 1 --branch "$TAG" "$REPO_URL" "$CLONE_DIR" 2>/dev/null
else
  git clone --depth 1 "$REPO_URL" "$CLONE_DIR" 2>/dev/null
fi

# Remove .git and other non-web files
rm -rf "$CLONE_DIR/.git" "$CLONE_DIR/.github" "$CLONE_DIR/.gitignore" "$CLONE_DIR/node_modules"
rm -f "$CLONE_DIR/LICENSE" "$CLONE_DIR/README.md" "$CLONE_DIR/package.json" "$CLONE_DIR/package-lock.json"

# Check for index.html
if [ ! -f "$CLONE_DIR/index.html" ]; then
  echo "❌ No index.html found in repo root!"
  rm -rf "$CLONE_DIR"
  exit 1
fi

# Count files
FILE_COUNT=$(find "$CLONE_DIR" -type f | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "$CLONE_DIR" | cut -f1)
echo "📁 Files: $FILE_COUNT, Size: $TOTAL_SIZE"

# Upload each file to R2 under apps/{slug}/
echo "☁️  Uploading to R2..."
UPLOADED=0
find "$CLONE_DIR" -type f | while read -r filepath; do
  # Get relative path from clone dir
  relpath="${filepath#$CLONE_DIR/}"
  r2key="apps/$SLUG/$relpath"

  CLOUDFLARE_API_TOKEN="$CF_TOKEN" $WRANGLER r2 object put "vibepub-apps/$r2key" \
    --file="$filepath" 2>/dev/null

  echo "  ✓ $relpath"
done

echo ""
echo "✅ Deployed! → https://${SLUG}.vibepub.dev"
echo "   R2 path: apps/$SLUG/"

# Cleanup
rm -rf "$CLONE_DIR"

echo ""
echo "📝 Remember to add/update the app record in D1 if needed."
echo "🎉 Done!"
