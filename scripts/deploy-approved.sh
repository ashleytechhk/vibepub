#!/bin/bash
#
# VibePub Deploy Script
# Picks up 'approved' submissions, clones repo, deploys to CF Pages, updates DB.
#
# Usage: ./scripts/deploy-approved.sh
#
set -euo pipefail

VIBEPUB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CF_TOKEN="$(cat ~/.config/cloudflare/vibepub_token)"
CF_ACCOUNT_ID="81397f8907c5e0e2e921d58c23f2093f"
WRANGLER="npx wrangler"
TMPDIR_BASE="/tmp/vibepub-deploy"

cd "$VIBEPUB_DIR"

echo "🔍 Checking for approved submissions..."

# Query approved submissions from D1
APPROVED=$(CLOUDFLARE_API_TOKEN="$CF_TOKEN" $WRANGLER d1 execute vibepub-db --remote --json \
  --command "SELECT id, app_id, repo_url, repo_tag, app_slug FROM submissions WHERE status = 'approved'" \
  2>/dev/null | python3 -c "
import sys, json
text = sys.stdin.read()
start = text.find('[')
if start == -1: sys.exit(0)
# Find the outermost JSON array
bracket_count = 0
end = start
for i, ch in enumerate(text[start:], start):
    if ch == '[': bracket_count += 1
    elif ch == ']': bracket_count -= 1
    if bracket_count == 0:
        end = i + 1
        break
data = json.loads(text[start:end])
results = data[0].get('results', []) if data else []
for r in results:
    print(f\"{r['id']}|{r['app_id']}|{r['repo_url']}|{r['repo_tag']}|{r['app_slug']}\")
" 2>/dev/null || true)

if [ -z "$APPROVED" ]; then
  echo "✅ No approved submissions to deploy."
  exit 0
fi

mkdir -p "$TMPDIR_BASE"

echo "$APPROVED" | while IFS='|' read -r SUB_ID APP_ID REPO_URL REPO_TAG APP_SLUG; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🚀 Deploying: $APP_SLUG"
  echo "   Repo: $REPO_URL @ $REPO_TAG"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  CLONE_DIR="$TMPDIR_BASE/$APP_SLUG"
  rm -rf "$CLONE_DIR"

  # Clone the repo at the specific tag
  echo "📦 Cloning..."
  if ! git clone --depth 1 --branch "$REPO_TAG" "$REPO_URL" "$CLONE_DIR" 2>/dev/null; then
    echo "❌ Failed to clone $REPO_URL @ $REPO_TAG"
    CLOUDFLARE_API_TOKEN="$CF_TOKEN" $WRANGLER d1 execute vibepub-db --remote \
      --command "UPDATE submissions SET status = 'rejected', reject_reason = 'Git clone failed' WHERE id = '$SUB_ID'" 2>/dev/null
    continue
  fi

  # Deploy to CF Pages
  echo "🌐 Deploying to CF Pages..."
  if CLOUDFLARE_API_TOKEN="$CF_TOKEN" $WRANGLER pages deploy "$CLONE_DIR" \
    --project-name "$APP_SLUG" \
    --branch main \
    --commit-message "VibePub auto-deploy $REPO_TAG" 2>&1; then

    NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    HOMEPAGE="https://${APP_SLUG}.pages.dev"

    echo "✅ Deployed! → $HOMEPAGE"

    # Update DB: submission → completed, app → published
    CLOUDFLARE_API_TOKEN="$CF_TOKEN" $WRANGLER d1 execute vibepub-db --remote \
      --command "UPDATE submissions SET status = 'completed', completed_at = '$NOW' WHERE id = '$SUB_ID'" 2>/dev/null

    CLOUDFLARE_API_TOKEN="$CF_TOKEN" $WRANGLER d1 execute vibepub-db --remote \
      --command "UPDATE apps SET status = 'published', published_at = '$NOW', homepage_url = '$HOMEPAGE', updated_at = '$NOW' WHERE id = '$APP_ID'" 2>/dev/null

    echo "📝 DB updated: published"
  else
    echo "❌ Deploy failed for $APP_SLUG"
    CLOUDFLARE_API_TOKEN="$CF_TOKEN" $WRANGLER d1 execute vibepub-db --remote \
      --command "UPDATE submissions SET status = 'rejected', reject_reason = 'CF Pages deploy failed' WHERE id = '$SUB_ID'" 2>/dev/null
  fi

  # Cleanup
  rm -rf "$CLONE_DIR"
done

echo ""
echo "🎉 Deploy run complete!"
