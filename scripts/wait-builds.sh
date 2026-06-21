#!/usr/bin/env bash
# Poll EAS builds to completion under a watchdog (EAS CLI hangs on flaky nets,
# macOS has no `timeout`). Prints the downloadable artifact URL per build.
set -u
cd /Users/mohamed/Desktop/fixate-mobile || exit 1

AND_ID="e56152a5-9d74-4641-9347-523cf1169212"
IOS_ID="d7d8a3d8-75cb-4133-a903-d60bac1a112d"
PER_CALL_TIMEOUT=60
SLEEP_BETWEEN=30
MAX_MIN=60
LOGDIR="$(mktemp -d /tmp/wait-builds-XXXX)"

# watchdog-wrapped `eas build:view <id> --json` -> stdout JSON (empty on hang/err)
view_build() {
  local id="$1" out="$LOGDIR/$1.json"
  : >"$out"
  eas build:view "$id" --json >"$out" 2>/dev/null &
  local pid=$!
  ( sleep "$PER_CALL_TIMEOUT"; kill -9 "$pid" 2>/dev/null ) &
  local w=$!
  wait "$pid" 2>/dev/null
  kill -9 "$w" 2>/dev/null; wait "$w" 2>/dev/null
  cat "$out"
}

and_done=""; ios_done=""
deadline=$(( $(date +%s) + MAX_MIN*60 ))

while [ -z "$and_done" ] || [ -z "$ios_done" ]; do
  if [ -z "$and_done" ]; then
    j=$(view_build "$AND_ID")
    st=$(echo "$j" | jq -r '.status // empty' 2>/dev/null)
    [ -n "$st" ] && echo "ANDROID_STATUS=$st ($(date +%H:%M:%S))"
    if [ "$st" = "FINISHED" ]; then
      url=$(echo "$j" | jq -r '.artifacts.applicationArchiveUrl // .artifacts.buildUrl // empty' 2>/dev/null)
      echo "ANDROID_ARTIFACT=$url"; and_done=1
    elif [ "$st" = "ERRORED" ] || [ "$st" = "CANCELED" ]; then
      echo "ANDROID_FAILED status=$st"; and_done=1
    fi
  fi
  if [ -z "$ios_done" ]; then
    j=$(view_build "$IOS_ID")
    st=$(echo "$j" | jq -r '.status // empty' 2>/dev/null)
    [ -n "$st" ] && echo "IOS_STATUS=$st ($(date +%H:%M:%S))"
    if [ "$st" = "FINISHED" ]; then
      url=$(echo "$j" | jq -r '.artifacts.applicationArchiveUrl // .artifacts.buildUrl // empty' 2>/dev/null)
      echo "IOS_ARTIFACT=$url"; ios_done=1
    elif [ "$st" = "ERRORED" ] || [ "$st" = "CANCELED" ]; then
      echo "IOS_FAILED status=$st"; ios_done=1
    fi
  fi
  [ -n "$and_done" ] && [ -n "$ios_done" ] && break
  [ "$(date +%s)" -ge "$deadline" ] && { echo "WAIT_TIMEOUT after ${MAX_MIN}min"; break; }
  sleep "$SLEEP_BETWEEN"
done
echo "BOTH_BUILDS_RESOLVED"
