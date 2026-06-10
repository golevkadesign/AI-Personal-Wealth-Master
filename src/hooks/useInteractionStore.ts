import { create } from 'zustand';
import { WorkbenchSessionSpec } from '../types/workbench';
import {
  createPromptWorkbenchSession,
  createWidgetCopilotWorkbenchSession,
} from '../lib/workbench-session';
import { createWorkbenchFactsDebugSnapshot } from '../lib/workbench-facts';
import {
  createWorkbenchRailDebugSnapshot,
  runWorkbenchRailOrchestration,
} from '../lib/workbench-rails';
import {
  createMemoryProjectionDebugSnapshot,
  hydrateWorkbenchMemoryProjection,
} from '../lib/workbench-memory';
import { useWealthStore } from './useWealthStore';

interface CopilotConfig {
  isOpen: boolean;
  title: string;
  data: any;
  role: string;
}

interface InteractionState {
  isDrawerOpen: boolean;
  pendingGlobalIntent: string | null;
  copilotConfig: CopilotConfig;
  activeWorkbenchSession: WorkbenchSessionSpec | null;
  setDrawerOpen: (isOpen: boolean) => void;
  openDrawerWithIntent: (intent: string) => void;
  clearPendingIntent: () => void;
  openCopilot: (title: string, data: any, role: string, sessionSpec?: WorkbenchSessionSpec) => void;
  closeCopilot: () => void;
  openWorkbench: (sessionSpec: WorkbenchSessionSpec) => void;
  closeWorkbench: () => void;
  closeWorkbenchForEntry: (entryType: WorkbenchSessionSpec['entryType']) => void;
}

