import { AccountPortfolio, AccountPosition, DistributionItem, TerminalState } from '../types/terminal';
import {
  PortfolioExposureAxis,
  PortfolioExposureAxisId,
  PortfolioIntelligenceMap,
  PortfolioIntelligencePosition,
  PortfolioMissingPiece,
  PortfolioSuggestedTilt,
} from '../types/portfolio-intelligence';

const AXIS_META: Record<PortfolioExposureAxisId, Pick<PortfolioExposureAxis, 'id' | 'labelKey' | 'color'>> = {
  growth: { id: 'growth', labelKey: 'portfolioIntelligence.axes.growth', color: '#00F09C' },
  defense: { id: 'defense', labelKey: 'portfolioIntelligence.axes.defense', color: '#2EA8FF' },
  liquidity: { id: 'liquidity', labelKey: 'portfolioIntelligence.axes.liquidity', color: '#8F42FF' },
  hedge: { id: 'hedge', labelKey: 'portfolioIntelligence.axes.hedge', color: '#FFB000' },
};

const SYMBOL_AXIS: Record<string, PortfolioExposureAxisId> = {
  NVDA: 'growth',
  TSLA: 'growth',
  MSFT: 'growth',
  AAPL: 'growth',
  AMD: 'growth',
  AVGO: 'growth',
  SMCI: 'growth',
  NBIS: 'growth',
  CRWV: 'growth',
  ASTS: 'growth',
  APLD: 'growth',
  DXYZ: 'growth',
  QQQ: 'growth',
  TQQQ: 'growth',
  VST: 'hedge',
  XLE: 'hedge',
  USO: 'hedge',
  GLD: 'hedge',
  IAU: 'hedge',
  SLV: 'hedge',
  SH: 'hedge',
  PSQ: 'hedge',
  VIXY: 'hedge',
  XLU: 'defense',
  XLV: 'defense',
  XLP: 'defense',
  JNJ: 'defense',
  PG: 'defense',
  KO: 'defense',
  PEP: 'defense',
  SGOV: 'liquidity',
  BIL: 'liquidity',
  SHV: 'liquidity',
  ICSH: 'liquidity',
  MINT: 'liquidity',
  TLT: 'liquidity',
  IEF: 'liquidity',
};

const KEYWORD_AXIS: Array<{ axis: PortfolioExposureAxisId; words: string[] }> = [
  { axis: 'growth', words: ['ai', 'cloud', 'software', 'semiconductor', 'chip', 'electric', 'growth', 'nasdaq', 'space', 'data center'] },
  { axis: 'defense', words: ['health', 'utility', 'consumer', 'staple', 'dividend', 'defense', 'insurance'] },
  { axis: 'liquidity', words: ['cash', 'treasury', 'bond', 'bill', 'money market', 'income', 'short term'] },
  { axis: 'hedge', words: ['gold', 'silver', 'oil', 'energy', 'commodity', 'inverse', 'volatility', 'hedge', 'bitcoin'] },
];

