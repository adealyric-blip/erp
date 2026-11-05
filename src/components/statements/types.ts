import type { DomainKey } from '@/data/shellData';

/**
 * Shared prop contract for Statements screens.
 * Wired in ScreenContent.tsx TabScreenRenderer.
 *
 * Source-of-truth HTML (upload/):
 *   - statements.html → statements
 */
export interface StatementsScreenProps {
  onNavigate: (domain: DomainKey, screenId: string) => void;
  onToast: (message: string) => void;
  onCreate: (label: string) => void;
  onOpenCreateFlyout: () => void;
}

/** Navigation targets used by Statements screens. */
export const STMT_NAV = {
  customers: () => ['finance', 'customers'] as const,
  invoices: () => ['finance', 'invoices'] as const,
  parties: () => ['finance', 'parties'] as const,
  customerOverview: () => ['finance', 'customer-overview'] as const,
} as const;
