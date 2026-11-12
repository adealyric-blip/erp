import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';
import type { Database } from '@/lib/db';

/**
 * Service-role client. Server-only by construction (`import 'server-only'`)
 * and by the ESLint no-restricted-imports rule: import it only from
 * src/server/supabase/admin.ts and the allow-listed server routes
 * (src/server/watermark/**, src/server/storage/**, src/app/api/supplier/**,
 * src/app/api/studio/jobs/**). Never import from a client component and
 * never hand it to supplier code.
 */
const env = getEnv();

export const admin = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
