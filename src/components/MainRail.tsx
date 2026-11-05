import { DOMAINS, DomainKey, PINNED } from '@/data/shellData';
import styles from './MainRail.module.css';

interface MainRailProps {
  activeDomain: DomainKey;
  onSelectDomain: (domain: DomainKey) => void;
  onOpenCreateFlyout: () => void;
  onRailAction: (id: string) => void;
  onUtilAction: (id: string) => void;
  favoritesCount?: number;
  favoritesOpen?: boolean;
  onToggleFavorites?: () => void;
}

// Pinned utility items (bottom section). These are the persistent quick-access
// tools that live below the domain rail, separated by a grouping divider.
const PINNED_UTIL: { id: string; icon: string; label: string; badge?: number }[] = [
  { id: 'tasks', icon: 'calendar_month', label: 'Tasks / calendar' },
  { id: 'favorites', icon: 'star', label: 'Favorites / bookmarks' },
  { id: 'inbox', icon: 'mail', label: 'Inbox / notifications', badge: 4 },
  { id: 'reports', icon: 'bar_chart', label: 'Reports' },
];

export default function MainRail({
  activeDomain,
  onSelectDomain,
  onOpenCreateFlyout,
  onRailAction,
  favoritesCount = 0,
  favoritesOpen = false,
  onToggleFavorites,
}: MainRailProps) {
  return (
    <aside className={styles.rail}>
      <div className={styles.topSection}>
        {/* Create */}
        <button
          id="rail-create"
          type="button"
          className={styles.createBtn}
          title="Create"
          onClick={onOpenCreateFlyout}
        >
          <span className={`material-symbols-outlined ${styles.icon20}`}>add</span>
        </button>

        {/* Grouping divider — separates Create from the domain rail */}
        <div className={styles.divider} />

        {/* Domain rail — the 7 primary domains, in PINNED order */}
        <div id="rail-domains" className={styles.pinnedList}>
          {PINNED.map((key) => {
            const domain = DOMAINS[key];
            const active = key === activeDomain;
            return (
              <button
                key={key}
                type="button"
                data-pinned={key}
                className={`${styles.pinnedBtn} ${active ? styles.pinnedBtnActive : ''}`}
                title={domain.label}
                onClick={() => onSelectDomain(key)}
              >
                <span className={`material-symbols-outlined ${styles.icon19}`}>{domain.icon}</span>
              </button>
            );
          })}
        </div>

        {/* Grouping divider — separates domain rail from the pinned utilities */}
        <div className={styles.divider} />

        {/* Pinned utility section */}
        <span className={styles.pinnedLabel}>Pinned</span>
        <div id="rail-pinned" className={styles.pinnedList}>
          {PINNED_UTIL.map((item) => {
            const isFavorites = item.id === 'favorites';
            const favActive = isFavorites && favoritesOpen;
            return (
              <button
                key={item.id}
                type="button"
                data-rail={item.id}
                className={`${styles.railBtn} ${favActive ? styles.railBtnActive : ''} ${
                  isFavorites && favoritesCount > 0 ? styles.railBtnHasFavorites : ''
                }`}
                title={item.label}
                onClick={() => {
                  if (isFavorites && onToggleFavorites) {
                    onToggleFavorites();
                  } else {
                    onRailAction(item.id);
                  }
                }}
                aria-label={item.label}
              >
                <span
                  className={`material-symbols-outlined ${styles.icon19} ${
                    isFavorites && favoritesCount > 0 ? styles.starFilled : ''
                  }`}
                >
                  {item.icon}
                </span>
                {isFavorites && favoritesCount > 0 && (
                  <span className={styles.starBadge}>{favoritesCount}</span>
                )}
                {item.badge != null && !isFavorites && (
                  <span className={styles.inboxBadge}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
