export type ScreenType = 'overview' | 'list' | 'wizard';

export type GroupBgToken =
  | 'bg-qb-navy'
  | 'bg-qb-teal'
  | 'bg-qb-maroon'
  | 'bg-qb-green'
  | 'bg-error'
  | 'bg-primary';

export interface ScreenItem {
  id: string;
  label: string;
  type: ScreenType;
  badge?: number;
}

export interface ScreenWithGroup extends ScreenItem {
  group: string;
}

export interface DomainGroup {
  name: string;
  icon: string;
  bg: GroupBgToken;
  screens: ScreenItem[];
}

export interface DomainConfig {
  label: string;
  icon: string;
  groups: DomainGroup[];
}

export type DomainKey =
  | 'dashboard'
  | 'marketing'
  | 'catalog'
  | 'orders'
  | 'finance'
  | 'contacts'
  | 'support'
  | 'settings'
  | 'reports'
  | 'connected-suppliers';

export const DOMAINS: Record<DomainKey, DomainConfig> = {
  dashboard: {
    label: 'Dashboard',
    icon: 'dashboard',
    groups: [
      {
        name: 'Overview',
        icon: 'play_circle',
        bg: 'bg-qb-navy',
        screens: [
          { id: 'ops', label: 'Operations Vitals', type: 'overview' },
          { id: 'exec', label: 'Executive GMV & Margins', type: 'overview' },
        ],
      },
      {
        name: 'Analytics',
        icon: 'bar_chart',
        bg: 'bg-qb-teal',
        screens: [
          { id: 'analytics', label: 'Analytics', type: 'overview' },
          { id: 'explorer', label: 'Explorer', type: 'list' },
        ],
      },
      {
        name: 'Queues',
        icon: 'notifications',
        bg: 'bg-qb-maroon',
        screens: [
          { id: 'attention', label: 'Attention Queue', type: 'list', badge: 8 },
          { id: 'customer-queue', label: 'Customer Queue', type: 'list', badge: 8 },
          { id: 'seller-queue', label: 'Seller Queue', type: 'list', badge: 7 },
        ],
      },
    ],
  },
  marketing: {
    label: 'Marketing',
    icon: 'campaign',
    groups: [
      {
        name: 'Marketing Overview',
        icon: 'play_circle',
        bg: 'bg-qb-navy',
        screens: [{ id: 'marketing-overview', label: 'Overview', type: 'overview' }],
      },
      {
        name: 'Banners & Popups',
        icon: 'crop_landscape',
        bg: 'bg-qb-teal',
        screens: [
          { id: 'banners', label: 'Banners', type: 'list' },
          { id: 'popups', label: 'Popups', type: 'list' },
        ],
      },
      {
        name: 'CMS Pages & Editorial',
        icon: 'article',
        bg: 'bg-qb-maroon',
        screens: [
          { id: 'cms-pages', label: 'CMS pages', type: 'list' },
          { id: 'content-blocks', label: 'Content blocks', type: 'list' },
        ],
      },
      {
        name: 'Social Studio',
        icon: 'share',
        bg: 'bg-qb-green',
        screens: [
          { id: 'social-calendar', label: 'Calendar', type: 'list' },
          { id: 'social-channels', label: 'Channels', type: 'list' },
          { id: 'social-create', label: 'Create', type: 'wizard' },
          { id: 'social-library', label: 'Library', type: 'list' },
          { id: 'social-performance', label: 'Performance', type: 'list' },
          { id: 'social-queue', label: 'Queue', type: 'list' },
        ],
      },
      {
        name: 'Promotions',
        icon: 'sell',
        bg: 'bg-primary',
        screens: [
          { id: 'promotions', label: 'Discounts & Promo Rules', type: 'list' },
          { id: 'newsletter', label: 'Newsletter', type: 'list' },
          { id: 'automation', label: 'Automation', type: 'list' },
        ],
      },
    ],
  },
  catalog: {
    label: 'Catalog',
    icon: 'inventory_2',
    groups: [
      {
        name: 'Catalog Overview',
        icon: 'play_circle',
        bg: 'bg-qb-navy',
        screens: [{ id: 'catalog-overview', label: 'Overview', type: 'overview' }],
      },
      {
        name: 'Design Studio',
        icon: 'palette',
        bg: 'bg-qb-maroon',
        screens: [
          { id: 'studio', label: 'Konva Studio', type: 'wizard' },
          { id: 'new-design', label: 'New design', type: 'wizard' },
          { id: 'collection', label: 'Collection', type: 'list' },
          { id: 'published', label: 'Published', type: 'list' },
        ],
      },
      {
        name: 'Products & Variants',
        icon: 'checkroom',
        bg: 'bg-qb-green',
        screens: [
          { id: 'products', label: 'Published Items & SKUs', type: 'list' },
          { id: 'bundles', label: 'Bundles', type: 'list' },
          { id: 'review', label: 'Review', type: 'list' },
          { id: 'categories', label: 'Categories', type: 'list' },
          { id: 'catalog-parties', label: 'Suppliers / Vendors / Sellers', type: 'list' },
        ],
      },
      {
        name: 'Channels',
        icon: 'hub',
        bg: 'bg-qb-teal',
        screens: [
          { id: 'ecommerce', label: 'Ecommerce', type: 'list' },
          { id: 'tiktok', label: 'TikTok', type: 'list' },
          { id: 'amazon', label: 'Amazon', type: 'list' },
          { id: 'facebook-marketplace', label: 'Facebook Marketplace', type: 'list' },
          { id: 'whatnot', label: 'What Not', type: 'list' },
          { id: 'etsy', label: 'Etsy', type: 'list' },
          { id: 'ebay', label: 'Ebay', type: 'list' },
          { id: 'website-cms', label: 'Website / CMS', type: 'list' },
        ],
      },
    ],
  },
  orders: {
    label: 'Orders',
    icon: 'local_shipping',
    groups: [
      {
        name: 'Overview',
        icon: 'play_circle',
        bg: 'bg-qb-navy',
        screens: [{ id: 'orders-overview', label: 'Overview', type: 'overview' }],
      },
      {
        name: 'Order Management',
        icon: 'assignment',
        bg: 'bg-qb-teal',
        screens: [
          { id: 'orders', label: 'Orders', type: 'list' },
          { id: 'order-detail', label: 'Order detail', type: 'list' },
          { id: 'packing-slip', label: 'Packing slip', type: 'list' },
          { id: 'order-issues', label: 'Order Issues (Manual Push / Needs Attention)', type: 'list' },
        ],
      },
      {
        name: 'Purchasing',
        icon: 'shopping_bag',
        bg: 'bg-qb-maroon',
        screens: [
          { id: 'purchase-orders', label: 'Purchase Orders', type: 'list' },
          { id: 'fulfillment', label: 'Fulfillment', type: 'list' },
          { id: 'inventory', label: 'Inventory', type: 'list' },
          { id: 'fulfillment-queue', label: 'Fulfillment Queue', type: 'list' },
          { id: 'batch-slips', label: 'Batch Slips & Labels', type: 'list' },
        ],
      },
      {
        name: 'Returns',
        icon: 'assignment_return',
        bg: 'bg-error',
        screens: [{ id: 'returns', label: 'Returns & Claims', type: 'list' }],
      },
    ],
  },
  finance: {
    label: 'Finance',
    icon: 'account_balance',
    groups: [
      {
        name: 'Accounting',
        icon: 'play_arrow',
        bg: 'bg-qb-navy',
        screens: [
          { id: 'accounting', label: 'Overview', type: 'overview' },
          { id: 'bank', label: 'Bank transactions', type: 'list' },
          { id: 'receipts', label: 'Receipts', type: 'list' },
          { id: 'reconcile', label: 'Reconcile', type: 'wizard' },
          { id: 'rules', label: 'Rules', type: 'list' },
          { id: 'coa', label: 'Chart of accounts', type: 'list' },
          { id: 'reports', label: 'Reports', type: 'list' },
        ],
      },
      {
        name: 'Business Tax',
        icon: 'description',
        bg: 'bg-qb-maroon',
        screens: [
          { id: 'tax-overview', label: 'Overview', type: 'overview' },
          { id: 'tax-summary', label: 'Tax summary', type: 'list' },
          { id: 'tax-filing', label: 'Year-end and filing', type: 'list' },
        ],
      },
      {
        name: 'Expenses & Bills',
        icon: 'receipt',
        bg: 'bg-qb-green',
        screens: [
          { id: 'bills-overview', label: 'Overview', type: 'overview' },
          { id: 'expenses', label: 'Expense transactions', type: 'list' },
          { id: 'vendors', label: 'Vendors', type: 'list' },
          { id: 'bills', label: 'Bills', type: 'list' },
          { id: 'bill-payments', label: 'Bill payments', type: 'list' },
          { id: 'purchase-orders', label: 'Purchase orders', type: 'wizard' },
        ],
      },
      {
        name: 'Sales & Get Paid',
        icon: 'attach_money',
        bg: 'bg-qb-teal',
        screens: [
          { id: 'sales-overview', label: 'Overview', type: 'overview' },
          { id: 'sales-transactions', label: 'Sales transactions', type: 'list' },
          { id: 'invoices', label: 'Invoices', type: 'list' },
          { id: 'estimates', label: 'Estimates', type: 'list' },
          { id: 'payment-links', label: 'Payment links', type: 'list' },
          { id: 'products', label: 'Products & services', type: 'list' },
        ],
      },
      {
        name: 'Contacts',
        icon: 'groups',
        bg: 'bg-primary',
        screens: [
          { id: 'customer-overview', label: 'Overview', type: 'overview' },
          { id: 'parties', label: 'Parties', type: 'list' },
          { id: 'customers', label: 'Customers', type: 'list' },
          { id: 'statements', label: 'Statements', type: 'list' },
        ],
      },
      {
        name: 'Cap Table',
        icon: 'pie_chart',
        bg: 'bg-qb-navy',
        screens: [
          { id: 'cap-overview', label: 'Overview', type: 'overview' },
          { id: 'cap-table', label: 'Cap Table', type: 'list' },
          { id: 'cap-holders', label: 'Stakeholders', type: 'list' },
          { id: 'cap-rounds', label: 'Funding Rounds', type: 'list' },
          { id: 'cap-options', label: 'Option Pool', type: 'list' },
          { id: 'cap-safes', label: 'SAFEs & Convertibles', type: 'list' },
          { id: 'cap-dilution', label: 'Dilution Modeler', type: 'wizard' },
          { id: 'cap-waterfall', label: 'Liquidation Waterfall', type: 'wizard' },
          { id: 'cap-409a', label: '409A & Valuations', type: 'list' },
          { id: 'cap-documents', label: 'Documents', type: 'list' },
          { id: 'cap-equity-events', label: 'Equity Events', type: 'list' },
        ],
      },
    ],
  },
  contacts: {
    label: 'Contacts',
    icon: 'groups',
    groups: [
      {
        name: 'CRM Overview',
        icon: 'play_circle',
        bg: 'bg-qb-navy',
        screens: [{ id: 'crm-overview', label: 'Overview', type: 'overview' }],
      },
      {
        name: 'Parties',
        icon: 'people',
        bg: 'bg-qb-teal',
        screens: [
          { id: 'customers', label: 'Customer', type: 'list' },
          { id: 'vendors', label: 'Vendors', type: 'list' },
          { id: 'suppliers', label: 'Suppliers', type: 'list' },
        ],
      },
      {
        name: 'CRM Tools',
        icon: 'hub',
        bg: 'bg-qb-green',
        screens: [
          { id: 'leads', label: 'Leads', type: 'list' },
          { id: 'appointments', label: 'Appointments', type: 'list' },
          { id: 'segments', label: 'Segments', type: 'list' },
          { id: 'templates', label: 'Templates', type: 'list' },
        ],
      },
    ],
  },
  support: {
    label: 'Support',
    icon: 'support_agent',
    groups: [
      {
        name: 'Support Overview',
        icon: 'play_circle',
        bg: 'bg-qb-navy',
        screens: [{ id: 'support-overview', label: 'Overview', type: 'overview' }],
      },
      {
        name: 'Inbox & Tickets',
        icon: 'inbox',
        bg: 'bg-qb-teal',
        screens: [
          { id: 'tickets', label: 'Tickets', type: 'list' },
          { id: 'messages', label: 'Omnichannel Inbox', type: 'list' },
        ],
      },
      {
        name: 'SLA & Routing',
        icon: 'route',
        bg: 'bg-qb-maroon',
        screens: [
          { id: 'queues', label: 'Queues', type: 'list' },
          { id: 'sla', label: 'SLA rules', type: 'list' },
          { id: 'automations', label: 'Automations', type: 'list' },
        ],
      },
      {
        name: 'Trust & Safety',
        icon: 'shield',
        bg: 'bg-qb-green',
        screens: [
          { id: 'trust', label: 'Knowledge base', type: 'list' },
          { id: 'help-center', label: 'Help center', type: 'list' },
          { id: 'docs', label: 'Docs', type: 'list' },
          { id: 'policies', label: 'Policies', type: 'list' },
        ],
      },
    ],
  },
  settings: {
    label: 'Settings',
    icon: 'settings',
    groups: [
      // ── Home (top-level, matches HTML) ──
      {
        name: 'Home',
        icon: 'home',
        bg: 'bg-qb-navy',
        screens: [{ id: 'settings-overview', label: 'Settings Home', type: 'overview' }],
      },
      // ── Workspace (HTML) ──
      {
        name: 'Workspace',
        icon: 'workspaces',
        bg: 'bg-qb-teal',
        screens: [
          { id: 'ws-general', label: 'General', type: 'list' },
          { id: 'ws-teammates', label: 'Teammates', type: 'list' },
          { id: 'ws-owners', label: 'Workspace owners', type: 'list' },
          { id: 'ws-office-hours', label: 'Office hours', type: 'list' },
          { id: 'ws-brands', label: 'Brands', type: 'list' },
          { id: 'ws-security', label: 'Security', type: 'list' },
          { id: 'ws-multilingual', label: 'Multilingual', type: 'list' },
        ],
      },
      // ── Accounting & Finance (HTML) ──
      {
        name: 'Accounting & Finance',
        icon: 'account_balance',
        bg: 'bg-qb-green',
        screens: [
          { id: 'set-coa', label: 'Chart of Accounts', type: 'list' },
          { id: 'set-bank-rules', label: 'Bank Rules', type: 'list' },
          { id: 'set-recurring-templates', label: 'Recurring Templates', type: 'list' },
          { id: 'set-business-tax', label: 'Business Tax', type: 'list' },
          { id: 'set-reports-budgets', label: 'Reports & Budgets', type: 'list' },
          { id: 'set-financial', label: 'Financial Settings', type: 'list' },
        ],
      },
      // ── CRM & Contacts (HTML) ──
      {
        name: 'CRM & Contacts',
        icon: 'groups',
        bg: 'bg-qb-maroon',
        screens: [
          { id: 'set-customer-hub', label: 'Customer Hub', type: 'list' },
          { id: 'set-vendors-suppliers', label: 'Vendors & Suppliers', type: 'list' },
          { id: 'set-segments-lists', label: 'Segments & Lists', type: 'list' },
          { id: 'set-lead-capture', label: 'Lead Capture Forms', type: 'list' },
        ],
      },
      // ── Catalog & Design (HTML) ──
      {
        name: 'Catalog & Design',
        icon: 'palette',
        bg: 'bg-primary',
        screens: [
          { id: 'set-design-studio', label: 'Design Studio', type: 'list' },
          { id: 'set-products-bundles', label: 'Products & Bundles', type: 'list' },
          { id: 'set-pricing-discounts', label: 'Pricing & Discounts', type: 'list' },
          { id: 'set-categories-tags', label: 'Categories & Tags', type: 'list' },
        ],
      },
      // ── Marketing & Social (HTML) ──
      {
        name: 'Marketing & Social',
        icon: 'campaign',
        bg: 'bg-qb-teal',
        screens: [
          { id: 'set-social-channels', label: 'Social Channels', type: 'list' },
          { id: 'set-publishing-queue', label: 'Publishing Queue', type: 'list' },
          { id: 'set-newsletter-email', label: 'Newsletter & Email', type: 'list' },
          { id: 'set-ad-center', label: 'Ad Center', type: 'list' },
          { id: 'set-gmb', label: 'Google My Business', type: 'list' },
        ],
      },
      // ── Operations & Orders (HTML) ──
      {
        name: 'Operations & Orders',
        icon: 'local_shipping',
        bg: 'bg-qb-green',
        screens: [
          { id: 'set-fulfillment-shipping', label: 'Fulfillment & Shipping', type: 'list' },
          { id: 'set-inventory-warehouses', label: 'Inventory & Warehouses', type: 'list' },
          { id: 'set-support-channels', label: 'Support Channels', type: 'list' },
          { id: 'set-help-center', label: 'Help Center', type: 'list' },
          { id: 'set-outbound', label: 'Outbound', type: 'list' },
        ],
      },
      // ── EXTENSION: Dashboard & Analytics (not in HTML, gives Dashboard a home) ──
      {
        name: 'Dashboard & Analytics',
        icon: 'dashboard',
        bg: 'bg-qb-navy',
        screens: [
          { id: 'set-dashboards', label: 'Dashboards & widgets', type: 'list' },
          { id: 'set-kpi-targets', label: 'KPI targets', type: 'list' },
          { id: 'set-analytics-config', label: 'Analytics configuration', type: 'list' },
        ],
      },
      // ── EXTENSION: Support (not in HTML, gives Support domain a home) ──
      {
        name: 'Support',
        icon: 'support_agent',
        bg: 'bg-qb-maroon',
        screens: [
          { id: 'set-ticket-channels', label: 'Ticket channels', type: 'list' },
          { id: 'set-sla-policies', label: 'SLA policies', type: 'list' },
          { id: 'set-automation-rules', label: 'Automation rules', type: 'list' },
          { id: 'set-kb-config', label: 'Knowledge base', type: 'list' },
        ],
      },
      // ── EXTENSION: Connected Suppliers (not in HTML, gives pillar #8 a home) ──
      {
        name: 'Connected Suppliers',
        icon: 'hub',
        bg: 'bg-qb-teal',
        screens: [
          { id: 'set-supplier-portal', label: 'Supplier portal', type: 'list' },
          { id: 'set-integration-feeds', label: 'Integration feeds', type: 'list' },
          { id: 'set-contracts-config', label: 'Contracts & pricing', type: 'list' },
          { id: 'set-compliance-config', label: 'Compliance & 1099', type: 'list' },
        ],
      },
      // ── EXTENSION: Reports (not in HTML, gives Reports domain a home) ──
      {
        name: 'Reports',
        icon: 'assessment',
        bg: 'bg-primary',
        screens: [
          { id: 'set-report-templates', label: 'Report templates', type: 'list' },
          { id: 'set-scheduled-reports', label: 'Scheduled reports', type: 'list' },
          { id: 'set-report-dashboards', label: 'Report dashboards', type: 'list' },
        ],
      },
      // ── System & Personal (HTML) ──
      {
        name: 'System & Personal',
        icon: 'dns',
        bg: 'bg-error',
        screens: [
          { id: 'set-integrations', label: 'Integrations', type: 'list' },
          { id: 'set-data-privacy', label: 'Data & Privacy', type: 'list' },
          { id: 'set-notifications', label: 'Notifications', type: 'list' },
          { id: 'set-api-tokens', label: 'API Tokens', type: 'list' },
          { id: 'set-audit', label: 'Audit log', type: 'list' },
        ],
      },
    ],
  },
  // Reports — a standalone, cross-module view (NOT tied to accounting/finance).
  // Accessed only via the pinned Reports button in the icon rail. Broken down
  // by every module so each domain's reports live in their own group.
  reports: {
    label: 'Reports',
    icon: 'assessment',
    groups: [
      {
        name: 'Overview',
        icon: 'play_circle',
        bg: 'bg-qb-navy',
        screens: [{ id: 'reports-overview', label: 'Overview', type: 'overview' }],
      },
      {
        name: 'Dashboard reports',
        icon: 'dashboard',
        bg: 'bg-qb-teal',
        screens: [
          { id: 'report-ops-vitals', label: 'Operations Vitals report', type: 'list' },
          { id: 'report-exec-gmv', label: 'Executive GMV & Margins report', type: 'list' },
          { id: 'report-analytics', label: 'Analytics report', type: 'list' },
        ],
      },
      {
        name: 'Contacts reports',
        icon: 'groups',
        bg: 'bg-qb-green',
        screens: [
          { id: 'report-customers', label: 'Customers report', type: 'list' },
          { id: 'report-vendors', label: 'Vendors report', type: 'list' },
          { id: 'report-suppliers', label: 'Suppliers report', type: 'list' },
          { id: 'report-leads', label: 'Leads & pipeline report', type: 'list' },
        ],
      },
      {
        name: 'Catalog reports',
        icon: 'inventory_2',
        bg: 'bg-qb-maroon',
        screens: [
          { id: 'report-products', label: 'Products & SKUs report', type: 'list' },
          { id: 'report-bundles', label: 'Bundles report', type: 'list' },
          { id: 'report-channels', label: 'Channel performance report', type: 'list' },
          { id: 'report-designs', label: 'Designs & collections report', type: 'list' },
        ],
      },
      {
        name: 'Orders reports',
        icon: 'local_shipping',
        bg: 'bg-primary',
        screens: [
          { id: 'report-orders', label: 'Orders report', type: 'list' },
          { id: 'report-fulfillment', label: 'Fulfillment report', type: 'list' },
          { id: 'report-inventory', label: 'Inventory report', type: 'list' },
          { id: 'report-returns', label: 'Returns & claims report', type: 'list' },
        ],
      },
      {
        name: 'Finance reports',
        icon: 'account_balance',
        bg: 'bg-qb-navy',
        screens: [
          { id: 'report-invoices', label: 'Invoices report', type: 'list' },
          { id: 'report-bills', label: 'Bills & expenses report', type: 'list' },
          { id: 'report-tax', label: 'Tax summary report', type: 'list' },
          { id: 'report-reconcile', label: 'Reconciliation report', type: 'list' },
        ],
      },
      {
        name: 'Marketing reports',
        icon: 'campaign',
        bg: 'bg-qb-teal',
        screens: [
          { id: 'report-social', label: 'Social performance report', type: 'list' },
          { id: 'report-promotions', label: 'Promotions report', type: 'list' },
          { id: 'report-newsletter', label: 'Newsletter report', type: 'list' },
          { id: 'report-cms', label: 'CMS & editorial report', type: 'list' },
        ],
      },
      {
        name: 'Support reports',
        icon: 'support_agent',
        bg: 'bg-qb-green',
        screens: [
          { id: 'report-tickets', label: 'Tickets report', type: 'list' },
          { id: 'report-sla', label: 'SLA report', type: 'list' },
          { id: 'report-trust', label: 'Trust & safety report', type: 'list' },
        ],
      },
    ],
  },
  // Connected Suppliers — standalone pillar #8 in the Navigation Hub flyout.
  // NOT in the PINNED icon rail; accessed only via the flyout. Unified view
  // of the supply-chain partner network: directory, integration feeds,
  // onboarding, contracts, and compliance.
  'connected-suppliers': {
    label: 'Connected Suppliers',
    icon: 'hub',
    groups: [
      {
        name: 'Overview',
        icon: 'play_circle',
        bg: 'bg-qb-navy',
        screens: [{ id: 'suppliers-overview', label: 'Overview', type: 'overview' }],
      },
      {
        name: 'Supplier Directory',
        icon: 'groups',
        bg: 'bg-qb-teal',
        screens: [
          { id: 'suppliers-directory', label: 'All suppliers', type: 'list' },
          { id: 'suppliers-vendors', label: 'Vendors', type: 'list' },
          { id: 'suppliers-sellers', label: 'Sellers', type: 'list' },
        ],
      },
      {
        name: 'Integration Feeds',
        icon: 'extension',
        bg: 'bg-qb-green',
        screens: [
          { id: 'feed-printful', label: 'Printful API', type: 'list' },
          { id: 'feed-printify', label: 'Printify Network', type: 'list' },
          { id: 'feed-gelato', label: 'Gelato Global', type: 'list' },
          { id: 'feed-stripe', label: 'Stripe Connect & Clearing', type: 'list' },
          { id: 'feed-receipts', label: 'Receipts Intake (OCR)', type: 'list' },
        ],
      },
      {
        name: 'Onboarding',
        icon: 'how_to_reg',
        bg: 'bg-qb-maroon',
        screens: [
          { id: 'onboarding-vendor-portal', label: 'Vendor portal', type: 'list' },
          { id: 'onboarding-requests', label: 'Onboarding requests', type: 'list' },
          { id: 'onboarding-approvals', label: 'Approvals', type: 'list' },
        ],
      },
      {
        name: 'Contracts & Pricing',
        icon: 'handshake',
        bg: 'bg-primary',
        screens: [
          { id: 'contracts', label: 'Contracts', type: 'list' },
          { id: 'pricing-tiers', label: 'Pricing tiers', type: 'list' },
          { id: 'terms', label: 'Terms & SLAs', type: 'list' },
        ],
      },
      {
        name: 'Compliance',
        icon: 'verified',
        bg: 'bg-error',
        screens: [
          { id: 'compliance-certifications', label: 'Certifications', type: 'list' },
          { id: 'compliance-1099', label: '1099 / Tax', type: 'list' },
          { id: 'compliance-audit', label: 'Audit trail', type: 'list' },
        ],
      },
    ],
  },
};

