'use client';
/* MarketingPrimitives.tsx
   Shared React components for marketing screens. Each mirrors a pattern
   that recurs across the 14 source HTML designs (drawer, peek, modal,
   row-menu, bulk-bar, split-button, filter dropdown, KPI strip, etc.).
   Screens compose these + the CSS module classes directly. */
import { ReactNode, useEffect, useRef, useState } from 'react';
import s from './MarketingPrimitives.module.css';

export interface MarketingScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

/* ───────────── BREADCRUMB ───────────── */
export function Breadcrumb({ items }: { items: { label: string; current?: boolean }[] }) {
  return (
    <div className={s.breadcrumb}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className={it.current ? s.current : ''}>{it.label}</span>
          {i < items.length - 1 && <span className={s.sep}>/</span>}
        </span>
      ))}
    </div>
  );
}

/* ───────────── PAGE HEADER ───────────── */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className={s.pageHeader}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p className={s.subtitle}>{subtitle}</p>}
      </div>
      {children && <div className={s.pageHeaderActions}>{children}</div>}
    </div>
  );
}

/* ───────────── BUTTONS ───────────── */
type BtnVariant = 'primary' | 'outline' | 'danger' | 'ghost' | 'secondary';
export function Btn({
  variant = 'outline',
  icon,
  children,
  onClick,
  sm,
  className,
  ...rest
}: {
  variant?: BtnVariant;
  icon?: string;
  children?: ReactNode;
  onClick?: () => void;
  sm?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  title?: string;
}) {
  const variantCls =
    variant === 'primary' ? s.btnPrimary
    : variant === 'danger' ? s.btnDanger
    : variant === 'ghost' ? s.btnGhost
    : variant === 'secondary' ? s.btnSecondary
    : s.btnOutline;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${s.btn} ${variantCls} ${sm ? s.btnSm : ''} ${className || ''}`}
      {...rest}
    >
      {icon && <span className="material-symbols-outlined">{icon}</span>}
      {children}
    </button>
  );
}

export function IconBtn({ icon, onClick, title }: { icon: string; onClick?: () => void; title?: string }) {
  return (
    <button type="button" className={s.btnIcon} onClick={onClick} title={title}>
      <span className="material-symbols-outlined">{icon}</span>
    </button>
  );
}

/* Split button (primary action + dropdown arrow that opens a menu) */
export function SplitButton({
  icon,
  label,
  onClick,
  menu,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  menu?: { label: string; icon?: string; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className={`${s.splitBtn} ${s.relative}`} ref={ref}>
      <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.splitBtnMain}`} onClick={onClick}>
        <span className="material-symbols-outlined">{icon}</span>{label}
      </button>
      {menu && (
        <>
          <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.splitBtnArrow}`} onClick={() => setOpen((v) => !v)}>
            <span className="material-symbols-outlined">expand_more</span>
          </button>
          {open && (
            <div className={s.popover} style={{ minWidth: 220 }}>
              {menu.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  className={s.popoverItem}
                  onClick={() => { m.onClick(); setOpen(false); }}
                >
                  {m.icon && <span className="material-symbols-outlined">{m.icon}</span>}
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ───────────── KPI STRIP ───────────── */
export function KpiStrip({ children }: { children: ReactNode }) {
  return <div className={s.kpiStrip}>{children}</div>;
}
export function KpiCard({
  label,
  value,
  sub,
  subTone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  subTone?: 'pos' | 'neg';
}) {
  return (
    <div className={s.kpiCard}>
      <div className={s.kpiLabel}>{label}</div>
      <div className={s.kpiValue}>{value}</div>
      {sub && <div className={`${s.kpiSub} ${subTone === 'pos' ? s.kpiSub + ' pos' : subTone === 'neg' ? s.kpiSub + ' neg' : ''}`}>{sub}</div>}
    </div>
  );
}

/* ───────────── STAT PILL ───────────── */
export function Stat({ kind, label }: { kind: string; label?: string }) {
  const cls = s[kind as keyof typeof s] || s.draft;
  const cls2 = (s as Record<string, string>)[kind] || s.draft;
  return <span className={`${s.stat} ${cls || cls2}`}>{label || kind}</span>;
}

/* Better Stat that maps status string → class */
const STAT_MAP: Record<string, string> = {
  active: 'active', paused: 'paused', 'in review': 'review', review: 'review',
  draft: 'draft', ended: 'ended', rejected: 'rejected', scheduled: 'scheduled',
  published: 'published', failed: 'failed', pending: 'pending', expired: 'expired', live: 'live',
};
export function StatusPill({ status }: { status: string }) {
  const key = (status || '').toLowerCase();
  const cls = STAT_MAP[key] || 'draft';
  // Pull the matching CSS class out of the module (each status has its own class with same name as kind)
  const clsObj = s as unknown as Record<string, string>;
  return <span className={`${s.stat} ${clsObj[cls] || s.draft}`}>{status}</span>;
}

/* ───────────── NET CHIP ───────────── */
const NET_MAP: Record<string, string> = {
  Meta: 'netMeta', TikTok: 'netTikTok', Google: 'netGoogle', Pinterest: 'netPinterest',
  Instagram: 'netInstagram', YouTube: 'netYouTube', X: 'netX', LinkedIn: 'netLinkedIn',
  Email: 'netEmail', SMS: 'netSMS',
};
export function NetChip({ net }: { net: string }) {
  const clsObj = s as unknown as Record<string, string>;
  const cls = NET_MAP[net] || 'netMeta';
  return <span className={`${s.netChip} ${clsObj[cls]}`}>{net}</span>;
}

/* ───────────── TABS (status filter) ───────────── */
export function StatusTabs({
  tabs,
  active,
  onChange,
  counts,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className={s.tabs}>
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          className={`${s.tab} ${active === t ? s.tabActive : ''}`}
          onClick={() => onChange(t)}
        >
          {t}
          {counts && <span className={s.tabCount}>{counts[t] ?? 0}</span>}
        </button>
      ))}
    </div>
  );
}

/* ───────────── FILTER BAR ───────────── */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className={s.filterBar}>{children}</div>;
}
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className={s.searchInput}>
      <span className="material-symbols-outlined">search</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Filter…'}
      />
    </div>
  );
}

/* Filter dropdown button + popover */
export function FilterDropdown({
  label,
  icon,
  options,
  selected,
  onChange,
  onClear,
  onApply,
}: {
  label: string;
  icon?: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  onClear?: () => void;
  onApply?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const toggle = (v: string) => {
    const n = new Set(selected);
    if (n.has(v)) n.delete(v); else n.add(v);
    onChange(n);
  };
  const hasFilter = selected.size > 0 && selected.size < options.length;
  return (
    <div className={s.relative} ref={ref}>
      <button
        type="button"
        className={`${s.filterBtn} ${hasFilter ? s.filterBtn + ' hasFilter' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        {icon && <span className="material-symbols-outlined">{icon}</span>}
        {label}
        {hasFilter && <span style={{ marginLeft: 4, fontWeight: 700 }}>{selected.size}</span>}
      </button>
      {open && (
        <div className={s.popover} style={{ minWidth: 220 }}>
          <div className={s.menuHeader}>Filter by {label.toLowerCase()}</div>
          {options.map((o) => (
            <label key={o} className={s.popoverCheckRow}>
              <input type="checkbox" checked={selected.has(o)} onChange={() => toggle(o)} />
              {o}
            </label>
          ))}
          <div className={s.popoverSep} />
          <div className={s.popoverFoot}>
            <button type="button" className={`${s.btn} ${s.btnOutline} ${s.btnSm}`} onClick={() => { onClear?.(); }}>Clear</button>
            <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={() => { onApply?.(); setOpen(false); }}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── BULK BAR ───────────── */
export interface BulkAction {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
}
export function BulkBar({ count, actions, onClear }: { count: number; actions: BulkAction[]; onClear: () => void }) {
  return (
    <div className={s.bulkBar}>
      <span style={{ fontWeight: 700, fontSize: 13 }}>{count} selected</span>
      {actions.map((a, i) => (
        <button key={i} type="button" onClick={a.onClick}>
          {a.icon && <span className="material-symbols-outlined">{a.icon}</span>}
          {a.label}
        </button>
      ))}
      <button type="button" className={s.clearBtn} onClick={onClear}>Clear</button>
    </div>
  );
}

/* ───────────── ROW MENU (per-row ⋯ menu) ───────────── */
export interface RowMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  sepBefore?: boolean;
  header?: string;
}
export function RowMenu({ items, onTrigger }: { items: RowMenuItem[]; onTrigger?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className={s.relative} ref={ref} style={{ display: 'inline-block' }}>
      <button
        type="button"
        className={s.btnIcon}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="Actions"
      >
        <span className="material-symbols-outlined">more_vert</span>
      </button>
      {open && (
        <div className={s.popover} style={{ right: 0, left: 'auto', minWidth: 220 }} onClick={(e) => e.stopPropagation()}>
          {items.map((it, i) => (
            <div key={i}>
              {it.header && <div className={s.menuHeader}>{it.header}</div>}
              {it.sepBefore && <div className={s.popoverSep} />}
              <button
                type="button"
                className={`${s.popoverItem} ${it.danger ? s.popoverItem + ' danger' : ''}`}
                onClick={() => { it.onClick(); setOpen(false); }}
              >
                {it.icon && <span className="material-symbols-outlined">{it.icon}</span>}
                {it.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── SCrim + DRAWER + PEEK + MODAL ───────────── */
export function Scrim({ onClose }: { onClose: () => void }) {
  return <div className={s.scrim} onClick={onClose} />;
}

export interface DrawerProps {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  width?: number;
}
export function Drawer({ open, title, subtitle, onClose, footer, children, width }: DrawerProps) {
  if (!open) return null;
  return (
    <>
      <Scrim onClose={onClose} />
      <div className={s.drawer} style={width ? { width } : undefined}>
        <div className={s.drawerHead}>
          <div>
            <h2>{title}</h2>
            {subtitle && <div className={s.peekHeadSub}>{subtitle}</div>}
          </div>
          <IconBtn icon="close" onClick={onClose} />
        </div>
        <div className={s.drawerBody}>{children}</div>
        {footer && <div className={s.drawerFoot}>{footer}</div>}
      </div>
    </>
  );
}

export interface PeekProps {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}
export function Peek({ open, title, subtitle, onClose, footer, children }: PeekProps) {
  if (!open) return null;
  return (
    <>
      <Scrim onClose={onClose} />
      <div className={s.peek}>
        <div className={s.peekHead}>
          <div>
            <h2>{title}</h2>
            {subtitle && <div className={s.peekHeadSub}>{subtitle}</div>}
          </div>
          <IconBtn icon="close" onClick={onClose} />
        </div>
        <div className={s.peekBody}>{children}</div>
        {footer && <div className={s.peekFoot}>{footer}</div>}
      </div>
    </>
  );
}

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}
export function Modal({ open, title, onClose, footer, children, size }: ModalProps) {
  if (!open) return null;
  return (
    <div className={s.modalScrim} onClick={onClose}>
      <div
        className={`${s.modalBox} ${size === 'sm' ? s.modalBox + ' sm' : size === 'lg' ? s.modalBox + ' lg' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={s.modalHead}>
          <h2>{title}</h2>
          <IconBtn icon="close" onClick={onClose} />
        </div>
        <div className={s.modalBody}>{children}</div>
        {footer && <div className={s.modalFoot}>{footer}</div>}
      </div>
    </div>
  );
}

/* ───────────── TABLE ───────────── */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className={s.tableWrap}>{children}</div>;
}
export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <table className={s.table}>
      <thead>{head}</thead>
      <tbody>{children}</tbody>
    </table>
  );
}

/* ───────────── FORM FIELDS ───────────── */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={s.fieldGroup}>
      <label className={s.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={s.fieldInput} {...props} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={s.fieldTextarea} {...props} />;
}
export function Select({ children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={s.fieldSelect} {...rest}>{children}</select>;
}

/* ───────────── KV LIST ───────────── */
export function KvList({ items }: { items: { k: string; v: ReactNode }[] }) {
  return (
    <dl style={{ margin: 0 }}>
      {items.map((it, i) => (
        <div className={s.kv} key={i}>
          <dt>{it.k}</dt>
          <dd>{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ───────────── PROGRESS BAR ───────────── */
export function ProgressBar({ pct, tone }: { pct: number; tone?: 'good' | 'warn' | 'bad' }) {
  const cls = tone === 'warn' ? s.progressBar + ' warn' : tone === 'bad' ? s.progressBar + ' bad' : s.progressBar;
  return (
    <div className={cls} title={`${pct}%`}>
      <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

/* ───────────── EMPTY STATE ───────────── */
export function EmptyState({ icon, title, body }: { icon: string; title: string; body?: string }) {
  return (
    <div className={s.empty}>
      <span className="material-symbols-outlined">{icon}</span>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
    </div>
  );
}

/* ───────────── AVATAR + THUMB ───────────── */
export function Avatar({ initials, lg }: { initials: string; lg?: boolean }) {
  return <span className={`${s.avatar} ${lg ? s.avatarLg : ''}`}>{initials.slice(0, 2).toUpperCase()}</span>;
}
export function Thumb({ icon = 'image' }: { icon?: string }) {
  return (
    <span className={s.thumb}>
      <span className="material-symbols-outlined">{icon}</span>
    </span>
  );
}

/* ───────────── EXPORT helper (re-export for convenience) ───────────── */
export { default as s } from './MarketingPrimitives.module.css';
