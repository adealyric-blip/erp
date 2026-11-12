export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: AppErrorCode; message: string; hint?: string } };

export type AppErrorCode =
  | 'forbidden'
  | 'not_found'
  | 'invalid_state'
  | 'missing_data'
  | 'conflict'
  | 'nda_required'
  | 'unknown';

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail<T>(code: AppErrorCode, message: string, hint?: string): Result<T> {
  return { ok: false, error: { code, message, hint } };
}