export const PINNED: DomainKey[] = [
  'dashboard',
  'contacts',
  'catalog',
  'orders',
  'finance',
  'marketing',
  'support',
];

export function screensOf(domain: DomainConfig): ScreenWithGroup[] {
  return domain.groups.flatMap((g) => g.screens.map((s) => ({ ...s, group: g.name })));
}

export function findScreen(domainId: DomainKey, screenId: string): ScreenWithGroup {
  const all = screensOf(DOMAINS[domainId]);
  return all.find((s) => s.id === screenId) || all[0];
}

export const SCREEN_HEADERS: Record<
  string,
  { title: string; subtitle: string; family: string; newLabel: string }
> = {
  invoices: { title: 'Invoices', subtitle: 'All invoices across customers.', family: 'sales', newLabel: 'Invoice' },
  expenses: { title: 'Expense transactions', subtitle: 'Bills, expenses, checks, credits.', family: 'expense', newLabel: 'Expense' },
  bills: { title: 'Bills', subtitle: 'Vendor bills — For review / Unpaid / Paid.', family: 'expense', newLabel: 'Bill' },
  customers: { title: 'Customers', subtitle: 'Party list — role=Customer.', family: 'party', newLabel: 'Customer' },
  vendors: { title: 'Vendors', subtitle: 'Party list — role=Vendor.', family: 'party', newLabel: 'Vendor' },
  products: { title: 'Products & services', subtitle: 'Catalog — same list as Catalog > Products.', family: 'catalog', newLabel: 'Product' },
  sales_transactions: { title: 'Sales transactions', subtitle: 'Invoice, Receipt, Credit, Payment.', family: 'sales', newLabel: 'Sale' },
  bank: { title: 'Bank transactions', subtitle: 'For review feed + Rules.', family: 'banking', newLabel: 'Deposit' },
  coa: { title: 'Chart of accounts', subtitle: 'Number, Name, Type, Balance.', family: 'accounting', newLabel: 'Account' },
  reports: { title: 'Reports', subtitle: 'Standard + custom reports.', family: 'reports', newLabel: 'Report' },
  products_services: { title: 'Products & services', subtitle: 'Same list as Finance.', family: 'catalog', newLabel: 'Product' },
  payment_links: { title: 'Payment links', subtitle: 'Share link or QR.', family: 'sales', newLabel: 'Payment link' },
  estimates: { title: 'Estimates', subtitle: 'Convert to Invoice.', family: 'sales', newLabel: 'Estimate' },
  statements: { title: 'Statements', subtitle: 'Batch billing summary.', family: 'sales', newLabel: 'Statement' },
  receipts: { title: 'Receipts', subtitle: 'Intake inbox — forward, drop, snap.', family: 'intake', newLabel: 'Receipt' },
  reconcile: { title: 'Reconcile', subtitle: 'Setup, then tie-out workspace.', family: 'wizard', newLabel: 'Reconcile' },
  rules: { title: 'Rules', subtitle: 'Bank rules.', family: 'accounting', newLabel: 'Rule' },
  tax_summary: { title: 'Tax summary', subtitle: 'Income / deductions / assets.', family: 'tax', newLabel: 'Tax summary' },
  tax_filing: { title: 'Year-end and filing', subtitle: 'Feature-gated page.', family: 'tax', newLabel: 'File' },
  bill_payments: { title: 'Bill payments', subtitle: 'Pay bills workspace.', family: 'expense', newLabel: 'Payment' },
  trust: { title: 'Trust & Safety', subtitle: 'Inspection and enforcement.', family: 'support', newLabel: 'Case' },
};

