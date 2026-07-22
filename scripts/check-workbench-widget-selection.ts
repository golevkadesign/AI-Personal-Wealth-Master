import {
  getRenderableWorkbenchWidgetSelection,
  getWorkbenchResponseWidgets,
  getWorkbenchWidgetPhase,
} from '../src/lib/workbench-widget-registry';
import {
  createDashboardBriefWorkbenchSession,
  createHoldingWorkbenchSession,
  createLifeStrategyWorkbenchSession,
  createPortfolioIntelligenceWorkbenchSession,
  createProfileMemoryWorkbenchSession,
  createPromptWorkbenchSession,
} from '../src/lib/workbench-session';
import { hydrateWorkbenchMemoryProjection } from '../src/lib/workbench-memory';
import type {
  AgentRailResult,
  MemoryInboxItem,
  WorkbenchRailRun,
  WorkbenchSessionSpec,
  WorkbenchWidgetManifest,
} from '../src/types/workbench';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const now = Date.now();

const terminalState: any = {
  distributions: {
    publicHoldings: [
      { id: 'VOO.US', symbol: 'VOO.US', name: 'Vanguard S&P 500 ETF', value: 6779, marketValue: 6779, percentage: 24.6 },
      { id: 'NVDA.US', symbol: 'NVDA.US', name: 'NVIDIA', value: 3996, marketValue: 3996, percentage: 14.5 },
      { id: 'TSLA.US', symbol: 'TSLA.US', name: 'Tesla', value: 3242, marketValue: 3242, percentage: 11.8 },
    ],
  },
  insights: {
    global: 'Portfolio context ready',
  },
};

function createRailRun(session: WorkbenchSessionSpec, widgets: WorkbenchWidgetManifest[]): WorkbenchRailRun {
  const rail: AgentRailResult = {
    railId: session.intentBias === 'allocation' ? 'allocation' : session.intentBias === 'life' ? 'life' : 'equity',
    titleKey: 'workbench.railTitles.equity',
    status: 'ready',
    summaryKey: 'workbench.railSummaries.equity.chatReady',
    summary: 'chat ready',
    confidence: 'high',
    evidenceRefs: ['chat.expert_analysis'],
    missingFacts: [],
    risks: [],
    actions: [{
      id: 'chat-action',
      labelKey: 'workbench.actions.reviewExposure',
      status: 'ready',
      priority: 'medium',
    }],
    widgetManifest: widgets,
    memoryCandidates: [],
  };

  return {
    id: `rail-${session.id}`,
    sessionId: session.id,
    status: 'ready',
    startedAt: now,
    completedAt: now,
    railResults: [rail],
    sourceRefs: ['chat.expert_analysis'],
    missingFacts: [],
    summary: {
      readyCount: 1,
      partialCount: 0,
      blockedCount: 0,
      railCount: 1,
    },
  };
}

function withChatReply(session: WorkbenchSessionSpec, widgets: WorkbenchWidgetManifest[]): WorkbenchSessionSpec {
  return {
    ...session,
    facts: {
      ...(session.facts || {}),
      userPrompt: 'review this in workbench',
      sourceRefs: [...(session.facts?.sourceRefs || []), 'workbench.chat', 'chat.expert_analysis'],
      summary: {
        ...(session.facts?.summary || {
          hasTerminalState: true,
          hasSovereignProfile: false,
          hasSelectedHolding: false,
          hasUserPrompt: true,
          hasMarketContext: false,
          publicHoldingCount: 0,
          accountCount: 0,
          positionCount: 0,
          sourceCount: 2,
          missingFactCount: 0,
        }),
        hasUserPrompt: true,
      },
    },
    railRun: createRailRun(session, widgets),
    dashboardProjection: {
      id: `projection-${session.id}`,
      generatedAt: now,
      status: 'ready',
      dynamicWidgets: [{
        id: 'chat-evidence-sections',
        type: 'evidence',
        titleKey: 'workbench.evidence',
        status: 'ready',
        priority: 1,
        sourceRefs: ['chat.expert_analysis'],
      }],
      sourceRefs: ['chat.expert_analysis'],
      trace: {
        sessionId: session.id,
        railRunId: `rail-${session.id}`,
        candidateIds: [],
        generatedFrom: ['facts', 'rails', 'chat'],
        sourceRefs: ['chat.expert_analysis'],
      },
    },
  };
}

const promptSession = createPromptWorkbenchSession('How should I think about this?', terminalState);
assert(getWorkbenchWidgetPhase(promptSession) === 'initial', 'prompt session should stay initial until rails or chat result arrive');
assert(promptSession.intentBias === 'global', 'manual prompt should use PRD global intent bias');
assert(promptSession.initialPrompt === 'How should I think about this?', 'manual prompt should keep initialPrompt');
assert(promptSession.defaultWidgetPreset === 'manual-chat', 'manual prompt should declare default widget preset');
assert(promptSession.subjectSpec?.type === 'custom', 'manual prompt should keep structured subjectSpec');
const promptReply = withChatReply(promptSession, [{
  id: 'chat-cio-brief',
  type: 'cio_brief',
  titleKey: 'workbench.cioSynthesis',
  status: 'ready',
  priority: 1,
  sourceRefs: ['chat.expert_analysis'],
}]);
assert(getWorkbenchWidgetPhase(promptReply) === 'reply', 'prompt session should become reply after completed rail/chat output');

