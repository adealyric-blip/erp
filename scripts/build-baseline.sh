#!/usr/bin/env bash
# Build supabase/migrations/20261107000000_baseline.sql from schema_target.zip
# (~/workspace/erp-2026-11-07/upload/schema_target.zip, 2026-11-09 22:22 — the
# newest, most complete snapshot: 28 domains, kinds incl. 80_grants).
#
# Why this zip and not ERP_Schema_By_Domain__1.zip: the ERP zip is an older
# (16:21) snapshot missing 80_grants, most 11_constraints, and domains
# 18_business_tax_e_file / 19_cap_table_valuation. schema_target.zip matches
# the runbook kind order (01_types -> 10_tables -> 11_constraints ->
# 20_foreign_keys -> 30_indexes -> 40_functions -> 50_triggers -> 60_rls ->
# 61_policies -> 80_grants).
#
# Load order (deviations from the plain kind order, with reasons):
#   00_header            extensions first (uuid-ossp, pgcrypto, pg_trgm, ...)
#   search_text prelude  26_reports_analytics/40_functions.sql defines
#                        public.search_text(), which generated columns in
#                        03/05/12/13/16 10_tables.sql reference — it must
#                        exist before any CREATE TABLE runs.
#   01_types, 02_sequences
#   10_tables
#   00_preflight         unify schema + views over public tables — must run
#                        AFTER 10_tables or view creation fails.
#   11_constraints, 20_foreign_keys, 30_indexes, 35_views, 40_functions
#   extra source files   04_appointments.sql (03 domain) + 06f_catalog_listing_map.sql (05) +
#                        07_actions_and_nav (1).sql (newest of the three variants in
#                        "29. Create Actions") — extra source files whose tables are NOT in the
#                        kind files (crm_appointments et al, listing map, platform_dashboards).
#                        MUST come AFTER 11_constraints: these files carry inline
#                        REFERENCES (e.g. crm_dependents.tenant_id -> tenants(id)) and the
#                        referenced PKs are only added by 11_constraints. Emitting extras
#                        before 11_constraints (the pre-fix order) made the baseline fail
#                        `supabase db reset` with 35 "no unique constraint matching given
#                        keys" errors (Phase 1 close-out, 2026-11-12).
#   50_triggers, 60_rls, 61_policies, 70_comments, 80_grants
#
# Intentionally excluded:
#   99_out_of_scope_other_app_leftovers, "Agnostic Buisness modules", "LMS",
#   "29. Create Actions"/07_actions_and_nav.sql + (2).sql (older variants),
#   19_cap_table_valuation/"App Part 19 - Cap Table and 409A Migration.sql"
#   (its 13 tables are all in 19/10_tables.sql; the file is the unsplit source).
#
# Idempotency note: the baseline runs once per `supabase db reset` on a fresh
# database, so single-run INSERT seed rows inside the extra files are fine.
# S590/S600/S605 (the following migrations) are the re-runnable ones.
set -euo pipefail

ZIP="${SCHEMA_ZIP:-$HOME/workspace/erp-2026-11-07/upload/schema_target.zip}"
OUT="${OUT:-$HOME/workspace/erp-2026-11-07/supabase/migrations/20261107000000_baseline.sql}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

unzip -q "$ZIP" -d "$WORK"
SRC="$WORK/schema_target"

python3 - "$SRC" "$OUT" <<'PYEOF'
import re, sys, pathlib
src = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])

def read(p):
    return pathlib.Path(p).read_text(errors="replace")

# --- extract search_text: from its CREATE FUNCTION to the closing $$;
f26 = read(src / "26_reports_analytics" / "40_functions.sql")
m = re.search(r"CREATE (?:OR REPLACE )?FUNCTION public\.search_text\(.*?\n\$\$;", f26, re.S)
if not m:
    raise SystemExit("search_text function not found in 26/40_functions.sql")
prelude = m.group(0)
assert "search_text" in prelude and "LANGUAGE" in prelude, prelude[:200]
# The 26/40_functions.sql file defines search_text a second time (plain
# CREATE FUNCTION, not OR REPLACE). When that file is emitted in the
# 40_functions pass, strip the duplicate — the PRELUDE above already
# defines it, and a second definition aborts the baseline.
SEARCH_TEXT_RE = re.compile(
    r"CREATE (?:OR REPLACE )?FUNCTION public\.search_text\(.*?\n\$\$;",
    re.S)

def dedup_search_text(text):
    new, n = SEARCH_TEXT_RE.subn(
        "-- search_text() defined by the PRELUDE above (deduplicated).", text)
    return new

# The extras call platform__apply_app_security() (and platform_classify_tables())
# mid-file — but that function drops and rebuilds every app_* policy, so a
# later 61_policies.sql CREATE POLICY app_* then fails with "already exists"
# (RESET5, line 58302). Defer both calls to one FINAL REFRESH at the end of
# the baseline, after 61_policies. (Atelier generation, 2026-11-11.)
DEFER_SECURITY_RE = re.compile(
    r"SELECT count\(\*\) AS tables_secured FROM public\.platform__apply_app_security\(\);")