const publishWorkbenchDebugSession = (sessionSpec: WorkbenchSessionSpec | null) => {
  if (typeof window === 'undefined') return;
  const isReviewContext = import.meta.env.DEV || window.location.search.includes('test=1');
  if (!isReviewContext) return;
  const railDebug = createWorkbenchRailDebugSnapshot(sessionSpec);
  const memoryProjectionDebug = createMemoryProjectionDebugSnapshot(sessionSpec);
  const renderWidgetCount = sessionSpec
    ? (sessionSpec.initialWidgets?.length || 0)
      + (sessionSpec.railRun?.railResults.flatMap((rail) => rail.widgetManifest).length || 0)
    : 0;
  if (typeof document !== 'undefined') {
    const factDebug = createWorkbenchFactsDebugSnapshot(sessionSpec);
    if (sessionSpec) {
      document.documentElement.dataset.arbitraWorkbenchEntry = sessionSpec.entryType;
      document.documentElement.dataset.arbitraWorkbenchTitle = sessionSpec.titleKey;
      document.documentElement.dataset.arbitraWorkbenchWidgetCount = String(sessionSpec.initialWidgets?.length || 0);
      document.documentElement.dataset.arbitraWorkbenchRenderWidgetCount = String(renderWidgetCount);
      document.documentElement.dataset.arbitraWorkbenchLegacySurface = sessionSpec.legacy?.surface || '';
      document.documentElement.dataset.arbitraWorkbenchFactConfidence = factDebug?.confidence || 'unknown';
      document.documentElement.dataset.arbitraWorkbenchFactSourceCount = String(factDebug?.sourceCount || 0);
      document.documentElement.dataset.arbitraWorkbenchFactMissingCount = String(factDebug?.missingFactCount || 0);
      document.documentElement.dataset.arbitraWorkbenchFactAccountCount = String(factDebug?.accountCount || 0);
      document.documentElement.dataset.arbitraWorkbenchFactPositionCount = String(factDebug?.positionCount || 0);
      document.documentElement.dataset.arbitraWorkbenchFactHoldingCount = String(factDebug?.publicHoldingCount || 0);
      document.documentElement.dataset.arbitraWorkbenchFactHasMarket = String(Boolean(factDebug?.hasMarketContext));
      document.documentElement.dataset.arbitraWorkbenchFactHasProfile = String(Boolean(factDebug?.hasSovereignProfile));
      document.documentElement.dataset.arbitraWorkbenchFactHasSelectedHolding = String(Boolean(factDebug?.hasSelectedHolding));
      document.documentElement.dataset.arbitraWorkbenchFactHasPrompt = String(Boolean(factDebug?.hasUserPrompt));
      document.documentElement.dataset.arbitraWorkbenchRailStatus = railDebug?.status || 'awaiting_context';
      document.documentElement.dataset.arbitraWorkbenchRailCount = String(railDebug?.railCount || 0);
      document.documentElement.dataset.arbitraWorkbenchRailReadyCount = String(railDebug?.readyCount || 0);
      document.documentElement.dataset.arbitraWorkbenchRailPartialCount = String(railDebug?.partialCount || 0);
      document.documentElement.dataset.arbitraWorkbenchRailBlockedCount = String(railDebug?.blockedCount || 0);
      document.documentElement.dataset.arbitraWorkbenchRailMissingCount = String(railDebug?.missingFactCount || 0);
      document.documentElement.dataset.arbitraWorkbenchRailStatuses = railDebug?.railStatuses || '';
      document.documentElement.dataset.arbitraWorkbenchMemoryPendingCount = String(memoryProjectionDebug?.memoryPendingCount || 0);
      document.documentElement.dataset.arbitraWorkbenchMemoryAcceptedCount = String(memoryProjectionDebug?.memoryAcceptedCount || 0);
      document.documentElement.dataset.arbitraWorkbenchMemoryRejectedCount = String(memoryProjectionDebug?.memoryRejectedCount || 0);
      document.documentElement.dataset.arbitraWorkbenchMemoryMergedCount = String(memoryProjectionDebug?.memoryMergedCount || 0);
      document.documentElement.dataset.arbitraWorkbenchProfileVersion = String(memoryProjectionDebug?.profileVersion || 0);
      document.documentElement.dataset.arbitraWorkbenchProjectionStatus = memoryProjectionDebug?.projectionStatus || 'awaiting_context';
      document.documentElement.dataset.arbitraWorkbenchProjectionWidgetCount = String(memoryProjectionDebug?.projectionWidgetCount || 0);
      document.documentElement.dataset.arbitraWorkbenchProjectionSourceCount = String(memoryProjectionDebug?.projectionSourceCount || 0);
      document.documentElement.dataset.arbitraWorkbenchProjectionTrace = memoryProjectionDebug?.projectionTrace || '';
      document.documentElement.dataset.arbitraWorkbenchPortfolioMapPositionCount = String(memoryProjectionDebug?.portfolioMapPositionCount || 0);
      document.documentElement.dataset.arbitraWorkbenchPortfolioMapMissingCount = String(memoryProjectionDebug?.portfolioMapMissingCount || 0);
      document.documentElement.dataset.arbitraWorkbenchPortfolioMapTiltCount = String(memoryProjectionDebug?.portfolioMapTiltCount || 0);
    } else {
      delete document.documentElement.dataset.arbitraWorkbenchEntry;
      delete document.documentElement.dataset.arbitraWorkbenchTitle;
      delete document.documentElement.dataset.arbitraWorkbenchWidgetCount;
      delete document.documentElement.dataset.arbitraWorkbenchRenderWidgetCount;
      delete document.documentElement.dataset.arbitraWorkbenchLegacySurface;
      delete document.documentElement.dataset.arbitraWorkbenchFactConfidence;
      delete document.documentElement.dataset.arbitraWorkbenchFactSourceCount;
      delete document.documentElement.dataset.arbitraWorkbenchFactMissingCount;
      delete document.documentElement.dataset.arbitraWorkbenchFactAccountCount;
      delete document.documentElement.dataset.arbitraWorkbenchFactPositionCount;
      delete document.documentElement.dataset.arbitraWorkbenchFactHoldingCount;
      delete document.documentElement.dataset.arbitraWorkbenchFactHasMarket;
      delete document.documentElement.dataset.arbitraWorkbenchFactHasProfile;
      delete document.documentElement.dataset.arbitraWorkbenchFactHasSelectedHolding;
      delete document.documentElement.dataset.arbitraWorkbenchFactHasPrompt;
      delete document.documentElement.dataset.arbitraWorkbenchRailStatus;
      delete document.documentElement.dataset.arbitraWorkbenchRailCount;
      delete document.documentElement.dataset.arbitraWorkbenchRailReadyCount;
      delete document.documentElement.dataset.arbitraWorkbenchRailPartialCount;
      delete document.documentElement.dataset.arbitraWorkbenchRailBlockedCount;
      delete document.documentElement.dataset.arbitraWorkbenchRailMissingCount;
      delete document.documentElement.dataset.arbitraWorkbenchRailStatuses;
      delete document.documentElement.dataset.arbitraWorkbenchMemoryPendingCount;
      delete document.documentElement.dataset.arbitraWorkbenchMemoryAcceptedCount;
      delete document.documentElement.dataset.arbitraWorkbenchMemoryRejectedCount;
      delete document.documentElement.dataset.arbitraWorkbenchMemoryMergedCount;
      delete document.documentElement.dataset.arbitraWorkbenchProfileVersion;
      delete document.documentElement.dataset.arbitraWorkbenchProjectionStatus;
      delete document.documentElement.dataset.arbitraWorkbenchProjectionWidgetCount;
      delete document.documentElement.dataset.arbitraWorkbenchProjectionSourceCount;
      delete document.documentElement.dataset.arbitraWorkbenchProjectionTrace;
      delete document.documentElement.dataset.arbitraWorkbenchPortfolioMapPositionCount;
      delete document.documentElement.dataset.arbitraWorkbenchPortfolioMapMissingCount;
      delete document.documentElement.dataset.arbitraWorkbenchPortfolioMapTiltCount;
    }
  }
  const factDebug = createWorkbenchFactsDebugSnapshot(sessionSpec);
  (window as any).__ARBITRA_WORKBENCH_SESSION__ = sessionSpec ? {
    id: sessionSpec.id,
    entryType: sessionSpec.entryType,
    titleKey: sessionSpec.titleKey,
    intentBias: sessionSpec.intentBias,
    widgetCount: sessionSpec.initialWidgets?.length || 0,
    renderWidgetCount,
    legacy: sessionSpec.legacy,
    facts: factDebug,
    railRun: railDebug,
    memoryProjection: memoryProjectionDebug,
    createdAt: sessionSpec.createdAt,
  } : null;
};

