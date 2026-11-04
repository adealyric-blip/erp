import { DomainKey } from '@/data/shellData';
import styles from './Header.module.css';

export interface WorkspaceTab {
  key: string;
  domain: DomainKey;
  screenId: string;
  label: string;
}

interface HeaderProps {
  openTabs: WorkspaceTab[];
  activeTabKey: string;
  onSelectTab: (tab: WorkspaceTab) => void;
  onCloseTab: (tabKey: string) => void;
  onOpenCreateFlyout: () => void;
  onOpenQuickActions?: () => void;
}

export default function Header({
  openTabs,
  activeTabKey,
  onSelectTab,
  onCloseTab,
  onOpenCreateFlyout,
  onOpenQuickActions,
}: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.topBar}>
        <div className={styles.leftGroup}>
          <button
            id="btn-allapps"
            type="button"
            className={styles.allAppsBtn}
            title="All apps (⌘K)"
            onClick={onOpenCreateFlyout}
          >
            <span className={`material-symbols-outlined ${styles.icon20}`}>apps</span>
          </button>
          <button type="button" className={styles.companyBtn}>
            <span>ManageKube LLC — Unsaid</span>
            <span className={`material-symbols-outlined ${styles.icon16Muted}`}>
              arrow_drop_down
            </span>
          </button>
        </div>
        <div className={styles.searchContainer}>
          <div className={styles.searchInner}>
            <span className={`material-symbols-outlined ${styles.icon18Search}`}>search</span>
            <input
              className={styles.searchInput}
              placeholder="Search transactions, contacts, reports, ⌘K"
              type="search"
            />
            <span className={styles.shortcutBadge}>⌘K</span>
          </div>
        </div>
        <div className={styles.rightGroup}>
          <button
            id="btn-quick-actions"
            type="button"
            className={styles.quickActionBtn}
            title="Quick actions / Create actions"
            onClick={onOpenQuickActions}
            aria-label="Quick actions"
          >
            <span className={`material-symbols-outlined ${styles.iconCirclePlus}`}>add_circle</span>
          </button>
          <button
            id="btn-create"
            type="button"
            className={styles.createBtn}
            onClick={onOpenCreateFlyout}
          >
            <span className={`material-symbols-outlined ${styles.icon16}`}>add</span>
            Create
          </button>
          <span className={styles.dateText}>Sun, Nov 1, 2026</span>
          <div className={styles.avatar}>SA</div>
        </div>
      </div>
      <div className={styles.tabBar}>
        <nav id="tabstrip" className={styles.tabStrip}>
          {openTabs.map((tab) => {
            const active = tab.key === activeTabKey;
            return (
              <div
                key={tab.key}
                role="tab"
                tabIndex={0}
                aria-selected={active}
                data-tab={tab.key}
                className={`${styles.tabLink} ${active ? styles.tabLinkActive : ''}`}
                onClick={() => onSelectTab(tab)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTab(tab);
                  }
                }}
              >
                <span className={styles.tabLabel}>{tab.label}</span>
                <button
                  type="button"
                  className={styles.tabCloseBtn}
                  title={`Close ${tab.label}`}
                  aria-label={`Close ${tab.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.key);
                  }}
                >
                  <span className={`material-symbols-outlined ${styles.icon14Close}`}>
                    close
                  </span>
                </button>
              </div>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
