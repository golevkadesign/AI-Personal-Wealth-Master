import { create } from 'zustand';
import { WorkbenchSessionSpec } from '../types/workbench';
import { MemoryInboxDecisionType } from '../types/workbench';
import {
  createPromptWorkbenchSession,
  createWidgetWorkbenchSession,
} from '../lib/workbench-session';
import { createWorkbenchFactsDebugSnapshot } from '../lib/workbench-facts';
import {
  createWorkbenchRailDebugSnapshot,
  runWorkbenchRailOrchestration,
} from '../lib/workbench-rails';
import {
  applyMemoryInboxDecision,
  createMemoryProjectionDebugSnapshot,
  hydrateWorkbenchMemoryProjection,
} from '../lib/workbench-memory';
import { useWealthStore } from './useWealthStore';

interface InteractionState {
  pendingGlobalIntent: string | null;
  activeWorkbenchSession: WorkbenchSessionSpec | null;
  openWorkbenchWithIntent: (intent: string) => void;
  clearPendingIntent: () => void;
  openWidgetWorkbench: (title: string, data: any, role: string, sessionSpec?: WorkbenchSessionSpec) => void;
  openWorkbench: (sessionSpec: WorkbenchSessionSpec) => void;
  submitWorkbenchPrompt: (prompt: string) => void;
  closeWorkbench: () => void;
  closeWorkbenchForEntry: (entryType: WorkbenchSessionSpec['entryType']) => void;
  decideMemoryInboxItem: (itemId: string, decision: MemoryInboxDecisionType) => void;
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

export const useInteractionStore = create<InteractionState>((set, get) => ({
  pendingGlobalIntent: null,
  activeWorkbenchSession: null,

  openWorkbenchWithIntent: (intent) => {
    const sessionSpec = createPromptWorkbenchSession(intent, useWealthStore.getState().data);
    openSessionWithRails(set, sessionSpec, {
      pendingGlobalIntent: intent,
    });
  },
  
  clearPendingIntent: () => set({ pendingGlobalIntent: null }),
  
  openWidgetWorkbench: (title, data, role, sessionSpec) => {
    const nextSession = sessionSpec || createWidgetWorkbenchSession({
      title,
      data,
      role,
      terminalState: useWealthStore.getState().data,
    });
    openSessionWithRails(set, nextSession);
  },

  openWorkbench: (sessionSpec) => {
    openSessionWithRails(set, sessionSpec);
  },

  submitWorkbenchPrompt: (prompt) => {
    const session = get().activeWorkbenchSession;
    const trimmedPrompt = prompt.trim();
    if (!session || !trimmedPrompt) return;

    const facts = session.facts || {};
    const terminalState = facts.terminalState || useWealthStore.getState().data;
    const sourceRefs = Array.from(new Set([...(facts.sourceRefs || []), 'workbench.chat']));
    const missingFacts = (facts.missingFacts || []).filter((fact) => fact !== 'user_prompt' && fact !== 'shared_facts');
    const nextSession: WorkbenchSessionSpec = {
      ...session,
      subject: session.subject || trimmedPrompt.slice(0, 80),
      facts: {
        ...facts,
        terminalState,
        userPrompt: trimmedPrompt,
        sourceRefs,
        missingFacts,
        summary: {
          ...(facts.summary || {
            hasTerminalState: Boolean(terminalState),
            hasSovereignProfile: Boolean(facts.sovereignProfile),
            hasSelectedHolding: Boolean(facts.selectedHolding),
            hasUserPrompt: true,
            hasMarketContext: Boolean(facts.marketContext),
            publicHoldingCount: terminalState?.distributions?.publicHoldings?.length || 0,
            accountCount: facts.publicHoldingAccounts?.length || 0,
            positionCount: facts.publicHoldingAccounts?.reduce((sum, account) => sum + (account.positions?.length || 0), 0) || 0,
            sourceCount: sourceRefs.length,
            missingFactCount: missingFacts.length,
          }),
          hasUserPrompt: true,
          sourceCount: sourceRefs.length,
          missingFactCount: missingFacts.length,
        },
      },
    };

    openSessionWithRails(set, nextSession, {
      pendingGlobalIntent: trimmedPrompt,
    });
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

  decideMemoryInboxItem: (itemId, decision) => set((state) => {
    const session = state.activeWorkbenchSession;
    const inbox = session?.memoryInbox;
    const item = inbox?.items.find((candidate) => candidate.id === itemId);
    if (!session || !inbox || !item) return {};

    const profile = session.facts?.sovereignProfile || { version: 1 };
    const result = applyMemoryInboxDecision({
      item,
      profile,
      decision,
      sessionSpec: session,
    });
    const items = inbox.items.map((candidate) => candidate.id === itemId ? result.item : candidate);
    const nextInbox = {
      ...inbox,
      items,
      pendingCount: items.filter((candidate) => candidate.status === 'pending').length,
      acceptedCount: items.filter((candidate) => candidate.status === 'accepted').length,
      rejectedCount: items.filter((candidate) => candidate.status === 'rejected').length,
      mergedCount: items.filter((candidate) => candidate.status === 'merged').length,
    };
    const nextSession = {
      ...session,
      facts: {
        ...(session.facts || {}),
        sovereignProfile: result.profile,
      },
      memoryInbox: nextInbox,
      dashboardProjection: result.dashboardProjection || session.dashboardProjection,
    };
    useWealthStore.getState().commitData({
      userProfile: {
        ...(useWealthStore.getState().data.userProfile || {}),
        ...(result.profile.identity || {}),
        sovereignProfile: result.profile,
      },
      userPersona: {
        ...useWealthStore.getState().data.userPersona,
        tags: Array.isArray(result.profile.behavioralPatterns?.tags)
          ? result.profile.behavioralPatterns?.tags
          : useWealthStore.getState().data.userPersona?.tags,
      },
    });
    publishWorkbenchDebugSession(nextSession);
    return { activeWorkbenchSession: nextSession };
  }),
}));
