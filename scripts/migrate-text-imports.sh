#!/usr/bin/env bash
# migrate-text-imports.sh
#
# Replaces bare RN Text/TextInput imports with AppText/AppTextInput
# across all screens and components in the project.
#
# Run once from the project root:
#   bash scripts/migrate-text-imports.sh
#
# What it does:
#   1. Finds all .tsx/.ts files under app/ and components/
#   2. Replaces: import { ..., Text, ... } from 'react-native'
#      with an additional import line for AppText
#   3. Replaces <Text  with <AppText  and </Text> with </AppText>
#   4. Does NOT touch files that already import AppText

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPTEXT_IMPORT="import { AppText, AppTextInput } from '../components/AppText';"

echo "🖊 Scanning files..."

find "$ROOT/app" "$ROOT/components" -type f \( -name '*.tsx' -o -name '*.ts' \) | while read -r FILE; do
  # Skip if already migrated
  if grep -q 'AppText' "$FILE"; then
    echo "  ⏩ skip (already migrated): ${FILE#$ROOT/}"
    continue
  fi

  # Skip if file doesn't use Text at all
  if ! grep -q '<Text' "$FILE"; then
    continue
  fi

  echo "  ✨ migrating: ${FILE#$ROOT/}"

  # 1. Add AppText import after the last react-native import line
  sed -i '' "/from 'react-native'/a\\
$APPTEXT_IMPORT
" "$FILE"

  # 2. Replace JSX tags (careful not to match TextInput with Text pattern)
  sed -i '' \
    -e 's/<Text /<AppText /g' \
    -e 's/<Text>/<AppText>/g' \
    -e 's|</Text>|</AppText>|g' \
    -e 's/<TextInput /<AppTextInput /g' \
    -e 's|</TextInput>|</AppTextInput>|g' \
    "$FILE"
done

echo ""
echo "✅ Done! Run: npx expo start --clear"
