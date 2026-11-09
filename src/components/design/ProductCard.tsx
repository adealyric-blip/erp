'use client';

import { useState } from 'react';
import type { BlankCard } from '@/lib/podApi';
import RowMenu, { type RowMenuItem } from '../ListPrimitives';

/**
 * ProductCard — minimal, matching Printify's reference design.
 *
 * Card shows: image, product name, brand, price, status pill.
 * NO supplier badge on the card — the supplier name lives at the top
 * of the category grid (one label for the whole grid).
 *
 * Click the card → opens the product page.
 * Click "Design this" → loads the canvas.
 */
export function isUsableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.trim();
  return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/');
}

export function ProductThumb({
  name,
  imageUrl,
  className,
  style,
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const showImg = !failed && isUsableImageUrl(imageUrl);
  return (
    <span
      className={className}
      style={{
        ...style,
        position: 'relative',
        overflow: 'hidden',
        display: 'block',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0eef0',
          color: '#9aa0a6',
          fontWeight: 600,
          fontSize: (style?.fontSize as number | string | undefined) ?? 20,
        }}
      >
        {initials || '•'}
      </span>
      {showImg && (
        <img
          src={imageUrl as string}
          alt={name}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

const statusPills: Record<string, { bg: string; fg: string }> = {
  eligible: { bg: '#e6f4ea', fg: '#137333' },
  render_ready: { bg: '#e6f4ea', fg: '#137333' },
  published: { bg: '#e6f4ea', fg: '#137333' },
  review: { bg: '#fef7e0', fg: '#b06000' },
  skeleton_pending: { bg: '#fef7e0', fg: '#b06000' },
  missing_assets: { bg: '#fef7e0', fg: '#b06000' },
  discontinued: { bg: '#fce8e6', fg: '#a50e0e' },
  default: { bg: '#f0eef0', fg: '#5a6355' },
};

function statusPill(status: string) {
  // Never show "unverified" — the render pipeline is automated, not
  // human-verified. Map it to the default pill instead.
  if (status === 'unverified') return statusPills.default;
  return statusPills[status] || statusPills.default;
}

// Supplier badge — color-coded per supplier. Each card shows its OWN supplier
// because a category has products from MULTIPLE suppliers (Printify, Printful,
// Gelato, Cloudprinter, etc.). A category is NOT beholden to one printer.
const supplierColors: Record<string, string> = {
  printify: '#1f2937',
  printful: '#7b2cbf',
  gelato: '#e8590c',
  cloudprinter: '#0ca678',
};
function supplierColor(s: string): string {
  return supplierColors[(s || '').toLowerCase().replace(/[^a-z]/g, '')] || '#5a6355';
}

export default function ProductCard({
  card,
  selected,
  onToggleSelect,
  onDesign,
  onView,
  onPreview,
}: {
  card: BlankCard;
  selected?: boolean;
  onToggleSelect?: () => void;
  onDesign: () => void;
  onView: () => void;
  onPreview?: () => void;
}) {
  const pill = statusPill(card.status);
  const menuItems: RowMenuItem[] = [
    { label: 'View product page', icon: 'inventory_2', onClick: onView },
  ];
  if (onPreview) menuItems.push({ label: 'Preview', icon: 'visibility', onClick: onPreview });
  menuItems.push({ label: 'Design this', icon: 'palette', onClick: onDesign });

  return (
    <article
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Image — click opens product page */}
      <div
        style={{ cursor: 'pointer', position: 'relative' }}
        onClick={onView}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onView(); }}
      >
        <ProductThumb
          name={card.name}
          imageUrl={card.mockupThumbUrl}
          style={{ width: '100%', aspectRatio: '4 / 3', display: 'block' }}
        />
        {/* Supplier badge — top-right, color-coded per supplier */}
        <span
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            background: supplierColor(card.supplier),
            color: '#fff',
            borderRadius: 3,
            padding: '1px 6px',
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
          }}
        >
          {card.supplier}
        </span>
        {/* Checkbox — top-left, compact */}
        {onToggleSelect && (
          <label
            style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(255,255,255,0.9)', borderRadius: 3, padding: 1, lineHeight: 1 }}
          >
            <input
              type="checkbox"
              aria-label={`Select ${card.name}`}
              checked={selected ?? false}
              onChange={onToggleSelect}
              style={{ margin: 0, cursor: 'pointer' }}
            />
          </label>
        )}
      </div>

      {/* Body — sentence case labels, not ALL CAPS */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {/* Name */}
        <div
          style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
          title={card.name}
        >
          {card.name}
        </div>
        {/* Brand — sentence case, muted */}
        <div style={{ fontSize: 10, color: '#5a6355', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.brand || '—'}
        </div>
        {/* Price + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>
            {card.baseCost != null ? `$${card.baseCost.toFixed(2)}` : '—'}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              background: pill.bg,
              color: pill.fg,
              borderRadius: 3,
              padding: '1px 5px',
              fontSize: 9,
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {card.status === 'unverified' ? 'Review' : card.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', borderTop: '1px solid #f0eef0' }}>
        <button
          type="button"
          onClick={onView}
          style={{
            flex: 1,
            padding: '6px 8px',
            border: 'none',
            background: 'transparent',
            color: '#5a6355',
            fontWeight: 600,
            fontSize: 11,
            cursor: 'pointer',
            borderRight: '1px solid #f0eef0',
          }}
        >
          View
        </button>
        <button
          type="button"
          onClick={onDesign}
          style={{
            flex: 1,
            padding: '6px 8px',
            border: 'none',
            background: 'transparent',
            color: '#0a6400',
            fontWeight: 700,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Design
        </button>
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', paddingRight: 4 }}>
          <RowMenu items={menuItems} ariaLabel={`Quick actions for ${card.name}`} />
        </span>
      </div>
    </article>
  );
}
