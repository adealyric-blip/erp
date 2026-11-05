import { DOMAINS, DomainKey, PINNED } from '@/data/shellData';
import styles from './MainRail.module.css';

interface MainRailProps {
  activeDomain: DomainKey;
  onSelectDomain: (domain: DomainKey) => void;
  onOpenQuickActions: () => void;
  onRailAction: (id: string) => void;
  onUtilAction: (id: string) => void;
  favoritesCount?: number;
  favoritesOpen?: boolean;
  onToggleFavorites?: () => void;
}

export default function MainRail({
  activeDomain,
  onSelectDomain,
  onOpenQuickActions,
  onRailAction,
  onUtilAction,
  favoritesCount = 0,
  favoritesOpen = false,
  onToggleFavorites,
}: MainRailProps) {
  return (
    <aside className={styles.rail}>
      <div className={styles.topSection}>
        <div className={styles.logoBlock}>
          <div className={styles.logoBadge} title="Unsaid">
            U
          </div>
        </div>
        <button
          type="button"
          data-rail="home"
          className={styles.railBtn}
          title="Home"
          onClick={() => onRailAction('home')}
        >
          <span className={`material-symbols-outlined ${styles.icon19}`}>home</span>
        </button>
        <button
          type="button"
          data-rail="feed"
          className={styles.railBtn}
          title="Feed"
          onClick={() => onRailAction('feed')}
        >
          <span className={`material-symbols-outlined ${styles.icon19}`}>dynamic_feed</span>
        </button>
        <button
          type="button"
          data-rail="reports"
          className={styles.railBtn}
          title="Reports"
          onClick={() => onRailAction('reports')}
        >
          <span className={`material-symbols-outlined ${styles.icon19}`}>bar_chart</span>
        </button>
        <button
          type="button"
          data-rail="allapps"
          className={styles.railBtn}
          title="All apps"
          onClick={() => onRailAction('allapps')}
        >
          <span className={`material-symbols-outlined ${styles.icon19}`}>apps</span>
        </button>
        <div className={styles.divider} />
        <span className={styles.pinnedLabel}>Pinned</span>
        <div id="rail-pinned" className={styles.pinnedList}>
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
        <div className={styles.divider} />
        <button
          type="button"
          data-rail="customize"
          className={styles.railBtn}
          title="Customize"
          onClick={() => onRailAction('customize')}
        >
          <span className={`material-symbols-outlined ${styles.icon19}`}>tune</span>
        </button>
      </div>
      <div className={styles.bottomSection}>
        <button
          type="button"
          data-util="modules"
          className={styles.utilBtn}
          title="Master Modules"
          onClick={() => onUtilAction('modules')}
        >
          <span className={`material-symbols-outlined ${styles.icon19}`}>menu_open</span>
        </button>
        <button
          type="button"
          data-util="quick-actions"
          className={styles.utilBtn}
          title="Quick actions"
          onClick={onOpenQuickActions}
        >
          <span className={`material-symbols-outlined ${styles.icon19}`} style={{ color: '#0a6400' }}>
            add_circle
          </span>
        </button>
        <button
          type="button"
          data-util="favorites"
          className={`${styles.utilBtn} ${favoritesOpen ? styles.utilBtnActive : ''} ${
            favoritesCount > 0 ? styles.utilBtnHasFavorites : ''
          }`}
          title={`Starred Favorites (${favoritesCount})`}
          onClick={() => {
            if (onToggleFavorites) {
              onToggleFavorites();
            } else {
              onUtilAction('favorites');
            }
          }}
          aria-expanded={favoritesOpen}
          aria-label={`Starred Favorites (${favoritesCount})`}
        >
          <span
            className={`material-symbols-outlined ${styles.icon19} ${
              favoritesCount > 0 ? styles.starFilled : ''
            }`}
          >
            star
          </span>
          {favoritesCount > 0 && (
            <span className={styles.starBadge}>{favoritesCount}</span>
          )}
        </button>
        <button
          type="button"
          data-util="reports"
          className={styles.utilBtn}
          title="Reports"
          onClick={() => onUtilAction('reports')}
        >
          <span className={`material-symbols-outlined ${styles.icon19}`}>bar_chart</span>
        </button>
        <button
          type="button"
          data-util="inbox"
          className={styles.utilBtn}
          title="Inbox"
          onClick={() => onUtilAction('inbox')}
        >
          <span className={`material-symbols-outlined ${styles.icon19}`}>mail</span>
          <span className={styles.inboxBadge}>4</span>
        </button>
        <button
          type="button"
          data-util="help"
          className={styles.utilBtn}
          title="Help"
          onClick={() => onUtilAction('help')}
        >
          <span className={`material-symbols-outlined ${styles.icon19}`}>help</span>
        </button>
        <button
          type="button"
          data-util="profile"
          className={styles.profileBtn}
          title="Profile"
          onClick={() => onUtilAction('profile')}
        >
          SA
        </button>
      </div>
    </aside>
  );
}
