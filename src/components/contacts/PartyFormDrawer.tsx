'use client';
/**
 * PartyFormDrawer — THE canonical create/edit party experience.
 *
 * Every surface that creates or edits a party (CRM overview, Parties list,
 * Customers, Vendors, Suppliers, quick-create) opens THIS drawer — one form,
 * one save path, one behavior: the drawer is instant (local state only),
 * Supabase is touched exclusively when the user clicks Save.
 *
 * Save paths:
 *   create → POST /api/parties           (routes to the right table by role)
 *   edit   → PATCH /api/parties/[id]?source=…
 */
import { useEffect, useState } from 'react';
import { usePlatformMutations, fetchJson } from '@/hooks/useCrmApi';

export const PARTY_ROLES = ['Customer', 'Vendor', 'Supplier', 'Contact', 'Lead'] as const;

export interface PartyFormEditTarget {
  id: string;
  source: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  roles: string[];
}

export interface PartyFormDrawerProps {
  open: boolean;
  editing?: PartyFormEditTarget | null;
  /** Role pre-selected when creating (e.g. 'Customer' from the overview). */
  preselectRole?: string;
  onClose: () => void;
  /** Called after a successful save so the caller can refresh its list. */
  onSaved?: (partyName: string, mode: 'created' | 'updated') => void;
  onToast: (m: string) => void;
}

interface PartyFormState {
  name: string; display: string; first: string; last: string; email: string; phone: string;
  street1: string; street2: string; city: string; state: string; zip: string; country: string; notes: string;
}

const EMPTY_FORM: PartyFormState = {
  name: '', display: '', first: '', last: '', email: '', phone: '',
  street1: '', street2: '', city: '', state: '', zip: '', country: 'United States', notes: '',
};

