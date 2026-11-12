-- 00_dev_tenant.sql — local-dev tenant + owner (runs only on `supabase db reset`).
-- DEV ONLY: the owner password below is a throwaway local credential.
-- Never run seed files against a shared/cloud database.
\set ON_ERROR_STOP on
BEGIN;

-- Fixed UUIDs so later seed files can reference the tenant/owner deterministically.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_super_admin
) VALUES (
  '22222222-2222-4222-8222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'owner@atelier.test',
  crypt('atelier-dev-owner', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Atelier Owner"}'::jsonb,
  now(), now(), false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenants (id, name, slug, type, is_active, active, status)
VALUES ('11111111-1111-4111-8111-111111111111', 'Atelier (dev)', 'atelier-dev', 'seller', true, true, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenant_memberships (tenant_id, user_id, role, active, status)
VALUES ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'owner', true, 'active')
ON CONFLICT DO NOTHING;

COMMIT;
