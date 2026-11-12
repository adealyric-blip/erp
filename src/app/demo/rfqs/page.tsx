// Demo: RFQ builder + publish dialog — fixture data only, no sign-in, no DB.
// Exists ONLY so the T17 flows can be captured with Playwright without
// the local Supabase stack (none on this VM). Every control is the real
// production component; creating/publishing reports a demo success,
// never a write. Remove with the demo suppliers page in one commit if
// Jaizon wants the demo surface gone.
'use client';

import { useState } from 'react';
import { RfqBuilder } from '@/features/rfq/components/RfqBuilder';
import { RfqDetailClient } from '@/features/rfq/components/RfqDetailClient';
import { DEMO_NDA_ID, DEMO_PACKS } from '@/features/rfq/lib/fixtures';
import { DEMO_SUPPLIERS } from '@/features/suppliers/lib/fixtures';
import { computePublishChecklist, pinTechPackVersion } from '@/features/rfq/lib/validation';

const DEMO_DETAIL = {
  rfq: {
    id: 'demo-rfq-1',
    tenant_id: 'demo-tenant',
    rfq_number: 'RFQ-2026-0142',
    title: 'Boxy Tee — Spring drop',
    status: 'draft',
    currency: 'USD',
    incoterm: 'FOB',
    sealed: true,
    bid_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    nda_id: DEMO_NDA_ID,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  lines: [
    {
      id: 'demo-line-1',
      line_no: 1,
      tech_pack_id: 'demo-tp-boxy-tee',
      quantity: 150,
      size_breakdown: { XS: 10, S: 30, M: 50, L: 40, XL: 20 },
      target_unit_cost: 12.5,
      tech_packs: { id: 'demo-tp-boxy-tee', title: 'Boxy Tee', style_number: 'AT-BT-001', status: 'approved', revision: 3, preview_pdf_asset_id: 'demo-preview-1' },
    },
  ],
  invitations: [
    { id: 'demo-inv-1', vendor_id: 'demo-vendor-gz', status: 'invited', acct_vendors: { id: 'demo-vendor-gz', legal_name: 'Guangzhou Cut & Sew Ltd' } },
    { id: 'demo-inv-2', vendor_id: 'demo-vendor-porto', status: 'invited', acct_vendors: { id: 'demo-vendor-porto', legal_name: 'Porto Knit Mill' } },
  ],
  ndaAcceptances: [
    { vendor_id: 'demo-vendor-gz', nda_id: DEMO_NDA_ID, signer_name: 'Demo Signer', accepted_at: new Date().toISOString() },
  ],
};

export default function DemoRfqsPage() {
  const [view, setView] = useState<'builder' | 'detail'>('builder');

  const pins = [pinTechPackVersion('demo-tp-boxy-tee', 3, 'c'.repeat(64))];
  const checklist = computePublishChecklist({
    status: 'draft',
    bidDeadline: DEMO_DETAIL.rfq.bid_deadline,
    ndaId: DEMO_NDA_ID,
    lines: [{ techPackId: 'demo-tp-boxy-tee', techPackStatus: 'approved', hasPreview: true }],
    inviteCount: 2,
    pins,
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12" data-testid="demo-rfqs-page">
      <h1 className="text-3xl font-bold">RFQs — demo</h1>
      <p className="mt-2 text-neutral-600">
        Fixture data only. The real RFQ pages live at <code>/studio/rfqs</code> behind staff sign-in.
      </p>
      <div className="mt-4 flex gap-2">
        <button type="button" data-testid="demo-view-builder" onClick={() => setView('builder')}
          className={`rounded-md px-3 py-1 text-sm ${view === 'builder' ? 'bg-black text-white' : 'border border-neutral-300'}`}>
          Builder
        </button>
        <button type="button" data-testid="demo-view-detail" onClick={() => setView('detail')}
          className={`rounded-md px-3 py-1 text-sm ${view === 'detail' ? 'bg-black text-white' : 'border border-neutral-300'}`}>
          RFQ detail (draft)
        </button>
      </div>

      {view === 'builder' ? (
        <div className="mt-6">
          <RfqBuilder
            packs={DEMO_PACKS}
            suppliers={DEMO_SUPPLIERS}
            activeNdaId={DEMO_NDA_ID}
            initialPackId={null}
            demo
            onCreate={async () => ({ ok: true, rfqId: 'demo-rfq-1' })}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <RfqDetailClient
            detail={DEMO_DETAIL}
            checklist={checklist}
            pins={pins}
            onPublish={async () => ({ ok: true, status: 'published', pins })}
            onClose={async () => ({ ok: true })}
            demo
          />
        </div>
      )}
    </main>
  );
}
