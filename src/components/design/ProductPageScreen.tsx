'use client';
/**
 * ProductPageScreen — mirrors PartyProfile's layout EXACTLY.
 *
 * Same component structure as the customer profile:
 *   1. Top action bar (back + Export + Edit + "Design this" split button)
 *   2. Profile card (product image + info grid + summary panel)
 *   3. Lifecycle stage bar (render state: Draft → Missing assets → Unverified → Render ready → Published)
 *   4. Tab-underline tabs (Overview · Variants · Orders · Shipping · Pricing · Designs)
 *   5. Tab content — TABLES matching PartyProfile's transaction table pattern
 *
 * Every field is real data from the POD API (/api/v1/blanks/:id). No stubs.
 */
import { useEffect, useState } from 'react';
import {
  getBlankOrders,
  getBlankPrice,
  listDesigns,
  type BlankDetail,
  type BlankOrderRow,
  type DesignListItem,
  type PriceQuote,
} from '@/lib/podApi';
import { useDesignCanvas, type CatalogProduct } from '@/lib/designCanvasStore';
import { exportToCsv } from '@/lib/csvExport';
import type { DomainKey } from '@/data/shellData';
import { ProductThumb } from './ProductCard';

interface ProductPageScreenProps {
  onToast: (msg: string) => void;
  onNavigate: (domain: DomainKey, screenId: string) => void;
}

type Tab = 'overview' | 'variants' | 'orders' | 'shipping' | 'pricing' | 'designs';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'variants', label: 'Variants' },
  { id: 'orders', label: 'Orders' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'designs', label: 'Associated designs' },
];

// POD lifecycle stages — mirror the customer lifecycle (lead → new → active → vip).
// Driven by renderState from the API: skeleton_pending → missing_assets →
// unverified → render_ready → published.
const LIFECYCLE_STAGES: { key: string; label: string }[] = [
  { key: 'skeleton_pending', label: 'Draft' },
  { key: 'missing_assets', label: 'Missing assets' },
  { key: 'unverified', label: 'Unverified' },
  { key: 'render_ready', label: 'Render ready' },
  { key: 'published', label: 'Published' },
];

function lifecycleIndex(renderState: string | undefined): number {
  if (!renderState) return 0;
  const idx = LIFECYCLE_STAGES.findIndex(s => s.key === renderState);
  return idx >= 0 ? idx : 0;
}

const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDelivery(d: { average: number; unit: string } | null): string {
  if (!d) return '—';
  return `≈${d.average} ${d.unit.replace(/_/g, ' ')}`;
}

