import type {
  HoldingWorkbenchAnalysis,
  WorkbenchSessionSpec,
  WorkbenchWidgetManifest,
  WorkbenchWidgetStatus,
} from '../../src/types/workbench';
import { buildSharedFactBundle } from '../../src/lib/workbench-facts';
import { buildPortfolioIntelligenceMap } from '../../src/lib/portfolio-intelligence';
import type { PortfolioIntelligenceMap } from '../../src/types/portfolio-intelligence';
import { analyzeHistory, fetchStockHistory } from './quantEngine';
import type { LongbridgeAccount } from './longbridgeAdapter';

const unique = (items: Array<string | undefined | null>) =>
  Array.from(new Set(items.filter((item): item is string => Boolean(item))));

type WorkbenchToolOptions = {
  longbridgeAccounts?: LongbridgeAccount[];
};

function getHoldingSymbol(holding: any) {
  const raw = String(holding?.symbol || holding?.ticker || holding?.name || '').trim();
  if (!raw) return '';
  return raw.toUpperCase();
}

function selectLongbridgeAccountForHolding(
  accounts: LongbridgeAccount[] | undefined,
  holding: any,
) {
  const validAccounts = (accounts || []).filter((account) => (
    account?.appKey && account?.appSecret && account?.accessToken
  ));
  if (validAccounts.length === 0) return undefined;

  const holdingAccountId = String(holding?.accountId || '').trim();
  const holdingAccountName = String(holding?.accountName || '').trim();
  const matched = validAccounts.find((account) => (
    (holdingAccountId && account.id === holdingAccountId) ||
    (holdingAccountName && account.name === holdingAccountName)
  )) || validAccounts[0];

  return {
    ...matched,
    market: holding?.market || String(holding?.symbol || '').split('.')[1],
  };
}

function getHoldingMarketValue(holding: any) {
  const marketValue = Number(holding?.marketValue);
  if (Number.isFinite(marketValue) && marketValue > 0) return marketValue;
  const value = Number(holding?.value);
  if (Number.isFinite(value) && value > 0) return value;
  const quantity = Number(holding?.quantity) || 0;
  const currentPrice = Number(holding?.currentPrice || holding?.lastPrice || holding?.costPrice) || 0;
  return quantity > 0 && currentPrice > 0 ? quantity * currentPrice : 0;
}

function getHoldingCurrentPrice(holding: any) {
  const currentPrice = Number(holding?.currentPrice || holding?.lastPrice || holding?._livePrice);
  if (Number.isFinite(currentPrice) && currentPrice > 0) return currentPrice;
  const quantity = Number(holding?.quantity) || 0;
  const marketValue = getHoldingMarketValue(holding);
  if (quantity > 0 && marketValue > 0) return marketValue / quantity;
  const costPrice = Number(holding?.costPrice);
  return Number.isFinite(costPrice) && costPrice > 0 ? costPrice : undefined;
}

function getAnalysisStatus(analysis: HoldingWorkbenchAnalysis | null): WorkbenchWidgetStatus {
  if (!analysis) return 'waiting_signals';
  if (analysis.analysisStatus === 'success') return 'ready';
  if (analysis.analysisStatus === 'partial') return 'partial';
  if (analysis.analysisStatus === 'error') return 'error';
  if (analysis.analysisStatus === 'loading') return 'waiting_signals';
  return 'awaiting_context';
}

function createHoldingStrategyProps(analysis: HoldingWorkbenchAnalysis | null, holding?: any) {
  const quantSignals = analysis?.quantSignals as unknown as Record<string, unknown> | undefined;
  const deterministicAdvice = analysis?.deterministicAdvice as unknown as Record<string, unknown> | undefined;
  return {
    symbol: getHoldingSymbol(holding) || analysis?.symbol || '',
    analysisStatus: analysis?.analysisStatus || 'idle',
    source: analysis?.source || 'none',
    fallbackUsed: Boolean(analysis?.fallbackUsed),
    historyPoints: analysis?.history?.length || 0,
    currentPrice: quantSignals?.currentPrice,
    trend: quantSignals?.trend,
    signal: quantSignals?.signal,
    support: quantSignals?.support,
    resistance: quantSignals?.resistance,
    stopLoss: quantSignals?.stopLoss,
    takeProfit: quantSignals?.takeProfit,
    missingIndicators: quantSignals?.missingIndicators || [],
    riskCount: Array.isArray(deterministicAdvice?.risks) ? deterministicAdvice.risks.length : 0,
    opportunityCount: Array.isArray(deterministicAdvice?.opportunities) ? deterministicAdvice.opportunities.length : 0,
    actionCount: Array.isArray(deterministicAdvice?.suggestedActions) ? deterministicAdvice.suggestedActions.length : 0,
    sourceRefs: analysis?.sourceRefs || [],
  };
}

