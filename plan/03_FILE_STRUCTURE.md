# 03 — File structure (Turborepo + pnpm)

Every file below has one owner task (Txx, see `06_Muse_CODE_RUNBOOK.md`). Agents create only files in their task's
paths, plus tests.

```
atelier/
├─ Muse.md                               # T01 (copy from plan/)
├─ turbo.json  pnpm-workspace.yaml  package.json  .nvmrc(22)  .env.example
├─ .github/workflows/{ci.yml,db-test.yml,deploy-scan-worker.yml}          # T05
├─ supabase/
│  ├─ config.toml                                                     # T02 (auth: google, email otp, mfa totp)
│  ├─ migrations/
│  │  ├─ 20261111000000_baseline.sql            # your schema.zip, concatenated in step order S100…S500
│  │  ├─ 20261111000590_design_studio_prereq_fixes.sql   # = plan/db/S590
│  │  ├─ 20261111000600_design_studio_production.sql     # = plan/db/S600
│  │  └─ 20261111000605_browser_runner.sql               # = plan/db/S605
│  │  ├─ 20261111000610_flat_library.sql                 # = plan/db/S610 (T10b)
│  │  └─ 20261111000615_tech_pack_template.sql           # = plan/db/S615 (T13b)
│  ├─ tests/{S600_tests.sql,S605_tests.sql,S610_tests.sql,S615_tests.sql}            # = plan/db/*_tests.sql (run in that order)
│  └─ seed/{00_dev_tenant.sql,10_libraries.sql,20_demo_design.sql}    # T02
├─ packages/
│  ├─ config/        eslint (no-restricted-imports for admin client), tsconfig base, tailwind preset   # T01
│  ├─ db/                                                             # T03
│  │  └─ src/{database.types.ts (generated), rpc.ts (typed RPC wrappers), enums.ts, index.ts}
│  ├─ commands/                                                       # T06  ← single source of truth for actions
│  │  └─ src/
│  │     ├─ define.ts            # defineCommand({id, title, input: zod, scope: 'studio'|'techpack'|'rfq', permission, run})
│  │     ├─ registry.ts          # registerAll(), list(), get(id), toMcpTools()
│  │     ├─ context.ts           # CommandContext {supabase, user, tenantId, canvas?, craft?}
│  │     ├─ studio/{design.save,design.duplicate,layer.add_text,layer.add_image,layer.add_shape,layer.align,
│  │     │          colorway.create,colorway.recolor,print_area.fit,asset.remove_bg,asset.upscale,mockup.render}.ts
│  │     ├─ techpack/{create,bom.upsert,measurements.upsert,measurements.grade,construction.upsert,artwork.place,
│  │     │            submit_review,approve,release,archive,export_pdf}.ts
│  │     ├─ rfq/{create,line.add,vendor.invite,publish,close,answer,award,compare}.ts
│  │     └─ media/{turntable.render,video.render,photos.grade,pattern.export}.ts
│  ├─ craft-bridge/                                                   # T11
│  │  └─ src/{host.ts (postMessage/`window.<app>` adapter), apps.ts (per-app capabilities), protocol.ts (zod), useCraftApp.ts}
│  └─ ui/            shadcn components + studio primitives (Panel, Toolbar, ColorSwatch, SizeGrid)   # T01/T06
├─ apps/
│  ├─ web/                                                            # Next.js 16
│  │  ├─ next.config.ts          # output:'standalone', headers() COOP/COEP only for /craft/:path*, craft editor page, /studio/render, CSP
│  │  ├─ proxy.ts                # T04: session refresh, /studio → staff+aal2, /supplier → supplier, /craft → staff
│  │  ├─ public/craft/<app>/     # T11: trunk build output per Craft app (gitignored, fetched in CI by scripts/fetch-craft.ts)
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ (auth)/login/page.tsx  (auth)/mfa/page.tsx  auth/callback/route.ts                  # T04
│  │  │  │  ├─ studio/layout.tsx                    # tenant switcher, nav, realtime provider        # T06
│  │  │  │  ├─ studio/page.tsx                      # dashboard: recent designs, open RFQs, jobs
│  │  │  │  ├─ studio/designs/page.tsx  designs/new/page.tsx                                        # T07
│  │  │  │  ├─ studio/designs/[designId]/page.tsx  # Studio editor (canvas + left rail + right inspector)
│  │  │  │  ├─ studio/designs/[designId]/history/page.tsx                                          # T08
│  │  │  │  ├─ studio/designs/[designId]/craft/[app]/page.tsx   # Craft iframe host                 # T12
│  │  │  │  ├─ studio/designs/[designId]/3d/page.tsx            # 360 / model-viewer / XR stream   # T22, T22b
│  │  │  │  ├─ studio/library/{seasons,sizes,poms,materials,templates}/page.tsx                    # T10
│  │  │  │  ├─ studio/library/flats/{page,import/page,generate/page}.tsx  # T10b — license badges, import, generator
│  │  │  │  ├─ studio/library/flats/import/[batchId]/page.tsx       # T10c — split review (accept / merge / cut / pair / scale)
│  │  │  │  ├─ studio/library/techpack-templates/page.tsx           # T13b — upload / validate / set default template
│  │  │  │  ├─ studio/techpacks/page.tsx  techpacks/[tpId]/page.tsx  techpacks/[tpId]/revisions/page.tsx   # T13–T15
│  │  │  │  ├─ studio/suppliers/page.tsx  suppliers/[vendorId]/page.tsx  suppliers/map/page.tsx    # T16
│  │  │  │  ├─ studio/ndas/page.tsx                                                                 # T16
│  │  │  │  ├─ studio/rfqs/page.tsx  rfqs/new/page.tsx  rfqs/[rfqId]/page.tsx  rfqs/[rfqId]/compare/page.tsx  # T17,T19
│  │  │  │  ├─ studio/audit/page.tsx                                                               # T20
│  │  │  │  ├─ studio/jobs/page.tsx                                                                # T26
│  │  │  │  ├─ studio/settings/{integrations,members}/page.tsx                                     # T27
│  │  │  │  ├─ supplier/layout.tsx  supplier/page.tsx (my RFQs)                                     # T18
│  │  │  │  ├─ supplier/invite/[token]/page.tsx                                                     # T18
│  │  │  │  ├─ supplier/rfqs/[rfqId]/page.tsx  rfqs/[rfqId]/nda/page.tsx  rfqs/[rfqId]/bid/page.tsx  # T18
│  │  │  │  ├─ supplier/releases/[tpId]/page.tsx                                                    # T20
│  │  │  │  ├─ api/supplier/assets/[rfqId]/[assetId]/route.ts   # watermark-and-stream proxy        # T18
│  │  │  │  ├─ api/supplier/uploads/route.ts                    # signs upload URL after register  # T18
│  │  │  │  ├─ api/supplier/releases/[tpId]/route.ts            # production pack stream           # T20
│  │  │  │  ├─ api/studio/assets/[assetId]/route.ts             # staff asset stream (no signed URLs in HTML)  # T09
│  │  │  │  ├─ api/craft/[app]/document/[assetId]/route.ts      # bytes to Craft iframe (staff)    # T12
│  │  │  │  ├─ studio/render/page.tsx                            # render station (claims + runs WASM jobs)  # T14
│  │  │  │  ├─ api/studio/jobs/[jobId]/output/route.ts          # render output → private bucket   # T14
│  │  │  │  ├─ api/webhooks/jobs/route.ts                       # scan-worker → revalidateTag      # T14
│  │  │  │  ├─ api/meet/briefing/route.ts                       # Google Meet space for RFQ        # T27
│  │  │  │  └─ api/integrations/google/{merchant,ga4,gsc}/route.ts                                  # T27
│  │  │  ├─ server/
│  │  │  │  ├─ supabase/{server.ts (user client from cookies), admin.ts ('server-only' service client), browser.ts}
│  │  │  │  ├─ auth/{requireStaff.ts (aal2 + membership), requireSupplier.ts, getTenant.ts}
│  │  │  │  ├─ errors.ts            # PG error code → user message (42501, 22023, 23502, 23514, P0002)
│  │  │  │  ├─ result.ts            # Result<T>
│  │  │  │  ├─ actions/{designs,techpacks,rfqs,suppliers,ndas,library,jobs}.ts   # 'use server' — thin wrappers over commands
│  │  │  │  ├─ watermark/{image.ts (sharp tiled text), pdf.ts (pdf-lib stamp)}
│  │  │  │  ├─ storage/{paths.ts, upload.ts, stream.ts}
│  │  │  │  ├─ email/{send.ts, templates/{supplier-invite,rfq-published,award}.tsx}   # React Email + Resend/SES
│  │  │  │  ├─ push/fcm.ts           # Firebase Admin (web push)
│  │  │  │  └─ google/{oauth.ts, merchant.ts, ga4.ts, gsc.ts, meet.ts, fonts.ts, people.ts, maps.ts}
│  │  │  ├─ features/
│  │  │  │  ├─ studio/
│  │  │  │  │  ├─ components/{StudioShell,LeftRail,UploadsPanel,ImagesPanel,GraphicsPanel,ShapesPanel,TextPanel,
│  │  │  │  │  │              AiPanel,CanvasStage,PrintAreaOverlay,LayerList,Inspector,ColorwayBar,ViewSwitcher,
│  │  │  │  │  │              SaveButton,PreviewPublishButton,Rotate360Button,VersionTimeline}.tsx
│  │  │  │  │  ├─ hooks/{useCanvasStore (zustand), useCommand, useAutosave, useUndoRedo, useHotkeys,
│  │  │  │  │  │         useRealtimeDesign, useFonts, useStockImages, useIcons}.ts
│  │  │  │  │  └─ lib/{konva-serialize.ts, print-area.ts (mm↔px), export.ts (PNG/PDF via jsPDF), fonts.ts}
│  │  │  │  ├─ techpack/components/{TechPackEditor,BomTable,MeasurementGrid,GradingDialog,ConstructionList,
│  │  │  │  │                       ArtworkPlacements,StatusBar,ApproveDialog,RevisionDiff,PdfStatus}.tsx
│  │  │  │  │   hooks/{useTechPack,useTechPackTransition,useJobStatus}.ts
│  │  │  │  ├─ rfq/components/{RfqBuilder,LineEditor,VendorPicker,PublishChecklist,QaThread,BidBoard,BidCompareTable,
│  │  │  │  │                  ScoreCard,AwardDialog}.tsx   hooks/{useRfq,useBids,useRfqRealtime}.ts
│  │  │  │  ├─ supplier/components/{SupplierShell,RfqList,NdaGate,RfqView,SecurePreview (canvas, no <img src> to storage),
│  │  │  │  │                       SecurePdfViewer (pdf.js from proxy stream),BidForm,QuestionBox,UploadDropzone,
│  │  │  │  │                       ReleaseDownload}.tsx  hooks/{useSupplierRfq,useBidDraft}.ts
│  │  │  │  ├─ suppliers/components/{VendorTable,InviteSupplierDialog,CapabilityForm,SupplierMap,RevokeDialog}.tsx
│  │  │  │  ├─ media/components/{TurntableViewer,ModelViewer3D,VideoJobPanel,PhotoBatchPanel}.tsx
│  │  │  │  ├─ render/{useRenderStation.ts, runHeadless.ts, handlers/{thumbnail,bg_remove,mockup_render,supplier_preview,
│  │  │  │  │          techpack_pdf,techpack_preview_pdf,vector_export,pattern_export,texture_bake,turntable_render,promo_video}.ts}
│  │  │  │  └─ audit/components/{AccessLogTable,AccessFilters}.tsx
│  │  │  └─ lib/{env.ts (zod-validated env), queryClient.ts, realtime.ts, format.ts}
│  │  ├─ e2e/{auth.spec.ts,studio.spec.ts,techpack.spec.ts,rfq-e2e.spec.ts,zero-leak.spec.ts}     # T05+
│  │  └─ Dockerfile                                                                               # T28
│  ├─ mcp-gateway/                                                    # T25
│  │  └─ src/{server.ts (Streamable HTTP, @modelcontextprotocol/sdk), auth.ts (verify Supabase JWT),
│  │         tools/fromRegistry.ts (packages/commands → MCP tools), tools/craft.ts (enqueue render jobs / allow-listed craft-bridge execute),
│  │         audit.ts}
│  └─ scan-worker/                                                    # T14
│     ├─ Dockerfile              # node:22-slim + clamav (freshclam on start); no Craft CLIs unless the T11 spike needs them
│     └─ src/{main.ts (ds_claim_jobs(['virus_scan']) → clamscan → ds_finish_job), storage.ts}
└─ scripts/{fetch-craft.ts, db-test.sh, gen-types.sh}
```

