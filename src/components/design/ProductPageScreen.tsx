'use client';
/**
 * ProductPageScreen — the product profile page, mirroring PartyProfile's
 * tabbed layout EXACTLY.
 *
 * Same structure as the customer profile:
 *   - Top action bar (back button + Edit + New transaction split button)
 *   - Profile card (product image + info grid + summary panel)
 *   - Tab-underline tabs (Overview · Variants · Orders · Shipping · Pricing · Designs)
 *   - Tab content below
 *
 * Reached from: card click in the category table, or any "View product page"
 * create-action. NOT in the sidebar (hidden) — it's a destination, reached
 * only via a create-action fired from a drawer/card.
 */
import { useEffect, useState } from 'react';
import {
  getBlank,
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

const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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

  // Load the blank detail when a product is selected (from the store)
  useEffect(() => {
    if (storeProduct?.id) {
      void loadBlankDetail(storeProduct.id).catch((e: Error) => {
        onToast(`Could not load product detail: ${e.message}`);
      });
    }
  }, [storeProduct?.id, loadBlankDetail, onToast]);

  // Load tab-specific data when the tab changes
  useEffect(() => {
    if (!blankDetail || tab === 'overview' || tab === 'variants' || tab === 'shipping') return;
    setTabError(null);
    if (tab === 'orders') {
      setTabOrders(null);
      void getBlankOrders(blankDetail.id)
        .then((r) => setTabOrders(r.orders))
        .catch((e: Error) => setTabError(e.message));
    } else if (tab === 'pricing') {
      setTabPrice(null);
      void getBlankPrice(blankDetail.id)
        .then((q) => setTabPrice(q))
        .catch((e: Error) => setTabError(e.message));
    } else if (tab === 'designs') {
      setTabDesigns(null);
      void listDesigns({ blankId: blankDetail.id, limit: 50 })
        .then((r) => setTabDesigns(r.items))
        .catch((e: Error) => setTabError(e.message));
    }
  }, [tab, blankDetail?.id]);

  // The product to display — from the loaded blank detail, or the store's
  // productPage, or a fallback
  const product: CatalogProduct = storeProduct ?? ({} as CatalogProduct);
  const displayName = blankDetail?.name || product.name || 'Unnamed product';
  const brand = blankDetail?.brand || product.brand || '—';
  const supplier = blankDetail?.supplier || '—';
  const baseCost = blankDetail?.baseCost ?? null;
  const family = blankDetail?.family || '—';
  const status = blankDetail?.status || 'review';
  const imageUrl = blankDetail?.views?.[0]?.baseUrl || product.img || blankDetail?.mockupThumbUrl;

  // Variants from the loaded detail
  const variants = blankDetail?.variants;
  const colors = variants?.colors || [];
  const sizes = variants?.sizes || [];
  const printAreas = variants?.printAreas || [];

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
        [{ key: 'name', label: 'Design' }, { key: 'status', label: 'Status' }, { key: 'blankId', label: 'Blank ID' }],
        `${displayName}-designs`);
      onToast(`Exported ${tabDesigns.length} designs`);
    } else if (tab === 'variants' && variants) {
      exportToCsv(colors.map(c => ({ color: c.name, hex: c.hex, sizes: sizes.join('/') })),
        [{ key: 'color', label: 'Color' }, { key: 'hex', label: 'Hex' }, { key: 'sizes', label: 'Sizes' }],
        `${displayName}-variants`);
      onToast(`Exported ${colors.length} variants`);
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
          <button className="h-8 px-3 border border-surface-dim rounded bg-white text-[13px] font-semibold hover:bg-surface-container" onClick={handleExport}>
            <span className="material-symbols-outlined text-[16px] align-middle">download</span> Export
          </button>
          <button className="h-8 px-3 border border-surface-dim rounded bg-white text-[13px] font-semibold hover:bg-surface-container" onClick={() => onToast('Edit product — opening form')}>
            <span className="material-symbols-outlined text-[16px] align-middle">edit</span> Edit
          </button>
          <div className="relative">
            <div className="flex">
              <button className="h-8 px-3 bg-primary text-white text-[13px] font-semibold rounded-l hover:bg-primary-container flex items-center gap-1" onClick={handleStartDesign}>
                <span className="material-symbols-outlined text-[16px]">palette</span> Design this
              </button>
              <button className="h-8 px-1.5 bg-primary text-white rounded-r hover:bg-primary-container border-l border-primary-container" onClick={e => { e.stopPropagation(); setTxnMenuOpen(v => !v); }}>
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
            {txnMenuOpen && (
              <div className="row-menu open" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, minWidth: 220 }} onClick={e => e.stopPropagation()}>
                <div className="menu-header">New transaction</div>
                <button onClick={() => { setTxnMenuOpen(false); onToast('New order — opening'); }}><span className="material-symbols-outlined">shopping_bag</span>Create order</button>
                <button onClick={() => { setTxnMenuOpen(false); onToast('Save to Collection'); }}><span className="material-symbols-outlined">bookmark</span>Save to Collection</button>
                <button onClick={() => { setTxnMenuOpen(false); onToast('Save to My templates'); }}><span className="material-symbols-outlined">view_quilt</span>Save to My templates</button>
                <button onClick={() => { setTxnMenuOpen(false); onToast('Publish to listing'); }}><span className="material-symbols-outlined">publish</span>Publish to listing</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ── PROFILE CARD (mirrors PartyProfile) ── */}
        <div className="bg-white border border-surface-dim rounded-xl p-6 flex gap-6 mb-4">
          {/* Image + name */}
          <div className="w-1/4 flex flex-col items-center justify-center text-center border-r border-surface-dim pr-6">
            <div className="w-32 h-32 rounded-xl bg-surface-container flex items-center justify-center mb-3 overflow-hidden">
              <ProductThumb
                name={displayName}
                imageUrl={imageUrl}
                style={{ width: '100%', height: '100%', fontSize: 36 }}
              />
            </div>
            <h1 className="text-[20px] font-semibold mb-1">{displayName}</h1>
            <div className="text-[12px] text-on-surface-variant mb-3">{brand}</div>
            <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
              <span className={`pill status role ${status === 'eligible' ? 'customer' : status === 'discontinued' ? 'vendor' : 'contact'}`}>{status}</span>
              <span className="pill tag">{family}</span>
              <span className="pill tag">{supplier}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high" title="Preview" onClick={() => onToast('Preview saved to Collection')}><span className="material-symbols-outlined text-[18px]">visibility</span></button>
              <button className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high" title="Save to templates" onClick={() => onToast(`"${displayName}" saved to My templates`)}><span className="material-symbols-outlined text-[18px]">view_quilt</span></button>
            </div>
          </div>

          {/* Info grid */}
          <div className="flex-1 grid grid-cols-2 gap-6 text-[13px]">
            <div className="space-y-4">
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Supplier</div>
                <span className="text-on-surface">{supplier}</span>
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Brand</div>
                <span className="text-on-surface">{brand}</span>
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
                <span className="text-on-surface">{printAreas.length > 0 ? printAreas.join(', ') : (blankDetail?.printAreas?.length || 0) + ' areas'}</span>
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Status</div>
                <span className="text-on-surface capitalize">{status}</span>
              </div>
            </div>
          </div>

          {/* Summary panel */}
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
            </div>
            <div className="pt-3 border-t border-surface-dim grid grid-cols-2 gap-2 text-[12px]">
              <div><div className="text-on-surface-variant">Colors</div><div className="font-semibold">{colors.length}</div></div>
              <div><div className="text-on-surface-variant">Sizes</div><div className="font-semibold">{sizes.length}</div></div>
              <div><div className="text-on-surface-variant">Print areas</div><div className="font-semibold">{blankDetail?.printAreas?.length || 0}</div></div>
              <div><div className="text-on-surface-variant">Printers</div><div className="font-semibold">{blankDetail?.printers?.length || 0}</div></div>
            </div>
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
        <div className="bg-white border border-surface-dim rounded-xl p-6">
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Gallery */}
              <div>
                <h3 className="text-[14px] font-semibold mb-3">Product images</h3>
                {blankDetail && blankDetail.views.length > 0 ? (
                  <div className="flex gap-3">
                    <div className="w-64 h-64 rounded-xl border border-surface-dim overflow-hidden bg-surface-container">
                      <img src={blankDetail.views[activeImg]?.baseUrl} alt={displayName} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col gap-2">
                      {blankDetail.views.slice(0, 5).map((v, i) => (
                        <button key={v.id} className={`w-16 h-16 rounded-lg border-2 overflow-hidden ${activeImg === i ? 'border-primary' : 'border-surface-dim'}`} onClick={() => setActiveImg(i)}>
                          <img src={v.baseUrl} alt={v.label} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="w-64 h-64 rounded-xl border border-surface-dim bg-surface-container flex items-center justify-center">
                    <ProductThumb name={displayName} imageUrl={imageUrl} style={{ width: '100%', height: '100%', fontSize: 48 }} />
                  </div>
                )}
              </div>
              {/* Specs */}
              {blankDetail && (
                <div>
                  <h3 className="text-[14px] font-semibold mb-3">Specifications</h3>
                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    <div><div className="text-on-surface-variant text-[11px] uppercase font-bold mb-1">Shipping from</div><div>{blankDetail.shippingFrom || '—'}</div></div>
                    <div><div className="text-on-surface-variant text-[11px] uppercase font-bold mb-1">Delivery estimate</div><div>{blankDetail.deliveryEstimate || '—'}</div></div>
                    <div><div className="text-on-surface-variant text-[11px] uppercase font-bold mb-1">Guidelines</div><div className="text-[12px]">{blankDetail.guidelines?.slice(0, 100) || '—'}{blankDetail.guidelines && blankDetail.guidelines.length > 100 ? '…' : ''}</div></div>
                    <div><div className="text-on-surface-variant text-[11px] uppercase font-bold mb-1">Render state</div><div className="capitalize">{blankDetail.renderState || '—'}</div></div>
                  </div>
                </div>
              )}
              {/* Printers */}
              {blankDetail && blankDetail.printers.length > 0 && (
                <div>
                  <h3 className="text-[14px] font-semibold mb-3">Available printers ({blankDetail.printers.length})</h3>
                  <div className="space-y-2">
                    {blankDetail.printers.map(p => (
                      <div key={p.slug} className="flex items-center justify-between p-3 border border-surface-dim rounded-lg text-[13px]">
                        <div>
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-on-surface-variant text-[11px]">{p.baseCost != null ? `Base: $${p.baseCost.toFixed(2)}` : 'Price on request'}</div>
                        </div>
                        <div className="text-on-surface-variant text-[11px]">{p.deliveryEstimate?.average || '—'} {p.deliveryEstimate?.unit?.replace(/_/g, ' ') || ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'variants' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-[14px] font-semibold mb-3">Colors ({colors.length})</h3>
                {colors.length === 0 ? (
                  <p className="text-on-surface-variant text-[13px]">No color variants loaded.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {colors.map(c => (
                      <div key={c.id} className="flex items-center gap-2 p-2 border border-surface-dim rounded-lg text-[12px]">
                        <div className="w-6 h-6 rounded-full border border-surface-dim" style={{ background: c.hex }} />
                        <span className="truncate">{c.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-[14px] font-semibold mb-3">Sizes ({sizes.length})</h3>
                {sizes.length === 0 ? (
                  <p className="text-on-surface-variant text-[13px]">No size variants loaded.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {sizes.map(s => (
                      <span key={s} className="px-3 py-1.5 border border-surface-dim rounded text-[12px] font-medium">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-[14px] font-semibold mb-3">Print areas ({printAreas.length})</h3>
                {printAreas.length === 0 ? (
                  <p className="text-on-surface-variant text-[13px]">No print areas listed.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {printAreas.map(p => (
                      <span key={p} className="px-3 py-1.5 border border-surface-dim rounded text-[12px] font-medium">{p}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div>
              {tabError ? (
                <p className="text-error text-[13px]">{tabError}</p>
              ) : tabOrders === null ? (
                <div className="flex items-center gap-2 text-on-surface-variant text-[13px]"><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>Loading orders…</div>
              ) : tabOrders.length === 0 ? (
                <p className="text-on-surface-variant text-[13px]">No orders for this product yet.</p>
              ) : (
                <table className="w-full text-left text-[13px]">
                  <thead className="text-[11px] text-on-surface-variant uppercase border-b border-surface-dim">
                    <tr><th className="py-2">Order</th><th>Date</th><th>Status</th><th className="text-right">Total</th></tr>
                  </thead>
                  <tbody className="divide-y divide-surface-dim">
                    {tabOrders.map(o => (
                      <tr key={o.id}>
                        <td className="py-2 font-medium">{o.orderNumber || o.id.slice(0, 8)}</td>
                        <td>{fmtDate(o.placedAt)}</td>
                        <td className="capitalize">{o.status}</td>
                        <td className="text-right tabular-nums">{money(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'shipping' && (
            <div className="space-y-4 text-[13px]">
              {blankDetail ? (
                <>
                  <div><div className="text-on-surface-variant text-[11px] uppercase font-bold mb-1">Shipping from</div><div>{blankDetail.shippingFrom || '—'}</div></div>
                  <div><div className="text-on-surface-variant text-[11px] uppercase font-bold mb-1">Delivery estimate</div><div>{blankDetail.deliveryEstimate || '—'}</div></div>
                </>
              ) : (
                <p className="text-on-surface-variant">Shipping details load when a product is selected.</p>
              )}
            </div>
          )}

          {tab === 'pricing' && (
            <div>
              {tabError ? (
                <p className="text-error text-[13px]">{tabError}</p>
              ) : !tabPrice ? (
                <div className="flex items-center gap-2 text-on-surface-variant text-[13px]"><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>Loading pricing…</div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-[#eef5fa] rounded-lg p-4">
                    <div className="text-[11px] text-on-surface-variant uppercase font-bold mb-1">Base cost</div>
                    <div className="text-[24px] font-semibold">{money(tabPrice.cost)}</div>
                  </div>
                  <div className="bg-[#eef5fa] rounded-lg p-4">
                    <div className="text-[11px] text-on-surface-variant uppercase font-bold mb-1">Suggested retail</div>
                    <div className="text-[24px] font-semibold">{money(tabPrice.suggestedRetailPrice)}</div>
                    <div className="text-[11px] text-on-surface-variant mt-1">cost × 1.55 + shipping</div>
                  </div>
                  <div className="bg-[#eef5fa] rounded-lg p-4">
                    <div className="text-[11px] text-on-surface-variant uppercase font-bold mb-1">Margin at suggested</div>
                    <div className="text-[24px] font-semibold">{money(tabPrice.marginAtSuggested)}</div>
                  </div>
                  <div className="bg-[#eef5fa] rounded-lg p-4">
                    <div className="text-[11px] text-on-surface-variant uppercase font-bold mb-1">Shipping tier</div>
                    <div className="text-[24px] font-semibold">{tabPrice.shippingTier}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'designs' && (
            <div>
              {tabError ? (
                <p className="text-error text-[13px]">{tabError}</p>
              ) : tabDesigns === null ? (
                <div className="flex items-center gap-2 text-on-surface-variant text-[13px]"><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>Loading designs…</div>
              ) : tabDesigns.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-on-surface-variant text-[13px] mb-3">No designs associated with this product yet.</p>
                  <button className="h-8 px-4 bg-primary text-white text-[13px] font-semibold rounded hover:bg-primary-container" onClick={handleStartDesign}>
                    <span className="material-symbols-outlined text-[16px] align-middle">palette</span> Start a design
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {tabDesigns.map(d => (
                    <div key={d.id} className="border border-surface-dim rounded-lg p-3 text-[13px]">
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-on-surface-variant text-[11px] capitalize">{d.status}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
