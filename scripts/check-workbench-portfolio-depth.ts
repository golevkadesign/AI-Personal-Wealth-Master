import { hydrateWorkbenchToolFacts } from '../server/services/workbenchTools';
import { buildPortfolioIntelligenceMap } from '../src/lib/portfolio-intelligence';
import { runWorkbenchRailOrchestration } from '../src/lib/workbench-rails';
import {
  createHoldingWorkbenchSession,
  createPortfolioIntelligenceWorkbenchSession,
} from '../src/lib/workbench-session';
import type { AccountPortfolio, DistributionItem, TerminalState } from '../src/types/terminal';
import type { HoldingWorkbenchAnalysis, WorkbenchWidgetManifest } from '../src/types/workbench';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const accountPortfolios: AccountPortfolio[] = [
  {
    accountId: 'longbridge-1',
    accountName: 'Longbridge Account 1',
    positions: [
      {
        symbol: 'NVDA.US',
        name: 'NVIDIA',
        quantity: 10,
        costPrice: 420,
        currentPrice: 600,
        marketValue: 6000,
        accountId: 'longbridge-1',
        accountName: 'Longbridge Account 1',
      },
      {
        symbol: 'VST.US',
        name: 'Vistra Energy',
        quantity: 10,
        costPrice: 80,
        currentPrice: 100,
        marketValue: 1000,
        accountId: 'longbridge-1',
        accountName: 'Longbridge Account 1',
      },
      {
        symbol: 'SGOV.US',
        name: 'iShares 0-3 Month Treasury Bond ETF',
        quantity: 5,
        costPrice: 99,
        currentPrice: 100,
        marketValue: 500,
        accountId: 'longbridge-1',
        accountName: 'Longbridge Account 1',
      },
    ],
    meta: {
      positionCount: 3,
      quoteCoverage: 1,
      valuationCoverage: 1,
      generatedAt: Date.now(),
    },
  },
];

const terminalState = {
  userPersona: { tags: [], description: '' },
  userProfile: {},
  metrics: {},
  goal: { name: 'Financial independence' },
  insights: {
    global: 'Portfolio review ready',
    private: '',
  },
  lifeStrategiesShort: [],
  lifeStrategiesLong: [],
  distributions: {
    liquidity: [],
    expenses: [],
    privateAssets: [],
    publicHoldings: [
      { id: 'NVDA.US', symbol: 'NVDA.US', name: 'NVIDIA', marketValue: 6000, value: 6000 },
      { id: 'VST.US', symbol: 'VST.US', name: 'Vistra Energy', marketValue: 1000, value: 1000 },
      { id: 'SGOV.US', symbol: 'SGOV.US', name: 'Treasury ETF', marketValue: 500, value: 500 },
    ],
    fixedAssets: [],
    options: [],
  },
  publicHoldingAccounts: accountPortfolios,
  _liveFetchedAt: Date.now(),
} as unknown as TerminalState;

const selectedHolding = {
  id: 'NVDA.US',
  symbol: 'NVDA.US',
  name: 'NVIDIA',
  marketValue: 6000,
  value: 6000,
  quantity: 10,
  currentPrice: 600,
} as DistributionItem;

const selectedHoldingAnalysis: HoldingWorkbenchAnalysis = {
  symbol: 'NVDA.US',
  source: 'fixture',
  fallbackUsed: false,
  history: [
    { date: '2026-06-24', close: 580 },
    { date: '2026-06-25', close: 600 },
  ] as any,
  quantSignals: {
    currentPrice: 600,
    changePercent: 3.4,
    trend: 'up',
    rsi: 58,
    macdHist: 1.2,
    adx: 26,
    signal: 'hold',
    buyPrice: 560,
    sellPrice: 660,
    support: 560,
    resistance: 660,
    stopLoss: 540,
    takeProfit: 690,
    missingIndicators: [],
  } as any,
  deterministicAdvice: {
    risks: ['portfolioIntelligence.testRisk'],
    opportunities: ['portfolioIntelligence.testOpportunity'],
    suggestedActions: ['portfolioIntelligence.testAction'],
  } as any,
  analysisStatus: 'success',
  sourceRefs: ['holding.quant_analysis.fixture'],
};

