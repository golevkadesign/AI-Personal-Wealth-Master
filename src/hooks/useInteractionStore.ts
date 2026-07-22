import { create } from 'zustand';
import {
  MemoryInboxDecisionInput,
  MemoryInboxDecisionType,
  MemoryCandidate,
  WorkbenchSessionSpec,
} from '../types/workbench';
import {
  createProfileMemoryWorkbenchSession,
  createPromptWorkbenchSession,
  createWidgetWorkbenchSession,
} from '../lib/workbench-session';
import { createWorkbenchFactsDebugSnapshot } from '../lib/workbench-facts';
import {
  createWorkbenchRailDebugSnapshot,
  runWorkbenchRailOrchestration,
} from '../lib/workbench-rails';
import {
  addMemoryCandidateToSession,
  applyMemoryInboxDecision,
  createMemoryProjectionDebugSnapshot,
  hydrateWorkbenchMemoryProjection,
} from '../lib/workbench-memory';
import {
  deriveTerminalPatchFromDashboardProjection,
  deriveTerminalPatchFromSovereignProfile,
} from '../lib/sovereign-profile-projection';
import { runWorkbenchSession } from '../lib/workbench-client';
import {
  createWorkbenchAuditDecisionRecord,
  createWorkbenchAuditPatch,
} from '../lib/workbench-audit';
import { getRenderableWorkbenchWidgetSelection } from '../lib/workbench-widget-registry';
import { getWorkbenchResponseWidgets } from '../lib/workbench-widget-registry';
import {
  appendWorkbenchEvent,
  appendWorkbenchEvents,
  createSessionOpenedEvents,
  createWorkbenchEvent,
  createWorkbenchEventDebugSnapshot,
  createWorkbenchRunCompletionEvents,
} from '../lib/workbench-events';
import { useWealthStore } from './useWealthStore';

type WorkbenchRunStatus = 'idle' | 'running' | 'ready' | 'fallback' | 'error';

interface InteractionState {
  pendingGlobalIntent: string | null;
  activeWorkbenchSession: WorkbenchSessionSpec | null;
  isWorkbenchOpen: boolean;
  workbenchRunStatus: WorkbenchRunStatus;
  workbenchRunError: string | null;
  workbenchRunRequestId: number;
  openWorkbenchWithIntent: (intent: string) => void;
  clearPendingIntent: () => void;
  openWidgetWorkbench: (title: string, data: any, role: string, sessionSpec?: WorkbenchSessionSpec) => void;
  openWorkbench: (sessionSpec: WorkbenchSessionSpec) => void;
  submitWorkbenchPrompt: (prompt: string, chatResult?: any) => Promise<WorkbenchSessionSpec | null>;
  restartWorkbench: () => void;
  closeWorkbench: () => void;
  closeWorkbenchForEntry: (entryType: WorkbenchSessionSpec['entryType']) => void;
  queueMemoryCandidate: (candidate: MemoryCandidate) => void;
  decideMemoryInboxItem: (itemId: string, decision: MemoryInboxDecisionType | MemoryInboxDecisionInput) => void;
}

const isWorkbenchReviewContext = () => {
  if (typeof window === 'undefined') return false;
  return import.meta.env.DEV || window.location.search.includes('test=1');
};

const publishWorkbenchRunDebug = (status: WorkbenchRunStatus, error: string | null = null) => {
  if (typeof document === 'undefined' || !isWorkbenchReviewContext()) return;
  document.documentElement.dataset.arbitraWorkbenchRunStatus = status;
  if (error) {
    document.documentElement.dataset.arbitraWorkbenchRunError = error.slice(0, 300);
  } else {
    delete document.documentElement.dataset.arbitraWorkbenchRunError;
  }
};

const publishWorkbenchVisibilityDebug = (isOpen: boolean) => {
  if (typeof document === 'undefined' || !isWorkbenchReviewContext()) return;
  document.documentElement.dataset.arbitraWorkbenchOpen = String(isOpen);
};