DEFER_CLASSIFY_RE = re.compile(
    r"SELECT public\.platform_classify_tables\(\) AS tables_classified;")

def defer_security_calls(text):
    text = DEFER_SECURITY_RE.sub(
        "-- (deferred: platform__apply_app_security() runs once at the end of the baseline,\n"
        "--  after 61_policies, so explicit CREATE POLICY app_* statements land first.)", text)
    text = DEFER_CLASSIFY_RE.sub(
        "-- (deferred: platform_classify_tables() is called inside platform__apply_app_security().)", text)
    return text

# --- platform registry: tables/functions the extra source files INSERT into
# or call (06f references platform_picklist_values; 04_appointments and
# 07_actions reference the registry + roles). They live in the unnumbered
# Agnostic/LMS source files, which the kind-order pass never emits — so
# extract them here and emit them as one section AFTER 40_functions and
# BEFORE the extras. The atelier generation (2026-11-11) did the same.
# platform_outbox has no CREATE TABLE anywhere in the zip (it is only ever
# INSERTed into); its DDL below is hand-written to match that generation.
REGISTRY_FILES = [
    "Agnostic Buisness modules/06d_modules_and_packs.sql",
    "Agnostic Buisness modules/06c_agnostic_core.sql",
    "Agnostic Buisness modules/06b_common_features.sql",
    "LMS/06e_roles_and_learning.sql",
]
REGISTRY_TABLES = {"platform_modules", "platform_packs", "platform_pack_items",
                   "platform_picklist_values", "platform_notification_preferences",
                   "platform_roles", "platform_role_aliases", "platform_member_roles"}
# Seed INSERTs only from 06d: 06e adds a 'learning' module row that the
# atelier generation (2026-11-11) excluded.
REGISTRY_INSERTS = {"platform_modules", "platform_packs"}
REGISTRY_FUNCS = {"platform_picklist_ok", "platform__picklist_guard", "platform_notify",
                  "platform_resolve_role", "platform__user_has_role", "platform_has_role"}
# Canonical order — the atelier generation's order (tables before the
# functions that use them; resolve_role after member_roles).
REGISTRY_ORDER = [
    ("table", "platform_modules"), ("insert", "platform_modules"),
    ("table", "platform_packs"), ("table", "platform_pack_items"),
    ("insert", "platform_packs"),
    ("table", "platform_picklist_values"),
    ("func", "platform_picklist_ok"), ("func", "platform__picklist_guard"),
    ("table", "platform_notification_preferences"),
    ("table", "platform_outbox"), ("func", "platform_notify"),
    ("table", "platform_roles"), ("table", "platform_role_aliases"),
    ("table", "platform_member_roles"),
    ("func", "platform_resolve_role"), ("func", "platform__user_has_role"),
    ("func", "platform_has_role"),
]
PLATFORM_OUTBOX_SQL = """CREATE TABLE IF NOT EXISTS public.platform_outbox (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel        text NOT NULL,
  event_type     text NOT NULL,
  aggregate_type text,
  aggregate_ref  text,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         text NOT NULL DEFAULT 'pending',
  attempts       integer NOT NULL DEFAULT 0,
  available_at   timestamptz NOT NULL DEFAULT now(),
  source_table   text,
  source_id      text,
  processed_at   timestamptz,
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);"""

def split_statements(text):
    """Split SQL into statements on ';' outside dollar-quoting, strings,
    and -- / /* */ comments (a comment apostrophe must not desync parsing)."""
    stmts, cur = [], []
    i, n = 0, len(text)
    dollar = None
    in_str = False
    in_line_comment = False
    in_block_comment = False
    while i < n:
        ch = text[i]
        two = text[i:i+2]
        if in_line_comment:
            cur.append(ch)
            if ch == '\n': in_line_comment = False
            i += 1; continue
        if in_block_comment:
            cur.append(ch)
            if two == '*/': cur.append('*'); i += 2; in_block_comment = False; continue
            i += 1; continue
        if dollar is not None:
            if text.startswith(dollar, i):
                cur.append(dollar); i += len(dollar); dollar = None; continue
            cur.append(ch); i += 1; continue
        if in_str:
            if ch == "'":
                if text[i+1:i+2] == "'": cur.append("''"); i += 2; continue
                in_str = False
            cur.append(ch); i += 1; continue
        if two == '--':
            in_line_comment = True; cur.append('--'); i += 2; continue
        if two == '/*':
            in_block_comment = True; cur.append('/*'); i += 2; continue
        if ch == "'":
            in_str = True; cur.append(ch); i += 1; continue
        m = re.match(r'\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$', text[i:])
        if m:
            dollar = m.group(0); cur.append(dollar); i += len(dollar); continue
        if ch == ';':
            cur.append(ch); stmts.append(''.join(cur)); cur = []; i += 1; continue
        cur.append(ch); i += 1
    if ''.join(cur).strip(): stmts.append(''.join(cur))
    return stmts