const nativePromptReply: WorkbenchSessionSpec = {
  ...promptSession,
  facts: {
    ...(promptSession.facts || {}),
    userPrompt: 'run native workbench',
    sourceRefs: [...(promptSession.facts?.sourceRefs || []), 'workbench.native_chat'],
    summary: {
      ...(promptSession.facts?.summary || {
        hasTerminalState: true,
        hasSovereignProfile: false,
        hasSelectedHolding: false,
        hasUserPrompt: true,
        hasMarketContext: false,
        publicHoldingCount: 0,
        accountCount: 0,
        positionCount: 0,
        sourceCount: 1,
        missingFactCount: 0,
      }),
      hasUserPrompt: true,
    },
  },
  railRun: createRailRun(promptSession, [{
    id: 'native-cio-brief',
    type: 'cio_brief',
    titleKey: 'workbench.cioSynthesis',
    status: 'ready',
    priority: 1,
    sourceRefs: ['workbench.native_chat'],
  }]),
  dashboardProjection: {
    id: `native-projection-${promptSession.id}`,
    generatedAt: now,
    status: 'ready',
    dynamicWidgets: [],
    sourceRefs: ['workbench.native_chat'],
    trace: {
      sessionId: promptSession.id,
      railRunId: `rail-${promptSession.id}`,
      candidateIds: [],
      generatedFrom: ['facts', 'rails'],
      sourceRefs: ['workbench.native_chat'],
    },
  },
};
const nativePromptSelection = getRenderableWorkbenchWidgetSelection(nativePromptReply);
assert(nativePromptSelection.phase === 'reply', 'native workbench source should move prompt session to reply phase');
assert(nativePromptSelection.reason === 'chat_reply', 'native workbench source should use chat reply selection logic');
assert(nativePromptSelection.widgets.length <= 4, 'manual native reply should stay capped');
assert(getWorkbenchResponseWidgets(nativePromptReply).some((widget) => widget.type === 'cio_brief'), 'native workbench reply should embed response widgets');

const holdingSession = createHoldingWorkbenchSession({
  id: 'VOO.US',
  symbol: 'VOO.US',
  name: 'Vanguard S&P 500 ETF',
  value: 6779,
  marketValue: 6779,
  quantity: 10,
  currentPrice: 677.9,
} as any, terminalState);
assert(holdingSession.defaultWidgetPreset === 'holding-analysis', 'holding session should declare holding preset');
assert(holdingSession.subjectSpec?.type === 'symbol', 'holding session should carry symbol subjectSpec');
const hydratedHoldingSession = hydrateWorkbenchMemoryProjection(holdingSession);
assert(
  getRenderableWorkbenchWidgetSelection(hydratedHoldingSession).reason === 'entry_initial',
  'initial hydration projection should not be treated as reply state',
);
const holdingInitial = getRenderableWorkbenchWidgetSelection(holdingSession);
assert(holdingInitial.phase === 'initial', 'holding initial should be initial phase');
assert(holdingInitial.selectedTypes[0] === 'holding_quote_snapshot', 'holding initial should start with quote snapshot');
assert(holdingInitial.selectedTypes.includes('holding_strategy_deductions'), 'holding initial should preserve strategy deductions widget');
assert(!holdingInitial.selectedTypes.includes('portfolio_map'), 'holding initial should not be replaced by generic portfolio map');
assert(holdingInitial.widgets.length <= 6, 'holding initial should stay within default widget limit');

const holdingReply = withChatReply(holdingSession, [
  {
    id: 'holding-strategy-chat',
    type: 'holding_strategy_deductions',
    titleKey: 'workbench.holdingStrategyDeductions',
    status: 'ready',
    priority: 1,
    sourceRefs: ['chat.expert_analysis.持仓智能分析'],
  },
  {
    id: 'holding-quant-chat',
    type: 'holding_quant_indicators',
    titleKey: 'workbench.holdingQuantIndicators',
    status: 'ready',
    priority: 2,
    sourceRefs: ['chat.expert_analysis.量化指标'],
  },
]);
const holdingReplySelection = getRenderableWorkbenchWidgetSelection(holdingReply);
assert(holdingReplySelection.phase === 'reply', 'holding reply should be reply phase');
assert(holdingReplySelection.reason === 'chat_reply', 'holding reply should be driven by chat reason');
assert(holdingReplySelection.selectedTypes.includes('holding_strategy_deductions'), 'holding reply should prioritize holding strategy widget');
assert(getWorkbenchResponseWidgets(holdingReply).some((widget) => widget.type === 'holding_strategy_deductions'), 'assistant response should embed holding strategy widget');