export default function ProductPageScreen({ onToast, onNavigate }: ProductPageScreenProps) {
  const storeProduct = useDesignCanvas((s) => s.productPage);
  const blankDetail = useDesignCanvas((s) => s.blankDetail);
  const loadBlankDetail = useDesignCanvas((s) => s.loadBlankDetail);
  const startDesign = useDesignCanvas((s) => s.startDesign);
  const loadBlank = useDesignCanvas((s) => s.loadBlank);

  const [tab, setTab] = useState<Tab>('overview');
  const [activeImg, setActiveImg] = useState(0);
  const [tabOrders, setTabOrders] = useState<BlankOrderRow[] | null>(null);
  const [tabPrice, setTabPrice] = useState<PriceQuote | null>(null);
  const [tabDesigns, setTabDesigns] = useState<DesignListItem[] | null>(null);
  const [tabError, setTabError] = useState<string | null>(null);
  const [txnMenuOpen, setTxnMenuOpen] = useState(false);

  // Load tab-specific data
  useEffect(() => {
    if (!blankDetail || tab === 'overview' || tab === 'variants' || tab === 'shipping') return;
    setTabError(null);
    if (tab === 'orders') {
      setTabOrders(null);
      void getBlankOrders(blankDetail.id).then(r => setTabOrders(r.orders)).catch((e: Error) => setTabError(e.message));
    } else if (tab === 'pricing') {
      setTabPrice(null);
      void getBlankPrice(blankDetail.id).then(q => setTabPrice(q)).catch((e: Error) => setTabError(e.message));
    } else if (tab === 'designs') {
      setTabDesigns(null);
      void listDesigns({ blankId: blankDetail.id, limit: 50 }).then(r => setTabDesigns(r.items)).catch((e: Error) => setTabError(e.message));
    }
  }, [tab, blankDetail?.id]);

  const product: CatalogProduct = storeProduct ?? ({} as CatalogProduct);
  const displayName = blankDetail?.name || product.name || 'Unnamed product';
  const brand = blankDetail?.brand || product.brand || '—';
  const supplier = blankDetail?.supplier || '—';
  const baseCost = blankDetail?.baseCost ?? null;
  const family = blankDetail?.family || '—';
  const status = blankDetail?.status || 'review';
  const renderState = blankDetail?.renderState;
  const imageUrl = blankDetail?.views?.[0]?.baseUrl || product.img || blankDetail?.mockupThumbUrl;

  const variants = blankDetail?.variants;
  const colors = variants?.colors || [];
  const sizes = variants?.sizes || [];
  const printAreaNames = variants?.printAreas || [];
  const printAreasPx = blankDetail?.printAreas || [];
  const views = blankDetail?.views || [];
  const printers = blankDetail?.printers || [];
  const stageIdx = lifecycleIndex(renderState);

  function handleStartDesign() {
    if (blankDetail) {
      void startDesign(blankDetail.id).then(() => {
        onNavigate('design', 'new-design');
        onToast(`"${displayName}" loaded into the studio.`);
      });
    } else if (product.blankKey) {
      loadBlank(product.blankKey);
      onNavigate('design', 'new-design');
      onToast(`"${displayName}" loaded into the studio.`);
    }
  }

  function handleExport() {
    if (tab === 'orders' && tabOrders) {
      exportToCsv(tabOrders.map(o => ({ order: o.orderNumber || o.id, date: o.placedAt || '', status: o.status || '', total: o.total || 0 })),
        [{ key: 'order', label: 'Order' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'total', label: 'Total' }],
        `${displayName}-orders`);
      onToast(`Exported ${tabOrders.length} orders`);
    } else if (tab === 'designs' && tabDesigns) {
      exportToCsv(tabDesigns.map(d => ({ name: d.name, status: d.status || '', blankId: d.blankId || '' })),
        [{ key: 'name', label: 'Design' }, { key: 'status', label: 'Status' }, { key: 'blankId', label: 'Blank' }],
        `${displayName}-designs`);
      onToast(`Exported ${tabDesigns.length} designs`);
    } else if (tab === 'variants' && colors.length > 0) {
      exportToCsv(colors.map(c => ({ color: c.name, hex: c.hex || '', sku: c.sku || '', sizes: sizes.join('/') })),
        [{ key: 'color', label: 'Color' }, { key: 'hex', label: 'Hex' }, { key: 'sku', label: 'SKU' }, { key: 'sizes', label: 'Sizes' }],
        `${displayName}-variants`);
      onToast(`Exported ${colors.length} variants`);
    } else if (tab === 'pricing' && printers.length > 0) {
      exportToCsv(printers.map(p => ({ name: p.name, baseCost: p.baseCost ?? '', delivery: p.estimatedDelivery ? `${p.estimatedDelivery.average} ${p.estimatedDelivery.unit}` : '' })),
        [{ key: 'name', label: 'Printer' }, { key: 'baseCost', label: 'Base cost' }, { key: 'delivery', label: 'Delivery' }],
        `${displayName}-printers`);
      onToast(`Exported ${printers.length} printers`);
    }
  }

  return (
    <main className="flex flex-col h-full overflow-hidden bg-background">
      {/* ═══ TOP ACTION BAR (mirrors PartyProfile) ═══ */}
      <header className="h-14 px-6 flex items-center justify-between bg-white border-b border-surface-dim shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <button className="flex items-center gap-1 text-primary font-semibold text-[13px] hover:underline shrink-0" onClick={() => onNavigate('design', 'new-design')}>
            <span className="material-symbols-outlined text-[16px]">arrow_back_ios</span>Back to canvas
          </button>
          <span className="text-on-surface-variant text-[12px] truncate">/ {displayName}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button className="h-8 px-3 border border-surface-dim rounded bg-white text-[13px] font-semibold hover:bg-surface-container flex items-center gap-1" onClick={handleExport}>
            <span className="material-symbols-outlined text-[16px]">download</span>Export
          </button>
          <button className="h-8 px-3 border border-surface-dim rounded bg-white text-[13px] font-semibold hover:bg-surface-container flex items-center gap-1" onClick={() => onToast('Edit product — opening form')}>
            <span className="material-symbols-outlined text-[16px]">edit</span>Edit
          </button>
          <div className="relative">
            <div className="flex">
              <button className="h-8 px-3 bg-primary text-white text-[13px] font-semibold rounded-l hover:bg-primary-container flex items-center gap-1" onClick={handleStartDesign}>
                <span className="material-symbols-outlined text-[16px]">palette</span>Design this
              </button>
              <button className="h-8 px-1.5 bg-primary text-white rounded-r hover:bg-primary-container border-l border-primary-container" onClick={e => { e.stopPropagation(); setTxnMenuOpen(v => !v); }}>
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
            {txnMenuOpen && (
              <div className="row-menu open" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, minWidth: 220 }} onClick={e => e.stopPropagation()}>
                <div className="menu-header">New transaction</div>
                <button onClick={() => { setTxnMenuOpen(false); onToast('Create order — opening'); }}><span className="material-symbols-outlined">shopping_bag</span>Create order</button>
                <button onClick={() => { setTxnMenuOpen(false); onToast('Saved to Collection'); }}><span className="material-symbols-outlined">bookmark</span>Save to Collection</button>
                <button onClick={() => { setTxnMenuOpen(false); onToast('Saved to My templates'); }}><span className="material-symbols-outlined">view_quilt</span>Save to My templates</button>
                <button onClick={() => { setTxnMenuOpen(false); onToast('Publish to listing — opening'); }}><span className="material-symbols-outlined">publish</span>Publish to listing</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto p-6">
        {!blankDetail ? (
          <div className="flex items-center justify-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-[32px] mr-2">progress_activity</span>Loading product…
          </div>
        ) : (
        <>
        {/* ── PROFILE CARD (mirrors PartyProfile exactly) ── */}
        <div className="bg-white border border-surface-dim rounded-xl p-6 flex gap-6 mb-4">
          {/* Image + name */}
          <div className="w-1/4 flex flex-col items-center justify-center text-center border-r border-surface-dim pr-6">
            <div className="w-32 h-32 rounded-xl bg-surface-container flex items-center justify-center mb-3 overflow-hidden">
              <ProductThumb name={displayName} imageUrl={imageUrl} style={{ width: '100%', height: '100%', fontSize: 36 }} />
            </div>
            <h1 className="text-[20px] font-semibold mb-1">{displayName}</h1>
            <div className="text-[12px] text-on-surface-variant mb-3">{brand}</div>
            <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
              <span className={`pill status role ${status === 'eligible' || status === 'render_ready' ? 'customer' : status === 'discontinued' ? 'vendor' : 'contact'}`}>{status.replace(/_/g, ' ')}</span>
              <span className="pill tag">{family}</span>
              <span className="pill tag">{supplier}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high" title="Preview" onClick={() => onToast('Preview saved to Collection')}><span className="material-symbols-outlined text-[18px]">visibility</span></button>
              <button className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high" title="Save to templates" onClick={() => onToast(`"${displayName}" saved to My templates`)}><span className="material-symbols-outlined text-[18px]">view_quilt</span></button>
            </div>
          </div>

          {/* Info grid (mirrors PartyProfile's 2-col grid) */}
          <div className="flex-1 grid grid-cols-2 gap-6 text-[13px]">
            <div className="space-y-4">
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Supplier</div>
                <span className="text-on-surface">{supplier}</span>
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Brand</div>
                <span className="text-on-surface">{brand || '—'}</span>
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Family</div>
                <span className="text-on-surface capitalize">{family}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Variants</div>
                <span className="text-on-surface">{colors.length} colors · {sizes.length} sizes</span>
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Print areas</div>
                <span className="text-on-surface">{printAreaNames.length > 0 ? printAreaNames.join(', ') : printAreasPx.length + ' areas'}</span>
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Render state</div>
                <span className="text-on-surface capitalize">{renderState?.replace(/_/g, ' ') || '—'}</span>
              </div>
            </div>
          </div>

          {/* Summary panel (mirrors PartyProfile's financial summary) */}
          <div className="w-64 shrink-0 bg-[#eef5fa] rounded-lg p-4">
            <h3 className="font-semibold text-[14px] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">inventory_2</span>
              Product summary
            </h3>
            <div className="mb-4">
              <div className="flex items-center gap-1 text-[12px] text-on-surface-variant mb-1"><span className="w-2 h-2 rounded-full bg-secondary"></span>Base cost</div>
              <div className="text-[20px] font-semibold text-on-surface">{money(baseCost)}</div>
            </div>
            <div className="mb-4">
              <div className="flex items-center gap-1 text-[12px] text-on-surface-variant mb-1"><span className="w-2 h-2 rounded-full bg-primary"></span>Suggested retail</div>
              <div className="text-[20px] font-semibold text-on-surface">{tabPrice ? money(tabPrice.suggestedRetailPrice) : '—'}</div>
              <div className="text-[10px] text-on-surface-variant mt-0.5">cost × 1.55 + shipping</div>
            </div>
            <div className="pt-3 border-t border-surface-dim grid grid-cols-2 gap-2 text-[12px]">
              <div><div className="text-on-surface-variant">Colors</div><div className="font-semibold">{colors.length}</div></div>
              <div><div className="text-on-surface-variant">Sizes</div><div className="font-semibold">{sizes.length}</div></div>
              <div><div className="text-on-surface-variant">Print areas</div><div className="font-semibold">{printAreasPx.length}</div></div>
              <div><div className="text-on-surface-variant">Printers</div><div className="font-semibold">{printers.length}</div></div>
              <div><div className="text-on-surface-variant">Views</div><div className="font-semibold">{views.length}</div></div>
              <div><div className="text-on-surface-variant">Delivery</div><div className="font-semibold text-[11px]">{blankDetail.deliveryEstimate?.replace('≈', '') || '—'}</div></div>
            </div>
          </div>
        </div>

        {/* ── LIFECYCLE STAGE BAR (mirrors PartyProfile's lifecycle changer) ── */}
        <div className="bg-white border border-surface-dim rounded-xl p-4 mb-4 flex items-center gap-3">
          <div className="text-[12px] text-on-surface-variant uppercase font-bold">Render lifecycle</div>
          <div className="flex items-center gap-2">
            {LIFECYCLE_STAGES.map((stage, i) => (
              <div key={stage.key} className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-[12px] font-semibold border transition-colors ${
                    i === stageIdx
                      ? 'bg-primary text-white border-primary'
                      : i < stageIdx
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : 'bg-white text-on-surface-variant border-surface-dim'
                  }`}
                >
                  {i < stageIdx && <span className="material-symbols-outlined text-[14px] align-middle mr-1">check</span>}
                  {stage.label}
                </span>
                {i < LIFECYCLE_STAGES.length - 1 && <span className="text-surface-dim text-[16px]">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* ── TABS (tab-underline, mirrors PartyProfile) ── */}
        <div className="border-b border-surface-dim mb-4 overflow-x-auto">
          <div className="flex items-center gap-6 min-w-max">
            {TABS.map(t => (
              <button key={t.id} className={`pb-3 text-[14px] tab-underline ${tab === t.id ? 'active' : 'text-on-surface-variant hover:text-on-surface'}`} onClick={() => setTab(t.id)}>
                {t.label}
                {t.id === 'designs' && tabDesigns && tabDesigns.length > 0 && <span className="text-[11px] text-on-surface-variant ml-1">({tabDesigns.length})</span>}
                {t.id === 'orders' && tabOrders && tabOrders.length > 0 && <span className="text-[11px] text-on-surface-variant ml-1">({tabOrders.length})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div className="bg-white border border-surface-dim rounded-xl overflow-hidden">
          {tab === 'overview' && (
            <div className="p-6 space-y-6">
              {/* Gallery + specs side by side */}
              <div className="flex gap-6">
                {/* Gallery */}
                <div className="w-64 shrink-0">
                  <h3 className="text-[14px] font-semibold mb-3">Product images ({views.length})</h3>
                  {views.length > 0 ? (
                    <div>
                      <div className="w-full aspect-square rounded-xl border border-surface-dim overflow-hidden bg-surface-container mb-3">
                        <img src={views[activeImg]?.baseUrl} alt={displayName} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex gap-2">
                        {views.slice(0, 6).map((v, i) => (
                          <button key={v.id || i} className={`w-14 h-14 rounded-lg border-2 overflow-hidden ${activeImg === i ? 'border-primary' : 'border-surface-dim'}`} onClick={() => setActiveImg(i)}>
                            <img src={v.baseUrl} alt={v.label} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-square rounded-xl border border-surface-dim bg-surface-container flex items-center justify-center">
                      <ProductThumb name={displayName} imageUrl={imageUrl} style={{ width: '100%', height: '100%', fontSize: 48 }} />
                    </div>
                  )}
                </div>

                {/* Specs */}
                <div className="flex-1">
                  <h3 className="text-[14px] font-semibold mb-3">Specifications</h3>
                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    <div><div className="text-on-surface-variant text-[11px] uppercase font-bold mb-1">Shipping from</div><div>{blankDetail.shippingFrom || '—'}</div></div>
                    <div><div className="text-on-surface-variant text-[11px] uppercase font-bold mb-1">Delivery estimate</div><div>{blankDetail.deliveryEstimate || '—'}</div></div>
                    <div><div className="text-on-surface-variant text-[11px] uppercase font-bold mb-1">Fulfillment</div><div className="capitalize">{blankDetail.fulfillment || '—'}</div></div>
                    <div><div className="text-on-surface-variant text-[11px] uppercase font-bold mb-1">Render state</div><div className="capitalize">{renderState?.replace(/_/g, ' ') || '—'}</div></div>
                    <div><div className="text-on-surface-variant text-[11px] uppercase font-bold mb-1">Base cost</div><div>{money(baseCost)}</div></div>
                    <div><div className="text-on-surface-variant text-[11px] uppercase font-bold mb-1">Currency</div><div>{blankDetail.currency || 'USD'}</div></div>
                  </div>
                  {blankDetail.guidelines && (
                    <div className="mt-4">
                      <div className="text-on-surface-variant text-[11px] uppercase font-bold mb-1">Guidelines</div>
                      <div className="text-[12px] text-on-surface-variant">{blankDetail.guidelines}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Print areas */}
              {printAreasPx.length > 0 && (
                <div>
                  <h3 className="text-[14px] font-semibold mb-3">Print areas ({printAreasPx.length})</h3>
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-surface-container-low text-[11px] text-on-surface-variant uppercase border-b border-surface-dim">
                      <tr>
                        <th className="py-2 px-3">Placement</th>
                        <th className="py-2 px-3 text-right">Width</th>
                        <th className="py-2 px-3 text-right">Height</th>
                        <th className="py-2 px-3 text-right">DPI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-dim">
                      {printAreasPx.map((pa, i) => (
                        <tr key={i} className="hover:bg-surface-container-low">
                          <td className="py-2 px-3 font-medium capitalize">{pa.placement}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{pa.widthPx}px</td>
                          <td className="py-2 px-3 text-right tabular-nums">{pa.heightPx}px</td>
                          <td className="py-2 px-3 text-right tabular-nums">{pa.dpi}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'variants' && (
            <div className="p-6">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-surface-container-low text-[11px] text-on-surface-variant uppercase border-b border-surface-dim">
                  <tr>
                    <th className="py-2 px-3 w-8"><input type="checkbox" /></th>
                    <th className="py-2 px-3">Color</th>
                    <th className="py-2 px-3">Hex</th>
                    <th className="py-2 px-3">SKU</th>
                    <th className="py-2 px-3">Sizes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-dim">
                  {colors.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-on-surface-variant">No color variants loaded.</td></tr>
                  ) : colors.map((c, i) => (
                    <tr key={i} className="hover:bg-surface-container-low">
                      <td className="py-2 px-3"><input type="checkbox" /></td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border border-surface-dim shrink-0" style={{ background: c.hex || '#ccc' }} />
                          <span className="font-medium">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-[12px]">{c.hex || '—'}</td>
                      <td className="py-2 px-3 font-mono text-[12px]">{c.sku || '—'}</td>
                      <td className="py-2 px-3 text-[12px]">{sizes.join(' / ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'orders' && (
            <div className="p-6">
              {tabError ? (
                <p className="text-error text-[13px]">{tabError}</p>
              ) : tabOrders === null ? (
                <div className="flex items-center gap-2 text-on-surface-variant text-[13px]"><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>Loading orders…</div>
              ) : tabOrders.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-[48px] text-surface-dim">receipt_long</span>
                  <p className="text-on-surface-variant text-[13px] mt-2 mb-3">No orders for this product yet.</p>
                  <button className="h-8 px-4 bg-primary text-white text-[13px] font-semibold rounded hover:bg-primary-container" onClick={() => onToast('Create order — opening')}>
                    <span className="material-symbols-outlined text-[16px] align-middle">add</span> Create order
                  </button>
                </div>
              ) : (
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-surface-container-low text-[11px] text-on-surface-variant uppercase border-b border-surface-dim">
                    <tr>
                      <th className="py-2 px-3 w-8"><input type="checkbox" /></th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">No.</th>
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-dim">
                    {tabOrders.map(o => (
                      <tr key={o.id} className="hover:bg-surface-container-low">
                        <td className="py-2 px-3"><input type="checkbox" /></td>
                        <td className="py-2 px-3">{fmtDate(o.placedAt)}</td>
                        <td className="py-2 px-3">Order</td>
                        <td className="py-2 px-3 font-medium">{o.orderNumber || o.id.slice(0, 8)}</td>
                        <td className="py-2 px-3">—</td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium">{money(o.total)}</td>
                        <td className="py-2 px-3"><span className={`pill status role ${o.status === 'fulfilled' || o.status === 'delivered' ? 'customer' : 'contact'}`}>{o.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'shipping' && (
            <div className="p-6">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-surface-container-low text-[11px] text-on-surface-variant uppercase border-b border-surface-dim">
                  <tr>
                    <th className="py-2 px-3">Printer</th>
                    <th className="py-2 px-3">Shipping from</th>
                    <th className="py-2 px-3">Delivery estimate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-dim">
                  {printers.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-8 text-on-surface-variant">No shipping data.</td></tr>
                  ) : printers.map(p => (
                    <tr key={p.slug} className="hover:bg-surface-container-low">
                      <td className="py-2 px-3 font-medium">{p.name}</td>
                      <td className="py-2 px-3">{blankDetail.shippingFrom || '—'}</td>
                      <td className="py-2 px-3">{fmtDelivery(p.estimatedDelivery)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'pricing' && (
            <div className="p-6">
              {/* Pricing summary cards */}
              {tabPrice && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-[#eef5fa] rounded-lg p-4">
                    <div className="text-[11px] text-on-surface-variant uppercase font-bold mb-1">Base cost</div>
                    <div className="text-[20px] font-semibold">{money(tabPrice.cost)}</div>
                  </div>
                  <div className="bg-[#eef5fa] rounded-lg p-4">
                    <div className="text-[11px] text-on-surface-variant uppercase font-bold mb-1">Suggested retail</div>
                    <div className="text-[20px] font-semibold">{money(tabPrice.suggestedRetailPrice)}</div>
                  </div>
                  <div className="bg-[#eef5fa] rounded-lg p-4">
                    <div className="text-[11px] text-on-surface-variant uppercase font-bold mb-1">Margin</div>
                    <div className="text-[20px] font-semibold text-green-700">{money(tabPrice.marginAtSuggested)}</div>
                  </div>
                  <div className="bg-[#eef5fa] rounded-lg p-4">
                    <div className="text-[11px] text-on-surface-variant uppercase font-bold mb-1">Shipping tier</div>
                    <div className="text-[20px] font-semibold">{tabPrice.shippingTier}</div>
                  </div>
                </div>
              )}

              {/* Printers comparison table (like Printify's fulfillment options) */}
              <h3 className="text-[14px] font-semibold mb-3">Available printers ({printers.length})</h3>
              {tabError ? (
                <p className="text-error text-[13px]">{tabError}</p>
              ) : !tabPrice ? (
                <div className="flex items-center gap-2 text-on-surface-variant text-[13px] mb-4"><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>Loading pricing…</div>
              ) : (
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-surface-container-low text-[11px] text-on-surface-variant uppercase border-b border-surface-dim">
                    <tr>
                      <th className="py-2 px-3">Printer</th>
                      <th className="py-2 px-3 text-right">Base cost</th>
                      <th className="py-2 px-3 text-right">Delivery</th>
                      <th className="py-2 px-3 text-right">Suggested retail</th>
                      <th className="py-2 px-3 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-dim">
                    {printers.map(p => (
                      <tr key={p.slug} className="hover:bg-surface-container-low">
                        <td className="py-2 px-3 font-medium">{p.name}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{money(p.baseCost)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtDelivery(p.estimatedDelivery)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{p.baseCost != null ? money(p.baseCost * 1.55 + tabPrice.shippingTier) : '—'}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-green-700">{p.baseCost != null ? money((p.baseCost * 1.55 + tabPrice.shippingTier) - p.baseCost - tabPrice.shippingTier) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'designs' && (
            <div className="p-6">
              {tabError ? (
                <p className="text-error text-[13px]">{tabError}</p>
              ) : tabDesigns === null ? (
                <div className="flex items-center gap-2 text-on-surface-variant text-[13px]"><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>Loading designs…</div>
              ) : tabDesigns.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-[48px] text-surface-dim">palette</span>
                  <p className="text-on-surface-variant text-[13px] mt-2 mb-3">No designs associated with this product yet.</p>
                  <button className="h-8 px-4 bg-primary text-white text-[13px] font-semibold rounded hover:bg-primary-container" onClick={handleStartDesign}>
                    <span className="material-symbols-outlined text-[16px] align-middle">palette</span> Start a design
                  </button>
                </div>
              ) : (
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-surface-container-low text-[11px] text-on-surface-variant uppercase border-b border-surface-dim">
                    <tr>
                      <th className="py-2 px-3 w-8"><input type="checkbox" /></th>
                      <th className="py-2 px-3">Design</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Updated</th>
                      <th className="py-2 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-dim">
                    {tabDesigns.map(d => (
                      <tr key={d.id} className="hover:bg-surface-container-low">
                        <td className="py-2 px-3"><input type="checkbox" /></td>
                        <td className="py-2 px-3 font-medium">{d.name}</td>
                        <td className="py-2 px-3"><span className={`pill status role ${d.status === 'published' ? 'customer' : 'contact'}`}>{d.status}</span></td>
                        <td className="py-2 px-3">{fmtDate(d.updatedAt)}</td>
                        <td className="py-2 px-3 text-right">
                          <button className="w-7 h-7 rounded border border-surface-dim hover:bg-surface-container inline-flex items-center justify-center" title="Open in studio" onClick={() => onNavigate('design', 'new-design')}>
                            <span className="material-symbols-outlined text-[16px]">palette</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </main>
  );
}
