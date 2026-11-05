'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  AttentionQueueItem,
  CustomerQueueItem,
  DEFAULT_PINNED_CREATE_ACTIONS,
  INITIAL_ATTENTION_QUEUE,
  INITIAL_CUSTOMER_QUEUE,
  INITIAL_SELLER_QUEUE,
  INITIAL_SETUP_STEPS,
  SellerQueueItem,
  SetupStepItem,
} from '@/data/dashboardData';
import { DemoRow, DomainKey } from '@/data/shellData';
import { ExecutiveGmvView, OperationsVitalsView } from './OverviewViews';
import { AnalyticsExplorerView, AnalyticsOverviewView } from './AnalyticsViews';
import {
  AttentionQueueView,
  CustomerQueueView,
  SellerQueueView,
} from './QueueViews';
import {
  CompanySetupWizardModal,
  ContractorInviteModal,
  CreateActionsCustomizerDrawer,
  QuickTaskModal,
} from './DashboardModals';

export const DASHBOARD_SCREEN_IDS = new Set<string>([
  'ops',
  'exec',
  'analytics',
  'explorer',
  'attention',
  'customer-queue',
  'seller-queue',
]);
export function useDashboardController() {
  const [setupSteps, setSetupSteps] =
    useState<SetupStepItem[]>(INITIAL_SETUP_STEPS);
  const [pinnedCreateActions, setPinnedCreateActions] = useState<string[]>(
    DEFAULT_PINNED_CREATE_ACTIONS
  );
  const [attentionItems, setAttentionItems] = useState<AttentionQueueItem[]>(
    INITIAL_ATTENTION_QUEUE
  );
  const [customerQueueItems, setCustomerQueueItems] = useState<
    CustomerQueueItem[]
  >(INITIAL_CUSTOMER_QUEUE);
  const [sellerQueueItems, setSellerQueueItems] =
    useState<SellerQueueItem[]>(INITIAL_SELLER_QUEUE);

  const [setupWizardStepIndex, setSetupWizardStepIndex] = useState<
    number | null
  >(null);
  const [customizeCreateOpen, setCustomizeCreateOpen] = useState<boolean>(false);
  const [contractorModalOpen, setContractorModalOpen] = useState<boolean>(false);
  const [quickTaskModalOpen, setQuickTaskModalOpen] = useState<boolean>(false);

  const openSetupWizard = useCallback((stepIdx = 0) => {
    setSetupWizardStepIndex(stepIdx);
  }, []);

  const closeSetupWizard = useCallback(() => {
    setSetupWizardStepIndex(null);
  }, []);

  const resolveAttentionItem = useCallback((id: string) => {
    setAttentionItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, status: 'Resolved', slaRemaining: 'Completed' }
          : it
      )
    );
  }, []);

  const addAttentionTask = useCallback((item: AttentionQueueItem) => {
    setAttentionItems((prev) => [item, ...prev]);
  }, []);

  const addSellerInvite = useCallback((item: SellerQueueItem) => {
    setSellerQueueItems((prev) => [item, ...prev]);
  }, []);

  const queueBadges = useMemo<Record<string, number>>(
    () => ({
      attention: attentionItems.filter((i) => i.status !== 'Resolved').length,
      'customer-queue': customerQueueItems.filter((i) => i.status !== 'Resolved')
        .length,
      'seller-queue': sellerQueueItems.filter((i) => i.status !== 'Approved')
        .length,
    }),
    [attentionItems, customerQueueItems, sellerQueueItems]
  );

  return {
    setupSteps,
    setSetupSteps,
    pinnedCreateActions,
    setPinnedCreateActions,
    attentionItems,
    setAttentionItems,
    customerQueueItems,
    setCustomerQueueItems,
    sellerQueueItems,
    setSellerQueueItems,
    setupWizardStepIndex,
    openSetupWizard,
    closeSetupWizard,
    customizeCreateOpen,
    setCustomizeCreateOpen,
    contractorModalOpen,
    setContractorModalOpen,
    quickTaskModalOpen,
    setQuickTaskModalOpen,
    resolveAttentionItem,
    addAttentionTask,
    addSellerInvite,
    queueBadges,
  };
}

export type DashboardController = ReturnType<typeof useDashboardController>;

