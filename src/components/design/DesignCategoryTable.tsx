'use client';
/**
 * DesignCategoryTable — the table that renders when a Studio Catalog category
 * is selected (Women / Men / Kids / Accessories / Home & Living / Books / PDFs).
 *
 * Mirrors the products + orders table shape: header + KPIs + status tabs +
 * search + table with row checkboxes + per-row three-dot quick-action menu.
 *
 * Wired to REAL catalog products from /api/products. Each row reveals the
 * supplier, quantity (variant count), variants — and lets the user:
 *   - Select & design it → loads blank onto canvas + opens Design drawer
 *   - Drag to canvas (via the row drag handle)
 *   - Save to Collection / My templates (move 3 destinations)
 *   - Preview (move 3 create-action → saves to Collection)
 *   - View product page (move 3 create-action → opens product page)
 */
import { useMemo, useState } from 'react';
import {
  useProducts,
  fetchJson,
  type CatalogProductSummary,
} from '@/hooks/useCrmApi';
import { useDesignCanvas, type CatalogProduct } from '@/lib/designCanvasStore';
import { exportToCsv } from '@/lib/csvExport';
import type { DomainKey } from '@/data/shellData';

interface DesignCategoryTableProps {
  /** The TOP_NAV category label — "Women", "Men", "Kids", etc. */
  category: string;
  onToast: (m: string) => void;
  onNavigate: (d: DomainKey, screenId: string) => void;
}

const money = (n: number | null) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Draft' },
];

function categoryIcon(category: string): string {
  const s = category.toLowerCase();
  if (s.includes('women') || s.includes('men') || s.includes('kids')) return 'checkroom';
  if (s.includes('accessor')) return 'diamond';
  if (s.includes('home')) return 'bed';
  if (s.includes('book')) return 'menu_book';
  if (s.includes('pdf')) return 'picture_as_pdf';
  return 'category';
}

