import { z } from 'zod';

// Validates every env var in plan/05 §Env at boot and fails fast.
// Call `env` only from server code that needs it; the public home page does
// not import this module, so `pnpm dev` serves `/` before env is configured.
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  WORKER_WEBHOOK_SECRET: z.string().min(1).optional(),
  MCP_GATEWAY_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  UNSPLASH_ACCESS_KEY: z.string().min(1).optional(),
  PEXELS_API_KEY: z.string().min(1).optional(),
  GOOGLE_FONTS_API_KEY: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_TOKEN_ENC_KEY: z.string().length(32).optional(),
  GOOGLE_MERCHANT_ID: z.string().min(1).optional(),
  GA4_PROPERTY_ID: z.string().min(1).optional(),
  GSC_SITE_URL: z.string().url().optional(),
  GOOGLE_INDEXING_SA_JSON: z.string().min(1).optional(),
  ISXR_PROJECT_ID: z.string().min(1).optional(),
  ISXR_REGION: z.string().min(1).optional(),
  ISXR_SERVICE_INSTANCE: z.string().min(1).optional(),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: z.string().min(1).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  SUPPLIER_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_CONFIG: z.string().min(1).optional(),
});

const envSchema = serverSchema.merge(clientSchema);

export type Env = z.infer<typeof envSchema>;

/** Parse + validate process.env. Throws a readable error naming the bad var. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${issues.join('\n')}`);
  }
  return parsed.data;
}

// Server-only: importing this module from a client component is a bug.
// (Client components read NEXT_PUBLIC_* vars through next/config, not here.)
// Lazy singleton: validated on first use so unit tests can import loadEnv
// without real credentials present.
let cached: Env | undefined;
export function getEnv(): Env {
  cached ??= loadEnv();
  return cached;
}
