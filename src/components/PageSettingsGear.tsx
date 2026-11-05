'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PageSettingsGear.module.css';

/**
 * PageSettingsGear — the gear icon + dropdown menu that used to live in the
 * SideRail header. Moved to the top-right of each page's content area (per-page,
 * not global app chrome) per the user's request: "move that settings button to
 * the top of that page for each sidebar".
 *
 * Self-contained: owns its own open/close state + outside-click handling.
 */
export default function PageSettingsGear() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        btnRef.current &&
        !btnRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap}>
      <button
        ref={btnRef}
        type="button"
        className={styles.gearBtn}
        title="Settings"
        aria-label="Settings"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
          settings
        </span>
      </button>

      {open && (
        <div ref={menuRef} className={styles.gearMenu} role="menu">
          <div className={styles.gearSectionTitle}>Your company</div>
          <button type="button" className={styles.gearItem} role="menuitem">
            <span className={`material-symbols-outlined ${styles.icon16Muted}`}>apartment</span>
            Account &amp; settings
          </button>
          <button type="button" className={styles.gearItem} role="menuitem">
            <span className={`material-symbols-outlined ${styles.icon16Muted}`}>manage_accounts</span>
            Manage users
          </button>
          <button type="button" className={styles.gearItem} role="menuitem">
            <span className={`material-symbols-outlined ${styles.icon16Muted}`}>account_balance</span>
            Chart of accounts
          </button>
          <div className={styles.gearDivider} />
          <div className={styles.gearSectionTitle}>Lists</div>
          <button type="button" className={styles.gearItem} role="menuitem">
            <span className={`material-symbols-outlined ${styles.icon16Muted}`}>list</span>
            All lists
          </button>
          <button type="button" className={styles.gearItem} role="menuitem">
            <span className={`material-symbols-outlined ${styles.icon16Muted}`}>inventory_2</span>
            Products &amp; services
          </button>
          <button type="button" className={styles.gearItem} role="menuitem">
            <span className={`material-symbols-outlined ${styles.icon16Muted}`}>tune</span>
            Custom fields
          </button>
          <div className={styles.gearDivider} />
          <div className={styles.gearSectionTitle}>Tools</div>
          <button type="button" className={styles.gearItem} role="menuitem">
            <span className={`material-symbols-outlined ${styles.icon16Muted}`}>swap_horiz</span>
            Reclassify transactions
          </button>
          <button type="button" className={styles.gearItem} role="menuitem">
            <span className={`material-symbols-outlined ${styles.icon16Muted}`}>fact_check</span>
            Reconcile
          </button>
          <button type="button" className={styles.gearItem} role="menuitem">
            <span className={`material-symbols-outlined ${styles.icon16Muted}`}>history</span>
            Audit log
          </button>
          <div className={styles.gearDivider} />
          <div className={styles.gearSectionTitle}>Profile</div>
          <button type="button" className={styles.gearItem} role="menuitem">
            <span className={`material-symbols-outlined ${styles.icon16Muted}`}>new_releases</span>
            What&apos;s new
          </button>
          <button type="button" className={styles.gearItem} role="menuitem">
            <span className={`material-symbols-outlined ${styles.icon16Muted}`}>chat</span>
            Feedback
          </button>
        </div>
      )}
    </div>
  );
}
