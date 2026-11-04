import { RefObject } from 'react';
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
  gearMenuOpen: boolean;
  onToggleGearMenu: () => void;
  gearMenuRef: RefObject<HTMLDivElement | null>;
  gearBtnRef: RefObject<HTMLButtonElement | null>;
  viewMode: 'business' | 'accountant';
  onChangeViewMode: (mode: 'business' | 'accountant') => void;
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
  gearMenuOpen,
  onToggleGearMenu,
  gearMenuRef,
  gearBtnRef,
  viewMode,
  onChangeViewMode,
  screenBadges,
}: SideRailProps) {
  const domain = DOMAINS[activeDomain];
  const query = sideFilter.toLowerCase();

  return (
    <aside className={styles.sideRail}>
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <button
            ref={gearBtnRef}
            id="gear-btn"
            type="button"
            className={styles.gearBtn}
            title="Gear menu"
            onClick={(e) => {
              e.stopPropagation();
              onToggleGearMenu();
            }}
          >
            <span className={`material-symbols-outlined ${styles.icon18}`}>settings</span>
          </button>
          <span id="siderail-title" className={styles.sideRailTitle}>
            {domain.label}
          </span>
        </div>
        <div className={styles.viewToggle} id="view-toggle">
          <button
            type="button"
            data-view="business"
            className={`${styles.viewToggleBtn} ${
              viewMode === 'business' ? styles.viewToggleBtnActive : ''
            }`}
            onClick={() => onChangeViewMode('business')}
          >
            Business
          </button>
          <button
            type="button"
            data-view="accountant"
            className={`${styles.viewToggleBtn} ${
              viewMode === 'accountant' ? styles.viewToggleBtnActive : ''
            }`}
            onClick={() => onChangeViewMode('accountant')}
          >
            Accountant
          </button>
        </div>
      </div>

      <div
        ref={gearMenuRef}
        id="gear-menu"
        className={`${styles.gearMenu} ${!gearMenuOpen ? styles.hiddenImp : ''}`}
      >
        <div className={styles.gearSectionTitle}>Your company</div>
        <button type="button" className={styles.gearItem}>
          <span className={`material-symbols-outlined ${styles.icon16Muted}`}>apartment</span>
          Account &amp; settings
        </button>
        <button type="button" className={styles.gearItem}>
          <span className={`material-symbols-outlined ${styles.icon16Muted}`}>manage_accounts</span>
          Manage users
        </button>
        <button type="button" className={styles.gearItem}>
          <span className={`material-symbols-outlined ${styles.icon16Muted}`}>account_balance</span>
          Chart of accounts
        </button>
        <div className={styles.gearDivider} />
        <div className={styles.gearSectionTitle}>Lists</div>
        <button type="button" className={styles.gearItem}>
          <span className={`material-symbols-outlined ${styles.icon16Muted}`}>list</span>
          All lists
        </button>
        <button type="button" className={styles.gearItem}>
          <span className={`material-symbols-outlined ${styles.icon16Muted}`}>inventory_2</span>
          Products &amp; services
        </button>
        <button type="button" className={styles.gearItem}>
          <span className={`material-symbols-outlined ${styles.icon16Muted}`}>tune</span>
          Custom fields
        </button>
        <div className={styles.gearDivider} />
        <div className={styles.gearSectionTitle}>Tools</div>
        <button type="button" className={styles.gearItem}>
          <span className={`material-symbols-outlined ${styles.icon16Muted}`}>swap_horiz</span>
          Reclassify transactions
        </button>
        <button type="button" className={styles.gearItem}>
          <span className={`material-symbols-outlined ${styles.icon16Muted}`}>fact_check</span>
          Reconcile
        </button>
        <button type="button" className={styles.gearItem}>
          <span className={`material-symbols-outlined ${styles.icon16Muted}`}>history</span>
          Audit log
        </button>
        <div className={styles.gearDivider} />
        <div className={styles.gearSectionTitle}>Profile</div>
        <button type="button" className={styles.gearItem}>
          <span className={`material-symbols-outlined ${styles.icon16Muted}`}>new_releases</span>
          What&apos;s new
        </button>
        <button type="button" className={styles.gearItem}>
          <span className={`material-symbols-outlined ${styles.icon16Muted}`}>chat</span>
          Feedback
        </button>
      </div>

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

      <div className={styles.navScroll}>
        <nav id="siderail">
          {domain.groups.map((group) => {
            const visibleScreens = group.screens.filter(
              (s) => !query || s.label.toLowerCase().includes(query)
            );
            if (query && visibleScreens.length === 0) return null;

            const isOpen =
              openGroups.includes(group.name) ||
              Boolean(query && visibleScreens.length > 0);

            return (
              <div key={group.name} className={styles.groupBlock}>
                <button
                  type="button"
                  data-group={group.name}
                  className={styles.groupBtn}
                  onClick={() => onToggleGroup(group.name)}
                >
                  <div className={styles.groupBtnLeft}>
                    <div className={`${styles.groupBadge} ${GROUP_BG_CLASS[group.bg]}`}>
                      <span className={`material-symbols-outlined ${styles.icon13}`}>
                        {group.icon}
                      </span>
                    </div>
                    <span className={styles.groupName}>{group.name}</span>
                  </div>
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
                </button>
                {isOpen && (
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
                            {screen.label}
                          </span>
                          {badgeCount !== undefined && badgeCount > 0 && (
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

      <div className={styles.footer}>
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
        <div className={styles.syncRow}>
          <span>
            <span className={styles.syncDot} />
            Sync: 2s ago
          </span>
          <span>v3.8.4</span>
        </div>
      </div>
    </aside>
  );
}
