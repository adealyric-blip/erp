'use client';
/**
 * ProductPageScreen — mirrors PartyProfile's layout EXACTLY.
 *
 * Top action bar has: Download, Print, Edit, and "Design this" split button
 * with create-action dropdown (Create order, Save to Collection, Save to
 * templates, Publish to listing).
 *
 * Colors: platform green primary (#0a6400), NOT blue.
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
  { id: 'designs', label: 'Designs' },
];

// POD lifecycle stages — renderState drives which is active.
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
  const saveToCollection = useDesignCanvas((s) => s.saveToCollection);
  const saveTemplate = useDesignCanvas((s) => s.saveTemplate);

  const [tab, setTab] = useState<Tab>('overview');
  const [activeImg, setActiveImg] = useState(0);
  const [tabOrders, setTabOrders] = useState<BlankOrderRow[] | null>(null);
  const [tabPrice, setTabPrice] = useState<PriceQuote | null>(null);
  const [tabDesigns, setTabDesigns] = useState<DesignListItem[] | null>(null);
  const [tabError, setTabError] = useState<string | null>(null);
  const [txnMenuOpen, setTxnMenuOpen] = useState(false);

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

  function handleDownload() {
    window.print();
  }

  function handlePrint() {
    window.print();
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
    } else {
      onToast('Nothing to export on this tab');
    }
  }

  return (
    <main className="flex flex-col h-full overflow-hidden bg-background">
      {/* ═══ TOP ACTION BAR (mirrors PartyProfile — Download, Print, Edit, split button) ═══ */}
      <header className="h-12 px-4 flex items-center justify-between bg-white border-b border-surface-dim shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button className="flex items-center gap-1 text-primary font-semibold text-[12px] hover:underline shrink-0" onClick={() => onNavigate('design', 'new-design')}>
            <span className="material-symbols-outlined text-[16px]">arrow_back_ios</span>Back
          </button>
          <span className="text-on-surface-variant text-[11px] truncate">/ {displayName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Download */}
          <button className="h-7 w-7 border border-surface-dim rounded bg-white hover:bg-surface-container-low flex items-center justify-center" title="Download" onClick={handleDownload}>
            <span className="material-symbols-outlined text-[15px]">download</span>
          </button>
          {/* Print */}
          <button className="h-7 w-7 border border-surface-dim rounded bg-white hover:bg-surface-container-low flex items-center justify-center" title="Print" onClick={handlePrint}>
            <span className="material-symbols-outlined text-[15px]">print</span>
          </button>
          {/* Export (CSV) */}
          <button className="h-7 w-7 border border-surface-dim rounded bg-white hover:bg-surface-container-low flex items-center justify-center" title="Export CSV" onClick={handleExport}>
            <span className="material-symbols-outlined text-[15px]">table_view</span>
          </button>
          {/* Edit */}
          <button className="h-7 px-2 border border-surface-dim rounded bg-white text-[12px] font-semibold hover:bg-surface-container-low flex items-center gap-1" onClick={() => onToast('Edit product — opening form')}>
            <span className="material-symbols-outlined text-[14px]">edit</span>Edit
          </button>
          {/* Split button — Design this + create-action dropdown */}
          <div className="relative">
            <div className="flex">
              <button className="h-7 px-3 bg-primary text-on-primary text-[12px] font-semibold rounded-l hover:bg-primary-container flex items-center gap-1" onClick={handleStartDesign}>
                <span className="material-symbols-outlined text-[14px]">palette</span>Design this
              </button>
              <button className="h-7 px-1.5 bg-primary text-on-primary rounded-r hover:bg-primary-container border-l border-primary-container" onClick={e => { e.stopPropagation(); setTxnMenuOpen(v => !v); }}>
                <span className="material-symbols-outlined text-[14px]">expand_more</span>
              </button>
            </div>
            {txnMenuOpen && (
              <div className="row-menu open" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, minWidth: 200 }} onClick={e => e.stopPropagation()}>
                <div className="menu-header">Create actions</div>
                <button onClick={() => { setTxnMenuOpen(false); onToast('Create order — opening'); }}><span className="material-symbols-outlined">shopping_bag</span>Create order</button>
                <button onClick={() => { setTxnMenuOpen(false); saveToCollection({ name: displayName, kind: 'product' }); onToast(`Saved "${displayName}" to Collection`); }}><span className="material-symbols-outlined">bookmark</span>Save to Collection</button>
                <button onClick={() => { setTxnMenuOpen(false); saveTemplate(displayName); onToast(`Saved "${displayName}" to My templates`); }}><span className="material-symbols-outlined">view_quilt</span>Save to My templates</button>
                <button onClick={() => { setTxnMenuOpen(false); onToast('Publish to listing — opening'); }}><span className="material-symbols-outlined">publish</span>Publish to listing</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto p-4">
        {!blankDetail ? (
          <div className="flex items-center justify-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-[28px] mr-2">progress_activity</span>Loading product…
          </div>
        ) : (
        <>
        {/* ── PROFILE CARD (mirrors PartyProfile) ── */}
        <div className="bg-white border border-surface-dim rounded-xl p-4 flex gap-4 mb-3">
          {/* Image + name */}
          <div className="w-48 flex flex-col items-center text-center border-r border-surface-dim pr-4 shrink-0">
            <div className="w-24 h-24 rounded-lg bg-surface-container overflow-hidden mb-2">
              <ProductThumb name={displayName} imageUrl={imageUrl} style={{ width: '100%', height: '100%', fontSize: 28 }} />
            </div>
            <h1 className="text-[16px] font-semibold mb-0.5 leading-tight">{displayName}</h1>
            <div className="text-[11px] text-on-surface-variant mb-2">{brand}</div>
            <div className="flex items-center gap-1 flex-wrap justify-center">
              <span className={`pill status role ${status === 'eligible' || status === 'render_ready' ? 'customer' : status === 'discontinued' ? 'vendor' : 'contact'}`}>{status.replace(/_/g, ' ')}</span>
              <span className="pill tag">{supplier}</span>
            </div>
          </div>

          {/* Info grid */}
          <div className="flex-1 grid grid-cols-2 gap-4 text-[12px]">
            <div className="space-y-3">
              <div>
                <div className="font-semibold text-on-surface-variant text-[10px] uppercase mb-0.5">Supplier</div>
                <div>{supplier}</div>
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant text-[10px] uppercase mb-0.5">Brand</div>
                <div>{brand || '—'}</div>
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant text-[10px] uppercase mb-0.5">Family</div>
                <div className="capitalize">{family}</div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="font-semibold text-on-surface-variant text-[10px] uppercase mb-0.5">Variants</div>
                <div>{colors.length} colors · {sizes.length} sizes</div>
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant text-[10px] uppercase mb-0.5">Print areas</div>
                <div>{printAreaNames.length > 0 ? printAreaNames.join(', ') : printAreasPx.length + ' areas'}</div>
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant text-[10px] uppercase mb-0.5">Render state</div>
                <div className="capitalize">{renderState?.replace(/_/g, ' ') || '—'}</div>
              </div>
            </div>
          </div>

          {/* Summary panel */}
          <div className="w-52 shrink-0 bg-[#eef5fa] rounded-lg p-3">
            <h3 className="font-semibold text-[12px] mb-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">inventory_2</span>
              Summary
            </h3>
            <div className="mb-3">
              <div className="text-[10px] text-on-surface-variant mb-0.5">Base cost</div>
              <div className="text-[16px] font-semibold">{money(baseCost)}</div>
            </div>
            <div className="mb-3">
              <div className="text-[10px] text-on-surface-variant mb-0.5">Suggested retail</div>
              <div className="text-[16px] font-semibold">{tabPrice ? money(tabPrice.suggestedRetailPrice) : '—'}</div>
            </div>
            <div className="pt-2 border-t border-surface-dim grid grid-cols-2 gap-1.5 text-[10px]">
              <div><div className="text-on-surface-variant">Colors</div><div className="font-semibold text-[12px]">{colors.length}</div></div>
              <div><div className="text-on-surface-variant">Sizes</div><div className="font-semibold text-[12px]">{sizes.length}</div></div>
              <div><div className="text-on-surface-variant">Printers</div><div className="font-semibold text-[12px]">{printers.length}</div></div>
              <div><div className="text-on-surface-variant">Views</div><div className="font-semibold text-[12px]">{views.length}</div></div>
            </div>
          </div>
        </div>

        {/* ── LIFECYCLE STAGE BAR (mirrors PartyProfile) ── */}
        <div className="bg-white border border-surface-dim rounded-xl p-3 mb-3 flex items-center gap-2">
          <div className="text-[10px] text-on-surface-variant uppercase font-bold">Render lifecycle</div>
          <div className="flex items-center gap-1">
            {LIFECYCLE_STAGES.map((stage, i) => (
              <div key={stage.key} className="flex items-center gap-1">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    i === stageIdx
                      ? 'bg-primary text-on-primary border-primary'
                      : i < stageIdx
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : 'bg-white text-on-surface-variant border-surface-dim'
                  }`}
                >
                  {i < stageIdx && <span className="material-symbols-outlined text-[12px] align-middle mr-0.5">check</span>}
                  {stage.label}
                </span>
                {i < LIFECYCLE_STAGES.length - 1 && <span className="text-surface-dim text-[12px]">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="border-b border-surface-dim mb-3 overflow-x-auto">
          <div className="flex items-center gap-5 min-w-max">
            {TABS.map(t => (
              <button key={t.id} className={`pb-2 text-[13px] tab-underline ${tab === t.id ? 'active' : 'text-on-surface-variant hover:text-on-surface'}`} onClick={() => setTab(t.id)}>
                {t.label}
                {t.id === 'designs' && tabDesigns && tabDesigns.length > 0 && <span className="text-[10px] text-on-surface-variant ml-0.5">({tabDesigns.length})</span>}
                {t.id === 'orders' && tabOrders && tabOrders.length > 0 && <span className="text-[10px] text-on-surface-variant ml-0.5">({tabOrders.length})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div className="bg-white border border-surface-dim rounded-xl overflow-hidden">
          {tab === 'overview' && (
            <div className="p-4 space-y-4">
              <div className="flex gap-4">
                <div className="w-48 shrink-0">
                  <h3 className="text-[12px] font-semibold mb-2">Images ({views.length})</h3>
                  {views.length > 0 ? (
                    <div>
                      <div className="w-full aspect-square rounded-lg border border-surface-dim overflow-hidden bg-surface-container mb-2">
                        <img src={views[activeImg]?.baseUrl} alt={displayName} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex gap-1">
                        {views.slice(0, 6).map((v, i) => (
                          <button key={v.id || i} className={`w-10 h-10 rounded border-2 overflow-hidden ${activeImg === i ? 'border-primary' : 'border-surface-dim'}`} onClick={() => setActiveImg(i)}>
                            <img src={v.baseUrl} alt={v.label} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-square rounded-lg border border-surface-dim bg-surface-container flex items-center justify-center">
                      <ProductThumb name={displayName} imageUrl={imageUrl} style={{ width: '100%', height: '100%', fontSize: 36 }} />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-[12px] font-semibold mb-2">Specifications</h3>
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div><div className="text-on-surface-variant text-[10px] uppercase font-bold mb-0.5">Shipping from</div><div>{blankDetail.shippingFrom || '—'}</div></div>
                    <div><div className="text-on-surface-variant text-[10px] uppercase font-bold mb-0.5">Delivery</div><div>{blankDetail.deliveryEstimate || '—'}</div></div>
                    <div><div className="text-on-surface-variant text-[10px] uppercase font-bold mb-0.5">Fulfillment</div><div className="capitalize">{blankDetail.fulfillment || '—'}</div></div>
                    <div><div className="text-on-surface-variant text-[10px] uppercase font-bold mb-0.5">Render state</div><div className="capitalize">{renderState?.replace(/_/g, ' ') || '—'}</div></div>
                    <div><div className="text-on-surface-variant text-[10px] uppercase font-bold mb-0.5">Base cost</div><div>{money(baseCost)}</div></div>
                    <div><div className="text-on-surface-variant text-[10px] uppercase font-bold mb-0.5">Currency</div><div>{blankDetail.currency || 'USD'}</div></div>
                  </div>
                  {blankDetail.guidelines && (
                    <div className="mt-3">
                      <div className="text-on-surface-variant text-[10px] uppercase font-bold mb-0.5">Guidelines</div>
                      <div className="text-[11px] text-on-surface-variant">{blankDetail.guidelines}</div>
                    </div>
                  )}
                </div>
              </div>
              {printAreasPx.length > 0 && (
                <div>
                  <h3 className="text-[12px] font-semibold mb-2">Print areas ({printAreasPx.length})</h3>
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-surface-container-low text-[10px] text-on-surface-variant uppercase border-b border-surface-dim">
                      <tr><th className="py-1.5 px-2">Placement</th><th className="py-1.5 px-2 text-right">Width</th><th className="py-1.5 px-2 text-right">Height</th><th className="py-1.5 px-2 text-right">DPI</th></tr>
                    </thead>
                    <tbody className="divide-y divide-surface-dim">
                      {printAreasPx.map((pa, i) => (
                        <tr key={i} className="hover:bg-surface-container-low">
                          <td className="py-1.5 px-2 font-medium capitalize">{pa.placement}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{pa.widthPx}px</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{pa.heightPx}px</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{pa.dpi}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'variants' && (
            <div className="p-4">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-surface-container-low text-[10px] text-on-surface-variant uppercase border-b border-surface-dim">
                  <tr><th className="py-1.5 px-2 w-6"><input type="checkbox" /></th><th className="py-1.5 px-2">Color</th><th className="py-1.5 px-2">Hex</th><th className="py-1.5 px-2">SKU</th><th className="py-1.5 px-2">Sizes</th></tr>
                </thead>
                <tbody className="divide-y divide-surface-dim">
                  {colors.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-6 text-on-surface-variant text-[12px]">No color variants loaded.</td></tr>
                  ) : colors.map((c, i) => (
                    <tr key={i} className="hover:bg-surface-container-low">
                      <td className="py-1.5 px-2"><input type="checkbox" /></td>
                      <td className="py-1.5 px-2"><div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full border border-surface-dim shrink-0" style={{ background: c.hex || '#ccc' }} /><span className="font-medium">{c.name}</span></div></td>
                      <td className="py-1.5 px-2 font-mono text-[11px]">{c.hex || '—'}</td>
                      <td className="py-1.5 px-2 font-mono text-[11px]">{c.sku || '—'}</td>
                      <td className="py-1.5 px-2 text-[11px]">{sizes.join(' / ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'orders' && (
            <div className="p-4">
              {tabError ? (
                <p className="text-error text-[12px]">{tabError}</p>
              ) : tabOrders === null ? (
                <div className="flex items-center gap-2 text-on-surface-variant text-[12px]"><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Loading orders…</div>
              ) : tabOrders.length === 0 ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-[36px] text-surface-dim">receipt_long</span>
                  <p className="text-on-surface-variant text-[12px] mt-1 mb-2">No orders for this product yet.</p>
                  <button className="h-7 px-3 bg-primary text-on-primary text-[12px] font-semibold rounded hover:bg-primary-container" onClick={() => onToast('Create order — opening')}>
                    <span className="material-symbols-outlined text-[14px] align-middle">add</span> Create order
                  </button>
                </div>
              ) : (
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-surface-container-low text-[10px] text-on-surface-variant uppercase border-b border-surface-dim">
                    <tr><th className="py-1.5 px-2 w-6"><input type="checkbox" /></th><th className="py-1.5 px-2">Date</th><th className="py-1.5 px-2">Type</th><th className="py-1.5 px-2">No.</th><th className="py-1.5 px-2 text-right">Amount</th><th className="py-1.5 px-2">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-surface-dim">
                    {tabOrders.map(o => (
                      <tr key={o.id} className="hover:bg-surface-container-low">
                        <td className="py-1.5 px-2"><input type="checkbox" /></td>
                        <td className="py-1.5 px-2">{fmtDate(o.placedAt)}</td>
                        <td className="py-1.5 px-2">Order</td>
                        <td className="py-1.5 px-2 font-medium">{o.orderNumber || o.id.slice(0, 8)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-medium">{money(o.total)}</td>
                        <td className="py-1.5 px-2"><span className={`pill status role ${o.status === 'fulfilled' || o.status === 'delivered' ? 'customer' : 'contact'}`}>{o.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'shipping' && (
            <div className="p-4">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-surface-container-low text-[10px] text-on-surface-variant uppercase border-b border-surface-dim">
                  <tr><th className="py-1.5 px-2">Printer</th><th className="py-1.5 px-2">Shipping from</th><th className="py-1.5 px-2">Delivery</th></tr>
                </thead>
                <tbody className="divide-y divide-surface-dim">
                  {printers.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-6 text-on-surface-variant text-[12px]">No shipping data.</td></tr>
                  ) : printers.map(p => (
                    <tr key={p.slug} className="hover:bg-surface-container-low">
                      <td className="py-1.5 px-2 font-medium">{p.name}</td>
                      <td className="py-1.5 px-2">{blankDetail.shippingFrom || '—'}</td>
                      <td className="py-1.5 px-2">{fmtDelivery(p.estimatedDelivery)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'pricing' && (
            <div className="p-4">
              {tabPrice && (
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-[#eef5fa] rounded-lg p-3"><div className="text-[10px] text-on-surface-variant uppercase font-bold mb-0.5">Base cost</div><div className="text-[16px] font-semibold">{money(tabPrice.cost)}</div></div>
                  <div className="bg-[#eef5fa] rounded-lg p-3"><div className="text-[10px] text-on-surface-variant uppercase font-bold mb-0.5">Suggested retail</div><div className="text-[16px] font-semibold">{money(tabPrice.suggestedRetailPrice)}</div></div>
                  <div className="bg-[#eef5fa] rounded-lg p-3"><div className="text-[10px] text-on-surface-variant uppercase font-bold mb-0.5">Margin</div><div className="text-[16px] font-semibold text-green-700">{money(tabPrice.marginAtSuggested)}</div></div>
                  <div className="bg-[#eef5fa] rounded-lg p-3"><div className="text-[10px] text-on-surface-variant uppercase font-bold mb-0.5">Shipping tier</div><div className="text-[16px] font-semibold">{tabPrice.shippingTier}</div></div>
                </div>
              )}
              <h3 className="text-[12px] font-semibold mb-2">Printers ({printers.length})</h3>
              {tabError ? (
                <p className="text-error text-[12px]">{tabError}</p>
              ) : !tabPrice ? (
                <div className="flex items-center gap-2 text-on-surface-variant text-[12px] mb-3"><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Loading pricing…</div>
              ) : (
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-surface-container-low text-[10px] text-on-surface-variant uppercase border-b border-surface-dim">
                    <tr><th className="py-1.5 px-2">Printer</th><th className="py-1.5 px-2 text-right">Base cost</th><th className="py-1.5 px-2 text-right">Delivery</th><th className="py-1.5 px-2 text-right">Suggested retail</th><th className="py-1.5 px-2 text-right">Margin</th></tr>
                  </thead>
                  <tbody className="divide-y divide-surface-dim">
                    {printers.map(p => (
                      <tr key={p.slug} className="hover:bg-surface-container-low">
                        <td className="py-1.5 px-2 font-medium">{p.name}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{money(p.baseCost)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{fmtDelivery(p.estimatedDelivery)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{p.baseCost != null ? money(p.baseCost * 1.55 + tabPrice.shippingTier) : '—'}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-green-700">{p.baseCost != null ? money((p.baseCost * 1.55 + tabPrice.shippingTier) - p.baseCost - tabPrice.shippingTier) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'designs' && (
            <div className="p-4">
              {tabError ? (
                <p className="text-error text-[12px]">{tabError}</p>
              ) : tabDesigns === null ? (
                <div className="flex items-center gap-2 text-on-surface-variant text-[12px]"><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Loading designs…</div>
              ) : tabDesigns.length === 0 ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-[36px] text-surface-dim">palette</span>
                  <p className="text-on-surface-variant text-[12px] mt-1 mb-2">No designs associated with this product yet.</p>
                  <button className="h-7 px-3 bg-primary text-on-primary text-[12px] font-semibold rounded hover:bg-primary-container" onClick={handleStartDesign}>
                    <span className="material-symbols-outlined text-[14px] align-middle">palette</span> Start a design
                  </button>
                </div>
              ) : (
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-surface-container-low text-[10px] text-on-surface-variant uppercase border-b border-surface-dim">
                    <tr><th className="py-1.5 px-2 w-6"><input type="checkbox" /></th><th className="py-1.5 px-2">Design</th><th className="py-1.5 px-2">Status</th><th className="py-1.5 px-2">Updated</th><th className="py-1.5 px-2 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-surface-dim">
                    {tabDesigns.map(d => (
                      <tr key={d.id} className="hover:bg-surface-container-low">
                        <td className="py-1.5 px-2"><input type="checkbox" /></td>
                        <td className="py-1.5 px-2 font-medium">{d.name}</td>
                        <td className="py-1.5 px-2"><span className={`pill status role ${d.status === 'published' ? 'customer' : 'contact'}`}>{d.status}</span></td>
                        <td className="py-1.5 px-2">{fmtDate(d.updatedAt)}</td>
                        <td className="py-1.5 px-2 text-right">
                          <button className="w-6 h-6 rounded border border-surface-dim hover:bg-surface-container inline-flex items-center justify-center" title="Open in studio" onClick={() => onNavigate('design', 'new-design')}>
                            <span className="material-symbols-outlined text-[14px]">palette</span>
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