function hydrateHoldingWidgetStatus(
  widgets: WorkbenchWidgetManifest[] | undefined,
  analysis: HoldingWorkbenchAnalysis | null,
  holding?: any,
) {
  const analysisStatus = getAnalysisStatus(analysis);
  const hasHistory = Boolean(analysis?.history?.length);
  const hasQuant = Boolean(analysis?.quantSignals);
  const hasAdvice = Boolean(analysis?.deterministicAdvice);
  const holdingAnalysis = createHoldingStrategyProps(analysis, holding);
  const statusByType: Record<string, WorkbenchWidgetStatus> = {
    holding_trend_chart: hasHistory ? analysisStatus : analysisStatus === 'error' ? 'error' : 'waiting_signals',
    holding_quant_indicators: hasQuant ? analysisStatus : analysisStatus === 'error' ? 'error' : 'waiting_signals',
    holding_strategy_deductions: hasAdvice ? analysisStatus : analysisStatus === 'error' ? 'error' : 'waiting_signals',
    holding_sync_status: analysis ? analysisStatus : 'partial',
    confidence: analysis ? analysisStatus : 'waiting_signals',
  };

  return (widgets || []).map((widget) => ({
    ...widget,
    status: statusByType[widget.type] || widget.status,
    sourceRefs: unique([...(widget.sourceRefs || []), ...(analysis?.sourceRefs || [])]),
    props: {
      ...(widget.props || {}),
      holdingAnalysis,
    },
  }));
}

const PORTFOLIO_WIDGET_TYPES = new Set([
  'portfolio_map',
  'current_exposure',
  'intent_fingerprint',
  'missing_pieces',
  'suggested_tilt',
  'projected_exposure',
]);

function getPortfolioWidgetStatus(
  widget: WorkbenchWidgetManifest,
  portfolioMap: PortfolioIntelligenceMap,
): WorkbenchWidgetStatus {
  if (!PORTFOLIO_WIDGET_TYPES.has(widget.type)) return widget.status || 'awaiting_context';
  if (portfolioMap.dataQuality.positionCount === 0) return 'awaiting_context';
  if (portfolioMap.dataQuality.valuedPositionCount === 0) return 'waiting_signals';
  if (widget.type === 'projected_exposure') {
    return portfolioMap.suggestedTilts.length > 0 || portfolioMap.axes.some((axis) => axis.projectedValue !== axis.value)
      ? 'ready'
      : 'partial';
  }
  if (widget.type === 'missing_pieces' || widget.type === 'suggested_tilt') {
    return portfolioMap.dataQuality.valuationCoverage >= 0.8 ? 'ready' : 'partial';
  }
  return 'ready';
}

function hydratePortfolioWidgetStatus(
  widgets: WorkbenchWidgetManifest[] | undefined,
  portfolioMap: PortfolioIntelligenceMap,
) {
  return (widgets || []).map((widget) => {
    if (!PORTFOLIO_WIDGET_TYPES.has(widget.type)) return widget;
    return {
      ...widget,
      status: getPortfolioWidgetStatus(widget, portfolioMap),
      sourceRefs: unique([...(widget.sourceRefs || []), ...portfolioMap.sourceRefs, 'portfolio_intelligence.map']),
      props: {
        ...(widget.props || {}),
        portfolioMapId: portfolioMap.id,
        portfolioDataQuality: portfolioMap.dataQuality,
        portfolioStrategySummary: portfolioMap.strategySummary,
      },
    };
  });
}

async function runHoldingQuantAnalysisTool(
  session: WorkbenchSessionSpec,
  options: WorkbenchToolOptions = {},
): Promise<HoldingWorkbenchAnalysis | null> {
  const holding = session.facts?.selectedHolding;
  const symbol = getHoldingSymbol(holding);
  if (!holding || !symbol) return null;

  const currentAnalysis = session.facts?.selectedHoldingAnalysis;
  if (currentAnalysis?.analysisStatus === 'success' || currentAnalysis?.analysisStatus === 'partial') {
    return currentAnalysis;
  }

  const sourceRefs = ['holding.quant_analysis', `holding.symbol.${symbol}`];
  try {
    const longbridgeAccount = selectLongbridgeAccountForHolding(options.longbridgeAccounts, holding);
    const historyResult = await fetchStockHistory(symbol, true, longbridgeAccount);
    if (!historyResult?.history?.length) {
      return {
        symbol,
        source: 'none',
        fallbackUsed: true,
        history: [],
        analysisStatus: 'error',
        sourceRefs: unique([...sourceRefs, 'holding.quant_analysis.error']),
      };
    }

    const holdingSnapshot = {
      quantity: Number((holding as any).quantity) || 0,
      currentPrice: getHoldingCurrentPrice(holding),
      marketValue: getHoldingMarketValue(holding),
    };
    const analysisInfo = analyzeHistory(historyResult.history, holdingSnapshot);
    if (!analysisInfo) {
      return {
        symbol,
        source: historyResult.source,
        fallbackUsed: historyResult.fallbackUsed,
        history: historyResult.history,
        analysisStatus: 'error',
        sourceRefs: unique([...sourceRefs, `holding.quant_analysis.${historyResult.source}`, 'holding.quant_analysis.error']),
      };
    }

    const missingIndicators = analysisInfo.quantSignals.missingIndicators || [];
    return {
      symbol,
      source: historyResult.source,
      fallbackUsed: historyResult.fallbackUsed,
      history: historyResult.history,
      historySummary: analysisInfo.historySummary,
      quantSignals: analysisInfo.quantSignals,
      deterministicAdvice: analysisInfo.deterministicAdvice,
      analysisStatus: missingIndicators.length > 0 ? 'partial' : 'success',
      sourceRefs: unique([...sourceRefs, `holding.quant_analysis.${historyResult.source}`]),
    };
  } catch (error) {
    console.warn('[WorkbenchTools] holding quant analysis failed:', error);
    return {
      symbol,
      source: 'error',
      fallbackUsed: true,
      history: [],
      analysisStatus: 'error',
      sourceRefs: unique([...sourceRefs, 'holding.quant_analysis.error']),
    };
  }
}

