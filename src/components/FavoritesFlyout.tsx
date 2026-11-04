'use client';

import React, { useRef, useEffect } from 'react';
import { ActionItem, ALL_ACTIONS_MAP } from './QuickActionsDrawer';
import styles from './FavoritesFlyout.module.css';

interface FavoritesFlyoutProps {
  open: boolean;
  favoriteIds: string[];
  onClose: () => void;
  onSelectAction: (actionName: string) => void;
  onOpenCustomize: () => void;
  onToast?: (message: string) => void;
}

export function FavoritesFlyout({
  open,
  favoriteIds,
  onClose,
  onSelectAction,
  onOpenCustomize,
  onToast,
}: FavoritesFlyoutProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (containerRef.current && containerRef.current.contains(target)) return;
      if (target.closest('[data-rail="favorites"]')) return;
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  const favoriteItems: ActionItem[] = favoriteIds
    .map((id) => ALL_ACTIONS_MAP.get(id))
    .filter((it): it is ActionItem => it !== undefined);

  return (
    <div
      ref={containerRef}
      className={styles.flyout}
      role="menu"
      aria-label="Starred Favorites Menu"
    >
      <div className={styles.arrow} />
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={`material-symbols-outlined ${styles.starIcon}`}>star</span>
          <span className={styles.title}>Starred Favorites</span>
          <span className={styles.countBadge}>{favoriteItems.length}</span>
        </div>
        <button
          type="button"
          className={styles.customizeBtn}
          onClick={() => {
            onClose();
            onOpenCustomize();
          }}
          title="Customize favorites in Quick Actions"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            tune
          </span>
          Edit
        </button>
      </div>

      <div className={styles.list}>
        {favoriteItems.length > 0 ? (
          favoriteItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.item}
              onClick={() => {
                onClose();
                onSelectAction(item.name);
                onToast?.(`Opening ${item.name}`);
              }}
              role="menuitem"
            >
              <span className={`material-symbols-outlined ${styles.itemIcon}`}>
                {item.icon}
              </span>
              <span className={styles.itemLabel}>{item.name}</span>
              <span className={styles.itemGroup}>{item.group}</span>
              <span className={`material-symbols-outlined ${styles.itemArrow}`}>
                arrow_forward
              </span>
            </button>
          ))
        ) : (
          <div className={styles.emptyState}>
            <span className={`material-symbols-outlined ${styles.emptyIcon}`}>
              star_border
            </span>
            <p className={styles.emptyTitle}>No favorites selected</p>
            <p className={styles.emptyDesc}>
              Check actions in Quick Actions to star and pin them here.
            </p>
            <button
              type="button"
              className={styles.emptyActionBtn}
              onClick={() => {
                onClose();
                onOpenCustomize();
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                add
              </span>
              Choose favorites
            </button>
          </div>
        )}
      </div>

      {favoriteItems.length > 0 && (
        <div className={styles.footer}>
          <span className={styles.footerHint}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              touch_app
            </span>
            Click to launch action
          </span>
          <button
            type="button"
            className={styles.footerLink}
            onClick={() => {
              onClose();
              onOpenCustomize();
            }}
          >
            + Customize
          </button>
        </div>
      )}
    </div>
  );
}
