# Konva CanvasStage proof (component-level)

`06-konva-stage.png` (parent dir) is a real-browser render of the actual
`src/features/studio/components/CanvasStage.tsx` (silhouette, dashed print
area with mm label, Anton text, star shape, outside-print-area warning).

Why component-level, not the studio page: the /studio editor is behind the
staff + MFA guard and this VM has no local Supabase stack (no CLI, no
Docker), so no authenticated session exists here to open it. The full-page
flow is covered by `e2e/studio.spec.ts` (runs against the local stack).

Regenerate: from this dir,
`npx -y esbuild@latest entry.tsx --bundle --outfile=bundle.js --format=esm --loader:.woff2=file --loader:.woff=file --loader:.ttf=file --jsx=automatic`
then `python3 -m http.server 8811` and run `../konva-shot.mjs` from the repo root.
