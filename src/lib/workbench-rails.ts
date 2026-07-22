import {
  AgentRailResult,
  MemoryCandidate,
  SharedFactBundle,
  WorkbenchRailDefinition,
  WorkbenchRailId,
  WorkbenchRailRun,
  WorkbenchSessionSpec,
  WorkbenchWidgetStatus,
  WorkbenchWidgetType,
} from '../types/workbench';
import { buildPortfolioIntelligenceMap } from './portfolio-intelligence';

export const WORKBENCH_RAIL_DEFINITIONS: WorkbenchRailDefinition[] = [
  {
    railId: 'equity',
    titleKey: 'workbench.railTitles.equity',
    intentBias: 'equity',
    requiredFacts: ['public_holdings', 'market_context'],
    widgetTypes: ['current_exposure', 'intent_fingerprint', 'suggested_tilt'],
  },
  {
    railId: 'allocation',
    titleKey: 'workbench.railTitles.allocation',
    intentBias: 'allocation',
    requiredFacts: ['public_holdings', 'market_context', 'strategic_brief'],
    widgetTypes: ['portfolio_map', 'current_exposure', 'projected_exposure'],
  },
  {
    railId: 'life',
    titleKey: 'workbench.railTitles.life',
    intentBias: 'life',
    requiredFacts: ['sovereign_profile', 'strategic_brief'],
    widgetTypes: ['action_queue', 'memory_candidate'],
  },
];

const WIDGET_TITLE_KEY: Record<WorkbenchWidgetType, string> = {
  shared_facts: 'workbench.sharedFacts',
  rail_card: 'workbench.threeRails',
  cio_brief: 'workbench.cioSynthesis',
  evidence: 'workbench.evidence',
  source: 'workbench.source',
  confidence: 'workbench.confidence',
  memory_candidate: 'workbench.memoryCandidate',
  action_queue: 'workbench.actionQueue',
  portfolio_map: 'workbench.portfolioIntelligenceMap',
  current_exposure: 'workbench.currentExposure',
  intent_fingerprint: 'workbench.intentFingerprint',
  missing_pieces: 'workbench.missingPieces',
  suggested_tilt: 'workbench.suggestedTilt',
  projected_exposure: 'workbench.projectedExposure',
  holding_quote_snapshot: 'workbench.holdingQuoteSnapshot',
  holding_value_summary: 'workbench.holdingValueSummary',
  holding_sync_status: 'workbench.holdingSyncStatus',
  holding_trend_chart: 'workbench.holdingTrendChart',
  holding_quant_indicators: 'workbench.holdingQuantIndicators',
  holding_strategy_deductions: 'workbench.holdingStrategyDeductions',
  holding_analysis_snapshot_diff: 'workbench.holdingAnalysisSnapshotDiff',
};

const mapFactConfidence = (confidence?: SharedFactBundle['confidence']): AgentRailResult['confidence'] => {
  if (confidence === 'high') return 'high';
  if (confidence === 'medium') return 'medium';
  return 'low';
};

const getRailMissingFacts = (definition: WorkbenchRailDefinition, facts?: Partial<SharedFactBundle>) => {
  const sessionMissing = new Set(facts?.missingFacts || []);
  return definition.requiredFacts.filter((fact) => sessionMissing.has(fact) || !isFactReady(fact, facts));
};

const getPortfolioIntelligenceMap = (facts?: Partial<SharedFactBundle>) => {
  if (facts?.portfolioIntelligenceMap) return facts.portfolioIntelligenceMap;
  if (!hasPortfolioFacts(facts)) return undefined;
  return buildPortfolioIntelligenceMap({
    accountPortfolios: facts?.publicHoldingAccounts,
    terminalState: facts?.terminalState,
  });
};

const hasStrategicBrief = (facts?: Partial<SharedFactBundle>) => {
  const insight = facts?.terminalState?.insights?.global;
  const defaultGlobalInsight = '\u7b49\u5f85\u6570\u636e\u6ce8\u5165...';
  return typeof insight === 'string' && insight.trim().length > 0 && insight.trim() !== defaultGlobalInsight;
};