const publishWorkbenchDebugSession = (sessionSpec: WorkbenchSessionSpec | null) => {
  if (typeof window === 'undefined') return;
  if (!isWorkbenchReviewContext()) return;
  const railDebug = createWorkbenchRailDebugSnapshot(sessionSpec);
  const memoryProjectionDebug = createMemoryProjectionDebugSnapshot(sessionSpec);
  const eventDebug = createWorkbenchEventDebugSnapshot(sessionSpec);
  const widgetSelection = sessionSpec ? getRenderableWorkbenchWidgetSelection(sessionSpec) : null;
  const renderWidgetCount = widgetSelection?.widgets.length || 0;
  if (typeof document !== 'undefined') {
    const factDebug = createWorkbenchFactsDebugSnapshot(sessionSpec);
    if (sessionSpec) {
      document.documentElement.dataset.arbitraWorkbenchEntry = sessionSpec.entryType;
      document.documentElement.dataset.arbitraWorkbenchTitle = sessionSpec.titleKey;
      document.documentElement.dataset.arbitraWorkbenchWidgetCount = String(sessionSpec.initialWidgets?.length || 0);
      document.documentElement.dataset.arbitraWorkbenchRenderWidgetCount = String(renderWidgetCount);
      document.documentElement.dataset.arbitraWorkbenchRenderWidgetTypes = widgetSelection?.selectedTypes.join(',') || '';
      document.documentElement.dataset.arbitraWorkbenchWidgetReason = widgetSelection?.reason || 'entry_initial';
      document.documentElement.dataset.arbitraWorkbenchFactConfidence = factDebug?.confidence || 'unknown';
      document.documentElement.dataset.arbitraWorkbenchFactSourceCount = String(factDebug?.sourceCount || 0);
      document.documentElement.dataset.arbitraWorkbenchFactMissingCount = String(factDebug?.missingFactCount || 0);
      document.documentElement.dataset.arbitraWorkbenchFactAccountCount = String(factDebug?.accountCount || 0);
      document.documentElement.dataset.arbitraWorkbenchFactPositionCount = String(factDebug?.positionCount || 0);
      document.documentElement.dataset.arbitraWorkbenchFactHoldingCount = String(factDebug?.publicHoldingCount || 0);
      document.documentElement.dataset.arbitraWorkbenchFactHasMarket = String(Boolean(factDebug?.hasMarketContext));
      document.documentElement.dataset.arbitraWorkbenchFactHasProfile = String(Boolean(factDebug?.hasSovereignProfile));
      document.documentElement.dataset.arbitraWorkbenchFactHasSelectedHolding = String(Boolean(factDebug?.hasSelectedHolding));
      document.documentElement.dataset.arbitraWorkbenchFactHasSelectedHoldingAnalysis = String(Boolean((factDebug as any)?.hasSelectedHoldingAnalysis));
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
      document.documentElement.dataset.arbitraWorkbenchMemoryTemporaryCount = String(memoryProjectionDebug?.memoryTemporaryCount || 0);
      document.documentElement.dataset.arbitraWorkbenchMemoryRevokedCount = String(memoryProjectionDebug?.memoryRevokedCount || 0);
      document.documentElement.dataset.arbitraWorkbenchMemoryAffectProfileCount = String(memoryProjectionDebug?.memoryAffectProfileCount || 0);
      document.documentElement.dataset.arbitraWorkbenchMemoryRefreshDashboardCount = String(memoryProjectionDebug?.memoryRefreshDashboardCount || 0);
      document.documentElement.dataset.arbitraWorkbenchMemoryCandidateTypes = memoryProjectionDebug?.memoryCandidateTypes || '';
      document.documentElement.dataset.arbitraWorkbenchProfileVersion = String(memoryProjectionDebug?.profileVersion || 0);
      document.documentElement.dataset.arbitraWorkbenchProjectionStatus = memoryProjectionDebug?.projectionStatus || 'awaiting_context';
      document.documentElement.dataset.arbitraWorkbenchProjectionWidgetCount = String(memoryProjectionDebug?.projectionWidgetCount || 0);
      document.documentElement.dataset.arbitraWorkbenchProjectionSourceCount = String(memoryProjectionDebug?.projectionSourceCount || 0);
      document.documentElement.dataset.arbitraWorkbenchProjectionTrace = memoryProjectionDebug?.projectionTrace || '';
      document.documentElement.dataset.arbitraWorkbenchPortfolioMapPositionCount = String(memoryProjectionDebug?.portfolioMapPositionCount || 0);
      document.documentElement.dataset.arbitraWorkbenchPortfolioMapMissingCount = String(memoryProjectionDebug?.portfolioMapMissingCount || 0);
      document.documentElement.dataset.arbitraWorkbenchPortfolioMapTiltCount = String(memoryProjectionDebug?.portfolioMapTiltCount || 0);
      document.documentElement.dataset.arbitraWorkbenchEventCount = String(eventDebug.count);
      document.documentElement.dataset.arbitraWorkbenchEventRunningCount = String(eventDebug.runningCount);
      document.documentElement.dataset.arbitraWorkbenchEventErrorCount = String(eventDebug.errorCount);
      document.documentElement.dataset.arbitraWorkbenchLatestEventPhase = eventDebug.latestPhase;
      document.documentElement.dataset.arbitraWorkbenchLatestEventStatus = eventDebug.latestStatus;
      document.documentElement.dataset.arbitraWorkbenchEventTimeline = eventDebug.timeline;
    } else {
      delete document.documentElement.dataset.arbitraWorkbenchEntry;
      delete document.documentElement.dataset.arbitraWorkbenchTitle;
      delete document.documentElement.dataset.arbitraWorkbenchWidgetCount;
      delete document.documentElement.dataset.arbitraWorkbenchRenderWidgetCount;
      delete document.documentElement.dataset.arbitraWorkbenchRenderWidgetTypes;
      delete document.documentElement.dataset.arbitraWorkbenchWidgetReason;
      delete document.documentElement.dataset.arbitraWorkbenchFactConfidence;
      delete document.documentElement.dataset.arbitraWorkbenchFactSourceCount;
      delete document.documentElement.dataset.arbitraWorkbenchFactMissingCount;
      delete document.documentElement.dataset.arbitraWorkbenchFactAccountCount;
      delete document.documentElement.dataset.arbitraWorkbenchFactPositionCount;
      delete document.documentElement.dataset.arbitraWorkbenchFactHoldingCount;
      delete document.documentElement.dataset.arbitraWorkbenchFactHasMarket;
      delete document.documentElement.dataset.arbitraWorkbenchFactHasProfile;
      delete document.documentElement.dataset.arbitraWorkbenchFactHasSelectedHolding;
      delete document.documentElement.dataset.arbitraWorkbenchFactHasSelectedHoldingAnalysis;
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
      delete document.documentElement.dataset.arbitraWorkbenchMemoryTemporaryCount;
      delete document.documentElement.dataset.arbitraWorkbenchMemoryRevokedCount;
      delete document.documentElement.dataset.arbitraWorkbenchMemoryAffectProfileCount;
      delete document.documentElement.dataset.arbitraWorkbenchMemoryRefreshDashboardCount;
      delete document.documentElement.dataset.arbitraWorkbenchMemoryCandidateTypes;
      delete document.documentElement.dataset.arbitraWorkbenchProfileVersion;
      delete document.documentElement.dataset.arbitraWorkbenchProjectionStatus;
      delete document.documentElement.dataset.arbitraWorkbenchProjectionWidgetCount;
      delete document.documentElement.dataset.arbitraWorkbenchProjectionSourceCount;
      delete document.documentElement.dataset.arbitraWorkbenchProjectionTrace;
      delete document.documentElement.dataset.arbitraWorkbenchPortfolioMapPositionCount;
      delete document.documentElement.dataset.arbitraWorkbenchPortfolioMapMissingCount;
      delete document.documentElement.dataset.arbitraWorkbenchPortfolioMapTiltCount;
      delete document.documentElement.dataset.arbitraWorkbenchEventCount;
      delete document.documentElement.dataset.arbitraWorkbenchEventRunningCount;
      delete document.documentElement.dataset.arbitraWorkbenchEventErrorCount;
      delete document.documentElement.dataset.arbitraWorkbenchLatestEventPhase;
      delete document.documentElement.dataset.arbitraWorkbenchLatestEventStatus;
      delete document.documentElement.dataset.arbitraWorkbenchEventTimeline;
      delete document.documentElement.dataset.arbitraWorkbenchRunStatus;
      delete document.documentElement.dataset.arbitraWorkbenchRunError;
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
    events: sessionSpec.events || [],
    eventDebug,
    createdAt: sessionSpec.createdAt,
  } : null;
};

const preserveWorkbenchEvents = (
  nextSession: WorkbenchSessionSpec,
  fallbackSession: WorkbenchSessionSpec,
): WorkbenchSessionSpec => {
  if (nextSession.events?.length) return nextSession;
  return {
    ...nextSession,
    events: fallbackSession.events,
  };
};

const normalizeWorkbenchKeyPart = (value: unknown) => {
  if (value === undefined || value === null) return '';
  return String(value).trim().toLowerCase();
};

const getWorkbenchSessionReuseKey = (sessionSpec: WorkbenchSessionSpec | null) => {
  if (!sessionSpec) return '';
  const holding = sessionSpec.facts?.selectedHolding as any;
  const subjectSpec = sessionSpec.subjectSpec;
  const holdingKey = normalizeWorkbenchKeyPart(
    holding?.symbol || holding?.id || holding?.name || sessionSpec.legacy?.positionSymbol,
  );
  const portfolioAccounts = sessionSpec.facts?.publicHoldingAccounts || [];
  const portfolioKey = portfolioAccounts
    .map((account: any) => normalizeWorkbenchKeyPart(account?.accountId || account?.accountName))
    .filter(Boolean)
    .sort()
    .join(',');
  return [
    sessionSpec.entryType,
    normalizeWorkbenchKeyPart(subjectSpec?.type),
    normalizeWorkbenchKeyPart(subjectSpec?.id),
    normalizeWorkbenchKeyPart(subjectSpec?.label),
    normalizeWorkbenchKeyPart(sessionSpec.subject),
    normalizeWorkbenchKeyPart(sessionSpec.defaultWidgetPreset),
    normalizeWorkbenchKeyPart(sessionSpec.intentBias),
    normalizeWorkbenchKeyPart(sessionSpec.legacy?.portfolioReviewSessionId),
    normalizeWorkbenchKeyPart(sessionSpec.legacy?.copilotTitle),
    holdingKey,
    portfolioKey,
  ].join('|');
};

const canResumeWorkbenchSession = (
  activeSession: WorkbenchSessionSpec | null,
  incomingSession: WorkbenchSessionSpec,
) => {
  if (!activeSession) return false;
  return getWorkbenchSessionReuseKey(activeSession) === getWorkbenchSessionReuseKey(incomingSession);
};

const commitDashboardProjectionFromSession = (sessionSpec: WorkbenchSessionSpec | null) => {
  if (!sessionSpec) return;
  const terminalPatch = deriveTerminalPatchFromDashboardProjection({
    dashboardProjection: sessionSpec.dashboardProjection,
    profile: sessionSpec.facts?.sovereignProfile,
  });

  useWealthStore.getState().commitData((prevData: any) => ({
    ...prevData,
    ...terminalPatch,
    ...createWorkbenchAuditPatch({
      terminalState: prevData,
      session: sessionSpec,
    }),
    insights: {
      ...(prevData.insights || {}),
      ...(terminalPatch.insights || {}),
    },
    sovereignProfileProjection: {
      ...(prevData.sovereignProfileProjection || {}),
      ...(terminalPatch.sovereignProfileProjection || {}),
    },
  }));
};

const persistWorkbenchProfileCheckpoint = () => {
  queueMicrotask(() => {
    useWealthStore.getState().saveCloudCheckpoint();
  });
};

const openSessionWithRails = (
  set: (partial: Partial<InteractionState> | ((state: InteractionState) => Partial<InteractionState>)) => void,
  sessionSpec: WorkbenchSessionSpec,
  patch: Partial<InteractionState> = {},
) => {
  const baseSession = appendWorkbenchEvents(
    hydrateWorkbenchMemoryProjection(sessionSpec),
    createSessionOpenedEvents(sessionSpec),
  );
  publishWorkbenchDebugSession(baseSession);
  publishWorkbenchVisibilityDebug(true);
  publishWorkbenchRunDebug('running');
  set({
    ...patch,
    activeWorkbenchSession: baseSession,
    isWorkbenchOpen: true,
    workbenchRunStatus: 'running',
    workbenchRunError: null,
  });

  const runSession = async () => {
    try {
      const session = preserveWorkbenchEvents(await runWorkbenchSession(baseSession), baseSession);
      return { session, status: 'ready' as WorkbenchRunStatus, error: null as string | null };
    } catch (error) {
      console.warn('[Workbench] API run failed, falling back to local rails:', error);
      const railRun = await runWorkbenchRailOrchestration(baseSession);
      return {
        session: hydrateWorkbenchMemoryProjection({
          ...baseSession,
          railRun,
        }),
        status: 'fallback' as WorkbenchRunStatus,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  void runSession().then(({ session: rawSession, status, error }) => {
    const completionStatus = status === 'ready' || status === 'fallback' || status === 'error'
      ? status
      : 'skipped';
    const nextSession = appendWorkbenchEvents(
      rawSession,
      createWorkbenchRunCompletionEvents({ session: rawSession, status: completionStatus, error }),
    );
    publishWorkbenchDebugSession(nextSession);
    publishWorkbenchRunDebug(status, error);
    set((state) => {
      if (state.activeWorkbenchSession?.id !== baseSession.id) {
        return {};
      }
      commitDashboardProjectionFromSession(nextSession);
      return {
        activeWorkbenchSession: nextSession,
        workbenchRunStatus: status,
        workbenchRunError: error,
      };
    });
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    publishWorkbenchRunDebug('error', message);
    set((state) => {
      if (state.activeWorkbenchSession?.id !== baseSession.id) return {};
      const nextSession = appendWorkbenchEvents(
        state.activeWorkbenchSession,
        createWorkbenchRunCompletionEvents({
          session: state.activeWorkbenchSession,
          status: 'error',
          error: message,
        }),
      );
      publishWorkbenchDebugSession(nextSession);
      return {
        activeWorkbenchSession: nextSession,
        workbenchRunStatus: 'error',
        workbenchRunError: message,
      };
    });
  });
};

export const useInteractionStore = create<InteractionState>((set, get) => ({
  pendingGlobalIntent: null,
  activeWorkbenchSession: null,
  isWorkbenchOpen: false,
  workbenchRunStatus: 'idle',
  workbenchRunError: null,
  workbenchRunRequestId: 0,

  openWorkbenchWithIntent: (intent) => {
    const state = get();
    const sessionSpec = createPromptWorkbenchSession(intent, useWealthStore.getState().data);
    if (!state.isWorkbenchOpen && canResumeWorkbenchSession(state.activeWorkbenchSession, sessionSpec)) {
      publishWorkbenchDebugSession(state.activeWorkbenchSession);
      publishWorkbenchVisibilityDebug(true);
      set({ isWorkbenchOpen: true });
      return;
    }
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
    const state = get();
    if (!state.isWorkbenchOpen && canResumeWorkbenchSession(state.activeWorkbenchSession, nextSession)) {
      publishWorkbenchDebugSession(state.activeWorkbenchSession);
      publishWorkbenchVisibilityDebug(true);
      set({ isWorkbenchOpen: true });
      return;
    }
    openSessionWithRails(set, nextSession);
  },

  openWorkbench: (sessionSpec) => {
    const state = get();
    if (!state.isWorkbenchOpen && canResumeWorkbenchSession(state.activeWorkbenchSession, sessionSpec)) {
      publishWorkbenchDebugSession(state.activeWorkbenchSession);
      publishWorkbenchVisibilityDebug(true);
      set({ isWorkbenchOpen: true });
      return;
    }
    openSessionWithRails(set, sessionSpec);
  },

  submitWorkbenchPrompt: async (prompt, chatResult) => {
    const session = get().activeWorkbenchSession;
    const trimmedPrompt = prompt.trim();
    if (!session || !trimmedPrompt) return null;
    const requestId = get().workbenchRunRequestId + 1;

    const facts = session.facts || {};
    const terminalState = useWealthStore.getState().data || facts.terminalState;
    const sourceRefs = Array.from(new Set([
      ...(facts.sourceRefs || []),
      'workbench.chat',
      chatResult?.workbenchNative ? 'workbench.native_chat' : undefined,
      chatResult?.expertAnalysis ? 'chat.expert_analysis' : undefined,
      chatResult?.externalData ? 'chat.external_data' : undefined,
      chatResult?.updatedProfile ? 'chat.updated_profile' : undefined,
    ].filter(Boolean) as string[]));
    const missingFacts = (facts.missingFacts || []).filter((fact) => fact !== 'user_prompt' && fact !== 'shared_facts');
    const optimisticSession: WorkbenchSessionSpec = {
      ...session,
      subject: session.subject || trimmedPrompt.slice(0, 80),
      subjectSpec: session.subjectSpec || {
        type: 'custom',
        id: `prompt-${requestId}`,
        label: trimmedPrompt.slice(0, 80),
        payload: { prompt: trimmedPrompt },
      },
      initialPrompt: session.initialPrompt || trimmedPrompt,
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

    const hydratedOptimisticSession = appendWorkbenchEvents(
      hydrateWorkbenchMemoryProjection(optimisticSession),
      [
        createWorkbenchEvent({
          sessionId: session.id,
          phase: 'chat_submitted',
          status: 'ready',
          requestId,
          sourceRefs,
        }),
        createWorkbenchEvent({
          sessionId: session.id,
          phase: 'workbench_run_started',
          status: 'running',
          requestId,
          sourceRefs,
        }),
      ],
    );
    publishWorkbenchDebugSession(hydratedOptimisticSession);
    publishWorkbenchRunDebug('running');
    set({
      workbenchRunRequestId: requestId,
      workbenchRunStatus: 'running',
      workbenchRunError: null,
      pendingGlobalIntent: trimmedPrompt,
      activeWorkbenchSession: hydratedOptimisticSession,
    });

    try {
      const nativeWorkbenchSession = chatResult?.workbenchNative && chatResult?.workbenchSession && typeof chatResult.workbenchSession === 'object'
        ? chatResult.workbenchSession as WorkbenchSessionSpec
        : null;
      const shouldUseNativeWorkbenchSession = Boolean(
        nativeWorkbenchSession &&
        getWorkbenchResponseWidgets(nativeWorkbenchSession).length > 0,
      );
      const rawNextSession = preserveWorkbenchEvents(
        shouldUseNativeWorkbenchSession && nativeWorkbenchSession
          ? nativeWorkbenchSession
          : await runWorkbenchSession(hydratedOptimisticSession, trimmedPrompt, chatResult),
        hydratedOptimisticSession,
      );
      const nextSession = appendWorkbenchEvents(
        rawNextSession,
        [
          createWorkbenchEvent({
            sessionId: hydratedOptimisticSession.id,
            phase: 'chat_result_received',
            status: chatResult ? 'ready' : 'skipped',
            requestId,
            sourceRefs,
          }),
          ...createWorkbenchRunCompletionEvents({
            session: rawNextSession,
            status: 'ready',
            requestId,
          }),
        ],
      );
      if (get().activeWorkbenchSession?.id !== hydratedOptimisticSession.id || get().workbenchRunRequestId !== requestId) {
        return null;
      }
      publishWorkbenchDebugSession(nextSession);
      publishWorkbenchRunDebug('ready');
      set((state) => {
        if (state.activeWorkbenchSession?.id !== hydratedOptimisticSession.id || state.workbenchRunRequestId !== requestId) {
          return {};
        }
        commitDashboardProjectionFromSession(nextSession);
        return {
          activeWorkbenchSession: nextSession,
          pendingGlobalIntent: trimmedPrompt,
          workbenchRunStatus: 'ready',
          workbenchRunError: null,
        };
      });
      return nextSession;
    } catch (error) {
      console.warn('[Workbench] Prompt run failed, falling back to local rails:', error);
      const railRun = await runWorkbenchRailOrchestration(hydratedOptimisticSession);
      const rawNextSession = hydrateWorkbenchMemoryProjection({
        ...hydratedOptimisticSession,
        railRun,
      });
      const message = error instanceof Error ? error.message : String(error);
      const nextSession = appendWorkbenchEvents(
        rawNextSession,
        [
          createWorkbenchEvent({
            sessionId: hydratedOptimisticSession.id,
            phase: 'chat_result_received',
            status: chatResult ? 'ready' : 'skipped',
            requestId,
            sourceRefs,
          }),
          ...createWorkbenchRunCompletionEvents({
            session: rawNextSession,
            status: 'fallback',
            error: message,
            requestId,
          }),
        ],
      );
      if (get().activeWorkbenchSession?.id !== hydratedOptimisticSession.id || get().workbenchRunRequestId !== requestId) {
        return null;
      }
      publishWorkbenchDebugSession(nextSession);
      publishWorkbenchRunDebug('fallback', message);
      set((state) => {
        if (state.activeWorkbenchSession?.id !== hydratedOptimisticSession.id || state.workbenchRunRequestId !== requestId) {
          return {};
        }
        commitDashboardProjectionFromSession(nextSession);
        return {
          activeWorkbenchSession: nextSession,
          pendingGlobalIntent: trimmedPrompt,
          workbenchRunStatus: 'fallback',
          workbenchRunError: message,
        };
      });
      return nextSession;
    }
  },

  restartWorkbench: () => {
    const state = get();
    const session = state.activeWorkbenchSession;
    if (!session) return;
    const now = Date.now();
    const sourceRefs = (session.facts?.sourceRefs || []).filter((sourceRef) => (
      sourceRef !== 'workbench.chat' && sourceRef !== 'workbench.native_chat'
    ));
    const nextSession: WorkbenchSessionSpec = {
      ...session,
      id: `workbench-${session.entryType}-${now}`,
      initialPrompt: undefined,
      facts: {
        ...(session.facts || {}),
        userPrompt: undefined,
        sourceRefs,
        summary: session.facts?.summary ? {
          ...session.facts.summary,
          hasUserPrompt: false,
          sourceCount: sourceRefs.length,
        } : undefined,
      },
      railRun: undefined,
      dashboardProjection: undefined,
      events: [],
      createdAt: now,
    };
    openSessionWithRails(set, nextSession, {
      pendingGlobalIntent: null,
      workbenchRunRequestId: state.workbenchRunRequestId + 1,
    });
  },

  closeWorkbench: () => {
    publishWorkbenchVisibilityDebug(false);
    set({
      isWorkbenchOpen: false,
    });
  },

  closeWorkbenchForEntry: (entryType) => set((state) => {
    if (state.activeWorkbenchSession?.entryType !== entryType) {
      return {};
    }
    publishWorkbenchVisibilityDebug(false);
    return { isWorkbenchOpen: false };
  }),

  queueMemoryCandidate: (candidate) => set((state) => {
    const baseSession = state.activeWorkbenchSession?.entryType === 'profile_memory'
      ? state.activeWorkbenchSession
      : hydrateWorkbenchMemoryProjection(createProfileMemoryWorkbenchSession(useWealthStore.getState().data));
    const queuedSession = addMemoryCandidateToSession(baseSession, candidate);
    const nextSession = appendWorkbenchEvent(queuedSession, createWorkbenchEvent({
      sessionId: queuedSession.id,
      phase: 'memory_candidate_queued',
      status: 'ready',
      detail: candidate.id,
      sourceRefs: candidate.sourceRefs,
      completedAt: Date.now(),
    }));
    commitDashboardProjectionFromSession(nextSession);
    publishWorkbenchDebugSession(nextSession);
    publishWorkbenchVisibilityDebug(true);
    publishWorkbenchRunDebug('ready');
    return {
      activeWorkbenchSession: nextSession,
      isWorkbenchOpen: true,
      workbenchRunStatus: 'ready',
      workbenchRunError: null,
    };
  }),

  decideMemoryInboxItem: (itemId, decision) => set((state) => {
    const session = state.activeWorkbenchSession;
    const inbox = session?.memoryInbox;
    const item = inbox?.items.find((candidate) => candidate.id === itemId);
    if (!session || !inbox || !item) return {};

    const decisionInput: MemoryInboxDecisionInput = typeof decision === 'string'
      ? { decision }
      : decision;
    const profile = session.facts?.sovereignProfile || { version: 1 };
    const result = applyMemoryInboxDecision({
      item,
      profile,
      decision: decisionInput.decision,
      editedPatch: decisionInput.editedPatch,
      editedTitle: decisionInput.editedTitle,
      editedBody: decisionInput.editedBody,
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
      temporaryCount: items.filter((candidate) => candidate.status === 'temporary').length,
      revokedCount: items.filter((candidate) => candidate.status === 'revoked').length,
    };
    const decisionRef = decisionInput.decision === 'revoke'
      ? 'memory_inbox.revoke'
      : 'memory_inbox.decision';
    const nextSession = appendWorkbenchEvent({
      ...session,
      facts: {
        ...(session.facts || {}),
        sovereignProfile: result.profile,
        sourceRefs: Array.from(new Set([
          ...(session.facts?.sourceRefs || []),
          ...item.candidate.sourceRefs,
          decisionRef,
        ])),
      },
      memoryInbox: nextInbox,
      dashboardProjection: result.dashboardProjection || session.dashboardProjection,
    }, createWorkbenchEvent({
      sessionId: session.id,
      phase: 'memory_decision',
      status: 'ready',
      detail: decisionInput.decision,
      sourceRefs: Array.from(new Set([
        ...(session.facts?.sourceRefs || []),
        ...item.candidate.sourceRefs,
        decisionRef,
      ])),
      completedAt: Date.now(),
    }));
    const decisionRecord = createWorkbenchAuditDecisionRecord({
      item: result.item,
      decision: decisionInput,
      session: nextSession,
    });
    useWealthStore.getState().commitData((prevData: any) => {
      const terminalPatch = result.event || result.dashboardProjection
        ? deriveTerminalPatchFromSovereignProfile({
          profile: result.profile,
          dashboardProjection: nextSession.dashboardProjection,
          event: result.event,
        })
        : {};
      return {
        ...prevData,
        ...terminalPatch,
        ...createWorkbenchAuditPatch({
          terminalState: prevData,
          session: nextSession,
          decisionRecord,
          profileEvent: result.event,
        }),
        userProfile: {
          ...(prevData.userProfile || {}),
          ...(terminalPatch.userProfile || {}),
        },
        userPersona: {
          ...(prevData.userPersona || {}),
          ...(terminalPatch.userPersona || {}),
        },
        insights: {
          ...(prevData.insights || {}),
          ...(terminalPatch.insights || {}),
        },
        sovereignProfileProjection: {
          ...(prevData.sovereignProfileProjection || {}),
          ...(terminalPatch.sovereignProfileProjection || {}),
        },
      };
    });
    if (result.event || result.dashboardProjection) {
      persistWorkbenchProfileCheckpoint();
    }
    publishWorkbenchDebugSession(nextSession);
    return { activeWorkbenchSession: nextSession };
  }),
}));