const portfolioSession = createPortfolioIntelligenceWorkbenchSession({ terminalState });
assert(portfolioSession.defaultWidgetPreset === 'portfolio-intelligence', 'portfolio intelligence should declare map preset');
assert(portfolioSession.subjectSpec?.type === 'portfolio', 'portfolio intelligence should carry portfolio subjectSpec');
const portfolioInitial = getRenderableWorkbenchWidgetSelection(portfolioSession);
assert(portfolioInitial.selectedTypes[0] === 'portfolio_map', 'portfolio initial should start with portfolio map');
assert(portfolioInitial.selectedTypes.includes('intent_fingerprint'), 'portfolio initial should include intent fingerprint');
assert(portfolioInitial.widgets.length <= 5, 'portfolio initial should stay compact');

const portfolioReply = withChatReply(portfolioSession, [
  {
    id: 'suggested-tilt-chat',
    type: 'suggested_tilt',
    titleKey: 'workbench.suggestedTilt',
    status: 'ready',
    priority: 1,
    sourceRefs: ['chat.expert_analysis.调仓倾向'],
  },
  {
    id: 'projected-exposure-chat',
    type: 'projected_exposure',
    titleKey: 'workbench.projectedExposure',
    status: 'ready',
    priority: 2,
    sourceRefs: ['chat.expert_analysis.预测版图'],
  },
]);
assert(getWorkbenchResponseWidgets(portfolioReply).some((widget) => widget.type === 'suggested_tilt'), 'portfolio reply should embed suggested tilt widget');

const memorySession = createProfileMemoryWorkbenchSession(terminalState);
assert(memorySession.defaultWidgetPreset === 'profile-memory', 'profile memory should declare memory preset');
assert(memorySession.subjectSpec?.type === 'profile', 'profile memory should carry profile subjectSpec');
const memoryInitial = getRenderableWorkbenchWidgetSelection(memorySession);
assert(memoryInitial.selectedTypes[0] === 'memory_candidate', 'profile memory should start with memory candidate');
const memoryItem: MemoryInboxItem = {
  id: 'inbox-test-memory',
  sourceSessionId: memorySession.id,
  sourceEntryType: 'profile_memory',
  status: 'accepted',
  willAffectProfile: true,
  willRefreshDashboard: true,
  createdAt: now,
  candidate: {
    id: 'test-memory',
    type: 'profile_fact',
    title: 'workbench.memory.chatProfileTitle',
    body: 'workbench.memory.chatProfileProjection',
    confidence: 'medium',
    sourceRefs: ['chat.updated_profile'],
    status: 'accepted',
    createdAt: now,
  },
};
const memoryReply = {
  ...memorySession,
  memoryInbox: {
    id: 'memory-inbox-test',
    sessionId: memorySession.id,
    generatedAt: now,
    pendingCount: 0,
    acceptedCount: 1,
    rejectedCount: 0,
    mergedCount: 0,
    temporaryCount: 0,
    revokedCount: 0,
    items: [memoryItem],
    sourceRefs: ['chat.updated_profile'],
  },
};
const memoryReplySelection = getRenderableWorkbenchWidgetSelection(memoryReply);
assert(memoryReplySelection.phase === 'reply', 'accepted memory should move profile memory view to reply phase');
assert(memoryReplySelection.selectedTypes.includes('memory_candidate'), 'memory reply should keep memory candidate widget visible');

const dashboardSession = createDashboardBriefWorkbenchSession({ terminalState, insight: terminalState.insights.global });
assert(dashboardSession.intentBias === 'global', 'dashboard brief should use global intent bias');
assert(dashboardSession.defaultWidgetPreset === 'dashboard-brief', 'dashboard brief should declare dashboard preset');
assert(dashboardSession.subjectSpec?.id === 'dashboard-strategic-brief', 'dashboard brief should carry structured subject');

const lifeSession = createLifeStrategyWorkbenchSession({ terminalState, initialPrompt: 'Plan around my life constraints' });
const lifeInitial = getRenderableWorkbenchWidgetSelection(lifeSession);
assert(lifeSession.entryType === 'life_strategy', 'life strategy session should use life_strategy entry');
assert(lifeSession.intentBias === 'life', 'life strategy session should use life intent bias');
assert(lifeSession.defaultWidgetPreset === 'life-strategy', 'life strategy should declare life preset');
assert(lifeInitial.selectedTypes.includes('rail_card'), 'life strategy initial should include life rail card');

console.log(JSON.stringify({
  status: 'ok',
  checked: [
    'session-contract-subjectSpec',
    'dashboard-global-contract',
    'life-strategy-contract',
    'prompt-phase',
    'native-workbench-reply-widgets',
    'hydrated-initial-phase',
    'holding-initial',
    'holding-reply-response-widgets',
    'portfolio-initial',
    'portfolio-reply-response-widgets',
    'profile-memory-lifecycle-selection',
  ],
  holdingInitialTypes: holdingInitial.selectedTypes,
  holdingReplyTypes: holdingReplySelection.selectedTypes,
  nativePromptTypes: nativePromptSelection.selectedTypes,
  portfolioInitialTypes: portfolioInitial.selectedTypes,
  lifeInitialTypes: lifeInitial.selectedTypes,
  memoryReplyReason: memoryReplySelection.reason,
}));
