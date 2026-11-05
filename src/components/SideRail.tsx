import { DOMAINS, DomainKey, GroupBgToken } from '@/data/shellData';
import styles from './SideRail.module.css';

interface SideRailProps {
  activeDomain: DomainKey;
  activeScreen: string;
  openGroups: string[];
  sideFilter: string;
  onSideFilterChange: (value: string) => void;
  onToggleGroup: (groupName: string) => void;
  onSelectScreen: (screenId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  screenBadges?: Record<string, number>;
}

const GROUP_BG_CLASS: Record<GroupBgToken, string> = {
  'bg-qb-navy': styles.bgQbNavy,
  'bg-qb-teal': styles.bgQbTeal,
  'bg-qb-maroon': styles.bgQbMaroon,
  'bg-qb-green': styles.bgQbGreen,
  'bg-error': styles.bgError,
  'bg-primary': styles.bgPrimary,
};

export default function SideRail({
  activeDomain,
  activeScreen,
  openGroups,
  sideFilter,
  onSideFilterChange,
  onToggleGroup,
  onSelectScreen,
  collapsed,
  onToggleCollapse,
  screenBadges,
}: SideRailProps) {
  const domain = DOMAINS[activeDomain];
  const query = sideFilter.toLowerCase();

  return (
    <aside className={`${styles.sideRail} ${collapsed ? styles.sideRailCollapsed : ''}`}>
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.collapseBtn}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            onClick={onToggleCollapse}
          >
            <span className={`material-symbols-outlined ${styles.icon18}`}>
              {collapsed ? 'menu_open' : 'left_panel_close'}
            </span>
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className={styles.filterRow}>
          <div className={styles.filterInner}>
            <span className={`material-symbols-outlined ${styles.icon15Search}`}>search</span>
            <input
              id="side-filter"
              className={styles.filterInput}
              placeholder="Filter…"
              type="text"
              value={sideFilter}
              onChange={(e) => onSideFilterChange(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className={styles.navScroll}>
        <nav id="siderail">
          {domain.groups.map((group) => {
            const visibleScreens = group.screens.filter(
              (s) => !query || s.label.toLowerCase().includes(query)
            );
            if (query && visibleScreens.length === 0) return null;

            const isOpen =
              !collapsed && (openGroups.includes(group.name) || Boolean(query && visibleScreens.length > 0));

            return (
              <div key={group.name} className={styles.groupBlock}>
                <button
                  type="button"
                  data-group={group.name}
                  className={`${styles.groupBtn} ${collapsed ? styles.groupBtnCollapsed : ''}`}
                  title={collapsed ? group.name : undefined}
                  onClick={() => !collapsed && onToggleGroup(group.name)}
                >
                  <div className={styles.groupBtnLeft}>
                    <div className={`${styles.groupBadge} ${GROUP_BG_CLASS[group.bg]}`}>
                      <span className={`material-symbols-outlined ${styles.icon13}`}>
                        {group.icon}
                      </span>
                    </div>
                    {!collapsed && <span className={styles.groupName}>{group.name}</span>}
                  </div>
                  {!collapsed && (
                    <div className={styles.groupBtnRight}>
                      <span className={styles.groupCount}>{group.screens.length}</span>
                      <span
                        className={`material-symbols-outlined ${styles.icon16} ${styles.chevron} ${
                          isOpen ? styles.chevronOpen : ''
                        }`}
                      >
                        expand_more
                      </span>
                    </div>
                  )}
                </button>
                {!collapsed && isOpen && (
                  <div className={styles.screensList}>
                    {visibleScreens.map((screen) => {
                      const active = screen.id === activeScreen;
                      const isOv = screen.type === 'overview';
                      let btnClass = styles.screenBtn;
                      if (active) {
                        btnClass = `${styles.screenBtn} ${styles.screenBtnActive}`;
                      } else if (isOv) {
                        btnClass = `${styles.screenBtn} ${styles.screenBtnOverview}`;
                      }
                      const badgeCount =
                        screenBadges && screenBadges[screen.id] !== undefined
                          ? screenBadges[screen.id]
                          : screen.badge;
                      return (
                        <button
                          key={screen.id}
                          type="button"
                          data-screen={screen.id}
                          className={btnClass}
                          onClick={() => onSelectScreen(screen.id)}
                        >
                          <span className={styles.screenLabel}>
                            {isOv && (
                              <span className={`material-symbols-outlined ${styles.icon13}`}>
                                play_circle
                              </span>
                            )}
                            {!collapsed && screen.label}
                          </span>
                          {!collapsed && badgeCount !== undefined && badgeCount > 0 && (
                            <span
                              className={`${styles.screenBadge} ${
                                active ? styles.screenBadgeActive : ''
                              }`}
                            >
                              {badgeCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className={`${styles.footer} ${collapsed ? styles.footerCollapsed : ''}`}>
        {collapsed ? (
          <button type="button" className={styles.footerBtnIconOnly} title="Workspace">
            <span className={`material-symbols-outlined ${styles.icon14}`}>add_box</span>
          </button>
        ) : (
          <div className={styles.footerGrid}>
            <button type="button" className={styles.footerBtn}>
              <span className={`material-symbols-outlined ${styles.icon14}`}>add_box</span>
              Workspace
            </button>
            <button type="button" className={styles.footerBtn}>
              <span className={`material-symbols-outlined ${styles.icon14}`}>download</span>
              Export
            </button>
          </div>
        )}
        {!collapsed && (
          <div className={styles.syncRow}>
            <span>
              <span className={styles.syncDot} />
              Sync: 2s ago
            </span>
            <span>v3.8.4</span>
          </div>
        )}
      </div>
    </aside>
  );
}
