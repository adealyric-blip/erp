# T15 proof (component-level)

`01-revisions-guard-login.png` is a live-browser shot against the :3003 dev
server: an unauthenticated visit to
`/studio/techpacks/demo-boxy-tee/revisions` redirects to `/login` (307, guard
intact — the route is staff-only via the studio layout's `requireStaff`).

`02`–`07` are real-browser renders of the ACTUAL components with fixture
data (`src/features/techpack/test-fixtures/revision-snapshots.ts`).

Why component-level, not the studio page: the /studio pages are behind the
staff + MFA guard and this VM has no local Supabase stack (no CLI, no
Docker), so no authenticated session exists here to open them. The full
authenticated flow is covered by `e2e/techpack-revisions.spec.ts` (runs
against the local stack; skipped here).

Regenerate, from the repo root:

```sh
npx esbuild docs/phase3-proof/lane-2/proof/entry.tsx --bundle \
  --outfile=docs/phase3-proof/lane-2/proof/bundle.js --format=esm --jsx=automatic \
  --alias:@=$PWD/src \
  --alias:next/navigation=$PWD/docs/phase3-proof/lane-2/proof/stubs/next-navigation.ts
node docs/phase3-proof/lane-2/proof/build-css.mjs
cd docs/phase3-proof/lane-2/proof && python3 -m http.server 8821
node docs/phase3-proof/lane-2/proof/shot.mjs   # from the repo root
```

`bundle.js` / `bundle.css` are build outputs of the harness and are not
committed. The `next/navigation` stub exists only so `RevisionsClient` can
render outside the App Router; it is never imported by the app.
