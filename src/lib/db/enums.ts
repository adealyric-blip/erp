// Status enums — one per status CHECK in plan/db/S600 + S605.
// Values must match the SQL CHECKs exactly; the DB is the source of truth.
export const SeasonStatus = ['planning', 'active', 'closed', 'archived'] as const;
export type SeasonStatus = (typeof SeasonStatus)[number];

export const SupplierPortalMemberStatus = ['invited', 'active', 'suspended', 'revoked'] as const;
export type SupplierPortalMemberStatus = (typeof SupplierPortalMemberStatus)[number];

export const TechPackStatus = [
  'draft',
  'in_review',
  'approved',
  'released',
  'superseded',
  'archived',
] as const;
export type TechPackStatus = (typeof TechPackStatus)[number];

export const RfqStatus = ['draft', 'published', 'closed', 'awarded', 'cancelled'] as const;
export type RfqStatus = (typeof RfqStatus)[number];

export const RfqInvitationStatus = [
  'invited',
  'viewed',
  'declined',
  'bid_submitted',
  'awarded',
  'not_awarded',
  'revoked',
] as const;
export type RfqInvitationStatus = (typeof RfqInvitationStatus)[number];

export const BidStatus = [
  'draft',
  'submitted',
  'withdrawn',
  'superseded',
  'shortlisted',
  'awarded',
  'rejected',
] as const;
export type BidStatus = (typeof BidStatus)[number];

export const RfqFileScanStatus = ['pending', 'clean', 'infected', 'error'] as const;
export type RfqFileScanStatus = (typeof RfqFileScanStatus)[number];

export const CraftJobStatus = ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export type CraftJobStatus = (typeof CraftJobStatus)[number];

export const CraftJobKind = [
  'mockup_render',
  'supplier_preview',
  'techpack_pdf',
  'techpack_preview_pdf',
  'vector_export',
  'pattern_export',
  'texture_bake',
  'turntable_render',
  'promo_video',
  'bg_remove',
  'virus_scan',
  'thumbnail',
] as const;
export type CraftJobKind = (typeof CraftJobKind)[number];

export const CraftApp = [
  'photocraft',
  'vectorcraft',
  'designcraft',
  'pdfcraft',
  'texturecraft',
  'materialcraft',
  'lightcraft',
  'effectcraft',
  'filmcraft',
  'ffmpeg',
  'clamav',
  'rembg',
  'internal',
] as const;
export type CraftApp = (typeof CraftApp)[number];

/** S605: which runner may execute a job. virus_scan is forced to 'server' by the DB. */
export const JobRunner = ['browser', 'server'] as const;
export type JobRunner = (typeof JobRunner)[number];

export const MaterialKind = [
  'fabric',
  'trim',
  'label',
  'packaging',
  'thread',
  'hardware',
  'interlining',
  'other',
] as const;
export type MaterialKind = (typeof MaterialKind)[number];

export const DesignAssetClassification = [
  'internal',
  'supplier_preview',
  'production_release',
  'supplier_upload',
] as const;
export type DesignAssetClassification = (typeof DesignAssetClassification)[number];

export const SizeUnit = ['cm', 'in'] as const;
export type SizeUnit = (typeof SizeUnit)[number];