export type DemoRow = Record<string, string | number>;

export const DEMO_ROWS: Record<string, DemoRow[]> = {
  invoices: [
    { no: '1002', date: '11/01/2026', party: 'Acme Corp', due: '12/01/2026', amount: '$1,240.00', balance: '$1,240.00', status: 'Open' },
    { no: '1001', date: '10/28/2026', party: 'Blue Ridge Co.', due: '11/27/2026', amount: '$3,410.00', balance: '$0.00', status: 'Paid' },
    { no: '0998', date: '10/15/2026', party: 'Maple Supply', due: '11/14/2026', amount: '$890.00', balance: '$890.00', status: 'Overdue' },
    { no: '0996', date: '10/02/2026', party: 'Northwind Labs', due: '11/01/2026', amount: '$2,100.00', balance: '$2,100.00', status: 'Open' },
    { no: '0994', date: '09/20/2026', party: 'Orion Apparel', due: '10/20/2026', amount: '$540.00', balance: '$0.00', status: 'Paid' },
  ],
  bills: [
    { vendor: 'Printful', billno: 'PF-9211', due: '11/10/2026', amount: '$2,880.00', status: 'For review' },
    { vendor: 'Gelato', billno: 'GL-4402', due: '11/15/2026', amount: '$1,200.00', status: 'Unpaid' },
    { vendor: 'Printify', billno: 'PR-3388', due: '10/30/2026', amount: '$640.00', status: 'Paid' },
  ],
  expenses: [
    { date: '10/30/2026', payee: 'Adobe', category: 'Software', paid: 'Visa •4421', amount: '$59.99', receipt: '✓' },
    { date: '10/29/2026', payee: 'FedEx', category: 'Shipping', paid: 'Bank •9910', amount: '$84.20', receipt: '✓' },
    { date: '10/28/2026', payee: 'Staples', category: 'Office', paid: 'Visa •4421', amount: '$142.50', receipt: '—' },
  ],
  customers: [
    { name: 'Acme Corp', email: 'ap@acme.com', orders: 12, ltv: '$18,240', balance: '$1,240', last: '11/01/2026', consent: 'Yes' },
    { name: 'Blue Ridge Co.', email: 'billing@blueridge.co', orders: 5, ltv: '$9,810', balance: '$0', last: '10/28/2026', consent: 'Yes' },
    { name: 'Maple Supply', email: 'ar@maplesupply.io', orders: 2, ltv: '$1,780', balance: '$890', last: '10/15/2026', consent: 'No' },
  ],
  vendors: [
    { name: 'Printful', role: 'Supplier', open: '$2,880', ytd: '$42,100', tax: '1099 —', sla: '99.1%' },
    { name: 'Gelato', role: 'Supplier', open: '$1,200', ytd: '$18,400', tax: '1099 —', sla: '98.4%' },
    { name: 'Printify', role: 'Supplier', open: '$0', ytd: '$31,900', tax: '1099 —', sla: '99.6%' },
  ],
  products: [
    { name: 'Classic Tee', sku: 'TEE-001', supplier: 'Printful', price: '$24.00', margin: '62%', status: 'Published' },
    { name: 'Canvas Tote', sku: 'TOTE-014', supplier: 'Gelato', price: '$18.00', margin: '55%', status: 'Published' },
    { name: 'Mug 11oz', sku: 'MUG-003', supplier: 'Printify', price: '$14.00', margin: '48%', status: 'Draft' },
  ],
};

