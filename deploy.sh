#!/usr/bin/env bash
set -u

APP_DIR="/home/funoonfiesta.noorululama.org/Funoon-Fiesta"
PM2_APP_NAME="funoon-fiesta"
BRANCH="main"
LOG_FILE="$APP_DIR/deploy.log"
STATUS_FILE="$APP_DIR/deploy-status.json"
LOCK_FILE="/tmp/funoon-fiesta-deploy.lock"

log() {
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$timestamp] $*" | tee -a "$LOG_FILE"
}

update_status() {
  local status="$1"
  local message="$2"
  local commit="${3:-}"
  local author="${4:-}"
  local now
  now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  cat > "$STATUS_FILE" <<EOF
{
  "status": "$status",
  "message": "$message",
  "commit": "$commit",
  "author": "$author",
  "updatedAt": "$now"
}
EOF
}

# Ensure lock cleanup
cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

# Concurrency check
if [ -e "$LOCK_FILE" ]; then
  LOCK_PID="$(cat "$LOCK_FILE" 2>/dev/null || echo "")"
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    log "⚠️  Deployment already in progress (PID: $LOCK_PID). Exiting."
    exit 0
  fi
fi
echo $$ > "$LOCK_FILE"

log "========================================================"
log "🚀 Deployment triggered for $PM2_APP_NAME on branch $BRANCH"
log "========================================================"

cd "$APP_DIR" || {
  log "❌ Failed to change directory to $APP_DIR"
  update_status "failed" "Failed to change directory to $APP_DIR"
  exit 1
}

OLD_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
log "📌 Current commit: $OLD_COMMIT"

update_status "deploying" "Fetching latest changes from GitHub..." "$OLD_COMMIT"

# Clean any locally generated build artifacts (e.g. sw.js, workbox files)
log "🧹 Resetting untracked/modified build artifacts..."
git checkout -- . 2>/dev/null || true
git clean -fd public/workbox-* 2>/dev/null || true

# Fetch and reset to remote main
log "📥 Pulling latest code from origin/$BRANCH..."
if ! git fetch origin "$BRANCH"; then
  log "❌ git fetch origin $BRANCH failed"
  update_status "failed" "git fetch origin $BRANCH failed"
  exit 1
fi

if ! git reset --hard "origin/$BRANCH"; then
  log "❌ git reset --hard origin/$BRANCH failed"
  update_status "failed" "git reset to origin/$BRANCH failed"
  exit 1
fi

NEW_COMMIT="$(git rev-parse --short HEAD)"
COMMIT_MSG="$(git log -1 --pretty=format:'%s')"
COMMIT_AUTHOR="$(git log -1 --pretty=format:'%an')"

log "✅ Synced to commit: $NEW_COMMIT"
log "💬 Commit message: $COMMIT_MSG"
log "👤 Author: $COMMIT_AUTHOR"

update_status "building" "Installing dependencies and compiling..." "$NEW_COMMIT" "$COMMIT_AUTHOR"

# Check if dependencies changed
PKG_DIFF="$(git diff "$OLD_COMMIT" "$NEW_COMMIT" -- package.json package-lock.json 2>/dev/null || echo "changed")"
if [ -n "$PKG_DIFF" ] || [ ! -d "node_modules" ]; then
  log "📦 Changes in package.json or node_modules missing. Running npm install..."
  if ! npm install --prefer-offline --no-audit; then
    log "❌ npm install failed!"
    update_status "failed" "npm install failed" "$NEW_COMMIT" "$COMMIT_AUTHOR"
    exit 1
  fi
  log "✅ Dependencies up to date."
else
  log "⚡ No package changes detected, skipping npm install."
fi

# Build Next.js application
log "🏗️  Building Next.js application (npm run build)..."
START_TIME=$(date +%s)

if ! npm run build; then
  log "❌ Build failed! Website kept running on previous working version."
  update_status "failed" "npm run build failed. Old version preserved." "$NEW_COMMIT" "$COMMIT_AUTHOR"
  exit 1
fi

BUILD_DURATION=$(( $(date +%s) - START_TIME ))
log "✅ Build succeeded in ${BUILD_DURATION}s!"

# Restart PM2 process
log "🔄 Reloading PM2 process '$PM2_APP_NAME'..."
if pm2 describe "$PM2_APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME"
  pm2 save
  log "✅ PM2 process '$PM2_APP_NAME' restarted."
else
  log "⚠️ PM2 process '$PM2_APP_NAME' not found in PM2, starting it..."
  pm2 start npm --name "$PM2_APP_NAME" -- start -- -p 11413
  pm2 save
  log "✅ PM2 process '$PM2_APP_NAME' started."
fi

# Health check
log "🩺 Verifying health on http://localhost:11413..."
sleep 4
HEALTHY=0
for i in {1..10}; do
  HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:11413/ || echo "000")"
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "308" ] || [ "$HTTP_CODE" = "302" ]; then
    HEALTHY=1
    log "✅ Health check passed! HTTP response code: $HTTP_CODE"
    break
  fi
  log "⏳ Waiting for server to become responsive (attempt $i/10, code: $HTTP_CODE)..."
  sleep 2
done

if [ "$HEALTHY" -eq 1 ]; then
  update_status "success" "Deployed successfully: $COMMIT_MSG" "$NEW_COMMIT" "$COMMIT_AUTHOR"
  log "🎉 Deployment finished successfully for commit $NEW_COMMIT ($BUILD_DURATION seconds build time)!"
else
  log "⚠️ Health check timed out, but PM2 process is running. Check 'pm2 logs $PM2_APP_NAME'."
  update_status "warning" "Build succeeded but health check returned $HTTP_CODE" "$NEW_COMMIT" "$COMMIT_AUTHOR"
fi

# Keep log file size reasonable (keep last 2000 lines)
if [ -f "$LOG_FILE" ]; then
  tail -n 2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

exit 0
