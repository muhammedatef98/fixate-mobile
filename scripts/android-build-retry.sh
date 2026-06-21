#!/usr/bin/env bash
# Resilient EAS Android production submit for a flaky connection to Expo.
# Failure mode observed: the ~8MB project upload succeeds, but the GraphQL build
# *registration* call right after it dies (socket hang up / ETIMEDOUT) whenever
# the route to Expo's Cloudflare edge drops. Mitigations:
#   1. Force IPv4-first DNS in Node (undici sometimes picks a dead AAAA route
#      where curl/IPv4 succeeds).
#   2. Pre-flight stability gate: only spend a 2-min upload when the API answers
#      several quick probes in a row, i.e. time each attempt to an open window.
#   3. Hard watchdog per attempt (macOS has no `timeout`) so a hung attempt is
#      force-killed and retried instead of stalling forever.
# Success = build queued (build URL printed).
set -u

cd /Users/mohamed/Desktop/fixate-mobile || exit 1
export NODE_OPTIONS="--dns-result-order=ipv4first ${NODE_OPTIONS:-}"

MAX_ATTEMPTS=30
PER_ATTEMPT_TIMEOUT=240   # upload (~1m50s) + register, then kill if hung
GATE_PROBES=3             # consecutive API 200s required before firing
GATE_MAX_WAIT=600         # seconds to wait for a stable window per attempt
LOGDIR="$(mktemp -d /tmp/and-build-XXXX)"

api_ok() {
  local c
  c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 -X POST \
        -H "Content-Type: application/json" -d '{"query":"{__typename}"}' \
        https://api.expo.dev/graphql 2>/dev/null)
  [ "$c" = "200" ]
}

wait_for_stable_window() {
  local streak=0 waited=0
  while [ "$waited" -lt "$GATE_MAX_WAIT" ]; do
    if api_ok; then streak=$((streak+1)); else streak=0; fi
    [ "$streak" -ge "$GATE_PROBES" ] && return 0
    sleep 5; waited=$((waited+5))
  done
  return 1   # gave up waiting; fire anyway
}

for i in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "===== ANDROID ATTEMPT $i ($(date +%H:%M:%S)) ====="
  if wait_for_stable_window; then
    echo "-- stable window detected, firing build --"
  else
    echo "-- no stable window after ${GATE_MAX_WAIT}s, firing anyway --"
  fi

  ALOG="$LOGDIR/attempt-$i.log"
  eas build -p android --profile production --non-interactive --no-wait >"$ALOG" 2>&1 &
  pid=$!
  ( sleep "$PER_ATTEMPT_TIMEOUT"; kill -9 "$pid" 2>/dev/null ) &
  watcher=$!
  wait "$pid" 2>/dev/null
  kill -9 "$watcher" 2>/dev/null; wait "$watcher" 2>/dev/null

  tail -n 6 "$ALOG"

  url=$(grep -oiE "https://expo\.dev/accounts/[^ ]+/builds/[0-9a-f-]+" "$ALOG" | head -1)
  if [ -n "$url" ]; then
    echo "ANDROID_BUILD_URL=$url"
    echo "ANDROID_QUEUED_SUCCESS"
    exit 0
  fi
  echo "-- attempt $i did not queue; will re-gate and retry --"
done

echo "ANDROID_ALL_ATTEMPTS_FAILED"
exit 1
