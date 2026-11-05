import type { DomainKey } from '@/data/shellData';

/**
 * Shared prop contract for Contacts screens.
 * Wired in ScreenContent.tsx TabScreenRenderer.
 *
 * Source-of-truth HTML (upload/):
 *   - customer hub Parties.html → parties
 */
export interface ContactsScreenProps {
  onNavigate: (domain: DomainKey, screenId: string) => void;
  onToast: (message: string) => void;
  onCreate: (label: string) => void;
  onOpenCreateFlyout: () => void;
}

/** Navigation targets used by Contacts screens. */
export const CONTACTS_NAV = {
  overview: () => ['contacts', 'crm-overview'] as const,
  parties: () => ['contacts', 'parties'] as const,
  customers: () => ['contacts', 'customers'] as const,
  statements: () => ['finance', 'statements'] as const,
  invoices: () => ['finance', 'invoices'] as const,
  estimates: () => ['finance', 'estimates'] as const,
  bills: () => ['finance', 'bills'] as const,
  vendors: () => ['finance', 'vendors'] as const,
} as const;
