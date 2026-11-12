// T15 — PdfStatus unit tests: derive the per-PDF state from craft_jobs rows.
import { describe, expect, it } from 'vitest';
import { derivePdfStatus, type PdfJobInput } from './PdfStatus';

const job = (over: Partial<PdfJobInput> & { kind: string }): PdfJobInput => ({
  id: '00000000-0000-4000-8000-000000000099',
  status: 'queued',
  ...over,
});

describe('derivePdfStatus', () => {
  it('is not_queued when no job of that kind exists', () => {
    const d = derivePdfStatus([], 'techpack_pdf');
    expect(d.state).toBe('not_queued');
    expect(d.job).toBeNull();
  });

  it('maps each craft_jobs status through', () => {
    for (const status of ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const) {
      expect(derivePdfStatus([job({ kind: 'techpack_pdf', status })], 'techpack_pdf').state).toBe(
        status,
      );
    }
  });

  it('ignores jobs of the other kind', () => {
    const d = derivePdfStatus(
      [job({ kind: 'techpack_preview_pdf', status: 'succeeded' })],
      'techpack_pdf',
    );
    expect(d.state).toBe('not_queued');
  });

  it('picks the first (newest) job when several exist', () => {
    const d = derivePdfStatus(
      [
        job({ kind: 'techpack_pdf', status: 'failed', error: 'render crashed' }),
        job({ kind: 'techpack_pdf', status: 'succeeded' }),
      ],
      'techpack_pdf',
    );
    expect(d.state).toBe('failed');
    expect(d.job?.error).toBe('render crashed');
  });

  it('exposes the output asset id when the job succeeded', () => {
    const d = derivePdfStatus(
      [
        job({
          kind: 'techpack_preview_pdf',
          status: 'succeeded',
          output: { asset_id: '00000000-0000-4000-8000-000000000070' },
        }),
      ],
      'techpack_preview_pdf',
    );
    expect(d.state).toBe('succeeded');
    expect(d.assetId).toBe('00000000-0000-4000-8000-000000000070');
  });

  it('treats an unknown status as not_queued rather than crashing', () => {
    const d = derivePdfStatus([job({ kind: 'techpack_pdf', status: 'stuck' })], 'techpack_pdf');
    expect(d.state).toBe('not_queued');
  });
});
