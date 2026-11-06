'use client';

/**
 * AdvertisersScreen — 1:1 faithful port of
 *   upload/marketing_extracted/Marketing/ad center mangemnt .html
 *   (HTML <title>: "Advertising — Advertisers")
 *
 * Sections replicated:
 *   • Breadcrumb (Advertising / Advertisers)
 *   • Page header (title, subtitle, Export / Customize / New advertiser split)
 *   • KPI strip (4 cards: Total advertisers, Active, Verification pending, Suspended)
 *   • List card with:
 *       - View tabs (All / Active / Pending / Suspended / Invited / Closed)
 *       - Filter bar (search, Network dropdown, Role dropdown,
 *         Saved views, Clear all, count label)
 *       - Bulk bar (Suspend / Restore / Mark verified / close)
 *       - Table (checkbox, Advertiser, Advertiser ID, Networks, Billing,
 *         Verification, Campaigns, Spend 30d, Status, ⋯)
 *       - Empty state
 *       - Pagination (rows-per-page select, prev/next, page label)
 *   • Create split menu (Advertiser / Invite user / Billing profile / Network connection)
 *   • Row ⋯ menu (Edit / View / Invite / Mark verified | Suspend / Restore | Close account)
 *   • Peek drawer (status + ID + net chips, spend card, KV list, access list, 4-button grid)
 *   • Advertiser drawer (identity, verification & tax, connected networks,
 *       billing profile, access & roles) with Save and new + Save and close split buttons
 *   • Invite user modal (Email + Role)
 *   • Billing profile modal (Profile name, Payment method, Credit limit)
 *   • Network connection modal (Network, Ad account ID)
 *   • Save split menu (Save and close / Save and new / Save and send invite)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Breadcrumb,
  PageHeader,
  Btn,
  IconBtn,
  KpiStrip,
  KpiCard,
  FilterBar,
  SearchInput,
  FilterDropdown,
  BulkBar,
  RowMenu,
  Drawer,
  Peek,
  Modal,
  TableWrap,
  Table,
  Field,
  Input,
  Select,
  KvList,
  s,
  MarketingScreenProps,
} from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';

/* ──────────────── types ──────────────── */
type AdvStatus = 'Active' | 'Pending' | 'Suspended' | 'Invited' | 'Closed';
type VerifyStatus = 'Verified' | 'Pending' | 'Rejected';
type NetName = 'Meta' | 'TikTok' | 'Google' | 'Pinterest';
type Role = 'Owner' | 'Manager' | 'Billing' | 'Analyst';

interface AccessUser {
  email: string;
  role: Role;
}

interface Advertiser {
  id: string;
  legalName: string;
  displayName: string;
  email: string;
  phone: string;
  country: string;
  bizType: string;
  taxId: string;
  verify: VerifyStatus;
  status: AdvStatus;
  networks: NetName[];
  billing: string;
  creditLimit: number;
  campaigns: number;
  spend: number;
  access: AccessUser[];
  created: string;
}

/* ──────────────── constants ──────────────── */
const NETWORKS: NetName[] = ['Meta', 'TikTok', 'Google', 'Pinterest'];
const NETWORK_LABELS: Record<NetName, string> = {
  Meta: 'Meta Ads',
  TikTok: 'TikTok Ads',
  Google: 'Google Ads',
  Pinterest: 'Pinterest Ads',
};
const ROLES: Role[] = ['Owner', 'Manager', 'Billing', 'Analyst'];
const VIEW_TABS = ['All', 'Active', 'Pending', 'Suspended', 'Invited', 'Closed'];
const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Australia'];
const BIZ_TYPES = ['LLC', 'C-Corp', 'S-Corp', 'Sole proprietor', 'Partnership'];
const PAYMENTS = ['Visa •4421', 'Mastercard •8801', 'Bank transfer'];
const ROWS_PER_PAGE_OPTIONS = [25, 50, 75, 100];

const NETWORK_BADGE: Record<NetName, { bg: string; color: string; letter: string }> = {
  Meta: { bg: '#edf3fc', color: '#4b77b8', letter: 'M' },
  TikTok: { bg: '#eef1f2', color: '#27353a', letter: 'T' },
  Google: { bg: '#f8f0ee', color: '#c45c5b', letter: 'G' },
  Pinterest: { bg: '#f9eeee', color: '#bd5558', letter: 'P' },
};

const STATUS_STYLES: Record<AdvStatus, { bg: string; color: string }> = {
  Active: { bg: '#8af5be', color: '#00714b' },
  Pending: { bg: '#eaf3fb', color: '#4e7b9d' },
  Suspended: { bg: '#ffdad6', color: '#93000a' },
  Invited: { bg: '#f2f1f8', color: '#6e6596' },
  Closed: { bg: '#f4f3f7', color: '#5a6355' },
};

const AVATAR_STYLES: Record<AdvStatus, { bg: string; color: string }> = {
  Active: { bg: '#e6efed', color: '#0a6400' },
  Pending: { bg: '#eaf3fb', color: '#4e7b9d' },
  Suspended: { bg: '#ffdad6', color: '#93000a' },
  Invited: { bg: '#f2f1f8', color: '#6e6596' },
  Closed: { bg: '#f4f3f7', color: '#5a6355' },
};