export interface ColumnDef {
  key: string;
  label: string;
  right?: boolean;
}

export interface ListScreenConfig {
  mode: 'list';
  key: string;
  title: string;
  subtitle: string;
  family: string;
  newLabel: string;
  tabs?: string[];
  cols: ColumnDef[];
  createActionsRow?: [string, string][];
  emptyTitle?: string;
  emptySteps?: string;
}

export interface OverviewKpi {
  label: string;
  value: string;
  delta?: string;
}

export interface OverviewScreenConfig {
  mode: 'overview';
  title: string;
  subtitle: string;
  kpis?: OverviewKpi[];
  actions?: [string, string][];
  panelTitle?: string;
  panelText?: string;
}

export type ScreenDefinition = ListScreenConfig | OverviewScreenConfig;

export const SCREEN_DEFS: Record<string, ScreenDefinition> = {
  invoices: {
    mode: 'list',
    key: 'invoices',
    title: 'Invoices',
    subtitle: 'All invoices across customers.',
    family: 'document',
    newLabel: 'Invoice',
    tabs: ['All', 'Open', 'Overdue', 'Paid'],
    cols: [
      { key: 'no', label: 'No.' },
      { key: 'date', label: 'Date' },
      { key: 'party', label: 'Customer' },
      { key: 'due', label: 'Due' },
      { key: 'amount', label: 'Amount', right: true },
      { key: 'balance', label: 'Balance', right: true },
      { key: 'status', label: 'Status' },
    ],
    createActionsRow: [
      ['Invoice', 'receipt_long'],
      ['Receive payment', 'price_check'],
      ['Estimate', 'request_quote'],
      ['Customer', 'person_add'],
    ],
  },
  bills: {
    mode: 'list',
    key: 'bills',
    title: 'Bills',
    subtitle: 'Vendor bills — For review / Unpaid / Paid.',
    family: 'document',
    newLabel: 'Bill',
    tabs: ['For review', 'Unpaid', 'Paid', 'All'],
    cols: [
      { key: 'vendor', label: 'Vendor' },
      { key: 'billno', label: 'Bill no.' },
      { key: 'due', label: 'Due' },
      { key: 'amount', label: 'Amount', right: true },
      { key: 'status', label: 'Status' },
    ],
  },
  expenses: {
    mode: 'list',
    key: 'expenses',
    title: 'Expense transactions',
    subtitle: 'Bills, expenses, checks, credits.',
    family: 'document',
    newLabel: 'Expense',
    tabs: ['All', 'Bills', 'Expenses', 'Checks', 'Credits'],
    cols: [
      { key: 'date', label: 'Date' },
      { key: 'payee', label: 'Payee' },
      { key: 'category', label: 'Category' },
      { key: 'paid', label: 'Paid from' },
      { key: 'amount', label: 'Amount', right: true },
      { key: 'receipt', label: 'Receipt' },
    ],
  },
  customers: {
    mode: 'list',
    key: 'customers',
    title: 'Customers',
    subtitle: 'Party list — role=Customer.',
    family: 'party',
    newLabel: 'Customer',
    tabs: ['All', 'Active', 'New', 'Recurring', 'Inactive', 'Needs follow-up'],
    cols: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'orders', label: 'Orders', right: true },
      { key: 'ltv', label: 'LTV', right: true },
      { key: 'balance', label: 'Balance', right: true },
      { key: 'last', label: 'Last order' },
      { key: 'consent', label: 'Marketing consent' },
    ],
    createActionsRow: [
      ['Customer', 'person_add'],
      ['Vendor', 'domain_add'],
      ['Supplier', 'local_shipping'],
      ['Contractor', 'engineering'],
    ],
  },
  vendors: {
    mode: 'list',
    key: 'vendors',
    title: 'Vendors',
    subtitle: 'Party list — role=Vendor.',
    family: 'party',
    newLabel: 'Vendor',
    tabs: ['All', 'Suppliers', 'Contractors', '1099'],
    cols: [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role' },
      { key: 'open', label: 'Open bills', right: true },
      { key: 'ytd', label: 'YTD paid', right: true },
      { key: 'tax', label: '1099' },
      { key: 'sla', label: 'SLA', right: true },
    ],
  },
  products: {
    mode: 'list',
    key: 'products',
    title: 'Products & services',
    subtitle: 'Same list as Catalog > Products.',
    family: 'catalog',
    newLabel: 'Product',
    tabs: ['All', 'Published', 'Draft', 'Archived'],
    cols: [
      { key: 'name', label: 'Name' },
      { key: 'sku', label: 'SKU' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'price', label: 'Price', right: true },
      { key: 'margin', label: 'Margin', right: true },
      { key: 'status', label: 'Status' },
    ],
  },
  sales_overview: {
    mode: 'overview',
    title: 'Sales & Get Paid — Overview',
    subtitle: 'Payment-request funnel: Not paid / Paid / Deposited.',
    kpis: [
      { label: 'Not paid', value: '$8,420', delta: '+12%' },
      { label: 'Paid', value: '$24,180', delta: '+8%' },
      { label: 'Deposited', value: '$22,900', delta: '+6%' },
      { label: 'Avg. days to pay', value: '14.2', delta: '−1.3' },
    ],
    actions: [
      ['Invoice', 'receipt_long'],
      ['Receive payment', 'price_check'],
      ['Payment link', 'link'],
      ['Estimate', 'request_quote'],
    ],
    panelTitle: 'Payment funnel',
    panelText: 'Not paid → Paid → Deposited breakdown appears here as a funnel visualization.',
  },
  expenses_overview: {
    mode: 'overview',
    title: 'Expenses & Bills — Overview',
    subtitle: 'Bills, expense transactions, vendors, bill payments.',
    kpis: [
      { label: 'Bills due', value: '$4,080', delta: '3 bills' },
      { label: 'Expenses MTD', value: '$1,840', delta: '+4%' },
      { label: 'Vendors', value: '42', delta: '' },
      { label: '1099 pending', value: '6', delta: '' },
    ],
    actions: [
      ['Bill', 'description'],
      ['Expense', 'credit_card'],
      ['Pay bills', 'account_balance_wallet'],
      ['Vendor', 'domain_add'],
    ],
    panelTitle: 'Receipts inbox',
    panelText: 'Drop, upload, or snap a receipt. Forwarding address: receipts@managekube.unsaid.app.',
  },
  tax_overview: {
    mode: 'overview',
    title: 'Business Tax — Overview',
    subtitle: 'Tax deadlines, taxable profit estimate, create actions.',
    kpis: [
      { label: 'Est. taxable profit', value: '$18,240', delta: '' },
      { label: 'Next deadline', value: 'Jan 15, 2027', delta: 'Q4 estimated' },
      { label: 'Sales tax payable', value: '$1,880', delta: '' },
      { label: 'Mapped accounts', value: '31 / 34', delta: '' },
    ],
    actions: [
      ['Tax summary', 'description'],
      ['File', 'upload_file'],
    ],
    panelTitle: 'Map accounts task',
    panelText: 'Map income/expense accounts to tax categories before filing.',
  },
  customers_overview: {
    mode: 'overview',
    title: 'Contacts — Overview',
    subtitle: 'Customers, parties, statements.',
    kpis: [
      { label: 'Total customers', value: '184', delta: '+9' },
      { label: 'Active', value: '142', delta: '' },
      { label: 'At risk', value: '11', delta: '' },
      { label: 'Outstanding balance', value: '$8,420', delta: '' },
    ],
    actions: [
      ['Customer', 'person_add'],
      ['Estimate', 'request_quote'],
      ['Statement', 'summarize'],
    ],
    panelTitle: 'Top customers by LTV',
    panelText: 'Ranked list of customers by lifetime value.',
  },
};

