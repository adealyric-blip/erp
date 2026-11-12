# Atelier Design Studio — zero-to-production plan

Start here: `Muse.md` (goes at the repo root) → `00_MASTER_PLAN.md`.

| File | What it is |
|---|---|
| Muse.md | Rules every Muse / Muse session follows |
| 00_MASTER_PLAN.md | Phases, gates, dependency graph, what's already done |
| 01_ARCHITECTURE.md | WASM-first topology (Vercel → Lightsail), identity model, zero-leak model, data flows |
| 02_DATABASE.md | Tables, triggers, RPCs, buckets, RLS registry fit, baseline bug fixes |
| 03_FILE_STRUCTURE.md | Monorepo tree + where each button/hook/command/RPC connects |
| 04_API_CONTRACTS.md | TypeScript contracts: Result, commands, proxy route, zod, realtime, render station, scan-worker |
| 05_INTEGRATIONS.md | Craft apps, MCP gateway, libraries, every Google API's job, env |
| 06_Muse_CODE_RUNBOOK.md | Tasks T01–T29 (+ T10b flats, T22b XR) with paths and acceptance criteria |
| 08_FLAT_LIBRARY.md | Where the blanks come from, parametric flat generator, license rules, bundle splitter, S610 spec (T10b, T10c) |
| 09_TECH_PACK_TEMPLATE.md | The 11-page tech pack: layout, field bindings, data sources, supplier-copy rules, S615 spec (T13b) |
| templates/techpack/ | Blank tech pack template: 11-page PDF + one SVG master per page + build script |
| 07_TESTING_RELEASE.md | Test layers, zero-leak checklist, go-live checklist, runbooks |
| db/S590_design_studio_prereq_fixes.sql | Fixes to your current schema (run first) |
| db/S600_design_studio_production.sql | The Design Studio data layer |
| db/S605_browser_runner.sql | Lets staff browser tabs run render jobs with the Craft WASM builds |
| db/S600_tests.sql | 82 end-to-end security/workflow checks (run on a throwaway DB) |
| db/S605_tests.sql | 17 browser-runner checks (run right after S600_tests.sql) |
