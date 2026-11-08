'use client';
/**
 * SideRail — fixed sidebar navigation.
 *
 * Screen children are collapsible accordions (NOT stuck open inline):
 *   - Click a parent screen with children → toggles expand/collapse
 *   - Click a child screen → navigates
 *   - Parents auto-expand if they contain the active screen
 *   - Parents auto-expand when the filter matches a child
 */
import { useState } from 'react';
import { DOMAINS, DomainKey, GroupBgToken, ScreenItem, groupScreenCount } from '@/data/shellData';
import { TOP_NAV } from '@/lib/designCanvasStore';
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
  /** Launch the Create Wizard for a category (and optional subcategory).
   *  Wired as an icon next to every catalog child. */
  onLaunchWizard?: (category: string, subcategory?: string) => void;
}

const GROUP_BG_CLASS: Record<GroupBgToken, string> = {
  'bg-qb-navy': styles.bgQbNavy,
  'bg-qb-teal': styles.bgQbTeal,
  'bg-qb-maroon': styles.bgQbMaroon,
  'bg-qb-green': styles.bgQbGreen,
  'bg-qb-purple': styles.bgQbPurple,
  'bg-qb-orange': styles.bgQbOrange,
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
  onLaunchWizard,
}: SideRailProps) {
  const domain = DOMAINS[activeDomain];
  const query = sideFilter.toLowerCase();

  // Track which parent screens are manually expanded.
  const [expandedScreens, setExpandedScreens] = useState<Set<string>>(new Set());

  function toggleScreenExpand(screenId: string) {
    setExpandedScreens((prev) => {
      const next = new Set(prev);
      if (next.has(screenId)) next.delete(screenId);
      else next.add(screenId);
      return next;
    });
  }

  // A parent screen is expanded if:
  // 1. Manually expanded, OR
  // 2. It contains the active screen as a child (auto-expand on navigation), OR
  // 3. The filter matches one of its children (auto-expand on search)
  function isScreenExpanded(screen: ScreenItem): boolean {
    if (!screen.children || screen.children.length === 0) return false;
    if (expandedScreens.has(screen.id)) return true;
    if (screen.children.some((c) => c.id === activeScreen)) return true;
    if (query && screen.children.some((c) => c.label.toLowerCase().includes(query))) return true;
    return false;
  }

  function handleScreenClick(screen: ScreenItem) {
    // ALWAYS navigate to the screen (parent or leaf). Parent screens with
    // children render their own table (all products in that category).
    onSelectScreen(screen.id);
  }

  function handleChevronClick(e: React.MouseEvent, screenId: string) {
    // Click the chevron ONLY toggles expand/collapse — doesn't navigate.
    e.stopPropagation();
    toggleScreenExpand(screenId);
  }

  // Determine if this group is the Design Studio's Catalog group, and if so,
  // extract the category (and optional subcategory) from a screen id so we
  // can show the wizard icon next to it.
  function catalogInfoFor(screenId: string): { category: string; subcategory?: string } | null {
    if (activeDomain !== 'design') return null;
    // studio-women → Women, studio-home-and-living → "Home & Living",
    // studio-home-and-living-mugs → category + subcategory "Mugs"
    if (!screenId.startsWith('studio-')) return null;
    const slug = screenId.replace('studio-', '');
    const slugifyLocal = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    for (const [cat, subs] of Object.entries(TOP_NAV)) {
      const catSlug = slugifyLocal(cat);
      if (slug === catSlug) return { category: cat };
      const subSlug = slug.slice(catSlug.length + 1);
      if (slug.startsWith(catSlug + '-') && subSlug) {
        const sub = subs.find((s) => slugifyLocal(s) === subSlug);
        if (sub) return { category: cat, subcategory: sub };
      }
    }
    return null;
  }

  function handleWizardClick(e: React.MouseEvent, category: string, subcategory?: string) {
    e.stopPropagation();
    onLaunchWizard?.(category, subcategory);
  }

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
            // Filter: a screen matches on its own label or a child's label.
            // Children filter independently unless the parent itself matches.
            // Hidden screens never render in the sidebar (they are opened
            // by an icon or an action); findScreen still resolves them.
            const visibleScreens = group.screens
              .filter((s) => !s.hidden)
              .map((s) => {
                if (!query) return s;
                if (s.label.toLowerCase().includes(query)) return s;
                const matchingChildren = (s.children ?? []).filter(
                  (c) => !c.hidden && c.label.toLowerCase().includes(query)
                );
                if (matchingChildren.length > 0) {
                  return { ...s, children: matchingChildren };
                }
                return null;
              })
              .filter((s): s is ScreenItem => s !== null);
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
                      <span
                        className={`${styles.groupCount} ${
                          group.badge !== undefined ? styles.groupCountAlert : ''
                        }`}
                      >
                        {groupScreenCount(group)}
                      </span>
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
                      const hasChildren = screen.children && screen.children.length > 0;
                      const expanded = isScreenExpanded(screen);
                      const catalogInfo = catalogInfoFor(screen.id);
                      let btnClass = styles.screenBtn;
                      if (active) {
                        btnClass = `${styles.screenBtn} ${styles.screenBtnActive}`;
                      } else if (isOv) {
                        btnClass = `${styles.screenBtn} ${styles.screenBtnOverview}`;
                      }
                      if (hasChildren) {
                        btnClass = `${btnClass} ${styles.screenBtnParent}`;
                      }
                      const badgeCount =
                        screenBadges && screenBadges[screen.id] !== undefined
                          ? screenBadges[screen.id]
                          : screen.badge;
                      return (
                        <div key={screen.id} className={catalogInfo ? styles.catalogRow : undefined}>
                          <button
                            type="button"
                            data-screen={screen.id}
                            className={btnClass}
                            onClick={() => handleScreenClick(screen)}
                            aria-expanded={hasChildren ? expanded : undefined}
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
                            {/* Wizard icon next to every catalog child (move 4) */}
                            {!collapsed && catalogInfo && (
                              <span
                                className={`material-symbols-outlined ${styles.icon14} ${styles.wizardIcon}`}
                                role="button"
                                tabIndex={0}
                                title={`Create wizard for ${catalogInfo.category}${catalogInfo.subcategory ? ' · ' + catalogInfo.subcategory : ''}`}
                                aria-label={`Create wizard for ${catalogInfo.category}${catalogInfo.subcategory ? ' · ' + catalogInfo.subcategory : ''}`}
                                onClick={(e) => handleWizardClick(e, catalogInfo.category, catalogInfo.subcategory)}
                              >
                                auto_fix_high
                              </span>
                            )}
                            {hasChildren && (
                              <span
                                className={`material-symbols-outlined ${styles.icon14} ${styles.screenChevron} ${
                                  expanded ? styles.screenChevronOpen : ''
                                }`}
                                onClick={(e) => handleChevronClick(e, screen.id)}
                                role="button"
                                tabIndex={0}
                                aria-label={expanded ? 'Collapse' : 'Expand'}
                              >
                                expand_more
                              </span>
                            )}
                          </button>
                          {/* Children render ONLY when the parent is expanded
                              (accordion — not stuck open) */}
                          {hasChildren && expanded && (
                            <div className={styles.childList}>
                              {screen.children!.map((child) => {
                                const childActive = child.id === activeScreen;
                                const childClass = childActive
                                  ? `${styles.screenBtn} ${styles.screenBtnActive}`
                                  : styles.screenBtn;
                                const childCatalogInfo = catalogInfoFor(child.id);
                                return (
                                  <div key={child.id} className={styles.catalogRow}>
                                    <button
                                      type="button"
                                      data-screen={child.id}
                                      className={`${childClass} ${styles.screenBtnChild}`}
                                      onClick={() => onSelectScreen(child.id)}
                                    >
                                      <span className={styles.screenLabel}>{child.label}</span>
                                      {/* Wizard icon next to every catalog subcategory too */}
                                      {!collapsed && childCatalogInfo && (
                                        <span
                                          className={`material-symbols-outlined ${styles.icon14} ${styles.wizardIcon}`}
                                          role="button"
                                          tabIndex={0}
                                          title={`Create wizard for ${childCatalogInfo.category} · ${childCatalogInfo.subcategory}`}
                                          aria-label={`Create wizard for ${childCatalogInfo.category} · ${childCatalogInfo.subcategory}`}
                                          onClick={(e) => handleWizardClick(e, childCatalogInfo.category, childCatalogInfo.subcategory)}
                                        >
                                          auto_fix_high
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
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
