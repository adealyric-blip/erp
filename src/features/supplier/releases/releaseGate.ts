// Release gate — T20, pure rule (unit-tested).
//
// A tech pack is releasable only when it is APPROVED and has an attached
// production PDF (pdf_asset_id). No approved pack + PDF, no release.
// The server action in src/server/actions/revoke.ts applies this same
// rule before calling ds_transition_tech_pack(…, 'released').

export function isReleasable(status: string | null | undefined, pdfAssetId: string | null | undefined): boolean {
  return status === 'approved' && pdfAssetId != null && pdfAssetId !== '';
}

/** The RFQ-level gate: at least one line passes. */
export function canReleaseAny(lines: Array<{ status: string; pdf_asset_id: string | null }>): boolean {
  return lines.some((l) => isReleasable(l.status, l.pdf_asset_id));
}