export interface DrawerField {
  label: string;
  type: string;
  placeholder?: string;
  value?: string;
}

export const DRAWER_FIELDS: Record<string, DrawerField[]> = {
  Invoice: [
    { label: 'Customer', type: 'text', placeholder: 'Add customer' },
    { label: 'Invoice no.', type: 'text', value: '1003' },
    { label: 'Terms', type: 'text', value: 'Net 30' },
    { label: 'Invoice date', type: 'date', value: '2026-11-01' },
    { label: 'Due date', type: 'date', value: '2026-12-01' },
  ],
  Customer: [
    { label: 'Company name', type: 'text' },
    { label: 'Display name', type: 'text' },
    { label: 'First name', type: 'text' },
    { label: 'Last name', type: 'text' },
    { label: 'Email', type: 'email' },
    { label: 'Phone', type: 'tel' },
  ],
  Vendor: [
    { label: 'Company name', type: 'text' },
    { label: 'Email', type: 'email' },
    { label: 'Terms', type: 'text', value: 'Net 30' },
    { label: 'Default expense account', type: 'text' },
  ],
  Product: [
    { label: 'Name', type: 'text' },
    { label: 'Type', type: 'text', value: 'Product' },
    { label: 'SKU', type: 'text' },
    { label: 'Sales price', type: 'number' },
  ],
};

