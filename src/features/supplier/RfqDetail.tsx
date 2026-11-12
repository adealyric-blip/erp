'use client';

import { useState } from 'react';
import { askQuestion, declineRfq } from '@/server/actions/supplier-portal';

// RfqDetail — T18 client island for questions, decline and uploads.
// Uploads go through /api/supplier/uploads (plan/04): the route registers
// the file with supplier_register_upload and signs the upload URL with the
// service key. The scan-worker marks the file clean/infected; staff see it
// only when clean. This component never touches storage directly.

export interface RfqDetailProps {
  rfqId: string;
  questionsClosed: boolean;
  declined: boolean;
}

export default function RfqDetail({ rfqId, questionsClosed, declined }: RfqDetailProps) {
  const [question, setQuestion] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<string | null>(null);

  async function submitQuestion(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await askQuestion(rfqId, question);
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setQuestion('');
    setNotice('Question sent to the buyer.');
  }

  async function decline() {
    setBusy(true);
    setError(null);
    const res = await declineRfq(rfqId, reason.trim() || null);
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setNotice('You declined this RFQ.');
  }

  async function upload(file: File) {
    setUploadState(null);
    setError(null);
    try {
      const reg = await fetch('/api/supplier/uploads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfqId, fileName: file.name, mime: file.type, size: file.size }),
      });
      if (!reg.ok) {
        const j = (await reg.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? `Upload registration failed (HTTP ${reg.status}).`);
        return;
      }
      const { uploadUrl, rfqFileId } = (await reg.json()) as { uploadUrl: string; rfqFileId: string };
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) {
        setError(`Upload failed (HTTP ${put.status}).`);
        return;
      }
      setUploadState(`Uploaded (file ${String(rfqFileId).slice(0, 8)}…). A virus scan runs before staff can see it.`);
    } catch {
      setError('Upload failed.');
    }
  }

  return (
    <div className="space-y-6">
      <section data-testid="rfq-questions" className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Questions</h2>
        {questionsClosed ? (
          <p className="mt-1 text-sm text-neutral-500">Questions are closed for this RFQ.</p>
        ) : (
          <form onSubmit={submitQuestion} className="mt-3 flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm">
              Ask the buyer a question
              <textarea
                required
                minLength={3}
                maxLength={4000}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="rounded-md border px-3 py-2"
                rows={2}
              />
            </label>
            <button type="submit" disabled={busy} className="w-fit rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50">
              {busy ? 'Sending…' : 'Send question'}
            </button>
          </form>
        )}
      </section>

      <section data-testid="rfq-uploads" className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Upload a file</h2>
        <p className="mt-1 text-sm text-neutral-600">
          PDF, PNG, JPEG, WebP, CSV or XLSX, up to 100 MB. Files are virus-scanned before staff can open them.
        </p>
        <input
          type="file"
          disabled={declined}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
          className="mt-3 text-sm"
        />
        {uploadState && <p className="mt-2 text-sm text-neutral-600">{uploadState}</p>}
      </section>

      <section data-testid="rfq-decline" className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Decline this RFQ</h2>
        {declined ? (
          <p className="mt-1 text-sm text-neutral-500">You declined this RFQ.</p>
        ) : (
          <>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              Reason (optional)
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="rounded-md border px-3 py-2"
                placeholder="e.g. No capacity in this window"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void decline()}
              className="mt-3 rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
            >
              Decline RFQ
            </button>
          </>
        )}
      </section>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {notice && <p className="text-sm text-neutral-600">{notice}</p>}
    </div>
  );
}
