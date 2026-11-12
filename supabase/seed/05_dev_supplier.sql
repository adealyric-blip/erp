-- Dev-only seed: a supplier user for the T04 auth e2e (auth.spec.ts).
-- DEV ONLY. Never run against a shared or cloud database.
-- Vendor + active portal membership, so requireSupplier() passes for this
-- user and requireStaff() 404s (the user has no tenant membership).

begin;

-- AP control account (entity FK skipped in fixtures only, per S600 tests).
set local session_replication_role = replica;
insert into public.acct_chart_of_accounts (tenant_id, entity_id, code, name, account_type, normal_balance, is_control_account)
values ('11111111-1111-4111-8111-111111111111', gen_random_uuid(), '2000', 'Accounts Payable', 'liability', 'credit', true)
on conflict do nothing;
set local session_replication_role = origin;

insert into public.acct_vendors (id, tenant_id, vendor_number, legal_name, email, ap_account_id)
select '44444444-4444-4444-8444-444444444444',
       '11111111-1111-4111-8111-111111111111',
       'V-DEV-001', 'Dev Sewing Co', 'supplier@atelier.test', coa.id
from public.acct_chart_of_accounts coa
where coa.tenant_id = '11111111-1111-4111-8111-111111111111' and coa.code = '2000'
on conflict (id) do nothing;

insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, role, aud, confirmation_token, is_sso_user,
  is_super_admin, raw_app_meta_data, raw_user_meta_data
) values (
  '33333333-3333-4333-8333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'supplier@atelier.test',
  crypt('atelier-dev-supplier', gen_salt('bf')),
  now(), now(), now(),
  'authenticated', 'authenticated', '', false, false,
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
) on conflict (id) do nothing;

insert into public.supplier_portal_members (tenant_id, vendor_id, email, user_id, role, status)
values (
  '11111111-1111-4111-8111-111111111111',
  '44444444-4444-4444-8444-444444444444',
  'supplier@atelier.test',
  '33333333-3333-4333-8333-333333333333',
  'owner', 'active'
) on conflict (vendor_id, email) do nothing;

commit;
