import { describe, expect, it } from 'vitest';
import * as rpc from './rpc';
import { RPC_NAMES } from './rpc';
import type { RpcName } from './rpc';
import { AwardPayload, BidPayload, GarmentPrintAreas, PrintArea } from './schemas';
import { BidStatus, CraftJobKind, RfqStatus, TechPackStatus } from './enums';

const WRAPPER_BY_RPC: Record<RpcName, string> = {
  ds_create_design_version: 'dsCreateDesignVersion',
  ds_create_tech_pack: 'dsCreateTechPack',
  ds_transition_tech_pack: 'dsTransitionTechPack',
  ds_tech_pack_snapshot: 'dsTechPackSnapshot',
  ds_create_rfq: 'dsCreateRfq',
  ds_invite_vendor_to_rfq: 'dsInviteVendorToRfq',
  ds_publish_rfq: 'dsPublishRfq',
  ds_close_rfq: 'dsCloseRfq',
  ds_close_due_rfqs: 'dsCloseDueRfqs',
  ds_answer_question: 'dsAnswerQuestion',
  ds_award_rfq: 'dsAwardRfq',
  ds_invite_supplier_user: 'dsInviteSupplierUser',
  ds_revoke_supplier: 'dsRevokeSupplier',
  ds_enqueue_job: 'dsEnqueueJob',
  ds_rfq_unsealed: 'dsRfqUnsealed',
  ds_my_vendor_ids: 'dsMyVendorIds',
  supplier_accept_invite: 'supplierAcceptInvite',
  supplier_get_nda: 'supplierGetNda',
  supplier_accept_nda: 'supplierAcceptNda',
  supplier_my_rfqs: 'supplierMyRfqs',
  supplier_get_rfq: 'supplierGetRfq',
  supplier_authorize_asset_view: 'supplierAuthorizeAssetView',
  supplier_save_bid: 'supplierSaveBid',
  supplier_submit_bid: 'supplierSubmitBid',
  supplier_withdraw_bid: 'supplierWithdrawBid',
  supplier_ask_question: 'supplierAskQuestion',
  supplier_decline_rfq: 'supplierDeclineRfq',
  supplier_register_upload: 'supplierRegisterUpload',
  supplier_authorize_release: 'supplierAuthorizeRelease',
  ds_claim_jobs: 'dsClaimJobs',
  ds_heartbeat_job: 'dsHeartbeatJob',
  ds_finish_job: 'dsFinishJob',
  ds_reap_stale_jobs: 'dsReapStaleJobs',
  ds_claim_browser_jobs: 'dsClaimBrowserJobs',
  ds_heartbeat_browser_job: 'dsHeartbeatBrowserJob',
  ds_finish_browser_job: 'dsFinishBrowserJob',
};

describe('rpc wrappers cover every RPC in plan/02', () => {
  it('has exactly one wrapper per RPC in plan/02 (36)', () => {
    expect(RPC_NAMES).toHaveLength(36);
    expect(Object.keys(WRAPPER_BY_RPC)).toHaveLength(36);
    expect([...RPC_NAMES].sort()).toEqual(Object.keys(WRAPPER_BY_RPC).sort());
  });

  it.each(RPC_NAMES)('RPC %s has a wrapper function', (name) => {
    const fn = (rpc as unknown as Record<string, unknown>)[WRAPPER_BY_RPC[name]];
    expect(typeof fn).toBe('function');
  });

  it('wrappers call client.rpc with the exact SQL function name', async () => {
    const calls: Array<[string, unknown]> = [];
    const fakeClient = {
      rpc: (fn: string, args: unknown) => {
        calls.push([fn, args]);
        return Promise.resolve({ data: null, error: null });
      },
    } as never;
    await rpc.dsCreateDesignVersion(fakeClient, { p_design: '00000000-0000-4000-8000-000000000000' });
    await rpc.supplierAuthorizeAssetView(fakeClient, {
      p_rfq: '00000000-0000-4000-8000-000000000000',
      p_asset: '00000000-0000-4000-8000-000000000001',
    });
    await rpc.dsClaimBrowserJobs(fakeClient, { p_tenant: '00000000-0000-4000-8000-000000000000', p_session: 'tab_session01' });
    expect(calls.map(([fn]) => fn)).toEqual([
      'ds_create_design_version',
      'supplier_authorize_asset_view',
      'ds_claim_browser_jobs',
    ]);
  });
});

describe('status enums match the S600 CHECKs', () => {
  it('tech pack / RFQ / bid / job statuses', () => {
    expect(TechPackStatus).toContain('approved');
    expect(RfqStatus).toEqual(['draft', 'published', 'closed', 'awarded', 'cancelled']);
    expect(BidStatus).toContain('superseded');
    expect(CraftJobKind).toContain('virus_scan');
    expect(CraftJobKind).toHaveLength(12);
  });
});

describe('zod schemas (plan/04)', () => {
  it('accepts a valid bid payload', () => {
    expect(
      BidPayload.safeParse({
        lines: [{ rfq_line_id: '00000000-0000-4000-8000-000000000000', unit_price: 12.5 }],
      }).success,
    ).toBe(true);
  });

  it('rejects a negative unit price and a bad incoterm', () => {
    expect(
      BidPayload.safeParse({
        incoterm: 'XXX',
        lines: [{ rfq_line_id: '00000000-0000-4000-8000-000000000000', unit_price: -1 }],
      }).success,
    ).toBe(false);
  });

  it('accepts a valid award payload, rejects an empty one', () => {
    const pair = {
      rfq_line_id: '00000000-0000-4000-8000-000000000000',
      bid_id: '00000000-0000-4000-8000-000000000001',
    };
    expect(AwardPayload.safeParse([pair]).success).toBe(true);
    expect(AwardPayload.safeParse([]).success).toBe(false);
  });

  it('print areas are normalized with positive mm sizes', () => {
    expect(
      PrintArea.safeParse({ x: 0.18, y: 0.2, w: 0.64, h: 0.6, width_mm: 300, height_mm: 400 })
        .success,
    ).toBe(true);
    expect(
      PrintArea.safeParse({ x: 1.2, y: 0.2, w: 0.64, h: 0.6, width_mm: 300, height_mm: 400 })
        .success,
    ).toBe(false);
    expect(
      GarmentPrintAreas.safeParse({
        front: { x: 0.18, y: 0.2, w: 0.64, h: 0.6, width_mm: 300, height_mm: 400 },
      }).success,
    ).toBe(true);
  });
});