async function main() {
  const portfolioMap = buildPortfolioIntelligenceMap({ accountPortfolios, terminalState });
  assert(portfolioMap.strategySummary.currentState.totalMarketValue === 7500, 'portfolio strategy summary should preserve total market value');
  assert(portfolioMap.strategySummary.currentState.dominantAxis === portfolioMap.intentFingerprint.dominantAxis, 'strategy summary should reuse intent dominant axis');
  assert(portfolioMap.strategySummary.projectedAxes.some((axis) => axis.delta !== 0), 'strategy summary should expose projected axis deltas');
  assert(portfolioMap.strategySummary.missingPieceSummary.length === portfolioMap.missingPieces.length, 'strategy summary should summarize missing pieces');
  assert(portfolioMap.strategySummary.tiltPlan.length === portfolioMap.suggestedTilts.length, 'strategy summary should summarize tilt plan');
  assert(portfolioMap.strategySummary.executionBias !== 'await_data', 'valued portfolio should produce an executable bias');

  const portfolioSession = createPortfolioIntelligenceWorkbenchSession({ accountPortfolios, terminalState });
  const hydratedPortfolio = await hydrateWorkbenchToolFacts(portfolioSession);
  const hydratedMap = hydratedPortfolio.facts?.portfolioIntelligenceMap;
  assert(hydratedMap?.strategySummary.currentState.totalMarketValue === 7500, 'hydrated facts should carry strategy summary');
  const portfolioWidget = hydratedPortfolio.initialWidgets?.find((widget) => widget.type === 'portfolio_map');
  assert(Boolean(portfolioWidget?.props?.portfolioStrategySummary), 'portfolio initial widget should receive strategy summary props');

  const railRun = await runWorkbenchRailOrchestration(hydratedPortfolio);
  const railWidgets: WorkbenchWidgetManifest[] = railRun.railResults.flatMap((rail) => rail.widgetManifest);
  assert(
    railWidgets.some((widget) => Boolean(widget.props?.portfolioStrategySummary)),
    'agent rail widgets should receive the same portfolio strategy summary',
  );

  const holdingSession = createHoldingWorkbenchSession(selectedHolding, terminalState);
  const hydratedHolding = await hydrateWorkbenchToolFacts({
    ...holdingSession,
    facts: {
      ...(holdingSession.facts || {}),
      selectedHolding,
      selectedHoldingAnalysis,
      publicHoldingAccounts: accountPortfolios,
      sourceRefs: ['holding.entry.fixture'],
    },
  });
  const holdingStrategyWidget = hydratedHolding.initialWidgets?.find((widget) => widget.type === 'holding_strategy_deductions');
  assert(holdingStrategyWidget?.status === 'ready', 'holding strategy widget should become ready with existing analysis');
  assert((holdingStrategyWidget?.props?.holdingAnalysis as any)?.actionCount === 1, 'holding widget should carry deterministic action summary');
  assert((holdingStrategyWidget?.props?.holdingAnalysis as any)?.historyPoints === 2, 'holding widget should carry history summary');

  console.log(JSON.stringify({
    status: 'ok',
    checked: [
      'portfolio-strategy-summary-generated',
      'portfolio-widget-props-hydrated',
      'rail-widget-props-hydrated',
      'holding-widget-analysis-summary-preserved',
    ],
    portfolio: {
      totalMarketValue: portfolioMap.strategySummary.currentState.totalMarketValue,
      executionBias: portfolioMap.strategySummary.executionBias,
      missingPieces: portfolioMap.strategySummary.missingPieceSummary.length,
      tiltPlan: portfolioMap.strategySummary.tiltPlan.length,
      projectedAxes: portfolioMap.strategySummary.projectedAxes.length,
    },
    holding: {
      status: holdingStrategyWidget?.status,
      actionCount: (holdingStrategyWidget?.props?.holdingAnalysis as any)?.actionCount,
      historyPoints: (holdingStrategyWidget?.props?.holdingAnalysis as any)?.historyPoints,
    },
  }));
}

void main();