/* ──────────────── seed data (matches HTML's ADVERTISERS array) ──────────────── */
const INITIAL: Advertiser[] = [
  {
    id: 'ADV-1001', legalName: 'Unsaid Company Inc.', displayName: 'Unsaid',
    email: 'ads@unsaid.app', phone: '+1 (901) 210-3145', country: 'United States',
    bizType: 'C-Corp', taxId: '••-•••4471', verify: 'Verified', status: 'Active',
    networks: ['Meta', 'TikTok', 'Google'], billing: 'Visa •4421', creditLimit: 15000,
    campaigns: 4, spend: 18420,
    access: [
      { email: 'jordan@unsaid.app', role: 'Owner' },
      { email: 'sarah@unsaid.app', role: 'Manager' },
    ],
    created: '2026-01-15',
  },
  {
    id: 'ADV-1002', legalName: 'Orion Apparel LLC', displayName: 'Orion Apparel',
    email: 'billing@orion.co', phone: '+1 (555) 220-4412', country: 'United States',
    bizType: 'LLC', taxId: '••-•••8821', verify: 'Verified', status: 'Active',
    networks: ['Meta', 'Pinterest'], billing: 'Mastercard •8801', creditLimit: 8000,
    campaigns: 2, spend: 6210,
    access: [
      { email: 'ap@orion.co', role: 'Owner' },
      { email: 'media@orion.co', role: 'Analyst' },
    ],
    created: '2026-03-02',
  },
  {
    id: 'ADV-1003', legalName: 'Blue Ridge Co.', displayName: 'Blue Ridge',
    email: 'ads@blueridge.co', phone: '+1 (555) 882-1102', country: 'United States',
    bizType: 'LLC', taxId: '••-•••1144', verify: 'Pending', status: 'Pending',
    networks: ['Meta'], billing: 'Visa •4421', creditLimit: 5000,
    campaigns: 0, spend: 0,
    access: [{ email: 'billing@blueridge.co', role: 'Owner' }],
    created: '2026-10-20',
  },
  {
    id: 'ADV-1004', legalName: 'Maple Supply Inc.', displayName: 'Maple Supply',
    email: 'ar@maplesupply.io', phone: '+1 (555) 774-9810', country: 'Canada',
    bizType: 'C-Corp', taxId: '••-•••7789', verify: 'Verified', status: 'Suspended',
    networks: ['Google'], billing: 'Bank transfer', creditLimit: 12000,
    campaigns: 1, spend: 0,
    access: [
      { email: 'ar@maplesupply.io', role: 'Owner' },
      { email: 'finance@maplesupply.io', role: 'Billing' },
    ],
    created: '2026-05-14',
  },
  {
    id: 'ADV-1005', legalName: 'Northwind Labs LLC', displayName: 'Northwind Labs',
    email: 'marketing@northwindlabs.io', phone: '+1 (555) 310-8844', country: 'United States',
    bizType: 'LLC', taxId: '••-•••6620', verify: 'Verified', status: 'Active',
    networks: ['Meta', 'Google'], billing: 'Visa •4421', creditLimit: 20000,
    campaigns: 3, spend: 9840,
    access: [
      { email: 'marketing@northwindlabs.io', role: 'Owner' },
      { email: 'ops@northwindlabs.io', role: 'Manager' },
      { email: 'reporting@northwindlabs.io', role: 'Analyst' },
    ],
    created: '2026-02-10',
  },
  {
    id: 'ADV-1006', legalName: 'Acme Corp', displayName: 'Acme Corp',
    email: 'ap@acme.com', phone: '+1 (555) 001-9921', country: 'United States',
    bizType: 'C-Corp', taxId: '••-•••4410', verify: 'Pending', status: 'Pending',
    networks: ['Meta', 'TikTok', 'Google', 'Pinterest'], billing: '—', creditLimit: 0,
    campaigns: 0, spend: 0,
    access: [{ email: 'ap@acme.com', role: 'Owner' }],
    created: '2026-11-01',
  },
  {
    id: 'ADV-1007', legalName: 'Gelato Pty Ltd', displayName: 'Gelato',
    email: 'ads@gelato.co', phone: '+61 2 8000 0000', country: 'Australia',
    bizType: 'Partnership', taxId: '••-•••3390', verify: 'Verified', status: 'Active',
    networks: ['TikTok'], billing: 'Mastercard •8801', creditLimit: 6000,
    campaigns: 1, spend: 3120,
    access: [
      { email: 'ads@gelato.co', role: 'Owner' },
      { email: 'billing@gelato.co', role: 'Billing' },
    ],
    created: '2026-06-30',
  },
  {
    id: 'ADV-1008', legalName: 'Printify Ltd.', displayName: 'Printify',
    email: 'hello@printify.com', phone: '+1 (555) 400-1120', country: 'United States',
    bizType: 'S-Corp', taxId: '••-•••2201', verify: 'Verified', status: 'Invited',
    networks: ['Meta', 'Pinterest'], billing: '—', creditLimit: 0,
    campaigns: 0, spend: 0,
    access: [{ email: 'hello@printify.com', role: 'Owner' }],
    created: '2026-11-02',
  },
];

/* ──────────────── small helper components (1:1 with HTML's local styles) ──────────────── */
function initials(s: string): string {
  return (
    (s || '')
      .split(/\s+/)
      .map((w) => w[0] || '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'A'
  );
}

function StatusPill({ status }: { status: AdvStatus }) {
  const st = STATUS_STYLES[status];
  return (
    <span className={s.stat} style={{ background: st.bg, color: st.color }}>
      {status}
    </span>
  );
}

function verifyPill(v: VerifyStatus) {
  // Verified → Active (green); Pending → Pending (blue); Rejected → Suspended (red)
  if (v === 'Verified') return <StatusPill status="Active" />;
  if (v === 'Pending') return <StatusPill status="Pending" />;
  return <StatusPill status="Suspended" />;
}

function AdvAvatar({ name, status }: { name: string; status: AdvStatus }) {
  const st = AVATAR_STYLES[status];
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: st.bg,
        color: st.color,
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}

function NetChipSmall({ n }: { n: NetName }) {
  const st = NETWORK_BADGE[n];
  return (
    <span className={s.netChip} style={{ background: st.bg, color: st.color }}>
      {n}
    </span>
  );
}

function RoleChip({ role }: { role: Role }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 6px',
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 600,
        background: '#f0f6f5',
        color: '#0a6400',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
        badge
      </span>
      {role}
    </span>
  );
}

function NetworkBadge({ n }: { n: NetName }) {
  const st = NETWORK_BADGE[n];
  return (
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        background: st.bg,
        color: st.color,
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: 10,
        flexShrink: 0,
      }}
    >
      {st.letter}
    </span>
  );
}