export default function DesignCategoryTable({ category, onToast, onNavigate }: DesignCategoryTableProps) {
  const { data: products, loaded, refresh } = useProducts('', 'all');

  // Filter to products whose category slug/name, brand, tags, or description
  // match this Studio category. Studio categories come from TOP_NAV:
  //   Women / Men / Kids / Accessories / Home & Living / Books / PDFs
  // Real catalog categories have slugs like "home-and-living-...", "t-shirts-...",
  // "mugs", "wellness-self-care-...". We tokenize the Studio category and match
  // all tokens against the combined haystack.
  const filtered = useMemo(() => {
    const needle = category.toLowerCase()
      .replace(/&/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Stop-words for common category names so we don't over-filter.
    const STOP = new Set(['the', 'and', 'of', 'for', 'all']);
    const tokens = needle.split(' ').filter((t) => t.length > 1 && !STOP.has(t));
    return products.filter((p) => {
      const hay = [
        p.category?.slug,
        p.category?.name,
        p.brand,
        p.name,
        p.description,
        ...(p.tags || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [products, category]);

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowMenuForId, setRowMenuForId] = useState<string | null>(null);

  const tabFiltered = useMemo(
    () => filtered.filter((p) => (tab === 'all' ? true : p.status === tab))
      .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand || '').toLowerCase().includes(search.toLowerCase())),
    [filtered, tab, search],
  );

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: filtered.length };
    for (const t of STATUS_TABS) {
      if (t.id === 'all') continue;
      counts[t.id] = filtered.filter((p) => p.status === t.id).length;
    }
    return counts;
  }, [filtered]);

  const totalVariants = tabFiltered.reduce((s, p) => s + p.variant_count, 0);
  const totalUnits = tabFiltered.reduce((s, p) => s + p.units_sold, 0);
  const totalRevenue = tabFiltered.reduce((s, p) => s + p.revenue, 0);

  const loadBlank = useDesignCanvas((s) => s.loadBlank);
  const saveToCollection = useDesignCanvas((s) => s.saveToCollection);
  const saveTemplate = useDesignCanvas((s) => s.saveTemplate);
  const openProductPage = useDesignCanvas((s) => s.openProductPage);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === tabFiltered.length) setSelected(new Set());
    else setSelected(new Set(tabFiltered.map((p) => p.id)));
  }

  function handleSelectAndDesign(p: CatalogProductSummary) {
    // Map the catalog product to a blank key (tee/hoodie/mug) by name heuristics.
    const name = p.name.toLowerCase();
    const blankKey = name.includes('mug') ? 'mug'
      : name.includes('hoodie') || name.includes('crewneck') ? 'hoodie'
      : 'tee';
    loadBlank(blankKey);
    onNavigate('design', 'new-design');
    onToast(`"${p.name}" loaded onto canvas — Design drawer opened.`);
  }

  function handlePreview(p: CatalogProductSummary) {
    // Move 3: preview produces a Collection artifact.
    saveToCollection({ name: `${p.name} — preview`, kind: 'preview', productId: p.id });
    onToast(`Preview saved to Collection: "${p.name}".`);
  }

  function handleViewProductPage(p: CatalogProductSummary) {
    // Move 3: View product page is now a create-action that opens the product
    // page (still a real page) AND saves a ref to Collection.
    const cp: CatalogProduct = {
      id: p.id,
      name: p.name,
      brand: p.brand || '',
      price: p.price_min || 0,
      blankKey: 'tee',
      img: '',
      family: 'tops',
      fabric: '',
      fit: '',
      eligibility: 'Eligible',
      department: p.category?.name || '',
    } as unknown as CatalogProduct;
    openProductPage(cp);
    onNavigate('design', 'product-page');
  }

  async function handleSaveAsTemplate(p: CatalogProductSummary) {
    saveTemplate(p.name);
    onToast(`"${p.name}" saved as a template.`);
  }

  async function bulkAddToQueue() {
    const sel = [...selected];
    const queue = useDesignCanvas.getState();
    let added = 0;
    for (const id of sel) {
      const p = products.find((x) => x.id === id);
      if (!p) continue;
      queue.addToQueue({
        id: p.id,
        name: p.name,
        brand: p.brand || '',
        price: p.price_min || 0,
        img: '',
        blankKey: 'tee',
      } as any);
      added++;
    }
    onToast(`${added} products added to the design queue.`);
    setSelected(new Set());
  }

  function handleExport() {
    exportToCsv(tabFiltered.map((p) => ({
      name: p.name, brand: p.brand || '', status: p.status,
      variants: p.variant_count, price_min: p.price_min ?? '',
      price_max: p.price_max ?? '', units: p.units_sold, revenue: p.revenue,
    })), [
      { key: 'name', label: 'Product' }, { key: 'brand', label: 'Brand' },
      { key: 'status', label: 'Status' }, { key: 'variants', label: 'Variants' },
      { key: 'price_min', label: 'Price min' }, { key: 'price_max', label: 'Price max' },
      { key: 'units', label: 'Units sold' }, { key: 'revenue', label: 'Revenue' },
    ], `studio-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    onToast(`Exported ${tabFiltered.length} products`);
  }

  return (
    <main className="px-6 pb-12 flex flex-col h-full">
      {/* Context header */}
      <div className="flex items-center gap-2 text-body-sm text-on-surface-variant py-3">
        <span className="material-symbols-outlined text-[18px]">grid_view</span>
        <span>Catalog</span>
        <span className="text-on-surface-variant/40">/</span>
        <span className="text-on-surface font-medium">{category}</span>
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-headline-lg">{category}</h1>
          <p className="text-body-sm text-on-surface-variant mt-0.5">
            {filtered.length} products · select and design, or drag to canvas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1" onClick={handleExport}>
            <span className="material-symbols-outlined text-[16px]">download</span>Export
          </button>
          <button
            className="h-8 px-3 bg-primary text-white text-body-md font-semibold rounded hover:bg-primary-container flex items-center gap-1"
            onClick={() => onNavigate('design', 'new-design')}
          >
            <span className="material-symbols-outlined text-[16px]">palette</span>New design
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase font-bold">Products</div>
          <div className="text-headline-sm tabular-nums">{tabFiltered.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase font-bold">Variants</div>
          <div className="text-headline-sm tabular-nums">{totalVariants}</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase font-bold">Units sold</div>
          <div className="text-headline-sm tabular-nums text-primary">{totalUnits}</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase font-bold">Revenue</div>
          <div className="text-headline-sm tabular-nums text-secondary">{money(totalRevenue)}</div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-3 border-b border-surface-dim">
        {STATUS_TABS.map((t) => (
          <button key={t.id} className={`px-3 py-2 text-label-md tab-underline ${tab === t.id ? 'active' : 'text-on-surface-variant'}`} onClick={() => setTab(t.id)}>
            {t.label} <span className="text-on-surface-variant">({tabCounts[t.id] || 0})</span>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-2 top-1.5 text-[16px] text-on-surface-variant">search</span>
          <input className="w-full h-8 pl-8 pr-3 border border-surface-dim rounded text-body-sm focus:outline-none focus:border-primary" placeholder={`Search ${category}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-surface-dim overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-3 py-2 w-8"><input type="checkbox" checked={selected.size === tabFiltered.length && tabFiltered.length > 0} onChange={toggleAll} /></th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Supplier / Brand</th>
                <th className="px-3 py-2 text-right">Variants</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Units</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-2 py-2 w-10 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-dim">
              {!loaded && filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-on-surface-variant/60">Fetching from Supabase…</td></tr>
              ) : tabFiltered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-on-surface-variant">No {category} products found.</td></tr>
              ) : (
                tabFiltered.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-surface-container-low cursor-pointer"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('blank-type', 'tee');
                      e.dataTransfer.setData('catalog-product-id', p.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => handleSelectAndDesign(p)}
                  >
                    <td className="px-3 py-2" onClick={(e) => { e.stopPropagation(); }}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleRow(p.id)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[15px] text-on-surface-variant">{categoryIcon(category)}</span>
                        </div>
                        <div className="min-w-0">
                          <button className="font-medium truncate text-left hover:text-primary hover:underline" onClick={(e) => { e.stopPropagation(); handleViewProductPage(p); }}>
                            {p.name}
                          </button>
                          <div className="text-[11px] text-on-surface-variant truncate">
                            {p.brand || p.slug}
                            {p.is_best_seller && <span className="ml-1 text-secondary font-semibold">· Best seller</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[12px]">{p.brand || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.variant_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[12px]">
                      {p.price_min == null ? '—' : p.price_min === p.price_max ? money(p.price_min) : `${money(p.price_min)}–${money(p.price_max)}`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.units_sold}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(p.revenue)}</td>
                    <td className="px-3 py-2">
                      <span className={`pill status role ${p.status === 'published' ? 'customer' : p.status === 'draft' ? 'contact' : 'vendor'}`}>{p.status}</span>
                    </td>
                    <td className="px-2 py-2 text-right relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="w-7 h-7 rounded border border-surface-dim hover:bg-surface-container flex items-center justify-center mx-auto"
                        title="Quick actions"
                        aria-label={`Quick actions for ${p.name}`}
                        onClick={(e) => { e.stopPropagation(); setRowMenuForId(rowMenuForId === p.id ? null : p.id); }}
                      >
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">more_horiz</span>
                      </button>
                      {rowMenuForId === p.id && (
                        <div className="row-menu open" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, minWidth: 230 }} onClick={(e) => e.stopPropagation()}>
                          <div className="menu-header">{p.name}</div>
                          <button onClick={() => { setRowMenuForId(null); handleSelectAndDesign(p); }}>
                            <span className="material-symbols-outlined">palette</span>Select &amp; design
                          </button>
                          <button onClick={() => { setRowMenuForId(null); handleViewProductPage(p); }}>
                            <span className="material-symbols-outlined">inventory_2</span>View product page
                          </button>
                          <button onClick={() => { setRowMenuForId(null); handlePreview(p); }}>
                            <span className="material-symbols-outlined">visibility</span>Preview
                          </button>
                          <div className="sep"></div>
                          <button onClick={() => { setRowMenuForId(null); handleSaveAsTemplate(p); }}>
                            <span className="material-symbols-outlined">view_quilt</span>Save to My templates
                          </button>
                          <button onClick={() => { setRowMenuForId(null); saveToCollection({ name: p.name, kind: 'product', productId: p.id }); onToast(`Saved "${p.name}" to Collection.`); }}>
                            <span className="material-symbols-outlined">bookmark</span>Save to Collection
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with bulk bar */}
        <div className="px-3 py-2 border-t border-surface-dim text-[11px] text-on-surface-variant flex items-center justify-between">
          <span>{tabFiltered.length} of {filtered.length} products</span>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span>{selected.size} selected</span>
              <button className="h-6 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low" onClick={bulkAddToQueue}>
                <span className="material-symbols-outlined text-[12px] align-middle">playlist_add</span>
                Add to queue
              </button>
              <button className="h-6 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low" onClick={() => { [...selected].forEach((id) => { const p = products.find((x) => x.id === id); if (p) handleSaveAsTemplate(p); }); setSelected(new Set()); }}>
                <span className="material-symbols-outlined text-[12px] align-middle">view_quilt</span>
                Save as templates
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Click-away for row menu */}
      {rowMenuForId && <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setRowMenuForId(null)} />}
    </main>
  );
}
