import type { DomainKey } from '@/data/shellData';

/**
 * Shared prop contract for all Accounting screens.
 * Wired in ScreenContent.tsx TabScreenRenderer.
 */
export interface AccountingScreenProps {
  onNavigate: (domain: DomainKey, screenId: string) => void;
  onToast: (message: string) => void;
  onCreate: (label: string) => void;
  onOpenCreateFlyout: () => void;
}

export const ACCT_NAV = {
  overview: () => ['finance', 'accounting'] as const,
  bank: () => ['finance', 'bank'] as const,
  receipts: () => ['finance', 'receipts'] as const,
  rules: () => ['finance', 'rules'] as const,
  coa: () => ['finance', 'coa'] as const,
  reports: () => ['finance', 'reports'] as const,
  reconcile: () => ['finance', 'reconcile'] as const,
  taxOverview: () => ['finance', 'tax-overview'] as const,
  invoices: () => ['finance', 'invoices'] as const,
} as const;
