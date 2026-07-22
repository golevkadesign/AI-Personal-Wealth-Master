import {
  WorkbenchActionPermission,
  WorkbenchDefaultWidgetPreset,
  WorkbenchEntryType,
  WorkbenchIntentBias,
  WorkbenchSessionSpec,
  WorkbenchSubjectSpec,
  WorkbenchWidgetManifest,
} from '../types/workbench';
import { buildSharedFactBundle } from './workbench-facts';
import { AccountPortfolio, DistributionItem, TerminalState } from '../types/terminal';

const DEFAULT_ACTIONS: WorkbenchActionPermission[] = ['chat', 'render_widgets'];

const sharedDecisionWidgets: WorkbenchWidgetManifest[] = [
  {
    id: 'shared-facts',
    type: 'shared_facts',
    titleKey: 'workbench.sharedFacts',
    status: 'awaiting_context',
    priority: 1,
  },
  {
    id: 'three-rails',
    type: 'rail_card',
    titleKey: 'workbench.threeRails',
    status: 'waiting_signals',
    priority: 2,
  },
  {
    id: 'cio-synthesis',
    type: 'cio_brief',
    titleKey: 'workbench.cioSynthesis',
    status: 'awaiting_context',
    priority: 3,
  },
  {
    id: 'memory-candidate',
    type: 'memory_candidate',
    titleKey: 'workbench.memoryCandidate',
    status: 'waiting_signals',
    priority: 4,
  },
];