export function DashboardOverlays({
  controller,
  onToast,
}: {
  controller: DashboardController;
  onToast: (msg: string) => void;
}) {
  return (
    <>
      {controller.setupWizardStepIndex !== null && (
        <CompanySetupWizardModal
          steps={controller.setupSteps}
          initialStepIndex={controller.setupWizardStepIndex}
          onSaveSteps={controller.setSetupSteps}
          onClose={controller.closeSetupWizard}
          onToast={onToast}
        />
      )}

      {controller.customizeCreateOpen && (
        <CreateActionsCustomizerDrawer
          pinnedLabels={controller.pinnedCreateActions}
          onSave={controller.setPinnedCreateActions}
          onClose={() => controller.setCustomizeCreateOpen(false)}
          onToast={onToast}
        />
      )}

      {controller.contractorModalOpen && (
        <ContractorInviteModal
          onInvite={controller.addSellerInvite}
          onClose={() => controller.setContractorModalOpen(false)}
          onToast={onToast}
        />
      )}

      {controller.quickTaskModalOpen && (
        <QuickTaskModal
          onAddTask={controller.addAttentionTask}
          onClose={() => controller.setQuickTaskModalOpen(false)}
          onToast={onToast}
        />
      )}
    </>
  );
}

export default function DashboardScreenRenderer({
  screenId,
  controller,
  onNavigate,
  onCreate,
  onOpenCreateFlyout,
  onOpenPeek,
  onToast,
}: {
  screenId: string;
  controller: DashboardController;
  onNavigate: (domain: DomainKey, screenId: string) => void;
  onCreate: (label: string) => void;
  onOpenCreateFlyout: () => void;
  onOpenPeek: (row: DemoRow, family: string) => void;
  onToast: (msg: string) => void;
}) {
  if (screenId === 'exec') {
    // Executive GMV & Margins is folded into the ops overview — redirect to ops.
    return (
      <ExecutiveGmvView
        pinnedCreateActions={controller.pinnedCreateActions}
        onOpenCustomizeCreate={() => controller.setCustomizeCreateOpen(true)}
        onNavigate={onNavigate}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
        onOpenPeek={onOpenPeek}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'analytics') {
    return (
      <AnalyticsOverviewView
        onNavigate={onNavigate}
        onOpenPeek={onOpenPeek}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'explorer') {
    return (
      <AnalyticsExplorerView
        onNavigate={onNavigate}
        onOpenPeek={onOpenPeek}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'attention') {
    return (
      <AttentionQueueView
        items={controller.attentionItems}
        onUpdateItems={controller.setAttentionItems}
        onOpenNewTaskModal={() => controller.setQuickTaskModalOpen(true)}
        onNavigate={onNavigate}
        onCreate={onCreate}
        onOpenPeek={onOpenPeek}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'customer-queue') {
    return (
      <CustomerQueueView
        items={controller.customerQueueItems}
        onUpdateItems={controller.setCustomerQueueItems}
        onNavigate={onNavigate}
        onCreate={onCreate}
        onOpenPeek={onOpenPeek}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'seller-queue') {
    return (
      <SellerQueueView
        items={controller.sellerQueueItems}
        onUpdateItems={controller.setSellerQueueItems}
        onOpenContractorInvite={() => controller.setContractorModalOpen(true)}
        onNavigate={onNavigate}
        onCreate={onCreate}
        onOpenPeek={onOpenPeek}
        onToast={onToast}
      />
    );
  }

  return (
    <>
      <OperationsVitalsView
        setupSteps={controller.setupSteps}
        pinnedCreateActions={controller.pinnedCreateActions}
        attentionItems={controller.attentionItems}
        onOpenSetupWizard={controller.openSetupWizard}
        onOpenCustomizeCreate={() => controller.setCustomizeCreateOpen(true)}
        onResolveAttentionItem={controller.resolveAttentionItem}
        onNavigate={onNavigate}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
        onOpenPeek={onOpenPeek}
        onToast={onToast}
      />
      <ExecutiveGmvView
        pinnedCreateActions={controller.pinnedCreateActions}
        onOpenCustomizeCreate={() => controller.setCustomizeCreateOpen(true)}
        onNavigate={onNavigate}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
        onOpenPeek={onOpenPeek}
        onToast={onToast}
      />
    </>
  );
}
