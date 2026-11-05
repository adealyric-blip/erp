'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ListPrimitives.module.css';

export interface RowMenuItem {
  label: string;
  icon?: string;
  danger?: boolean;
  onClick: () => void;
  disabled?: boolean;
  dividerBefore?: boolean;
}

export interface RowMenuProps {
  items: RowMenuItem[];
  ariaLabel?: string;
}

/**
 * Shared row ⋯ dropdown menu for list pages.
 * Click to open, click-outside/Escape to close, items render as a vertical menu.
 */
export default function RowMenu({ items, ariaLabel = 'Row actions' }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className={styles.rowMenuWrap}>
      <button
        ref={btnRef}
        type="button"
        className={styles.rowMenuBtn}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          more_horiz
        </span>
      </button>
      {open && (
        <div ref={ref} className={styles.rowMenu} role="menu">
          {items.map((item, idx) => (
            <div key={idx}>
              {item.dividerBefore && <div className={styles.rowMenuDivider} />}
              <button
                type="button"
                className={`${styles.rowMenuItem} ${
                  item.danger ? styles.rowMenuItemDanger : ''
                }`}
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  if (!item.disabled) item.onClick();
                }}
              >
                {item.icon && (
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Shared bulk-bar that appears when rows are selected on a list page.
 * Shows count + action buttons + dismiss.
 */
export interface BulkAction {
  label: string;
  icon?: string;
  onClick: (ids: string[]) => void;
  danger?: boolean;
}

export interface BulkBarProps {
  selectedIds: string[];
  onClear: () => void;
  actions: BulkAction[];
}

export function BulkBar({ selectedIds, onClear, actions }: BulkBarProps) {
  if (selectedIds.length === 0) return null;
  return (
    <div className={styles.bulkBar}>
      <span className={styles.bulkBarText}>
        {selectedIds.length} selected
      </span>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className={`${styles.bulkBarBtn} ${
            action.danger ? styles.bulkBarBtnDanger : ''
          }`}
          onClick={() => action.onClick(selectedIds)}
        >
          {action.icon && (
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {action.icon}
            </span>
          )}
          {action.label}
        </button>
      ))}
      <span className={styles.bulkBarSpacer} />
      <button
        type="button"
        className={styles.bulkBarClose}
        onClick={onClear}
        aria-label="Clear selection"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
          close
        </span>
      </button>
    </div>
  );
}