const FACT_READINESS_CHECKS: Record<string, (facts?: Partial<SharedFactBundle>) => boolean> = {
  terminal_state: (facts) => Boolean(facts?.summary?.hasTerminalState || facts?.terminalState),
  public_holdings: (facts) => hasPortfolioFacts(facts),
  public_holding_accounts: (facts) => Boolean(facts?.publicHoldingAccounts?.some((account) => account.positions?.length)),
  market_context: (facts) => Boolean(facts?.summary?.hasMarketContext || facts?.marketContext),
  strategic_brief: (facts) => hasStrategicBrief(facts),
  sovereign_profile: (facts) => Boolean(facts?.summary?.hasSovereignProfile || facts?.sovereignProfile),
  selected_holding_identity: (facts) => Boolean(facts?.selectedHolding?.symbol || facts?.selectedHolding?.name),
  holding_quant_analysis: (facts) => Boolean(facts?.selectedHoldingAnalysis),
  industry_map: (facts) => Boolean(getPortfolioIntelligenceMap(facts)?.positions.length),
  projected_exposure: (facts) => {
    const portfolioMap = getPortfolioIntelligenceMap(facts);
    return Boolean(portfolioMap && portfolioMap.dataQuality.valuedPositionCount > 0);
  },
  rail_outputs: () => true,
  user_prompt: (facts) => Boolean(facts?.summary?.hasUserPrompt || facts?.userPrompt),
  shared_facts: (facts) => Boolean(facts?.sourceRefs?.length),
};

const isFactReady = (fact: string, facts?: Partial<SharedFactBundle>) => {
  const check = FACT_READINESS_CHECKS[fact];
  if (check) return check(facts);
  return !facts?.missingFacts?.includes(fact);
};

const getRailStatus = (
  definition: WorkbenchRailDefinition,
  facts?: Partial<SharedFactBundle>,
): WorkbenchWidgetStatus => {
  if (!isFactReady('terminal_state', facts)) return 'blocked';
  const missingFacts = getRailMissingFacts(definition, facts);
  if (missingFacts.length === 0) return 'ready';
  if (missingFacts.length < definition.requiredFacts.length) return 'partial';
  return 'awaiting_context';
};

const getSummaryKey = (railId: WorkbenchRailId, status: WorkbenchWidgetStatus) => {
  if (status === 'ready') return `workbench.railSummaries.${railId}.ready`;
  if (status === 'partial') return `workbench.railSummaries.${railId}.partial`;
  if (status === 'blocked') return `workbench.railSummaries.${railId}.blocked`;
  return `workbench.railSummaries.${railId}.awaiting`;
};

const nowId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const hasPortfolioFacts = (facts?: Partial<SharedFactBundle>) =>
  Boolean(
    facts?.summary?.positionCount ||
    facts?.summary?.publicHoldingCount ||
    facts?.publicHoldingAccounts?.some((account) => account.positions?.length),
  );

const createMemoryCandidates = (
  definition: WorkbenchRailDefinition,
  sessionSpec: WorkbenchSessionSpec,
  status: WorkbenchWidgetStatus,
): MemoryCandidate[] => {
  const facts = sessionSpec.facts;
  const sourceRefs = facts?.sourceRefs || [];
  const profileVersion = facts?.sovereignProfile?.version || 1;

  if (definition.railId === 'equity' && hasPortfolioFacts(facts)) {
    const portfolioMap = buildPortfolioIntelligenceMap({
      accountPortfolios: facts?.publicHoldingAccounts,
      terminalState: facts?.terminalState,
    });
    return [
      {
        id: nowId('memory-equity-intent'),
        type: 'behavioral_pattern',
        title: 'workbench.memory.equityIntentTitle',
        body: portfolioMap.intentFingerprint.labelKey,
        confidence: status === 'ready' ? 'high' : 'medium',
        sourceRefs: [...sourceRefs, ...portfolioMap.sourceRefs],
        structuredPatch: {
          version: profileVersion,
          behavioralPatterns: {
            publicMarketIntent: portfolioMap.intentFingerprint,
          },
        },
        status: 'pending',
        createdAt: Date.now(),
      },
    ];
  }

  if (definition.railId === 'allocation' && hasPortfolioFacts(facts)) {
    const portfolioMap = buildPortfolioIntelligenceMap({
      accountPortfolios: facts?.publicHoldingAccounts,
      terminalState: facts?.terminalState,
    });
    return [
      {
        id: nowId('memory-allocation-policy'),
        type: 'decision_rule',
        title: 'workbench.memory.allocationGuardrailTitle',
        body: portfolioMap.missingPieces.length > 0
          ? portfolioMap.missingPieces.map((piece) => piece.labelKey).join(', ')
          : 'portfolioIntelligence.missing.none',
        confidence: portfolioMap.dataQuality.valuationCoverage >= 0.8 ? 'high' : 'medium',
        sourceRefs: [...sourceRefs, ...portfolioMap.sourceRefs],
        structuredPatch: {
          version: profileVersion,
          allocationPolicy: {
            exposureAxes: portfolioMap.axes,
            suggestedTilts: portfolioMap.suggestedTilts,
          },
        },
        status: 'pending',
        createdAt: Date.now(),
      },
    ];
  }

  if (definition.railId === 'life' && facts?.sovereignProfile) {
    return [
      {
        id: nowId('memory-life-profile'),
        type: 'profile_fact',
        title: 'workbench.memory.lifeProfileTitle',
        body: 'workbench.memory.lifeProfileProjection',
        confidence: facts.confidence === 'high' ? 'high' : 'medium',
        sourceRefs,
        structuredPatch: {
          version: profileVersion,
          decisionLedger: [
            {
              sessionId: sessionSpec.id,
              entryType: sessionSpec.entryType,
              capturedAt: Date.now(),
              intentBias: sessionSpec.intentBias,
            },
          ],
        },
        status: 'pending',
        createdAt: Date.now(),
      },
    ];
  }

  return [];
};

