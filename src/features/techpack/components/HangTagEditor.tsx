// Tech pack editor — HangTagEditor (T13b): hang tag spec with UPC check
// digit (live valid/invalid, S615 ds__barcode_valid).
'use client';

import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import { barcodeValid } from '../lib/validation';

export default function HangTagEditor(props: {
  snapshot: TechPackSnapshot;
  locked: boolean;
  onUpsertHangtag: (row: Record<string, unknown>) => void;
}) {
  const { snapshot, locked, onUpsertHangtag } = props;
  const tag = ((snapshot.hangtags ?? [])[0] ?? {}) as Record<string, unknown>;
  const type = String(tag.barcode_type ?? '');
  const value = String(tag.barcode_value ?? '');
  const barcodeOk = barcodeValid(type, value);

  const patch = (p: Record<string, unknown>) => onUpsertHangtag({ ...tag, ...p });

  return (
    <section data-testid="techpack-hangtag">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="text-xs font-medium text-neutral-600">
          Size mm (W × H)
          <span className="flex gap-1">
            <input type="number" min={0} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={Number(tag.width_mm ?? '')} disabled={locked} onChange={(e) => patch({ width_mm: Number(e.target.value) })} />
            <input type="number" min={0} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={Number(tag.height_mm ?? '')} disabled={locked} onChange={(e) => patch({ height_mm: Number(e.target.value) })} />
          </span>
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Shape
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(tag.shape ?? '')} disabled={locked} onChange={(e) => patch({ shape: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Stock / GSM
          <span className="flex gap-1">
            <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(tag.stock ?? '')} disabled={locked} onChange={(e) => patch({ stock: e.target.value })} />
            <input type="number" min={0} className="mt-1 w-20 rounded border border-neutral-300 px-2 py-1 text-sm" value={Number(tag.gsm ?? '')} disabled={locked} onChange={(e) => patch({ gsm: Number(e.target.value) })} />
          </span>
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Print
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(tag.print ?? '')} disabled={locked} onChange={(e) => patch({ print: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Finish
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(tag.finish ?? '')} disabled={locked} onChange={(e) => patch({ finish: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Eyelet
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(tag.eyelet ?? '')} disabled={locked} onChange={(e) => patch({ eyelet: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Fastener
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(tag.fastener ?? '')} disabled={locked} onChange={(e) => patch({ fastener: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Fastener colour
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(tag.fastener_color ?? '')} disabled={locked} onChange={(e) => patch({ fastener_color: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Attach position
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(tag.placement ?? '')} disabled={locked} onChange={(e) => patch({ placement: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Barcode type
          <select className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={type} disabled={locked} onChange={(e) => patch({ barcode_type: e.target.value || null })}>
            <option value="">—</option>
            {['upc_a', 'ean_13', 'code_128', 'qr'].map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Barcode value
          <input className={`mt-1 w-full rounded border px-2 py-1 text-sm ${value && !barcodeOk ? 'border-red-500 bg-red-50' : 'border-neutral-300'}`} value={value} disabled={locked} onChange={(e) => patch({ barcode_value: e.target.value })} />
        </label>
        <span className="flex items-end pb-1 text-sm" data-testid="barcode-check">
          {value === '' ? '' : barcodeOk ? <span className="text-green-700">✓ valid check digit</span> : <span className="text-red-700">✗ bad check digit</span>}
        </span>
        <label className="text-xs font-medium text-neutral-600">
          Retail price
          <span className="flex gap-1">
            <input className="mt-1 w-16 rounded border border-neutral-300 px-2 py-1 text-sm uppercase" value={String(tag.currency ?? 'USD')} disabled={locked} onChange={(e) => patch({ currency: e.target.value.toUpperCase() })} />
            <input type="number" min={0} step="0.01" className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={Number(tag.retail_price ?? '')} disabled={locked} onChange={(e) => patch({ retail_price: Number(e.target.value) })} />
          </span>
        </label>
        <label className="text-xs font-medium text-neutral-600 md:col-span-2">
          Notes
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(tag.notes ?? '')} disabled={locked} onChange={(e) => patch({ notes: e.target.value })} />
        </label>
      </div>
      <p className="mt-2 text-xs text-neutral-500">UPC-A / EAN-13 values are check-digit validated (S615); a bad digit is rejected by the database too.</p>
    </section>
  );
}