export default function PartyFormDrawer({ open, editing, preselectRole, onClose, onSaved, onToast }: PartyFormDrawerProps) {
  const { createParty } = usePlatformMutations(onToast);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [draftRoles, setDraftRoles] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  /* Reset the form whenever the drawer opens for a different target. */
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        ...EMPTY_FORM,
        name: editing.name || '', display: editing.name || '',
        email: editing.email || '', phone: editing.phone || '',
        street1: editing.address || '',
      });
      setDraftRoles(new Set(editing.roles || []));
    } else {
      setForm({ ...EMPTY_FORM });
      setDraftRoles(new Set(preselectRole ? [preselectRole] : []));
    }
  }, [open, editing, preselectRole]);

  if (!open) return null;

  function toggleRole(role: string) {
    setDraftRoles(prev => {
      const n = new Set(prev);
      if (n.has(role)) n.delete(role); else n.add(role);
      return n;
    });
  }

  function collect(): { name: string } | null {
    const name = form.name.trim() || `${form.first.trim()} ${form.last.trim()}`.trim();
    if (!name) { onToast('Name is required — company, or first + last'); return null; }
    if (draftRoles.size === 0) { onToast('Select at least one role'); return null; }
    return { name };
  }

  async function persist(): Promise<boolean> {
    const c = collect();
    if (!c) return false;
    setSaving(true);
    try {
      if (editing) {
        const res = await fetchJson(`/api/parties/${editing.id}?source=${editing.source}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: c.name,
            first_name: form.first || null,
            last_name: form.last || null,
            email: form.email || null,
            phone: form.phone || null,
            address: form.street1 || null,
            city: form.city || null,
            state: form.state || null,
            zip: form.zip || null,
          }),
        });
        if (!res.ok) { onToast(`Save failed: ${res.error}`); return false; }
        onSaved?.(c.name, 'updated');
        return true;
      } else {
        const primaryRole = (draftRoles.has('Customer') ? 'customer'
          : draftRoles.has('Vendor') ? 'vendor'
          : draftRoles.has('Supplier') ? 'supplier'
          : draftRoles.has('Lead') ? 'lead' : 'contact');
        const res = await createParty({
          role: primaryRole,
          name: c.name,
          first_name: form.first || undefined,
          last_name: form.last || undefined,
          company_name: form.name || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          address: form.street1 || undefined,
          zip: form.zip || undefined,
        });
        if (!res.ok) return false;
        onSaved?.(c.name, 'created');
        return true;
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveAndClose() {
    if (await persist()) onClose();
  }
  async function saveAndNew() {
    if (await persist()) {
      setForm({ ...EMPTY_FORM });
      // keep the current role selection — usually adding several of the same kind
    }
  }

  return (
    <>
      <div className="drawer-scrim open" onClick={onClose} />
      <div className="drawer open" role="dialog" aria-label={editing ? 'Edit party' : 'New party'}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-surface-dim shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[20px] text-primary">groups</span>
            <div className="min-w-0">
              <div className="text-headline-sm truncate">{editing ? 'Edit party' : 'New party'}</div>
              <div className="text-[11px] text-on-surface-variant">{editing ? editing.name : 'Add details and assign roles.'}</div>
            </div>
          </div>
          <button className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center" onClick={onClose} aria-label="Close"><span className="material-symbols-outlined text-[18px]">close</span></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Role chips */}
          <section>
            <div className="section-h">Roles</div>
            <div className="flex flex-wrap gap-2">
              {PARTY_ROLES.map(r => (
                <button key={r} type="button" className={`role-chip-btn ${draftRoles.has(r) ? 'selected' : ''}`} onClick={() => toggleRole(r)} aria-pressed={draftRoles.has(r)}>
                  <span className="material-symbols-outlined text-[16px]">{r === 'Customer' ? 'person' : r === 'Vendor' ? 'storefront' : r === 'Supplier' ? 'factory' : r === 'Lead' ? 'flag' : 'contacts'}</span>{r}
                </button>
              ))}
            </div>
          </section>

          {/* Names & contact */}
          <section>
            <div className="section-h">Names &amp; contact</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label" htmlFor="pf-name">Company / party name</label><input id="pf-name" className="field-input" placeholder="e.g. Acme Corp" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div><label className="field-label" htmlFor="pf-display">Display name</label><input id="pf-display" className="field-input" placeholder="e.g. Acme" value={form.display} onChange={e => setForm(p => ({ ...p, display: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label" htmlFor="pf-first">First name</label><input id="pf-first" className="field-input" placeholder="First" value={form.first} onChange={e => setForm(p => ({ ...p, first: e.target.value }))} /></div>
                <div><label className="field-label" htmlFor="pf-last">Last name</label><input id="pf-last" className="field-input" placeholder="Last" value={form.last} onChange={e => setForm(p => ({ ...p, last: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label" htmlFor="pf-email">Email</label><input id="pf-email" className="field-input" type="email" placeholder="name@company.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
                <div><label className="field-label" htmlFor="pf-phone">Phone</label><input id="pf-phone" className="field-input" type="tel" placeholder="+1 (555) 000-0000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
              </div>
            </div>
          </section>

          {/* Address */}
          <section>
            <div className="section-h">Address</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="field-label" htmlFor="pf-street1">Street 1</label><input id="pf-street1" className="field-input" placeholder="Street 1" value={form.street1} onChange={e => setForm(p => ({ ...p, street1: e.target.value }))} /></div>
              <div><label className="field-label" htmlFor="pf-street2">Street 2</label><input id="pf-street2" className="field-input" placeholder="Street 2" value={form.street2} onChange={e => setForm(p => ({ ...p, street2: e.target.value }))} /></div>
              <div><label className="field-label" htmlFor="pf-city">City</label><input id="pf-city" className="field-input" placeholder="City" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></div>
              <div><label className="field-label" htmlFor="pf-state">State / Province</label><input id="pf-state" className="field-input" placeholder="State" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} /></div>
              <div><label className="field-label" htmlFor="pf-zip">ZIP / Postal</label><input id="pf-zip" className="field-input" placeholder="ZIP" value={form.zip} onChange={e => setForm(p => ({ ...p, zip: e.target.value }))} /></div>
              <div><label className="field-label" htmlFor="pf-country">Country</label><select id="pf-country" className="field-input" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))}><option>United States</option><option>Canada</option><option>United Kingdom</option><option>Australia</option></select></div>
            </div>
          </section>

          {/* Role-specific sections */}
          {draftRoles.has('Customer') && (
            <div className="role-section">
              <div className="text-label-sm font-bold text-primary mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">person</span>Customer details</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Terms</label><select className="field-input"><option>Net 30</option><option>Net 15</option><option>Due on receipt</option></select></div>
                <div><label className="field-label">Credit limit</label><input className="field-input" placeholder="$0.00" /></div>
              </div>
              <label className="flex items-center gap-2 mt-3 text-body-sm"><input type="checkbox" className="row-check" /> Marketing consent</label>
            </div>
          )}
          {draftRoles.has('Vendor') && (
            <div className="role-section">
              <div className="text-label-sm font-bold text-qb-blue mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">storefront</span>Vendor details</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Terms</label><select className="field-input"><option>Net 30</option><option>Net 15</option><option>Due on receipt</option></select></div>
                <div><label className="field-label">Default expense account</label><input className="field-input" placeholder="Select account…" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div><label className="field-label">Tax ID</label><input className="field-input code-mono" placeholder="XX-XXXXXXX" /></div>
                <div className="flex items-end"><label className="flex items-center gap-2 text-body-sm"><input type="checkbox" className="row-check" /> Track for 1099</label></div>
              </div>
            </div>
          )}
          {draftRoles.has('Supplier') && (
            <div className="role-section">
              <div className="text-label-sm font-bold text-error mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">factory</span>Supplier details</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Account no.</label><input className="field-input code-mono" placeholder="SUP-000" /></div>
                <div><label className="field-label">Lead time (days)</label><input className="field-input" placeholder="e.g. 7" /></div>
              </div>
              <div className="mt-3"><label className="field-label">Catalog / API URL</label><input className="field-input code-mono" placeholder="https://supplier.com/api" /></div>
            </div>
          )}
          {draftRoles.has('Contact') && (
            <div className="role-section">
              <div className="text-label-sm font-bold text-qb-maroon mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">contacts</span>Contact details</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Company</label><input className="field-input" placeholder="Company name" /></div>
                <div><label className="field-label">Title</label><input className="field-input" placeholder="Job title" /></div>
              </div>
            </div>
          )}
          {draftRoles.has('Lead') && (
            <div className="role-section">
              <div className="text-label-sm font-bold text-qb-maroon mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">flag</span>Lead details</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Lead source</label><select className="field-input"><option>Website</option><option>Referral</option><option>Cold outreach</option><option>Event</option><option>Social media</option></select></div>
                <div><label className="field-label">Status</label><select className="field-input"><option>New</option><option>Contacted</option><option>Qualified</option><option>Proposal sent</option><option>Negotiation</option><option>Won</option><option>Lost</option></select></div>
              </div>
              <div className="mt-3"><label className="field-label">Next step</label><input className="field-input" placeholder="e.g. Schedule demo call" /></div>
            </div>
          )}

          {/* Notes */}
          <section>
            <div className="section-h">Notes &amp; attachments</div>
            <textarea className="field-textarea" placeholder="Add any notes about this party…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            <div className="mt-2 border border-dashed border-surface-dim rounded-lg p-3 text-center cursor-pointer hover:bg-surface-container-low" onClick={() => onToast('Attach a file — file picker')}>
              <div className="text-[12px] font-semibold text-primary">Attach a file</div>
            </div>
          </section>
        </div>

        <div className="h-14 border-t border-surface-dim px-4 flex items-center justify-between shrink-0">
          <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low" onClick={onClose}>Cancel</button>
          <div className="flex items-center gap-2">
            <button className="h-8 px-3 border border-surface-dim rounded text-body-md font-semibold hover:bg-surface-container-low disabled:opacity-50" onClick={saveAndNew} disabled={saving}>Save and new</button>
            <button className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold hover:bg-primary-container disabled:opacity-50" onClick={saveAndClose} disabled={saving}>{saving ? 'Saving…' : 'Save and close'}</button>
          </div>
        </div>
      </div>
    </>
  );
}
