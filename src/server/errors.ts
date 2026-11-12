import type { AppErrorCode, Result } from './result';

const PG_MAP: Record<string, AppErrorCode> = {
  '42501': 'forbidden',
  P0002: 'not_found',
  '22023': 'invalid_state',
  '23502': 'missing_data',
  '23505': 'conflict',
  '23514': 'invalid_state',
  '23503': 'invalid_state',
};

/** Map a Postgres / PostgREST error to a Result — never leak raw PG errors. */
export function mapPgError(e: { code?: string; message?: string; hint?: string }): Result<never> {
  if (e.message === 'NDA_REQUIRED') {
    return {
      ok: false,
      error: { code: 'nda_required', message: 'Accept the NDA to continue', hint: e.hint },
    };
  }
  return {
    ok: false,
    error: {
      code: PG_MAP[e.code ?? ''] ?? 'unknown',
      message: e.message ?? 'Something went wrong',
    },
  };
}
