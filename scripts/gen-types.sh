#!/usr/bin/env bash
# npm run gen:types — regenerate the typed DB client from the local database.
# Requires `supabase start` (local DB with migrations applied).
# Output goes to src/lib/db/database.types.ts (add-only adaptation: this
# repo is a single Next.js app, not a pnpm workspace, so the plan's
# packages/db lives under src/lib/db instead).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p src/lib/db
supabase gen types typescript --local > src/lib/db/database.types.ts
echo "wrote src/lib/db/database.types.ts ($(wc -l < src/lib/db/database.types.ts) lines)"