const createRailActions = (
  definition: WorkbenchRailDefinition,
  status: WorkbenchWidgetStatus,
  missingFacts: string[],
) => {
  if (missingFacts.length > 0) {
    return [
      {
        id: `${definition.railId}-complete-context`,
        labelKey: 'workbench.actions.completeContext',
        intentBias: definition.intentBias,
        priority: 'medium' as const,
        status: status === 'blocked' ? 'blocked' as const : 'pending' as const,
        payload: {
          missingFacts,
        },
      },
    ];
  }

  const actionByRail: Record<WorkbenchRailId, string> = {
    equity: 'workbench.actions.reviewExposure',
    allocation: 'workbench.actions.runPortfolioMap',
    life: 'workbench.actions.updateProfile',
  };

  return [
    {
      id: `${definition.railId}-next-action`,
      labelKey: actionByRail[definition.railId],
      intentBias: definition.intentBias,
      priority: 'high' as const,
      status: 'ready' as const,
    },
  ];
};

const MISSING_FACT_RISK_KEY: Record<string, string> = {
  public_holdings: 'workbench.railRisks.missingPublicHoldings',
  public_holding_accounts: 'workbench.railRisks.missingPublicHoldings',
  market_context: 'workbench.railRisks.missingMarketContext',
  strategic_brief: 'workbench.railRisks.missingStrategicBrief',
  sovereign_profile: 'workbench.railRisks.missingSovereignProfile',
  holding_quant_analysis: 'workbench.railRisks.missingHoldingQuantAnalysis',
};

const createRailRiskKeys = (
  definition: WorkbenchRailDefinition,
  facts?: Partial<SharedFactBundle>,
  missingFacts: string[] = [],
) => {
  const riskKeys = missingFacts.map((fact) => MISSING_FACT_RISK_KEY[fact] || `missing:${fact}`);
  const portfolioMap = getPortfolioIntelligenceMap(facts);
  const valuationCoverage = portfolioMap?.dataQuality.valuationCoverage || 0;
  const hasValuedPositions = Boolean(portfolioMap && portfolioMap.dataQuality.valuedPositionCount > 0);
  const highSeverityPieces = portfolioMap?.missingPieces.filter((piece) => piece.severity === 'high') || [];

  if (hasValuedPositions && valuationCoverage < 0.8) {
    riskKeys.push('workbench.railRisks.lowValuationCoverage');
  }

  if (definition.railId === 'equity') {
    if ((portfolioMap?.intentFingerprint.concentrationScore || 0) >= 60) {
      riskKeys.push('workbench.railRisks.highConcentration');
    }
    if (facts?.selectedHoldingAnalysis?.deterministicAdvice?.risks?.length) {
      riskKeys.push('workbench.railRisks.holdingQuantRisk');
    }
  }

  if (definition.railId === 'allocation') {
    if (highSeverityPieces.length > 0) {
      riskKeys.push('workbench.railRisks.missingAllocationPieces');
    }
    const growthAxis = portfolioMap?.axes.find((axis) => axis.id === 'growth');
    if ((growthAxis?.value || 0) >= 58) {
      riskKeys.push('workbench.railRisks.growthOverweight');
    }
  }

  if (definition.railId === 'life') {
    if (hasValuedPositions && !facts?.sovereignProfile) {
      riskKeys.push('workbench.railRisks.lifeConstraintUnknown');
    }
    if ((portfolioMap?.intentFingerprint.concentrationScore || 0) >= 60 && facts?.sovereignProfile) {
      riskKeys.push('workbench.railRisks.lifeHighBetaNeedsConstraint');
    }
  }

  return Array.from(new Set(riskKeys));
};

