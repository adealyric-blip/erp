'use client';

import { useState } from 'react';
import type { BlankCard } from '@/lib/podApi';
import RowMenu, { type RowMenuItem } from '../ListPrimitives';

/**
 * ProductCard — the product card for blanks, driven by the live blanks API.
 * A card is never a broken image: when there is no usable thumbnail URL
 * (no stored mockup yet — most blanks), the tile shows the product's
 * initials instead of an <img> that 404s. Price shows the live base cost
 * or "Price —" when no cost is on file — never an invented price.
 */

export function isUsableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.trim();
  return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/');
}

/**
 * Initials tile with the supplier photo layered on top when it loads.
 * The initials are ALWAYS the background layer: while the supplier image
 * is still loading (or when it 404s — most blanks have no stored photo
 * yet), the tile shows the product's initials instead of a blank hole or
 * a broken-image icon. When the photo arrives it covers the initials.
 * No import is needed for this — the photo is the supplier's own URL;
 * stored photos (after import) replace it.
 */
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
  const initialsFontSize = (style?.fontSize as number | string | undefined) ?? 28;
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
          background: '#e8e4dc',
          color: '#5f574a',
          fontWeight: 700,
          fontSize: initialsFontSize,
          letterSpacing: 1,
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

const pillColors: Record<string, { bg: string; fg: string }> = {
  eligible: { bg: '#e6f4ea', fg: '#137333' },
  review: { bg: '#fef7e0', fg: '#b06000' },
  discontinued: { bg: '#fce8e6', fg: '#a50e0e' },
};

export default function ProductCard({
  card,
  eligibility,
  selected,
  onToggleSelect,
  onDesign,
  onView,
  onPreview,
}: {
  card: BlankCard;
  eligibility?: { status: string; reasons: string[] };
  selected?: boolean;
  onToggleSelect?: () => void;
  onDesign: () => void;
  onView: () => void;
  onPreview?: () => void;
}) {
  const status = eligibility?.status ?? 'review';
  const pill = pillColors[status] ?? pillColors.review;
  const menuItems: RowMenuItem[] = [
    { label: 'View product page', icon: 'inventory_2', onClick: onView },
  ];
  if (onPreview) menuItems.push({ label: 'Preview', icon: 'visibility', onClick: onPreview });
  menuItems.push({ label: 'Design this', icon: 'palette', onClick: onDesign });
  return (
    <article
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {onToggleSelect && (
        <label
          style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, background: '#fff', borderRadius: 4, padding: 2 }}
        >
          <input
            type="checkbox"
            aria-label={`Select ${card.name}`}
            checked={selected ?? false}
            onChange={onToggleSelect}
          />
        </label>
      )}
      <div style={{ cursor: 'pointer' }} onClick={onView} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onView(); }}>
        <ProductThumb
          name={card.name}
          imageUrl={card.mockupThumbUrl}
          style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }}
        />
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{card.name}</div>
        <div style={{ fontSize: 12, color: '#5f6368' }}>
          {card.brand} · {card.supplier}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {card.baseCost != null ? `USD ${card.baseCost.toFixed(2)}` : 'Price —'}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              background: pill.bg,
              color: pill.fg,
              borderRadius: 999,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {status === 'eligible' ? 'Eligible' : status === 'discontinued' ? 'Discontinued' : 'Review'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={onDesign}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#1a73e8',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Design this
          </button>
          <span style={{ flexShrink: 0 }}>
            <RowMenu items={menuItems} ariaLabel={`Quick actions for ${card.name}`} />
          </span>
        </div>
      </div>
    </article>
  );
}
