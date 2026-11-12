# Phase 4 Lane 1 — T16 + T17 — open items (Nov 12, 2026)

Built and verified on this VM; the items below could NOT be verified here
because there is no local Supabase stack (no Docker / Supabase CLI) and
the shared dev server on :3003 has no Supabase env. Nothing below is
stubbed silently — each is a named, test-shaped gap.

## Unrunnable here (need the local stack: `supabase start` + seed + `SUPPLIER_E2E_LIVE=1`)

1. **Invite email arrival in Mailpit.** `sendSupplierInviteEmail` is
   implemented (Resend HTTPS API, token never logged — unit-tested in
   `src/server/email/invite.test.ts`, 3/3). Whether the email actually
   lands in Mailpit for a real invite is covered by the skipped live
   test in `e2e/suppliers.spec.ts` ("invite email arrives in Mailpit;
   token appears in no log line"). Run with the stack + `SUPPLIER_E2E_LIVE=1`.
2. **Token in no log line (live).** Same skipped test: extracts the
   token from the Mailpit invite link and greps `dev.log`
   (`tokenAbsentFromLogs` in `e2e/_support/supplier-setup.ts`). The
   unit test proves the mailer never logs; the live grep proves the
   whole request path doesn't either.
3. **Live DB round-trip for all server actions** (`createSupplier`
   incl. the `acct_vendors` reuse path, `inviteSupplier`,
   `revokeSupplier`, `unbanSupplier`, NDA create/activate,
   `createRfq`, `publishRfq`, `closeRfq`). RLS behaviour is the main
   unknown: staff writes to `acct_vendors` / `supplier_capabilities` /
   `supplier_portal_members` / `ds_ndas` go through the user-JWT
   client and depend on the baseline staff policies. If any write is
   denied, the action returns the mapped error (never a silent pass).
4. **Publish against the real `ds_publish_rfq` RPC.** The checklist
   mirrors the RPC item-for-item (unit-tested) and the dialog disables
   publish until all are met, but the end-to-end publish (approved
   pack + preview + invite + deadline) is only covered by the skipped
   live test in `e2e/rfq.spec.ts`.
5. **Unban RLS.** `unbanSupplier` updates `supplier_portal_members`
   directly with the staff JWT; whether the baseline policy permits a
   staff update there is unverified live (see #3).

## Design decisions recorded (not gaps, but for the coordinator)

6. **`ds_supplier_zones` does not exist in S600, and neither does a
   `suppliers.zones` column.** The brief named the RPC; the plan's
   S600 has no such RPC and no zones column on any vendor table.
   Zones are stored in `acct_vendors.metadata.zones` (ISO-3166
   alpha-2 codes) and gating reads that (plus
   `supplier_capabilities.country_code`). No ad-hoc grants table was
   created. A future S620 step file could formalise this as a
   `zones text[]` column + `ds_supplier_zones(vendor)` RPC — that
   migration was NOT written here, per the brief ("report it as open
   instead").
7. **Version pin has no column.** S600 `rfqs` has no version-pin
   column, so the publish pin (tech-pack revision + sha256 of the
   `ds_tech_pack_snapshot` JSON) is returned with the publish call
   and shown on the RFQ page, not stored. A future step file could
   add `rfqs.spec_snapshot_pins jsonb`.
8. **"Tech Packs page offers only RFQ".** The tech-pack editor page
   (`src/app/studio/techpacks/[tpId]/page.tsx`, Phase 3 Lane 1's
   path — NOT edited) was grepped: it has no email/print/export
   actions, so the only outbound action from a pack is the RFQ flow
   (`/studio/rfqs/new?designId=xx` + the pack picker in the builder).
   No "Start RFQ" button was added to the tech-pack page itself —
   that file belongs to the parallel Phase 3 lane; adding the entry
   point there is a coordinator call.
9. **PO row / embed budget.** "PO row is a JSONB array and does not
   exceed the embed" is implemented as: the award PO draft is a JSONB
   array (`buildPoDraft`) with an 8 KiB embed budget
   (`PO_DRAFT_EMBED_BUDGET_BYTES`), enforced in the builder and shown
   on the detail page. The 8 KiB figure is a builder-side budget, not
   a value from the plan — confirm it against the award/notification
   payload limits when T19 lands.
10. **RFQ2 cap = 100.** "Qty > cap (100)" is implemented as: any
    line qty > 100 OR the RFQ total qty > 100 shows the RFQ2
    carve-out banner (unit-tested both ways).
11. **NDA link "T09 NDA upload".** NDA versions are managed in
    Suppliers → NDAs (T16's own surface: new version = new row,
    activate one). T09 is the asset pipeline and has no NDA upload;
    the brief's "T09" reference appears to be a mix-up — the RFQ
    detail page links to Suppliers → NDAs instead.
12. **Demo routes `/demo/suppliers` and `/demo/rfqs`.** Public,
    fixture-only (`*.example`) pages rendering the real production
    components, added ONLY so the interactive flows could be captured
    with Playwright without a stack (the studio layout gates all
    `/studio/*` behind staff sign-in). They perform no DB reads or
    writes. Remove both in one commit if Jaizon wants the demo
    surface gone.
13. **No nav entry was added.** Suppliers/RFQs are reachable by URL
    and cross-linked (Suppliers ↔ RFQs, RFQs → Tech Packs). The
    studio nav/shell belongs to Lane A; wiring entries there is a
    coordinator call.

## Pre-existing issues (not Lane 1 — not fixed, not counted)

- 1 lint error at `src/components/StudioDrawer.tsx:754` (Lane A; final close-out).
- `src/server/actions/revoke.ts` had a type error during this run
  (another lane's file); it did not appear in the final typecheck.
- T10c's tests are mid-work in the shared tree (`src/lib/commands/*`,
  `src/lib/flat/*`); not run as part of this lane's verify.
- `pnpm db:test` was NOT run (Phase 3 Lane 1 owns the throwaway PG
  cluster; no new migration was written by this lane anyway).