export function createWorkbenchSessionSpec(input: {
  entryType: WorkbenchEntryType;
  titleKey: string;
  subject?: string;
  subjectSpec?: WorkbenchSubjectSpec;
  intentBias?: WorkbenchIntentBias;
  initialPrompt?: string;
  defaultWidgetPreset?: WorkbenchDefaultWidgetPreset | string;
  initialWidgets?: WorkbenchWidgetManifest[];
  allowedActions?: WorkbenchActionPermission[];
  facts?: WorkbenchSessionSpec['facts'];
  legacy?: WorkbenchSessionSpec['legacy'];
}): WorkbenchSessionSpec {
  return {
    id: `workbench-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    entryType: input.entryType,
    titleKey: input.titleKey,
    subject: input.subject,
    subjectSpec: input.subjectSpec,
    intentBias: input.intentBias || 'global',
    initialPrompt: input.initialPrompt,
    defaultWidgetPreset: input.defaultWidgetPreset,
    facts: input.facts,
    initialWidgets: input.initialWidgets || [],
    allowedActions: input.allowedActions || DEFAULT_ACTIONS,
    legacy: input.legacy,
    createdAt: Date.now(),
  };
}

export function createManualChatWorkbenchSession(terminalState?: TerminalState): WorkbenchSessionSpec {
  return createWorkbenchSessionSpec({
    entryType: 'manual_chat',
    titleKey: 'workbench.agentWorkbench',
    subject: 'Agent Workbench',
    subjectSpec: {
      type: 'custom',
      id: 'manual-chat',
      label: 'Agent Workbench',
    },
    intentBias: 'global',
    defaultWidgetPreset: 'manual-chat',
    facts: buildSharedFactBundle({
      terminalState,
      sourceRefs: ['manual_chat.entry'],
      missingFacts: ['user_prompt', 'rail_outputs'],
    }),
    allowedActions: ['chat', 'run_rails', 'render_widgets', 'propose_memory', 'project_dashboard'],
    initialWidgets: sharedDecisionWidgets,
  });
}

export function createPromptWorkbenchSession(userPrompt: string, terminalState?: TerminalState): WorkbenchSessionSpec {
  return createWorkbenchSessionSpec({
    entryType: 'manual_chat',
    titleKey: 'workbench.agentWorkbench',
    subject: userPrompt.slice(0, 80),
    subjectSpec: {
      type: 'custom',
      id: `prompt-${Date.now()}`,
      label: userPrompt.slice(0, 80),
      payload: { prompt: userPrompt },
    },
    intentBias: 'global',
    initialPrompt: userPrompt,
    defaultWidgetPreset: 'manual-chat',
    facts: buildSharedFactBundle({
      terminalState,
      userPrompt,
      sourceRefs: ['manual_prompt'],
      missingFacts: ['shared_facts', 'rail_outputs'],
    }),
    allowedActions: ['chat', 'run_rails', 'render_widgets', 'propose_memory'],
    initialWidgets: sharedDecisionWidgets,
  });
}

export function createProfileMemoryWorkbenchSession(terminalState?: TerminalState): WorkbenchSessionSpec {
  return createWorkbenchSessionSpec({
    entryType: 'profile_memory',
    titleKey: 'workbench.memoryProfileWorkbench',
    subject: 'Sovereign Profile / Memory Inbox',
    subjectSpec: {
      type: 'profile',
      id: 'sovereign-profile',
      label: 'Sovereign Profile / Memory Inbox',
    },
    intentBias: 'memory',
    defaultWidgetPreset: 'profile-memory',
    facts: buildSharedFactBundle({
      terminalState,
      sourceRefs: ['profile_memory.entry', 'terminal.userProfile', 'terminal.userPersona'],
      missingFacts: ['rail_outputs'],
    }),
    allowedActions: ['chat', 'run_rails', 'render_widgets', 'propose_memory', 'write_memory', 'update_profile', 'project_dashboard'],
    initialWidgets: [
      {
        id: 'memory-candidate',
        type: 'memory_candidate',
        titleKey: 'workbench.memoryCandidate',
        status: 'waiting_signals',
        priority: 1,
      },
      {
        id: 'shared-facts',
        type: 'shared_facts',
        titleKey: 'workbench.sharedFacts',
        status: 'partial',
        priority: 2,
      },
      {
        id: 'confidence',
        type: 'confidence',
        titleKey: 'workbench.confidence',
        status: 'waiting_signals',
        priority: 3,
      },
      {
        id: 'action-queue',
        type: 'action_queue',
        titleKey: 'workbench.actionQueue',
        status: 'waiting_signals',
        priority: 4,
      },
    ],
  });
}

export function createWidgetWorkbenchSession(input: {
  title: string;
  data?: unknown;
  role?: string;
  terminalState?: TerminalState;
}): WorkbenchSessionSpec {
  const facts = buildSharedFactBundle({
    terminalState: input.terminalState,
    sourceRefs: ['dashboard_widget'],
    missingFacts: input.data ? ['rail_outputs'] : ['widget_context', 'rail_outputs'],
  });

  return createWorkbenchSessionSpec({
    entryType: 'widget',
    titleKey: 'workbench.widgetWorkbench',
    subject: input.title,
    subjectSpec: {
      type: input.role === 'metric' ? 'metric' : 'custom',
      id: input.title,
      label: input.title,
      payload: {
        role: input.role,
        data: input.data,
      },
    },
    intentBias: 'global',
    defaultWidgetPreset: 'widget-context',
    facts,
    allowedActions: ['chat', 'run_rails', 'render_widgets', 'propose_memory', 'project_dashboard'],
    initialWidgets: [
      {
        id: 'source',
        type: 'source',
        titleKey: 'workbench.source',
        status: input.data ? 'ready' : 'awaiting_context',
        priority: 1,
      },
      {
        id: 'evidence',
        type: 'evidence',
        titleKey: 'workbench.evidence',
        status: input.data ? 'partial' : 'awaiting_context',
        priority: 2,
      },
      {
        id: 'confidence',
        type: 'confidence',
        titleKey: 'workbench.confidence',
        status: 'waiting_signals',
        priority: 3,
      },
      {
        id: 'action-queue',
        type: 'action_queue',
        titleKey: 'workbench.actionQueue',
        status: 'waiting_signals',
        priority: 4,
      },
    ],
  });
}

export function createDashboardBriefWorkbenchSession(input: {
  insight?: unknown;
  role?: string;
  terminalState?: TerminalState;
}): WorkbenchSessionSpec {
  const facts = buildSharedFactBundle({
    terminalState: input.terminalState,
    sourceRefs: ['dashboard.insights.global'],
    missingFacts: input.insight ? ['rail_outputs'] : ['strategic_brief', 'rail_outputs'],
  });

  return createWorkbenchSessionSpec({
    entryType: 'dashboard_brief',
    titleKey: 'workbench.strategicBriefWorkbench',
    subject: 'Strategic Brief',
    subjectSpec: {
      type: 'custom',
      id: 'dashboard-strategic-brief',
      label: 'Strategic Brief',
      payload: {
        role: input.role,
        insight: input.insight,
      },
    },
    intentBias: 'global',
    defaultWidgetPreset: 'dashboard-brief',
    facts,
    allowedActions: ['chat', 'run_rails', 'render_widgets', 'propose_memory', 'project_dashboard'],
    initialWidgets: [
      ...sharedDecisionWidgets,
      {
        id: 'evidence',
        type: 'evidence',
        titleKey: 'workbench.evidence',
        status: input.insight ? 'partial' : 'awaiting_context',
        priority: 5,
      },
      {
        id: 'confidence',
        type: 'confidence',
        titleKey: 'workbench.confidence',
        status: 'waiting_signals',
        priority: 6,
      },
    ],
  });
}

export function createHoldingWorkbenchSession(holding: DistributionItem, terminalState?: TerminalState): WorkbenchSessionSpec {
  const subject = String(holding.symbol || holding.name || holding.id || '');
  const hasHoldingIdentity = Boolean(holding.symbol || holding.name || holding.id);
  const hasHoldingValue = Number(holding.marketValue ?? holding.value ?? 0) > 0;
  const holdingSourceRefs = [
    'public_holding.selection',
    holding.accountId ? 'longbridge.account_position' : 'terminal.distributions.publicHoldings',
  ];
  const facts = buildSharedFactBundle({
    terminalState,
    selectedHolding: holding,
    sourceRefs: holdingSourceRefs,
    missingFacts: ['holding_quant_analysis', 'industry_map', 'rail_outputs', 'projected_exposure'],
  });

  return createWorkbenchSessionSpec({
    entryType: 'holding',
    titleKey: 'workbench.holdingWorkbench',
    subject,
    subjectSpec: {
      type: 'symbol',
      id: subject,
      label: holding.name || subject,
      payload: {
        symbol: holding.symbol,
        name: holding.name,
        accountId: holding.accountId,
        marketValue: holding.marketValue ?? holding.value,
      },
    },
    intentBias: 'equity',
    defaultWidgetPreset: 'holding-analysis',
    facts,
    allowedActions: ['chat', 'run_rails', 'render_widgets', 'run_simulation', 'propose_memory'],
    legacy: {
      surface: 'position_drawer',
      positionSymbol: subject,
    },
    initialWidgets: [
      {
        id: 'holding-quote-snapshot',
        type: 'holding_quote_snapshot',
        titleKey: 'workbench.holdingQuoteSnapshot',
        status: hasHoldingIdentity ? 'partial' : 'awaiting_context',
        priority: 1,
        sourceRefs: holdingSourceRefs,
      },
      {
        id: 'holding-value-summary',
        type: 'holding_value_summary',
        titleKey: 'workbench.holdingValueSummary',
        status: hasHoldingValue ? 'partial' : 'awaiting_context',
        priority: 2,
        sourceRefs: holdingSourceRefs,
      },
      {
        id: 'holding-sync-status',
        type: 'holding_sync_status',
        titleKey: 'workbench.holdingSyncStatus',
        status: holding.lastSyncTime || terminalState?.publicHoldingAccountsLastSyncAt || terminalState?.publicHoldingsLastSyncAt ? 'partial' : 'awaiting_context',
        priority: 3,
        sourceRefs: holdingSourceRefs,
      },
      {
        id: 'holding-trend-chart',
        type: 'holding_trend_chart',
        titleKey: 'workbench.holdingTrendChart',
        status: 'waiting_signals',
        priority: 4,
        sourceRefs: ['holding.quant_analysis'],
      },
      {
        id: 'holding-quant-indicators',
        type: 'holding_quant_indicators',
        titleKey: 'workbench.holdingQuantIndicators',
        status: 'waiting_signals',
        priority: 5,
        sourceRefs: ['holding.quant_analysis'],
      },
      {
        id: 'holding-strategy-deductions',
        type: 'holding_strategy_deductions',
        titleKey: 'workbench.holdingStrategyDeductions',
        status: 'waiting_signals',
        priority: 6,
        sourceRefs: ['holding.quant_analysis'],
      },
      {
        id: 'confidence',
        type: 'confidence',
        titleKey: 'workbench.confidence',
        status: 'waiting_signals',
        priority: 7,
      },
      {
        id: 'intent-fingerprint',
        type: 'intent_fingerprint',
        titleKey: 'workbench.intentFingerprint',
        status: 'waiting_signals',
        priority: 8,
      },
      {
        id: 'suggested-tilt',
        type: 'suggested_tilt',
        titleKey: 'workbench.suggestedTilt',
        status: 'waiting_signals',
        priority: 9,
      },
      {
        id: 'holding-analysis-snapshot-diff',
        type: 'holding_analysis_snapshot_diff',
        titleKey: 'workbench.holdingAnalysisSnapshotDiff',
        status: 'awaiting_context',
        priority: 10,
        sourceRefs: ['holding.analysis_snapshots'],
      },
      {
        id: 'current-exposure',
        type: 'current_exposure',
        titleKey: 'workbench.currentExposure',
        status: 'partial',
        priority: 1,
      },
    ],
  });
}

export function createPortfolioReviewWorkbenchSession(input: {
  sessionId?: string;
  accountPortfolios?: AccountPortfolio[];
  terminalState?: TerminalState;
}): WorkbenchSessionSpec {
  const hasAccounts = Boolean(input.accountPortfolios && input.accountPortfolios.length > 0);
  const facts = buildSharedFactBundle({
    terminalState: input.terminalState,
    accountPortfolios: input.accountPortfolios,
    sourceRefs: ['longbridge.account_portfolios'],
    missingFacts: hasAccounts ? ['rail_outputs', 'projected_exposure'] : ['public_holding_accounts', 'rail_outputs', 'projected_exposure'],
  });

  return createWorkbenchSessionSpec({
    entryType: 'portfolio_review',
    titleKey: 'workbench.portfolioReviewWorkbench',
    subject: input.sessionId,
    subjectSpec: {
      type: 'portfolio',
      id: input.sessionId || 'portfolio-review',
      label: 'Portfolio Review',
      payload: {
        accountCount: input.accountPortfolios?.length || 0,
      },
    },
    intentBias: 'allocation',
    defaultWidgetPreset: 'portfolio-review',
    facts,
    allowedActions: ['chat', 'run_rails', 'render_widgets', 'run_simulation', 'propose_memory', 'project_dashboard'],
    initialWidgets: [
      {
        id: 'portfolio-map',
        type: 'portfolio_map',
        titleKey: 'workbench.portfolioIntelligenceMap',
        status: hasAccounts ? 'partial' : 'awaiting_context',
        priority: 1,
      },
      {
        id: 'current-exposure',
        type: 'current_exposure',
        titleKey: 'workbench.currentExposure',
        status: hasAccounts ? 'partial' : 'awaiting_context',
        priority: 2,
      },
      {
        id: 'missing-pieces',
        type: 'missing_pieces',
        titleKey: 'workbench.missingPieces',
        status: 'waiting_signals',
        priority: 3,
      },
      {
        id: 'suggested-tilt',
        type: 'suggested_tilt',
        titleKey: 'workbench.suggestedTilt',
        status: 'waiting_signals',
        priority: 4,
      },
      {
        id: 'projected-exposure',
        type: 'projected_exposure',
        titleKey: 'workbench.projectedExposure',
        status: 'waiting_signals',
        priority: 5,
      },
    ],
  });
}

export function createPortfolioIntelligenceWorkbenchSession(input: {
  accountPortfolios?: AccountPortfolio[];
  terminalState?: TerminalState;
}): WorkbenchSessionSpec {
  const hasAccounts = Boolean(input.accountPortfolios && input.accountPortfolios.length > 0);
  const hasFallbackHoldings = Boolean(input.terminalState?.distributions?.publicHoldings?.length);
  const hasHoldings = hasAccounts || hasFallbackHoldings;
  const facts = buildSharedFactBundle({
    terminalState: input.terminalState,
    accountPortfolios: input.accountPortfolios,
    sourceRefs: hasAccounts ? ['longbridge.account_portfolios'] : ['terminal.distributions.publicHoldings'],
    missingFacts: hasHoldings ? ['rail_outputs'] : ['public_holdings', 'rail_outputs'],
  });

  return createWorkbenchSessionSpec({
    entryType: 'portfolio_intelligence',
    titleKey: 'workbench.portfolioIntelligenceMap',
    subject: 'Portfolio Intelligence Map',
    subjectSpec: {
      type: 'portfolio',
      id: 'portfolio-intelligence-map',
      label: 'Portfolio Intelligence Map',
      payload: {
        accountCount: input.accountPortfolios?.length || 0,
        hasFallbackHoldings,
      },
    },
    intentBias: 'allocation',
    defaultWidgetPreset: 'portfolio-intelligence',
    facts,
    allowedActions: ['chat', 'run_rails', 'render_widgets', 'run_simulation', 'propose_memory', 'project_dashboard'],
    initialWidgets: [
      {
        id: 'portfolio-map',
        type: 'portfolio_map',
        titleKey: 'workbench.portfolioIntelligenceMap',
        status: hasHoldings ? 'partial' : 'awaiting_context',
        priority: 1,
      },
      {
        id: 'current-exposure',
        type: 'current_exposure',
        titleKey: 'workbench.currentExposure',
        status: hasHoldings ? 'partial' : 'awaiting_context',
        priority: 2,
      },
      {
        id: 'intent-fingerprint',
        type: 'intent_fingerprint',
        titleKey: 'workbench.intentFingerprint',
        status: hasHoldings ? 'partial' : 'awaiting_context',
        priority: 3,
      },
      {
        id: 'missing-pieces',
        type: 'missing_pieces',
        titleKey: 'workbench.missingPieces',
        status: hasHoldings ? 'partial' : 'awaiting_context',
        priority: 4,
      },
      {
        id: 'suggested-tilt',
        type: 'suggested_tilt',
        titleKey: 'workbench.suggestedTilt',
        status: hasHoldings ? 'waiting_signals' : 'awaiting_context',
        priority: 5,
      },
      {
        id: 'projected-exposure',
        type: 'projected_exposure',
        titleKey: 'workbench.projectedExposure',
        status: hasHoldings ? 'waiting_signals' : 'awaiting_context',
        priority: 6,
      },
    ],
  });
}

export function createLifeStrategyWorkbenchSession(input: {
  terminalState?: TerminalState;
  goalId?: string;
  goalLabel?: string;
  initialPrompt?: string;
} = {}): WorkbenchSessionSpec {
  const label = input.goalLabel || 'Life Strategy Pathway';
  const facts = buildSharedFactBundle({
    terminalState: input.terminalState,
    userPrompt: input.initialPrompt,
    sourceRefs: ['life_strategy.entry', 'terminal.userProfile', 'terminal.userPersona'],
    missingFacts: ['life_constraints', 'rail_outputs', 'memory_candidates'],
  });

  return createWorkbenchSessionSpec({
    entryType: 'life_strategy',
    titleKey: 'workbench.lifeStrategyWorkbench',
    subject: label,
    subjectSpec: {
      type: 'goal',
      id: input.goalId || 'life-strategy',
      label,
      payload: {
        prompt: input.initialPrompt,
      },
    },
    intentBias: 'life',
    initialPrompt: input.initialPrompt,
    defaultWidgetPreset: 'life-strategy',
    facts,
    allowedActions: ['chat', 'run_rails', 'render_widgets', 'propose_memory', 'update_profile', 'project_dashboard'],
    initialWidgets: [
      {
        id: 'shared-facts',
        type: 'shared_facts',
        titleKey: 'workbench.sharedFacts',
        status: input.terminalState ? 'partial' : 'awaiting_context',
        priority: 1,
      },
      {
        id: 'life-rail',
        type: 'rail_card',
        titleKey: 'workbench.railTitles.life',
        status: 'waiting_signals',
        railId: 'life',
        priority: 2,
      },
      {
        id: 'action-queue',
        type: 'action_queue',
        titleKey: 'workbench.actionQueue',
        status: 'waiting_signals',
        priority: 3,
      },
      {
        id: 'memory-candidate',
        type: 'memory_candidate',
        titleKey: 'workbench.memoryCandidate',
        status: 'waiting_signals',
        priority: 4,
      },
      {
        id: 'confidence',
        type: 'confidence',
        titleKey: 'workbench.confidence',
        status: 'waiting_signals',
        priority: 5,
      },
    ],
  });
}