def registry_statements():
    found = {}
    for rel in REGISTRY_FILES:
        for st in split_statements(read(src / rel)):
            s = st.strip()
            # Strip leading -- comment lines only: the section keeps
            # statements only (the atelier generation's section has no
            # file-header comments attached to the statements).
            lns = s.split('\n')
            while lns and lns[0].lstrip().startswith('--'):
                lns.pop(0)
            body = '\n'.join(lns).strip()
            if not body:
                continue
            m = re.search(r'(CREATE TABLE IF NOT EXISTS|INSERT INTO|CREATE OR REPLACE FUNCTION)\s+public\.([a-z_0-9]+)', body)
            if not m:
                continue
            kind = {'CREATE TABLE IF NOT EXISTS': 'table',
                    'INSERT INTO': 'insert',
                    'CREATE OR REPLACE FUNCTION': 'func'}[m.group(1)]
            name = m.group(2)
            if kind == 'insert' and '06d_modules_and_packs.sql' not in rel:
                continue
            if ((kind == 'table' and name in REGISTRY_TABLES)
                    or (kind == 'insert' and name in REGISTRY_INSERTS)
                    or (kind == 'func' and name in REGISTRY_FUNCS)):
                found[(kind, name)] = body
    ordered = []
    for key in REGISTRY_ORDER:
        if key == ('table', 'platform_outbox'):
            ordered.append(PLATFORM_OUTBOX_SQL)
        elif key in found:
            ordered.append(found[key])
    return ordered

domains = sorted(p.name for p in src.iterdir()
                 if p.is_dir() and re.match(r"\d\d_", p.name))
kinds_before_tables = ["01_types", "02_sequences"]
kinds_before_extras = ["11_constraints", "20_foreign_keys", "30_indexes",
                      "35_views", "40_functions"]
kinds_after_extras = ["50_triggers", "60_rls",
                      "61_policies", "70_comments", "80_grants"]
extras = [
    "03_contacts_parties_crm/04_appointments.sql",
    "05_catalog_products/06f_catalog_listing_map.sql",
    "29. Create Actions/07_actions_and_nav (1).sql",
]

parts = []
parts.append("-- =====================================================================")
parts.append("-- Atelier baseline — generated by scripts/build-baseline.sh")
parts.append("-- Source: upload/schema_target.zip (2026-11-09 22:22)")
parts.append("-- Order: 00_header, search_text prelude, 01_types, 02_sequences,")
parts.append("--   10_tables, 00_preflight, 11_constraints, 20_foreign_keys,")
parts.append("--   30_indexes, 35_views, 40_functions, extra source files,")
parts.append("--   50_triggers, 60_rls, 61_policies, 70_comments, 80_grants.")
parts.append("-- DO NOT EDIT BY HAND — regenerate with scripts/build-baseline.sh.")
parts.append("-- =====================================================================")
parts.append("")
parts.append("\\set ON_ERROR_STOP on")
parts.append("BEGIN;")
parts.append("")

def emit(label, text):
    parts.append("-- ---------------------------------------------------------------------")
    parts.append(f"-- {label}")
    parts.append("-- ---------------------------------------------------------------------")
    parts.append(text.rstrip())
    parts.append("")

emit("00_foundation/00_header.sql", read(src / "00_foundation" / "00_header.sql"))
emit("PRELUDE: public.search_text() (26_reports_analytics/40_functions.sql)", prelude)

for kind in kinds_before_tables:
    for d in domains:
        f = src / d / f"{kind}.sql"
        if f.exists():
            emit(f"{d}/{kind}.sql", read(f))

for d in domains:
    f = src / d / "10_tables.sql"
    if f.exists():
        emit(f"{d}/10_tables.sql", read(f))

emit("00_foundation/00_preflight.sql", read(src / "00_foundation" / "00_preflight.sql"))

for kind in kinds_before_extras:
    for d in domains:
        f = src / d / f"{kind}.sql"
        if f.exists():
            text = read(f)
            if d == "26_reports_analytics" and kind == "40_functions":
                text = dedup_search_text(text)
            emit(f"{d}/{kind}.sql", text)

registry = registry_statements()
parts.append("-- ---------------------------------------------------------------------")
parts.append("-- PLATFORM REGISTRY (Agnostic 06b/06c/06d + LMS 06e, extracted — see build-baseline.sh)")
parts.append("-- ---------------------------------------------------------------------")
parts.append("-- platform registry — tables the extras INSERT/UPDATE.")
parts.append("")
parts.append("\n\n".join(registry))
parts.append("")

for rel in extras:
    emit(rel, defer_security_calls(read(src / rel)))

for kind in kinds_after_extras:
    for d in domains:
        f = src / d / f"{kind}.sql"
        if f.exists():
            emit(f"{d}/{kind}.sql", read(f))

parts.append("")
parts.append("-- =====================================================================")
parts.append("-- FINAL REFRESH — registry is the authority for app_* policies.")
parts.append("-- platform__apply_app_security() drops and rebuilds every app_* policy")
parts.append("-- (including for the extras' new tables), so it runs once here, after")
parts.append("-- 61_policies, not inside the extras.")
parts.append("SELECT count(*) AS tables_secured FROM public.platform__apply_app_security();")
parts.append("")

parts.append("COMMIT;")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(parts))
print(f"wrote {out} ({out.stat().st_size} bytes)")
PYEOF
