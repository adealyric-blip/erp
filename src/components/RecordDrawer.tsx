import { useState } from 'react';
import { DRAWER_FIELDS } from '@/data/shellData';
import styles from './RecordDrawer.module.css';

interface RecordDrawerProps {
  open: boolean;
  kind: string;
  sessionKey: number;
  onClose: () => void;
  onToast?: (msg: string) => void;
}

export default function RecordDrawer({
  open,
  kind,
  sessionKey,
  onClose,
  onToast,
}: RecordDrawerProps) {
  const [menuOpen, setMenuOpen] = useState<'secondary' | 'primary' | null>(null);
  const fields = DRAWER_FIELDS[kind] || [{ label: 'Name', type: 'text' }];
  const icon =
    kind === 'Customer' || kind === 'Vendor'
      ? 'person'
      : kind === 'Product'
      ? 'checkroom'
      : 'receipt_long';
  const subtitle =
    kind === 'Invoice' ? 'Document engine available on Open full' : 'New record';

  const handleSave = (mode: 'save' | 'save-new' | 'save-close') => {
    setMenuOpen(null);
    const label = mode === 'save' ? 'Saved' : mode === 'save-new' ? 'Saved — creating new' : 'Saved';
    onToast?.(`${label} ${kind.toLowerCase()}.`);
    if (mode === 'save-close' || mode === 'save') {
      onClose();
    } else if (mode === 'save-new') {
      // Reset the form by bumping the session key — parent controls this.
      onClose();
    }
  };

  return (
    <>
      <div
        id="record-scrim"
        className={`${styles.scrim} ${open ? styles.scrimOpen : ''}`}
        onClick={onClose}
      />
      <div
        id="record-drawer"
        className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}
      >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span
              id="rec-icon"
              className={`material-symbols-outlined ${styles.icon20Primary}`}
            >
              {icon}
            </span>
            <div>
              <div id="rec-title" className={styles.title}>
                {kind}
              </div>
              <div id="rec-sub" className={styles.subtitle}>
                {subtitle}
              </div>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button type="button" className={styles.iconBtn} title="Maximize">
              <span className={`material-symbols-outlined ${styles.icon18}`}>
                open_in_full
              </span>
            </button>
            <button
              id="rec-close"
              type="button"
              className={styles.iconBtn}
              onClick={onClose}
            >
              <span className={`material-symbols-outlined ${styles.icon18}`}>close</span>
            </button>
          </div>
        </div>

        <div key={`${kind}-${sessionKey}`} id="rec-body" className={styles.body}>
          <div className={styles.grammarBanner}>
            <span className={styles.grammarBadge}>Save grammar</span>
            <span className={styles.grammarText}>
              Save · Save and new · Save and close
            </span>
          </div>
          {fields.map((field) => (
            <div key={field.label}>
              <label className={styles.fieldLabel}>{field.label}</label>
              <input
                className={styles.fieldInput}
                type={field.type}
                placeholder={field.placeholder || ''}
                defaultValue={field.value || ''}
              />
            </div>
          ))}
          <div className={styles.notesSection}>
            <h3 className={styles.notesHeading}>Notes and attachments</h3>
            <textarea className={styles.notesTextarea} placeholder="Add a note…" />
          </div>
        </div>

        <div className={styles.footer}>
          <button
            id="rec-cancel"
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
          >
            Cancel
          </button>
          <div className={styles.footerRight}>
            <div className={styles.splitBtn}>
              <button
                type="button"
                className={styles.splitSecondaryMain}
                onClick={() => handleSave('save-new')}
              >
                Save and new
              </button>
              <button
                type="button"
                className={styles.splitSecondaryArrow}
                onClick={() => setMenuOpen(menuOpen === 'secondary' ? null : 'secondary')}
              >
                <span className={`material-symbols-outlined ${styles.icon16}`}>
                  expand_more
                </span>
              </button>
              {menuOpen === 'secondary' && (
                <div className={styles.splitMenu} role="menu">
                  <button type="button" onClick={() => handleSave('save-new')}>
                    Save and new
                  </button>
                  <button type="button" onClick={() => handleSave('save-close')}>
                    Save and close
                  </button>
                  <button type="button" onClick={() => handleSave('save')}>
                    Save
                  </button>
                </div>
              )}
            </div>
            <div className={styles.splitBtn}>
              <button
                type="button"
                className={styles.splitPrimaryMain}
                onClick={() => handleSave('save-close')}
              >
                Save and close
              </button>
              <button
                type="button"
                className={styles.splitPrimaryArrow}
                onClick={() => setMenuOpen(menuOpen === 'primary' ? null : 'primary')}
              >
                <span className={`material-symbols-outlined ${styles.icon16}`}>
                  expand_more
                </span>
              </button>
              {menuOpen === 'primary' && (
                <div className={styles.splitMenu} role="menu">
                  <button type="button" onClick={() => handleSave('save-close')}>
                    Save and close
                  </button>
                  <button type="button" onClick={() => handleSave('save-new')}>
                    Save and new
                  </button>
                  <button type="button" onClick={() => handleSave('save')}>
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