export type CreateDotToken =
  | 'bg-primary'
  | 'bg-secondary'
  | 'bg-tertiary'
  | 'bg-qb-navy'
  | 'bg-primary-container'
  | 'bg-error';

export interface CreateRegistryCategory {
  title: string;
  dot: CreateDotToken;
  items: { label: string; desc: string; icon: string }[];
}

export const CREATE_REGISTRY: CreateRegistryCategory[] = [
  {
    title: 'Customers',
    dot: 'bg-primary',
    items: [
      { label: 'Invoice', desc: 'Document engine — Edit/Email/Payor/PDF', icon: 'receipt_long' },
      { label: 'Payment link', desc: 'Amount, description, share link/QR', icon: 'link' },
      { label: 'Receive payment', desc: 'Apply to open invoices', icon: 'price_check' },
      { label: 'Statement', desc: 'Batch billing summary', icon: 'summarize' },
      { label: 'Estimate', desc: 'Convert to Invoice', icon: 'request_quote' },
      { label: 'Sales receipt', desc: 'Instant settlement', icon: 'point_of_sale' },
      { label: 'Credit memo', desc: 'RMA / reduction', icon: 'assignment_return' },
      { label: 'Add customer', desc: 'Party drawer, role=Customer', icon: 'person_add' },
    ],
  },
  {
    title: 'Vendors & Suppliers',
    dot: 'bg-secondary',
    items: [
      { label: 'Expense', desc: 'Payee, date, paid-from, category', icon: 'credit_card' },
      { label: 'Check', desc: 'Print later option', icon: 'payments' },
      { label: 'Bill', desc: 'Capture panel, Tags toggle', icon: 'description' },
      { label: 'Pay bills', desc: 'Payment workspace', icon: 'account_balance_wallet' },
      { label: 'Purchase order', desc: 'Blank/SKU lines', icon: 'shopping_bag' },
      { label: 'Vendor credit', desc: 'Supplier refund', icon: 'savings' },
      { label: 'Add vendor', desc: 'Party drawer, role=Vendor', icon: 'domain_add' },
      { label: 'Add supplier', desc: 'Party drawer, role=Supplier', icon: 'factory' },
    ],
  },
  {
    title: 'Team',
    dot: 'bg-tertiary',
    items: [
      { label: 'Add contractor', desc: 'Name, email, W-9 invite', icon: 'engineering' },
      { label: 'Time entry', desc: 'Optional, later', icon: 'schedule' },
    ],
  },
  {
    title: 'Other (books)',
    dot: 'bg-qb-navy',
    items: [
      { label: 'Task', desc: 'Quick to-do', icon: 'task' },
      { label: 'Bank deposit', desc: 'Combine funds', icon: 'account_balance' },
      { label: 'Journal entry', desc: 'Double-entry debit/credit', icon: 'menu_book' },
      { label: 'Transfer', desc: 'Inter-account treasury', icon: 'swap_horiz' },
      { label: 'Reconcile', desc: 'Setup + tie-out', icon: 'fact_check' },
      { label: 'Settlement', desc: 'Stripe/Shopify split', icon: 'assured_workload' },
      { label: 'Add product/service', desc: 'Drawer w/ Sales/Purchasing/Accounting', icon: 'checkroom' },
      { label: 'Add account', desc: 'CoA drawer', icon: 'account_tree' },
    ],
  },
  {
    title: 'Catalog & Marketing',
    dot: 'bg-primary-container',
    items: [
      { label: 'Design', desc: 'Konva studio', icon: 'palette' },
      { label: 'Product', desc: 'Open Studio from drawer', icon: 'checkroom' },
      { label: 'Collection', desc: 'Canvas builder', icon: 'collections_bookmark' },
      { label: 'Category', desc: 'Record drawer', icon: 'category' },
      { label: 'Banner', desc: 'Storefront slot', icon: 'view_carousel' },
      { label: 'Popup', desc: 'Creative popup', icon: 'open_in_new' },
      { label: 'Discount code', desc: 'Type, value, window', icon: 'sell' },
      { label: 'Campaign', desc: 'Meta/TikTok/Google Ads', icon: 'campaign' },
      { label: 'Post', desc: 'Multi-channel content', icon: 'share' },
      { label: 'Newsletter', desc: 'Campaign builder', icon: 'mail' },
    ],
  },
  {
    title: 'Support & Orders',
    dot: 'bg-error',
    items: [
      { label: 'Sales order', desc: 'Order document', icon: 'shopping_cart_checkout' },
      { label: 'Return/RMA', desc: 'Return authorization', icon: 'assignment_return' },
      { label: 'Ticket', desc: 'Support ticket', icon: 'confirmation_number' },
      { label: 'Add note', desc: 'Quick note', icon: 'note_add' },
      { label: 'Void', desc: 'Void a transaction', icon: 'block' },
    ],
  },
];
