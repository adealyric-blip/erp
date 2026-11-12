// T15 — ApproveDialog unit tests: the disabled-with-reason matrix.
// The DB (ds_transition_tech_pack + ds__assert_admin) is the final authority;
// these tests pin the UI explanation so staff always see WHY Approve is disabled.
import { describe, expect, it } from 'vitest';
import { getTransitionOptions, isApproverRole, type TechPackStatus } from './ApproveDialog';

function option(status: TechPackStatus, role: string, to: string) {
  const found = getTransitionOptions(status, role).find((o) => o.to === to);
  if (!found) throw new Error(`no option ${to}`);
  return found;
}

describe('isApproverRole', () => {
  it.each(['owner', 'Owner', 'admin', 'ADMIN', 'administrator'])(
    'allows %s',
    (role) => {
      expect(isApproverRole(role)).toBe(true);
    },
  );
  it.each(['member', 'staff', 'viewer', 'estimator', ''])('denies %s', (role) => {
    expect(isApproverRole(role)).toBe(false);
  });
});

describe('getTransitionOptions — Approve (the T15 accept item)', () => {
  it('staff on an in-review pack sees Approve disabled with the role reason', () => {
    const opt = option('in_review', 'member', 'approved');
    expect(opt.enabled).toBe(false);
    expect(opt.reason).toContain('Only an owner or admin can approve');
    expect(opt.reason).toContain('member');
  });

  it('owner on an in-review pack can approve', () => {
    expect(option('in_review', 'owner', 'approved').enabled).toBe(true);
    expect(option('in_review', 'admin', 'approved').enabled).toBe(true);
  });

  it('owner on a draft sees Approve disabled with the status reason, not the role reason', () => {
    const opt = option('draft', 'owner', 'approved');
    expect(opt.enabled).toBe(false);
    expect(opt.reason).toContain('only an in-review pack can be approved');
    expect(opt.reason).not.toContain('role');
  });
});

describe('getTransitionOptions — other transitions', () => {
  it('submit for review only from draft, any member', () => {
    expect(option('draft', 'member', 'in_review').enabled).toBe(true);
    expect(option('in_review', 'member', 'in_review').enabled).toBe(false);
  });

  it('request changes only from in_review', () => {
    expect(option('in_review', 'member', 'draft').enabled).toBe(true);
    expect(option('draft', 'member', 'draft').enabled).toBe(false);
  });

  it('release only from approved + approver role', () => {
    expect(option('approved', 'owner', 'released').enabled).toBe(true);
    expect(option('approved', 'member', 'released').enabled).toBe(false);
    expect(option('approved', 'member', 'released').reason).toContain('owner or admin');
    expect(option('in_review', 'owner', 'released').enabled).toBe(false);
  });

  it('archive needs an approver and a non-terminal status', () => {
    expect(option('draft', 'owner', 'archived').enabled).toBe(true);
    expect(option('draft', 'member', 'archived').enabled).toBe(false);
    expect(option('released', 'owner', 'archived').enabled).toBe(false);
    expect(option('released', 'owner', 'archived').reason).toContain('cannot be archived');
    expect(option('superseded', 'owner', 'archived').enabled).toBe(false);
  });

  it('returns all five transitions', () => {
    expect(getTransitionOptions('draft', 'owner')).toHaveLength(5);
  });
});