const openSessionWithRails = (
  set: (partial: Partial<InteractionState> | ((state: InteractionState) => Partial<InteractionState>)) => void,
  sessionSpec: WorkbenchSessionSpec,
  patch: Partial<InteractionState> = {},
) => {
  const baseSession = hydrateWorkbenchMemoryProjection(sessionSpec);
  publishWorkbenchDebugSession(baseSession);
  set({
    ...patch,
    activeWorkbenchSession: baseSession,
  });

  void runWorkbenchRailOrchestration(baseSession).then((railRun) => {
    const nextSession = hydrateWorkbenchMemoryProjection({
      ...baseSession,
      railRun,
    });
    publishWorkbenchDebugSession(nextSession);
    set((state) => {
      if (state.activeWorkbenchSession?.id !== baseSession.id) {
        return {};
      }
      return {
        activeWorkbenchSession: nextSession,
      };
    });
  });
};

export const useInteractionStore = create<InteractionState>((set) => ({
  isDrawerOpen: false,
  pendingGlobalIntent: null,
  copilotConfig: { isOpen: false, title: '', data: null, role: '' },
  activeWorkbenchSession: null,
  
  setDrawerOpen: (isOpen) => set({ isDrawerOpen: isOpen }),
  
  openDrawerWithIntent: (intent) => {
    const sessionSpec = createPromptWorkbenchSession(intent, useWealthStore.getState().data);
    openSessionWithRails(set, sessionSpec, {
      isDrawerOpen: true, 
      pendingGlobalIntent: intent,
    });
  },
  
  clearPendingIntent: () => set({ pendingGlobalIntent: null }),
  
  openCopilot: (title, data, role, sessionSpec) => {
    const nextSession = sessionSpec || createWidgetCopilotWorkbenchSession({
      title,
      data,
      role,
      terminalState: useWealthStore.getState().data,
    });
    openSessionWithRails(set, nextSession, {
      copilotConfig: { isOpen: true, title, data, role },
    });
  },
  
  closeCopilot: () => set((state) => ({ 
    copilotConfig: { ...state.copilotConfig, isOpen: false } 
  })),

  openWorkbench: (sessionSpec) => {
    openSessionWithRails(set, sessionSpec);
  },

  closeWorkbench: () => {
    publishWorkbenchDebugSession(null);
    set({
      activeWorkbenchSession: null,
    });
  },

  closeWorkbenchForEntry: (entryType) => set((state) => {
    if (state.activeWorkbenchSession?.entryType !== entryType) {
      return {};
    }
    publishWorkbenchDebugSession(null);
    return { activeWorkbenchSession: null };
  }),
}));