## Where things hook in (cheat sheet)
| UI element | Component | Hook | Command | Server | DB |
|---|---|---|---|---|---|
| [Save] | `SaveButton` | `useCommand('design.save')`, `useAutosave` (30 s, dirty only) | `studio/design.save` | `actions/designs.saveVersion` | `ds_create_design_version` |
| [Preview & Publish] | `PreviewPublishButton` | `useCommand('mockup.render')` | `studio/mockup.render` | `ds_enqueue_job('mockup_render')` | `craft_jobs` → `design_assets` |
| [360 Rotate Product] | `Rotate360Button` → `TurntableViewer` | `useJobStatus` | `media/turntable.render` | enqueue `turntable_render` | frames in `design-private` |
| Left rail: Uploads | `UploadsPanel` | `useUpload` | `layer.add_image` | `storage/upload.ts` → `design-private` | `design_assets` (internal) |
| Images | `ImagesPanel` | `useStockImages` (Unsplash/Pexels via server route, API keys server-side) | `layer.add_image` | `/api/stock` | `design_assets` with `provider` |
| Graphics | `GraphicsPanel` | `useIcons` (Iconify, self-hosted JSON sets) | `layer.add_image` (SVG) | none | none |
| Shapes / Text | `ShapesPanel` / `TextPanel` | `useFonts` (Fontsource packages + Google Web Fonts API list) | `layer.add_shape` / `layer.add_text` | none | none |
| AI | `AiPanel` | `useCommand(*)` | any command (same registry as MCP) | `actions/*` | as command |
| Dashed print area | `PrintAreaOverlay` | `useCanvasStore` | `print_area.fit` | none | `ds_garment_templates.print_areas` |
| Approve tech pack | `ApproveDialog` | `useTechPackTransition` | `techpack/approve` | `actions/techpacks.transition` | `ds_transition_tech_pack` |
| Publish RFQ | `PublishChecklist` | `useRfq` | `rfq/publish` | `actions/rfqs.publish` | `ds_publish_rfq` |
| Supplier image | `SecurePreview` | `useSupplierRfq` | none | `/api/supplier/assets/...` | `supplier_authorize_asset_view` |
| Award | `AwardDialog` | `useBids` | `rfq/award` | `actions/rfqs.award` | `ds_award_rfq` |
