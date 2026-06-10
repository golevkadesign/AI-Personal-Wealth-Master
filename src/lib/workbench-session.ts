import {
  WorkbenchActionPermission,
  WorkbenchEntryType,
  WorkbenchIntentBias,
  WorkbenchSessionSpec,
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
  intentBias?: WorkbenchIntentBias;
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
    intentBias: input.intentBias || 'general',
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
    intentBias: 'general',
    facts: buildSharedFactBundle({
      terminalState,
      sourceRefs: ['manual_chat.entry'],
      missingFacts: ['user_prompt', 'rail_outputs'],
    }),
    allowedActions: ['chat', 'render_widgets', 'propose_memory'],
    initialWidgets: sharedDecisionWidgets,
    legacy: {
      surface: 'drawer',
      drawerOpen: true,
    },
  });
}

export function createPromptWorkbenchSession(userPrompt: string, terminalState?: TerminalState): WorkbenchSessionSpec {
  return createWorkbenchSessionSpec({
    entryType: 'manual_chat',
    titleKey: 'workbench.agentWorkbench',
    subject: userPrompt.slice(0, 80),
    intentBias: 'general',
    facts: buildSharedFactBundle({
      terminalState,
      userPrompt,
      sourceRefs: ['manual_prompt'],
      missingFacts: ['shared_facts', 'rail_outputs'],
    }),
    allowedActions: ['chat', 'run_rails', 'render_widgets', 'propose_memory'],
    initialWidgets: sharedDecisionWidgets,
    legacy: {
      surface: 'drawer',
      drawerOpen: true,
    },
  });
}

export function createWidgetCopilotWorkbenchSession(input: {
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
    intentBias: 'general',
    facts,
    allowedActions: ['chat', 'render_widgets', 'propose_memory'],
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
        id: 'legacy-chat',
        type: 'legacy_chat',
        titleKey: 'workbench.legacyMode',
        status: 'partial',
        priority: 4,
      },
    ],
    legacy: {
      surface: 'copilot',
      copilotTitle: input.title,
      copilotRole: input.role,
    },
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
    intentBias: 'allocation',
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
    legacy: {
      surface: 'copilot',
      copilotTitle: 'Strategic Brief',
      copilotRole: input.role,
    },
  });
}

export function createHoldingWorkbenchSession(holding: DistributionItem, terminalState?: TerminalState): WorkbenchSessionSpec {
  const subject = String(holding.symbol || holding.name || holding.id || '');
  const facts = buildSharedFactBundle({
    terminalState,
    selectedHolding: holding,
    sourceRefs: ['public_holding.selection'],
    missingFacts: ['industry_map', 'rail_outputs', 'projected_exposure'],
  });

  return createWorkbenchSessionSpec({
    entryType: 'holding',
    titleKey: 'workbench.holdingWorkbench',
    subject,
    intentBias: 'equity',
    facts,
    allowedActions: ['chat', 'run_rails', 'render_widgets', 'run_simulation', 'propose_memory'],
    initialWidgets: [
      {
        id: 'current-exposure',
        type: 'current_exposure',
        titleKey: 'workbench.currentExposure',
        status: 'partial',
        priority: 1,
      },
      {
        id: 'intent-fingerprint',
        type: 'intent_fingerprint',
        titleKey: 'workbench.intentFingerprint',
        status: 'waiting_signals',
        priority: 2,
      },
      {
        id: 'suggested-tilt',
        type: 'suggested_tilt',
        titleKey: 'workbench.suggestedTilt',
        status: 'waiting_signals',
        priority: 3,
      },
      {
        id: 'confidence',
        type: 'confidence',
        titleKey: 'workbench.confidence',
        status: 'waiting_signals',
        priority: 4,
      },
    ],
    legacy: {
      surface: 'position_drawer',
      positionSymbol: subject,
    },
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
    intentBias: 'allocation',
    facts,
    allowedActions: ['run_rails', 'render_widgets', 'run_simulation', 'propose_memory', 'project_dashboard'],
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
    legacy: {
      surface: 'portfolio_review_drawer',
      portfolioReviewSessionId: input.sessionId,
    },
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
    intentBias: 'simulation',
    facts,
    allowedActions: ['run_rails', 'render_widgets', 'run_simulation', 'propose_memory', 'project_dashboard'],
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