async function runSingleRail(
  definition: WorkbenchRailDefinition,
  sessionSpec: WorkbenchSessionSpec,
): Promise<AgentRailResult> {
  const facts = sessionSpec.facts;
  const status = getRailStatus(definition, facts);
  const missingFacts = getRailMissingFacts(definition, facts);
  const summaryKey = getSummaryKey(definition.railId, status);
  const memoryCandidates = createMemoryCandidates(definition, sessionSpec, status);
  const actions = createRailActions(definition, status, missingFacts);
  const risks = createRailRiskKeys(definition, facts, missingFacts);
  const portfolioMap = getPortfolioIntelligenceMap(facts);

  return {
    railId: definition.railId,
    titleKey: definition.titleKey,
    status,
    summaryKey,
    summary: summaryKey,
    confidence: status === 'ready' ? mapFactConfidence(facts?.confidence) : 'low',
    evidenceRefs: facts?.sourceRefs || [],
    missingFacts,
    risks,
    actions,
    widgetManifest: definition.widgetTypes.map((type, index) => ({
      id: `${definition.railId}-${type}`,
      type,
      titleKey: WIDGET_TITLE_KEY[type],
      railId: definition.railId,
      status,
      priority: index + 1,
      sourceRefs: facts?.sourceRefs || [],
      props: {
        railId: definition.railId,
        requiredFacts: definition.requiredFacts,
        missingFacts,
        portfolioMapId: portfolioMap?.id,
        portfolioDataQuality: portfolioMap?.dataQuality,
        portfolioStrategySummary: portfolioMap?.strategySummary,
      },
    })),
    memoryCandidates,
  };
}

const deriveRunStatus = (railResults: AgentRailResult[]): WorkbenchWidgetStatus => {
  const readyCount = railResults.filter((rail) => rail.status === 'ready').length;
  const partialCount = railResults.filter((rail) => rail.status === 'partial').length;
  const blockedCount = railResults.filter((rail) => rail.status === 'blocked').length;
  if (readyCount === railResults.length) return 'ready';
  if (readyCount > 0 || partialCount > 0) return 'partial';
  if (blockedCount === railResults.length) return 'blocked';
  return 'awaiting_context';
};

export async function runWorkbenchRailOrchestration(sessionSpec: WorkbenchSessionSpec): Promise<WorkbenchRailRun> {
  const startedAt = Date.now();
  const railResults = await Promise.all(
    WORKBENCH_RAIL_DEFINITIONS.map((definition) => runSingleRail(definition, sessionSpec)),
  );
  const missingFacts = Array.from(new Set(railResults.flatMap((rail) => rail.missingFacts)));
  const readyCount = railResults.filter((rail) => rail.status === 'ready').length;
  const partialCount = railResults.filter((rail) => rail.status === 'partial').length;
  const blockedCount = railResults.filter((rail) => rail.status === 'blocked').length;

  return {
    id: `rail-run-${startedAt}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: sessionSpec.id,
    status: deriveRunStatus(railResults),
    startedAt,
    completedAt: Date.now(),
    railResults,
    sourceRefs: sessionSpec.facts?.sourceRefs || [],
    missingFacts,
    summary: {
      readyCount,
      partialCount,
      blockedCount,
      railCount: railResults.length,
    },
  };
}

export function createWorkbenchRailDebugSnapshot(sessionSpec: WorkbenchSessionSpec | null) {
  const railRun = sessionSpec?.railRun;
  if (!railRun) return null;
  return {
    status: railRun.status,
    railCount: railRun.summary.railCount,
    readyCount: railRun.summary.readyCount,
    partialCount: railRun.summary.partialCount,
    blockedCount: railRun.summary.blockedCount,
    missingFactCount: railRun.missingFacts.length,
    railStatuses: railRun.railResults.map((rail) => `${rail.railId}:${rail.status}`).join(','),
  };
}