const TARGET_EXPOSURE: Record<PortfolioExposureAxisId, number> = {
  growth: 42,
  defense: 22,
  liquidity: 18,
  hedge: 18,
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const normalizeSymbol = (symbol?: string) => {
  const raw = (symbol || '').toUpperCase().trim();
  return raw.split('.')[0] || raw;
};

const getPositionMarketValue = (position: Partial<AccountPosition | DistributionItem>): number => {
  const record = position as Record<string, unknown>;
  const marketValue = Number(record.marketValue);
  const value = Number(record.value);
  if (!Number.isNaN(marketValue) && marketValue > 0) return marketValue;
  if (!Number.isNaN(value) && value > 0) return value;

  const quantity = Number(record.quantity) || 0;
  const currentPrice = Number(record.currentPrice) || Number(record.current_price) || Number(record.lastPrice);
  if (quantity > 0 && currentPrice > 0) return quantity * currentPrice;
  return 0;
};

const classifyPosition = (position: Partial<AccountPosition | DistributionItem>): { axis: PortfolioExposureAxisId; confidence: 'high' | 'medium' | 'low' } => {
  const record = position as Record<string, unknown>;
  const symbol = normalizeSymbol(String(record.symbol || ''));
  if (SYMBOL_AXIS[symbol]) {
    return { axis: SYMBOL_AXIS[symbol], confidence: 'high' };
  }

  const haystack = `${record.name || ''} ${record.category || ''} ${record.type || ''}`.toLowerCase();
  const keywordHit = KEYWORD_AXIS.find((entry) => entry.words.some((word) => haystack.includes(word)));
  if (keywordHit) {
    return { axis: keywordHit.axis, confidence: 'medium' };
  }

  return { axis: 'growth', confidence: 'low' };
};

const flattenAccountPositions = (accounts: AccountPortfolio[] = []) =>
  accounts.flatMap((account) =>
    (account.positions || []).map((position) => ({
      ...position,
      accountId: account.accountId,
      accountName: account.accountName,
    })),
  );

const flattenFallbackHoldings = (terminalState?: TerminalState) =>
  (terminalState?.distributions?.publicHoldings || []).map((holding, index) => ({
    ...holding,
    symbol: holding.symbol || holding.name || `holding-${index}`,
    name: holding.name || holding.symbol || `holding-${index}`,
  }));

const normalizePositions = (input: {
  accountPortfolios?: AccountPortfolio[];
  terminalState?: TerminalState;
}): PortfolioIntelligencePosition[] => {
  const accountPositions = flattenAccountPositions(input.accountPortfolios || []);
  const rawPositions = accountPositions.length > 0 ? accountPositions : flattenFallbackHoldings(input.terminalState);
  const valued = rawPositions
    .map((position, index) => {
      const marketValue = getPositionMarketValue(position);
      const classification = classifyPosition(position);
      const symbol = String(position.symbol || position.name || `holding-${index}`);
      return {
        id: `${position.accountId || 'portfolio'}-${symbol}-${index}`,
        symbol,
        name: String(position.name || symbol),
        accountId: position.accountId,
        accountName: position.accountName,
        marketValue,
        weight: 0,
        axis: classification.axis,
        confidence: classification.confidence,
      };
    })
    .filter((position) => position.marketValue > 0);

  const total = valued.reduce((sum, position) => sum + position.marketValue, 0);
  return valued.map((position) => ({
    ...position,
    weight: total > 0 ? (position.marketValue / total) * 100 : 0,
  }));
};

const deriveAxes = (positions: PortfolioIntelligencePosition[]): PortfolioExposureAxis[] => {
  if (positions.length === 0) {
    return (Object.keys(AXIS_META) as PortfolioExposureAxisId[]).map((axis) => ({
      ...AXIS_META[axis],
      value: 0,
      projectedValue: 0,
      sourceSymbols: [],
    }));
  }

  const totals = positions.reduce<Record<PortfolioExposureAxisId, number>>((next, position) => {
    next[position.axis] += position.weight;
    return next;
  }, { growth: 0, defense: 0, liquidity: 0, hedge: 0 });

  const missing = (Object.keys(TARGET_EXPOSURE) as PortfolioExposureAxisId[]).reduce<Record<PortfolioExposureAxisId, number>>((next, axis) => {
    next[axis] = Math.max(0, TARGET_EXPOSURE[axis] - totals[axis]);
    return next;
  }, { growth: 0, defense: 0, liquidity: 0, hedge: 0 });
  const totalMissing = Object.values(missing).reduce((sum, value) => sum + value, 0) || 1;

  return (Object.keys(AXIS_META) as PortfolioExposureAxisId[]).map((axis) => {
    const improvement = Math.min(missing[axis], 10 + (missing[axis] / totalMissing) * 12);
    const reduction = axis === 'growth' && totals.growth > TARGET_EXPOSURE.growth + 8 ? Math.min(12, totals.growth - TARGET_EXPOSURE.growth) : 0;
    return {
      ...AXIS_META[axis],
      value: Math.round(totals[axis] * 10) / 10,
      projectedValue: Math.round(clamp(totals[axis] + improvement - reduction) * 10) / 10,
      sourceSymbols: positions.filter((position) => position.axis === axis).slice(0, 6).map((position) => position.symbol),
    };
  });
};

const deriveMissingPieces = (axes: PortfolioExposureAxis[], positions: PortfolioIntelligencePosition[]): PortfolioMissingPiece[] => {
  if (positions.length === 0) return [];
  const pieces: PortfolioMissingPiece[] = [];
  axes.forEach((axis) => {
    const target = TARGET_EXPOSURE[axis.id];
    if (axis.value < target * 0.45) {
      pieces.push({
        id: `${axis.id}-underweight`,
        axis: axis.id,
        labelKey: `portfolioIntelligence.missing.${axis.id}`,
        severity: axis.value < target * 0.25 ? 'high' : 'medium',
        currentValue: axis.value,
        targetValue: target,
      });
    }
  });

  const topWeight = positions[0]?.weight || 0;
  if (topWeight > 34) {
    pieces.push({
      id: 'concentration-guardrail',
      axis: 'defense',
      labelKey: 'portfolioIntelligence.missing.concentration',
      severity: topWeight > 48 ? 'high' : 'medium',
      currentValue: topWeight,
      targetValue: 28,
    });
  }

  return pieces.slice(0, 5);
};

const deriveSuggestedTilts = (axes: PortfolioExposureAxis[], missingPieces: PortfolioMissingPiece[]): PortfolioSuggestedTilt[] => {
  const growth = axes.find((axis) => axis.id === 'growth')?.value || 0;
  return missingPieces.map((piece, index) => ({
    id: `tilt-${piece.id}`,
    labelKey: `portfolioIntelligence.tilts.${piece.id}`,
    fromAxis: growth > TARGET_EXPOSURE.growth + 8 ? 'growth' : undefined,
    toAxis: piece.axis,
    magnitude: Math.round(Math.min(12, Math.max(4, piece.targetValue - piece.currentValue)) * 10) / 10,
    priority: index === 0 && piece.severity === 'high' ? 'high' : piece.severity,
  }));
};

const deriveIntent = (positions: PortfolioIntelligencePosition[], axes: PortfolioExposureAxis[]) => {
  const sorted = [...positions].sort((a, b) => b.weight - a.weight);
  const topPositionWeight = sorted[0]?.weight || 0;
  const topThreeWeight = sorted.slice(0, 3).reduce((sum, position) => sum + position.weight, 0);
  const dominantAxis = [...axes].sort((a, b) => b.value - a.value)[0]?.id || 'growth';
  const concentrationScore = clamp((topPositionWeight * 0.9) + (topThreeWeight * 0.45));
  const diversificationScore = clamp(100 - concentrationScore + (axes.filter((axis) => axis.value >= 10).length * 8));
  const hasLowConfidence = positions.some((position) => position.confidence === 'low');
  const confidence: 'high' | 'medium' | 'low' = hasLowConfidence ? 'medium' : 'high';

  return {
    labelKey:
      dominantAxis === 'growth' && concentrationScore > 48
        ? 'portfolioIntelligence.intent.growthConcentrated'
        : dominantAxis === 'liquidity'
          ? 'portfolioIntelligence.intent.liquidityFirst'
          : dominantAxis === 'hedge'
            ? 'portfolioIntelligence.intent.hedged'
            : 'portfolioIntelligence.intent.balanced',
    concentrationScore: Math.round(concentrationScore),
    diversificationScore: Math.round(diversificationScore),
    dominantAxis,
    topPositionWeight: Math.round(topPositionWeight * 10) / 10,
    topThreeWeight: Math.round(topThreeWeight * 10) / 10,
    confidence,
  };
};

export function buildPortfolioIntelligenceMap(input: {
  accountPortfolios?: AccountPortfolio[];
  terminalState?: TerminalState;
}): PortfolioIntelligenceMap {
  const positions = normalizePositions(input).sort((a, b) => b.weight - a.weight);
  const axes = deriveAxes(positions);
  const missingPieces = deriveMissingPieces(axes, positions);
  const suggestedTilts = deriveSuggestedTilts(axes, missingPieces);
  const totalMarketValue = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const accountCount = input.accountPortfolios?.length || 0;
  const rawPositionCount = accountCount > 0
    ? flattenAccountPositions(input.accountPortfolios).length
    : flattenFallbackHoldings(input.terminalState).length;

  return {
    id: `portfolio-intelligence-${input.terminalState?._liveFetchedAt || Date.now()}`,
    generatedAt: Date.now(),
    totalMarketValue,
    currency: positions[0]?.symbol?.endsWith('.HK') ? 'HKD' : positions[0] ? 'USD' : 'USD',
    axes,
    positions,
    intentFingerprint: deriveIntent(positions, axes),
    missingPieces,
    suggestedTilts,
    sourceRefs: [
      accountCount > 0 ? 'longbridge.account_portfolios' : 'terminal.distributions.publicHoldings',
      input.terminalState?.marketContext ? 'market_context' : '',
    ].filter(Boolean),
    dataQuality: {
      accountCount,
      positionCount: rawPositionCount,
      valuedPositionCount: positions.length,
      valuationCoverage: rawPositionCount > 0 ? Math.round((positions.length / rawPositionCount) * 100) / 100 : 0,
      heuristicClassification: true,
    },
  };
}