export async function hydrateWorkbenchToolFacts(
  session: WorkbenchSessionSpec,
  options: WorkbenchToolOptions = {},
): Promise<WorkbenchSessionSpec> {
  let nextSession = session;

  if (session.entryType === 'holding') {
    const analysis = await runHoldingQuantAnalysisTool(session, options);
    if (analysis) {
      const facts = session.facts || {};
      const nextSourceRefs = unique([
        ...(facts.sourceRefs || []),
        ...(analysis.sourceRefs || []),
      ]);
      const nextMissingFacts = (facts.missingFacts || []).filter((fact) => fact !== 'holding_quant_analysis');
      const nextFacts = buildSharedFactBundle({
        terminalState: facts.terminalState,
        selectedHolding: facts.selectedHolding,
        selectedHoldingAnalysis: analysis,
        accountPortfolios: facts.publicHoldingAccounts,
        portfolioIntelligenceMap: facts.portfolioIntelligenceMap,
        userPrompt: facts.userPrompt,
        sourceRefs: nextSourceRefs,
        missingFacts: nextMissingFacts,
        confidence: analysis.analysisStatus === 'success'
          ? 'high'
          : analysis.analysisStatus === 'partial'
            ? 'medium'
            : facts.confidence,
      });

      nextSession = {
        ...session,
        facts: nextFacts,
        initialWidgets: hydrateHoldingWidgetStatus(session.initialWidgets, analysis, facts.selectedHolding),
      };
    }
  }

  const facts = nextSession.facts || {};
  const portfolioMap = facts.portfolioIntelligenceMap || buildPortfolioIntelligenceMap({
    accountPortfolios: facts.publicHoldingAccounts,
    terminalState: facts.terminalState,
  });
  if (portfolioMap.dataQuality.positionCount === 0) return nextSession;

  const nextSourceRefs = unique([
    ...(facts.sourceRefs || []),
    ...portfolioMap.sourceRefs,
    'portfolio_intelligence.map',
  ]);
  const nextMissingFacts = (facts.missingFacts || []).filter((fact) => ![
    'industry_map',
    'projected_exposure',
    'public_holding_accounts',
  ].includes(fact));
  const nextFacts = buildSharedFactBundle({
    terminalState: facts.terminalState,
    selectedHolding: facts.selectedHolding,
    selectedHoldingAnalysis: facts.selectedHoldingAnalysis,
    accountPortfolios: facts.publicHoldingAccounts,
    portfolioIntelligenceMap: portfolioMap,
    userPrompt: facts.userPrompt,
    sourceRefs: nextSourceRefs,
    missingFacts: nextMissingFacts,
    confidence: portfolioMap.dataQuality.valuationCoverage >= 0.8
      ? 'high'
      : portfolioMap.dataQuality.valuedPositionCount > 0
        ? 'medium'
        : facts.confidence,
  });

  return {
    ...nextSession,
    facts: nextFacts,
    initialWidgets: hydratePortfolioWidgetStatus(nextSession.initialWidgets, portfolioMap),
    dashboardProjection: nextSession.dashboardProjection
      ? {
        ...nextSession.dashboardProjection,
        portfolioIntelligenceMap: portfolioMap,
        sourceRefs: unique([
          ...nextSession.dashboardProjection.sourceRefs,
          ...nextSourceRefs,
        ]),
        trace: nextSession.dashboardProjection.trace
          ? {
            ...nextSession.dashboardProjection.trace,
            sourceRefs: unique([
              ...nextSession.dashboardProjection.trace.sourceRefs,
              ...nextSourceRefs,
            ]),
          }
          : nextSession.dashboardProjection.trace,
      }
      : nextSession.dashboardProjection,
  };
}
