// Shared client bits for the library pages (T10).
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Result } from '@/server/result';

export function ResultMessage({ result }: { result: Result<string> | null }) {
  if (!result) return null;
  if (result.ok) return <p className="text-sm text-green-700">Saved.</p>;
  return (
    <p className="text-sm text-red-700">
      {result.error.message}
      {result.error.hint ? ` (field: ${result.error.hint})` : ''}
    </p>
  );
}

export function DeleteButton({
  label,
  onDelete,
}: {
  label: string;
  onDelete: () => Promise<Result<string>>;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  return (
    <span>
      <button
        type="button"
        className="text-sm text-red-700 underline"
        onClick={async () => {
          if (!window.confirm(`Delete ${label}?`)) return;
          const res = await onDelete();
          if (!res.ok) setMsg(res.error.message);
          else router.refresh();
        }}
      >
        Delete
      </button>
      {msg && <span className="ml-2 text-xs text-red-700">{msg}</span>}
    </span>
  );
}

export const inputCls = 'mt-1 w-full rounded border px-2 py-1 text-sm';
export const labelCls = 'block text-sm font-medium';