/* ──────────────── local split button (supports menu header) ──────────────── */
interface SplitMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
}
function HeaderSplitButton({
  variant,
  icon,
  label,
  onClick,
  menuHeader,
  menu,
}: {
  variant: 'primary' | 'outline';
  icon: string;
  label: string;
  onClick: () => void;
  menuHeader?: string;
  menu: SplitMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const variantCls = variant === 'primary' ? s.btnPrimary : s.btnOutline;
  return (
    <div className={`${s.splitBtn} ${s.relative}`} ref={ref}>
      <button
        type="button"
        className={`${s.btn} ${variantCls} ${s.splitBtnMain}`}
        onClick={onClick}
      >
        <span className="material-symbols-outlined">{icon}</span>
        {label}
      </button>
      <button
        type="button"
        className={`${s.btn} ${variantCls} ${s.splitBtnArrow}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-symbols-outlined">expand_more</span>
      </button>
      {open && (
        <div
          className={s.popover}
          style={{ right: 0, left: 'auto', minWidth: 220 }}
        >
          {menuHeader && <div className={s.menuHeader}>{menuHeader}</div>}
          {menu.map((m, i) => (
            <button
              key={i}
              type="button"
              className={`${s.popoverItem} ${m.danger ? s.popoverItem + ' danger' : ''}`}
              onClick={() => {
                m.onClick();
                setOpen(false);
              }}
            >
              {m.icon && <span className="material-symbols-outlined">{m.icon}</span>}
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────── form state ──────────────── */
interface AdvForm {
  legalName: string;
  displayName: string;
  email: string;
  phone: string;
  country: string;
  bizType: string;
  taxId: string;
  verify: VerifyStatus;
  networks: Set<NetName>;
  useWorkspaceBilling: boolean;
  payment: string;
  creditLimit: number;
}

function blankForm(): AdvForm {
  return {
    legalName: '',
    displayName: '',
    email: '',
    phone: '',
    country: 'United States',
    bizType: 'LLC',
    taxId: '',
    verify: 'Pending',
    networks: new Set<NetName>(['Meta', 'TikTok', 'Google']),
    useWorkspaceBilling: true,
    payment: 'Visa •4421',
    creditLimit: 15000,
  };
}

function formFromAdvertiser(a: Advertiser): AdvForm {
  return {
    legalName: a.legalName,
    displayName: a.displayName,
    email: a.email,
    phone: a.phone,
    country: a.country,
    bizType: a.bizType,
    taxId: a.taxId === '—' ? '' : a.taxId,
    verify: a.verify,
    networks: new Set<NetName>(a.networks),
    useWorkspaceBilling: a.billing === 'Visa •4421',
    payment: PAYMENTS.includes(a.billing) ? a.billing : 'Visa •4421',
    creditLimit: a.creditLimit,
  };
}

/* ──────────────── main component ──────────────── */
export default function AdvertisersScreen({ onToast }: MarketingScreenProps) {
  const [items, setItems] = useState<Advertiser[]>(INITIAL);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<string>('All');
  const [networkFilter, setNetworkFilter] = useState<Set<string>>(
    new Set(NETWORKS.map((n) => NETWORK_LABELS[n]))
  );
  const [roleFilter, setRoleFilter] = useState<Set<string>>(new Set(ROLES));
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // peek + drawer
  const [peekId, setPeekId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AdvForm>(blankForm());
  const [draftAccess, setDraftAccess] = useState<AccessUser[]>([]);

  // modals
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('Manager');
  const [billingOpen, setBillingOpen] = useState(false);
  const [billingName, setBillingName] = useState('');
  const [billingPayment, setBillingPayment] = useState('Visa •4421');
  const [billingCredit, setBillingCredit] = useState(15000);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [netSelect, setNetSelect] = useState<NetName>('Meta');
  const [netAccount, setNetAccount] = useState('');

  // pagination (visual)
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);

  const checkAllRef = useRef<HTMLInputElement>(null);

  /* ─── filtering ─── */
  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return items.filter((a) => {
      const qOK =
        !ql ||
        `${a.id} ${a.displayName} ${a.legalName} ${a.email} ${a.networks.join(' ')}`
          .toLowerCase()
          .includes(ql);
      const tabOK = tab === 'All' || a.status === tab;
      const netOK = a.networks.some((n) => networkFilter.has(NETWORK_LABELS[n]));
      const roleOK = a.access.some((u) => roleFilter.has(u.role));
      return qOK && tabOK && netOK && roleOK;
    });
  }, [items, q, tab, networkFilter, roleFilter]);

  /* ─── KPI counts (mirrors HTML syncCounts) ─── */
  const kpis = useMemo(() => {
    const total = items.length;
    const active = items.filter((a) => a.status === 'Active').length;
    const pending = items.filter((a) => a.status === 'Pending').length;
    const suspended = items.filter((a) => a.status === 'Suspended').length;
    const networkCount = new Set(items.flatMap((a) => a.networks)).size;
    return { total, active, pending, suspended, networkCount };
  }, [items]);

  /* ─── checkbox state ─── */
  const visibleIds = filtered.map((a) => a.id);
  const allChecked =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someChecked =
    visibleIds.some((id) => selected.has(id)) && !allChecked;

  useEffect(() => {
    if (checkAllRef.current) {
      checkAllRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  // drop selections that are no longer visible (after filter changes)
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      visibleIds.forEach((id) => {
        if (prev.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [q, tab, networkFilter, roleFilter, visibleIds]);

  const filtersActive =
    !!q ||
    tab !== 'All' ||
    networkFilter.size !== NETWORKS.length ||
    roleFilter.size !== ROLES.length;

  /* ─── handlers ─── */
  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllVisible = (on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => {
        if (on) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const handleExport = () => {
    const rows = filtered.map((a) => ({
      id: a.id,
      legalName: a.legalName,
      displayName: a.displayName,
      email: a.email,
      phone: a.phone,
      country: a.country,
      bizType: a.bizType,
      taxId: a.taxId,
      verify: a.verify,
      status: a.status,
      networks: a.networks.join(', '),
      billing: a.billing,
      creditLimit: a.creditLimit,
      campaigns: a.campaigns,
      spend: a.spend,
      access: a.access.map((u) => `${u.email} (${u.role})`).join('; '),
      created: a.created,
    }));
    exportToCsv(
      rows as unknown as Record<string, unknown>[],
      [
        { key: 'id', label: 'Advertiser ID' },
        { key: 'legalName', label: 'Legal name' },
        { key: 'displayName', label: 'Display name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'country', label: 'Country' },
        { key: 'bizType', label: 'Business type' },
        { key: 'taxId', label: 'Tax ID' },
        { key: 'verify', label: 'Verification' },
        { key: 'status', label: 'Status' },
        { key: 'networks', label: 'Networks' },
        { key: 'billing', label: 'Billing' },
        { key: 'creditLimit', label: 'Credit limit' },
        { key: 'campaigns', label: 'Campaigns' },
        { key: 'spend', label: 'Spend (30d)' },
        { key: 'access', label: 'Access' },
        { key: 'created', label: 'Created' },
      ],
      'advertisers'
    );
    onToast(`Exported ${filtered.length} advertiser(s).`);
  };

  const clearAllFilters = () => {
    setQ('');
    setTab('All');
    setNetworkFilter(new Set(NETWORKS.map((n) => NETWORK_LABELS[n])));
    setRoleFilter(new Set(ROLES));
  };

  const updateItem = (id: string, patch: Partial<Advertiser>) => {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const openPeek = (id: string) => setPeekId(id);
  const closePeek = () => setPeekId(null);
  const peekAdv = items.find((a) => a.id === peekId) || null;

  const openNewAdvertiser = () => {
    setEditId(null);
    setForm(blankForm());
    setDraftAccess([]);
    setDrawerOpen(true);
  };
  const openEditAdvertiser = (id: string) => {
    const a = items.find((x) => x.id === id);
    if (!a) return;
    setEditId(id);
    setForm(formFromAdvertiser(a));
    setDraftAccess(a.access.map((u) => ({ ...u })));
    setPeekId(null);
    setDrawerOpen(true);
  };
  const closeAdvertiserDrawer = () => {
    setDrawerOpen(false);
    setEditId(null);
  };

  const toggleNetwork = (n: NetName) => {
    setForm((p) => {
      const next = new Set(p.networks);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return { ...p, networks: next };
    });
  };

  const changeAccessRole = (idx: number, role: Role) => {
    setDraftAccess((prev) => prev.map((u, i) => (i === idx ? { ...u, role } : u)));
  };
  const removeAccessUser = (idx: number) => {
    setDraftAccess((prev) => prev.filter((_, i) => i !== idx));
  };

  const openInviteModal = () => {
    setInviteEmail('');
    setInviteRole('Manager');
    setInviteOpen(true);
  };
  const confirmInvite = () => {
    if (!inviteEmail.trim()) {
      onToast('Email is required');
      return;
    }
    if (drawerOpen) {
      // attached to current draft
      setDraftAccess((prev) => [...prev, { email: inviteEmail.trim(), role: inviteRole }]);
      setInviteOpen(false);
      onToast(`Invited ${inviteEmail.trim()} (${inviteRole})`);
    } else {
      setInviteOpen(false);
      onToast(`Invite sent to ${inviteEmail.trim()} as ${inviteRole}`);
    }
  };

  const openBillingModal = () => {
    setBillingName('');
    setBillingPayment('Visa •4421');
    setBillingCredit(15000);
    setBillingOpen(true);
  };
  const confirmBilling = () => {
    if (!billingName.trim()) {
      onToast('Profile name is required');
      return;
    }
    setBillingOpen(false);
    onToast(`Billing profile created: ${billingName.trim()}`);
  };

  const openNetworkModal = () => {
    setNetSelect('Meta');
    setNetAccount('');
    setNetworkOpen(true);
  };
  const confirmNetwork = () => {
    if (!netAccount.trim()) {
      onToast('Ad account ID is required');
      return;
    }
    setNetworkOpen(false);
    onToast(`Connected ${NETWORK_LABELS[netSelect]} (${netAccount.trim()})`);
  };

  /* ─── save ─── */
  const collectAdvertiser = (): Advertiser | null => {
    if (!form.legalName.trim()) {
      onToast('Legal business name is required');
      return null;
    }
    if (!form.displayName.trim()) {
      onToast('Display name is required');
      return null;
    }
    if (!form.email.trim()) {
      onToast('Contact email is required');
      return null;
    }
    const networksArr = NETWORKS.filter((n) => form.networks.has(n));
    const existing = editId ? items.find((a) => a.id === editId) : null;
    const id = existing
      ? existing.id
      : `ADV-${String(items.length + 1001).padStart(4, '0')}`;
    return {
      id,
      legalName: form.legalName.trim(),
      displayName: form.displayName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      country: form.country,
      bizType: form.bizType,
      taxId: form.taxId.trim() || '—',
      verify: form.verify,
      status: existing ? existing.status : 'Pending',
      networks: networksArr,
      billing: form.useWorkspaceBilling
        ? 'Visa •4421'
        : form.payment,
      creditLimit: form.creditLimit || 0,
      campaigns: existing ? existing.campaigns : 0,
      spend: existing ? existing.spend : 0,
      access: draftAccess.map((u) => ({ ...u })),
      created: existing ? existing.created : new Date().toISOString().slice(0, 10),
    };
  };

  const saveAndClose = () => {
    const a = collectAdvertiser();
    if (!a) return;
    setItems((prev) => {
      if (editId) {
        const idx = prev.findIndex((x) => x.id === editId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = a;
          return next;
        }
      }
      return [a, ...prev];
    });
    closeAdvertiserDrawer();
    onToast(editId ? 'Advertiser updated' : 'Advertiser created');
  };

  const saveAndNew = () => {
    const a = collectAdvertiser();
    if (!a) return;
    setItems((prev) => {
      if (editId) {
        const idx = prev.findIndex((x) => x.id === editId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = a;
          return next;
        }
      }
      return [a, ...prev];
    });
    setEditId(null);
    setForm(blankForm());
    setDraftAccess([]);
    onToast('Saved. New advertiser form ready.');
  };

  const saveAndInvite = () => {
    const a = collectAdvertiser();
    if (!a) return;
    setItems((prev) => {
      if (editId) {
        const idx = prev.findIndex((x) => x.id === editId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = a;
          return next;
        }
      }
      return [a, ...prev];
    });
    closeAdvertiserDrawer();
    onToast('Saved and sent invite');
  };

  /* ─── row menu actions ─── */
  const rowMenuItems = (a: Advertiser) => [
    { label: 'Edit advertiser', icon: 'edit', onClick: () => openEditAdvertiser(a.id) },
    { label: 'View details', icon: 'visibility', onClick: () => openPeek(a.id) },
    { label: 'Invite user', icon: 'group_add', onClick: () => openInviteModal() },
    {
      label: 'Mark verified',
      icon: 'verified',
      onClick: () => {
        const patch: Partial<Advertiser> = { verify: 'Verified' };
        if (a.status === 'Pending') patch.status = 'Active';
        updateItem(a.id, patch);
        onToast(`Marked verified: ${a.displayName}`);
      },
    },
    {
      label: 'Suspend',
      icon: 'block',
      sepBefore: true,
      header: 'Status',
      onClick: () => {
        updateItem(a.id, { status: 'Suspended' });
        onToast(`Suspended: ${a.displayName}`);
      },
    },
    {
      label: 'Restore',
      icon: 'refresh',
      onClick: () => {
        updateItem(a.id, { status: 'Active' });
        onToast(`Restored: ${a.displayName}`);
      },
    },
    {
      label: 'Close account',
      icon: 'do_not_disturb',
      danger: true,
      sepBefore: true,
      onClick: () => {
        if (typeof window !== 'undefined' && window.confirm('Close this advertiser account? This cannot be undone.')) {
          updateItem(a.id, { status: 'Closed' });
          onToast(`Closed: ${a.displayName}`);
        }
      },
    },
  ];

  /* ─── peek actions ─── */
  const peekAction = (act: 'edit' | 'invite' | 'suspend' | 'restore') => {
    if (!peekAdv) return;
    if (act === 'edit') {
      const id = peekAdv.id;
      closePeek();
      openEditAdvertiser(id);
    } else if (act === 'invite') {
      openInviteModal();
    } else if (act === 'suspend') {
      updateItem(peekAdv.id, { status: 'Suspended' });
      closePeek();
      onToast('Suspended');
    } else if (act === 'restore') {
      updateItem(peekAdv.id, { status: 'Active' });
      closePeek();
      onToast('Restored');
    }
  };

  /* ─── bulk actions ─── */
  const bulkSuspend = () => {
    let n = 0;
    setItems((prev) =>
      prev.map((a) => {
        if (selected.has(a.id)) {
          n++;
          return { ...a, status: 'Suspended' as AdvStatus };
        }
        return a;
      })
    );
    clearSelection();
    onToast(`Suspended ${n} advertiser(s)`);
  };
  const bulkRestore = () => {
    let n = 0;
    setItems((prev) =>
      prev.map((a) => {
        if (selected.has(a.id)) {
          n++;
          return { ...a, status: 'Active' as AdvStatus };
        }
        return a;
      })
    );
    clearSelection();
    onToast(`Restored ${n} advertiser(s)`);
  };
  const bulkVerify = () => {
    let n = 0;
    setItems((prev) =>
      prev.map((a) => {
        if (selected.has(a.id)) {
          n++;
          return {
            ...a,
            verify: 'Verified' as VerifyStatus,
            status: a.status === 'Pending' ? ('Active' as AdvStatus) : a.status,
          };
        }
        return a;
      })
    );
    clearSelection();
    onToast(`Marked ${n} advertiser(s) verified`);
  };

  /* ─── create menu ─── */
  const createMenu = [
    { label: 'Advertiser', icon: 'person_add', onClick: openNewAdvertiser },
    { label: 'Invite user', icon: 'group_add', onClick: openInviteModal },
    { label: 'Billing profile', icon: 'account_balance', onClick: openBillingModal },
    { label: 'Network connection', icon: 'hub', onClick: openNetworkModal },
  ];

  /* ─── save menu (for the drawer Save split arrows) ─── */
  const saveMenu = [
    { label: 'Save and close', icon: 'save', onClick: saveAndClose },
    { label: 'Save and new', icon: 'add', onClick: saveAndNew },
    { label: 'Save and send invite', icon: 'mail', onClick: saveAndInvite },
  ];

  /* ─── pagination (visual, like HTML) ─── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  useEffect(() => {
    setPage(1);
  }, [q, tab, networkFilter, roleFilter, rowsPerPage]);

  /* ──────────────── render ──────────────── */
  return (
    <div className={s.screen} style={{ padding: '0 24px 48px' }}>
      {/* BREADCRUMB */}
      <Breadcrumb
        items={[
          { label: 'Advertising' },
          { label: 'Advertisers', current: true },
        ]}
      />

      {/* PAGE HEADER */}
      <PageHeader
        title="Advertisers"
        subtitle="Every advertiser account — identity, networks, billing, verification, and access."
      >
        <Btn variant="outline" icon="download" onClick={handleExport}>
          Export
        </Btn>
        <Btn
          variant="outline"
          icon="tune"
          onClick={() => onToast('Customize panel — Data / Visual tabs')}
        >
          Customize
        </Btn>
        <HeaderSplitButton
          variant="primary"
          icon="add"
          label="New advertiser"
          onClick={openNewAdvertiser}
          menuHeader="New"
          menu={createMenu}
        />
      </PageHeader>

      {/* KPI STRIP */}
      <KpiStrip>
        <KpiCard label="Total advertisers" value={kpis.total} sub={`Across ${kpis.networkCount} networks`} />
        <KpiCard label="Active" value={kpis.active} sub="Approved & able to spend" subTone="pos" />
        <KpiCard label="Verification pending" value={kpis.pending} sub="Blocking new campaigns" />
        <KpiCard label="Suspended" value={kpis.suspended} sub="Spend paused by policy" subTone="neg" />
      </KpiStrip>

      {/* LIST CARD */}
      <div className={s.card}>
        {/* View tabs */}
        <div className={s.tabs}>
          {VIEW_TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`${s.tab} ${tab === t ? s.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Filter advertisers…" />
          <FilterDropdown
            label="Network"
            icon="hub"
            options={NETWORKS.map((n) => NETWORK_LABELS[n])}
            selected={networkFilter}
            onChange={setNetworkFilter}
            onClear={() => setNetworkFilter(new Set(NETWORKS.map((n) => NETWORK_LABELS[n])))}
            onApply={() => {}}
          />
          <FilterDropdown
            label="Role"
            icon="badge"
            options={ROLES}
            selected={roleFilter}
            onChange={setRoleFilter}
            onClear={() => setRoleFilter(new Set(ROLES))}
            onApply={() => {}}
          />
          <button
            type="button"
            className={`${s.filterBtn}`}
            onClick={() => onToast('Saved views — pick or save current filters')}
          >
            <span className="material-symbols-outlined">bookmark</span>
            Saved views
          </button>
          {filtersActive && (
            <button
              type="button"
              className={s.filterBtn}
              onClick={clearAllFilters}
            >
              <span className="material-symbols-outlined">filter_alt_off</span>
              Clear all
            </button>
          )}
          <span className={s.flex1} />
          <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
            {filtered.length} of {items.length}
          </span>
        </FilterBar>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <BulkBar
            count={selected.size}
            onClear={clearSelection}
            actions={[
              { label: 'Suspend', icon: 'block', onClick: bulkSuspend },
              { label: 'Restore', icon: 'refresh', onClick: bulkRestore },
              { label: 'Mark verified', icon: 'verified', onClick: bulkVerify },
            ]}
          />
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: '0 auto 12px',
                borderRadius: '50%',
                background: 'var(--surface-container-low)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 28, color: 'var(--outline)' }}
              >
                person_search
              </span>
            </div>
            <h3 className={s.headlineSm} style={{ margin: '0 0 4px' }}>
              No advertisers match
            </h3>
            <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', margin: '0 0 12px' }}>
              Clear filters or add a new advertiser.
            </p>
            <Btn variant="outline" onClick={clearAllFilters}>
              Clear filters
            </Btn>
          </div>
        ) : (
          <TableWrap>
            <Table
              head={
                <tr>
                  <th className={s.checkCell}>
                    <input
                      ref={checkAllRef}
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => toggleAllVisible(e.target.checked)}
                    />
                  </th>
                  <th>Advertiser</th>
                  <th>Advertiser ID</th>
                  <th>Networks</th>
                  <th>Billing</th>
                  <th>Verification</th>
                  <th className={s.right}>Campaigns</th>
                  <th className={s.right}>Spend (30d)</th>
                  <th>Status</th>
                  <th className={s.checkCell} />
                </tr>
              }
            >
              {filtered.map((a) => (
                <tr key={a.id} onClick={() => openPeek(a.id)}>
                  <td className={s.checkCell}>
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleRow(a.id)}
                    />
                  </td>
                  <td>
                    <div className={`${s.flex} ${s.itemsCenter} ${s.gap2}`} style={{ minWidth: 0 }}>
                      <AdvAvatar name={a.displayName} status={a.status} />
                      <div style={{ minWidth: 0 }}>
                        <div className={s.rowName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.displayName}
                        </div>
                        <div className={s.rowSub} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.legalName} · {a.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={s.mono}>{a.id}</span>
                  </td>
                  <td>
                    <div className={`${s.flex} ${s.itemsCenter} ${s.gap2} ${s.flexWrap}`}>
                      {a.networks.map((n) => (
                        <NetChipSmall key={n} n={n} />
                      ))}
                    </div>
                  </td>
                  <td style={{ fontSize: 11 }}>{a.billing}</td>
                  <td>
                    {verifyPill(a.verify)}
                  </td>
                  <td className={s.right} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {a.campaigns}
                  </td>
                  <td className={s.right} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    ${a.spend.toLocaleString()}
                  </td>
                  <td>
                    <StatusPill status={a.status} />
                  </td>
                  <td
                    className={s.checkCell}
                    style={{ textAlign: 'right' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowMenu items={rowMenuItems(a)} />
                  </td>
                </tr>
              ))}
            </Table>
          </TableWrap>
        )}

        {/* Pagination */}
        <div
          className={`${s.flex} ${s.itemsCenter} ${s.justifyBetween}`}
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--surface-dim)',
            fontSize: 11,
            color: 'var(--on-surface-variant)',
          }}
        >
          <span className={`${s.flex} ${s.itemsCenter} ${s.gap2}`}>
            Rows per page:
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
              style={{
                border: '1px solid var(--surface-dim)',
                borderRadius: 4,
                padding: '2px 4px',
                background: '#fff',
                fontSize: 11,
              }}
            >
              {ROWS_PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </span>
          <div className={`${s.flex} ${s.itemsCenter} ${s.gap2}`}>
            <button
              type="button"
              onClick={() => onToast('Previous page')}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                chevron_left
              </span>
            </button>
            <span>
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onToast('Next page')}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════ PEEK DRAWER (row click) ═══════════ */}
      <Peek
        open={!!peekAdv}
        title={peekAdv?.displayName || 'Advertiser'}
        onClose={closePeek}
        subtitle={
          peekAdv ? (
            <span className={`${s.flex} ${s.itemsCenter} ${s.gap2}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--on-surface-variant)' }}>
                person
              </span>
              <span className={s.mono} style={{ color: 'var(--on-surface-variant)' }}>
                {peekAdv.id}
              </span>
            </span>
          ) : null
        }
        footer={
          <div className={`${s.grid2} ${s.gap2}`}>
            <Btn variant="primary" icon="edit" onClick={() => peekAction('edit')}>
              Edit
            </Btn>
            <Btn variant="outline" icon="group_add" onClick={() => peekAction('invite')}>
              Invite
            </Btn>
            <Btn variant="outline" icon="block" onClick={() => peekAction('suspend')}>
              Suspend
            </Btn>
            <Btn variant="outline" icon="refresh" onClick={() => peekAction('restore')}>
              Restore
            </Btn>
          </div>
        }
      >
        {peekAdv && (
          <>
            <div className={`${s.flex} ${s.itemsCenter} ${s.gap2} ${s.mb3}`}>
              <StatusPill status={peekAdv.status} />
              <span className={s.mono} style={{ color: 'var(--on-surface-variant)' }}>
                {peekAdv.id}
              </span>
            </div>
            <div className={`${s.flex} ${s.itemsCenter} ${s.gap2} ${s.flexWrap} ${s.mb3}`}>
              {peekAdv.networks.map((n) => (
                <NetChipSmall key={n} n={n} />
              ))}
            </div>
            <div
              style={{
                background: 'var(--surface-container-low)',
                borderRadius: 8,
                padding: 12,
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--on-surface-variant)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                Spend (30d)
              </div>
              <div
                className={s.headlineMd}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                ${peekAdv.spend.toLocaleString()}
              </div>
            </div>
            <KvList
              items={[
                { k: 'Legal name', v: peekAdv.legalName },
                { k: 'Email', v: peekAdv.email },
                { k: 'Phone', v: peekAdv.phone },
                { k: 'Country', v: peekAdv.country },
                { k: 'Business type', v: peekAdv.bizType },
                { k: 'Tax ID', v: <span className={s.mono}>{peekAdv.taxId}</span> },
                { k: 'Verification', v: peekAdv.verify },
                { k: 'Billing', v: peekAdv.billing },
                {
                  k: 'Credit limit',
                  v: <span style={{ fontVariantNumeric: 'tabular-nums' }}>${peekAdv.creditLimit.toLocaleString()}</span>,
                },
                {
                  k: 'Campaigns',
                  v: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{peekAdv.campaigns}</span>,
                },
                { k: 'Created', v: peekAdv.created },
              ]}
            />
            <div
              className={s.mt4}
              style={{ paddingTop: 12, borderTop: '1px solid var(--surface-dim)' }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--on-surface-variant)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                Access
              </div>
              <div className={s.flexCol} style={{ gap: 4 }}>
                {peekAdv.access.map((u, i) => (
                  <div
                    key={i}
                    className={`${s.flex} ${s.itemsCenter} ${s.justifyBetween}`}
                    style={{ padding: '4px 0', fontSize: 13 }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.email}
                    </span>
                    <RoleChip role={u.role} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Peek>

      {/* ═══════════ ADVERTISER DRAWER (create + edit) ═══════════ */}
      <Drawer
        open={drawerOpen}
        title={editId ? 'Edit advertiser' : 'New advertiser'}
        subtitle={
          editId
            ? `${items.find((a) => a.id === editId)?.status ?? ''} · ${editId}`
            : 'Draft · not yet invited'
        }
        onClose={closeAdvertiserDrawer}
        width={600}
        footer={
          <div className={`${s.flex} ${s.itemsCenter} ${s.justifyBetween}`} style={{ width: '100%' }}>
            <Btn variant="outline" onClick={closeAdvertiserDrawer}>
              Cancel
            </Btn>
            <div className={`${s.flex} ${s.itemsCenter} ${s.gap2}`}>
              <HeaderSplitButton
                variant="outline"
                icon=""
                label="Save and new"
                onClick={saveAndNew}
                menu={saveMenu}
              />
              <HeaderSplitButton
                variant="primary"
                icon=""
                label="Save and close"
                onClick={saveAndClose}
                menu={saveMenu}
              />
            </div>
          </div>
        }
      >
        {/* Advertiser identity */}
        <div className={s.sectionH}>Advertiser identity</div>
        <div className={s.flexCol} style={{ gap: 12 }}>
          <Field label="Legal business name">
            <Input
              value={form.legalName}
              onChange={(e) => setForm((p) => ({ ...p, legalName: e.target.value }))}
              placeholder="e.g. Unsaid Company Inc."
            />
          </Field>
          <Field label="Display name">
            <Input
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              placeholder="e.g. Unsaid"
            />
          </Field>
          <div className={s.fieldRow}>
            <Field label="Contact email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="ads@company.com"
              />
            </Field>
            <Field label="Contact phone">
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+1 (555) 010-0100"
              />
            </Field>
          </div>
          <div className={s.fieldRow}>
            <Field label="Country">
              <Select
                value={form.country}
                onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
              >
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Business type">
              <Select
                value={form.bizType}
                onChange={(e) => setForm((p) => ({ ...p, bizType: e.target.value }))}
              >
                {BIZ_TYPES.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        {/* Verification & tax */}
        <div className={s.sectionH} style={{ marginTop: 20 }}>
          Verification &amp; tax
        </div>
        <div className={s.flexCol} style={{ gap: 12 }}>
          <div className={s.fieldRow}>
            <Field label="Tax ID (EIN)">
              <Input
                value={form.taxId}
                onChange={(e) => setForm((p) => ({ ...p, taxId: e.target.value }))}
                placeholder="••-•••••••"
                className={s.mono}
                style={{ fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace" }}
              />
            </Field>
            <Field label="Verification">
              <Select
                value={form.verify}
                onChange={(e) =>
                  setForm((p) => ({ ...p, verify: e.target.value as VerifyStatus }))
                }
              >
                <option value="Pending">Pending</option>
                <option value="Verified">Verified</option>
                <option value="Rejected">Rejected</option>
              </Select>
            </Field>
          </div>
          <div
            onClick={() => onToast('Document upload — choose file')}
            style={{
              border: '1px dashed var(--surface-dim)',
              borderRadius: 8,
              padding: 12,
              textAlign: 'center',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-container-low)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
              Upload business documents
            </div>
            <div style={{ fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 4 }}>
              Articles of incorporation, W-9, business license · PDF up to 10 MB
            </div>
          </div>
        </div>

        {/* Connected networks */}
        <div className={s.sectionH} style={{ marginTop: 20 }}>
          Connected networks
        </div>
        <div className={s.flexCol} style={{ gap: 8 }}>
          {NETWORKS.map((n) => (
            <label
              key={n}
              className={`${s.flex} ${s.itemsCenter} ${s.justifyBetween}`}
              style={{
                padding: 8,
                borderRadius: 6,
                border: '1px solid var(--surface-dim)',
                cursor: 'pointer',
              }}
            >
              <span className={`${s.flex} ${s.itemsCenter} ${s.gap2}`}>
                <NetworkBadge n={n} />
                <span style={{ fontSize: 13 }}>{NETWORK_LABELS[n]}</span>
              </span>
              <input
                type="checkbox"
                checked={form.networks.has(n)}
                onChange={() => toggleNetwork(n)}
                style={{ accentColor: 'var(--qb-blue)', cursor: 'pointer' }}
              />
            </label>
          ))}
        </div>

        {/* Billing profile */}
        <div className={s.sectionH} style={{ marginTop: 20 }}>
          Billing profile
        </div>
        <div className={s.flexCol} style={{ gap: 8 }}>
          <label
            className={`${s.flex} ${s.itemsCenter} ${s.justifyBetween}`}
            style={{ padding: '4px 0', fontSize: 13 }}
          >
            <span>Use workspace billing profile</span>
            <input
              type="checkbox"
              checked={form.useWorkspaceBilling}
              onChange={(e) =>
                setForm((p) => ({ ...p, useWorkspaceBilling: e.target.checked }))
              }
              style={{ accentColor: 'var(--qb-blue)', cursor: 'pointer' }}
            />
          </label>
          <div className={s.fieldRow} style={{ opacity: form.useWorkspaceBilling ? 0.6 : 1 }}>
            <Field label="Payment method">
              <Select
                value={form.payment}
                onChange={(e) => setForm((p) => ({ ...p, payment: e.target.value }))}
              >
                {PAYMENTS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field label="Monthly credit limit">
              <Input
                type="number"
                value={form.creditLimit}
                onChange={(e) =>
                  setForm((p) => ({ ...p, creditLimit: parseInt(e.target.value || '0', 10) }))
                }
              />
            </Field>
          </div>
        </div>

        {/* Access & roles */}
        <div className={s.sectionH} style={{ marginTop: 20 }}>
          Access &amp; roles
        </div>
        <div className={s.flexCol} style={{ gap: 8 }}>
          {draftAccess.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
              No users yet.
            </div>
          )}
          {draftAccess.map((u, i) => (
            <div
              key={`${u.email}-${i}`}
              className={`${s.flex} ${s.itemsCenter} ${s.gap2}`}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--surface-dim)',
                fontSize: 13,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16, color: 'var(--primary)' }}
              >
                person
              </span>
              <div className={s.flex1} style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.email}
                </div>
                <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                  {u.role}
                </div>
              </div>
              <select
                value={u.role}
                onChange={(e) => changeAccessRole(i, e.target.value as Role)}
                style={{
                  height: 28,
                  padding: '0 4px',
                  border: '1px solid var(--surface-dim)',
                  borderRadius: 4,
                  fontSize: 13,
                  background: '#fff',
                  fontFamily: 'inherit',
                }}
              >
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeAccessUser(i)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Remove"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 14, color: 'var(--error)' }}
                >
                  close
                </span>
              </button>
            </div>
          ))}
          <Btn
            variant="outline"
            sm
            icon="group_add"
            onClick={openInviteModal}
          >
            Invite user
          </Btn>
        </div>
      </Drawer>

      {/* ═══════════ INVITE USER MODAL ═══════════ */}
      <Modal
        open={inviteOpen}
        title="Invite user"
        onClose={() => setInviteOpen(false)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={confirmInvite}>
              Send invite
            </Btn>
          </>
        }
      >
        <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', margin: '0 0 12px' }}>
          They will receive an email invitation for this advertiser.
        </p>
        <Field label="Email">
          <Input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="teammate@company.com"
          />
        </Field>
        <Field label="Role">
          <Select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
      </Modal>

      {/* ═══════════ BILLING PROFILE MODAL ═══════════ */}
      <Modal
        open={billingOpen}
        title="New billing profile"
        onClose={() => setBillingOpen(false)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setBillingOpen(false)}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={confirmBilling}>
              Create profile
            </Btn>
          </>
        }
      >
        <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', margin: '0 0 12px' }}>
          Create a billing profile to attach to advertiser accounts.
        </p>
        <Field label="Profile name">
          <Input
            value={billingName}
            onChange={(e) => setBillingName(e.target.value)}
            placeholder="e.g. US Card •4421"
          />
        </Field>
        <Field label="Payment method">
          <Select
            value={billingPayment}
            onChange={(e) => setBillingPayment(e.target.value)}
          >
            {PAYMENTS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="Monthly credit limit">
          <Input
            type="number"
            value={billingCredit}
            onChange={(e) => setBillingCredit(parseInt(e.target.value || '0', 10))}
          />
        </Field>
      </Modal>

      {/* ═══════════ NETWORK CONNECTION MODAL ═══════════ */}
      <Modal
        open={networkOpen}
        title="Connect a network"
        onClose={() => setNetworkOpen(false)}
        footer={
          <>
            <Btn variant="outline" onClick={() => setNetworkOpen(false)}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={confirmNetwork}>
              Connect
            </Btn>
          </>
        }
      >
        <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', margin: '0 0 12px' }}>
          Authorize this advertiser to spend on a network.
        </p>
        <Field label="Network">
          <Select
            value={netSelect}
            onChange={(e) => setNetSelect(e.target.value as NetName)}
          >
            {NETWORKS.map((n) => (
              <option key={n} value={n}>
                {NETWORK_LABELS[n]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ad account ID">
          <Input
            value={netAccount}
            onChange={(e) => setNetAccount(e.target.value)}
            placeholder="act_1234567890"
          />
        </Field>
      </Modal>
    </div>
  );
}
