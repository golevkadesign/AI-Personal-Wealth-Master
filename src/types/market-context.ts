export type MarketInstrumentCategory =
  | 'equity_index'
  | 'rates'
  | 'credit'
  | 'fx'
  | 'commodity'
  | 'crypto'
  | 'volatility'
  | 'position_quote'
  | 'unknown';

export type MarketDataSource =
  | 'stooq'
  | 'longbridge'
  | 'yahoo'
  | 'alpha_vantage'
  | 'fred'
  | 'manual'
  | 'fallback';

export type MarketDataQuality = 'high' | 'medium' | 'low';

export interface MarketInstrumentSnapshot {
  symbol: string;
  label: string;
  category: MarketInstrumentCategory;
  source: MarketDataSource;
  asOf: number;

  close?: number;
  change1D?: number;
  change1M?: number;
  change3M?: number;
  change6M?: number;

  volatility20D?: number;
  maxDrawdown3M?: number;
  relativeToSPY3M?: number;

  dataQuality: MarketDataQuality;
  warnings?: string[];

  raw?: unknown;
}

export interface MarketFactorSnapshot {
  id: string;
  label: string;
  category:
    | 'risk_appetite'
    | 'rate_pressure'
    | 'dollar_pressure'
    | 'credit_condition'
    | 'commodity_impulse'
    | 'volatility'
    | 'china_hk_risk'
    | 'crypto_beta'
    | 'unknown';

  value: 'positive' | 'neutral' | 'negative' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
}

export interface MarketRegime {
  riskMode: 'risk_on' | 'neutral' | 'risk_off' | 'unknown';
  ratePressure:
    | 'rising_rate_pressure'
    | 'falling_rate_pressure'
    | 'neutral'
    | 'unknown';
  dollarPressure:
    | 'strong_usd'
    | 'weak_usd'
    | 'neutral'
    | 'unknown';
  creditStress: 'elevated' | 'normal' | 'unknown';
  commodityImpulse:
    | 'inflationary'
    | 'disinflationary'
    | 'mixed'
    | 'unknown';
  volatilityState: 'calm' | 'normal' | 'stressed' | 'unknown';
  summary: string;
}

export interface CrossAssetSignal {
  id: string;
  title: string;
  severity: 'info' | 'watch' | 'warning' | 'critical';
  evidence: string[];
  affectedExposures: string[];
  interpretation: string;
  suggestedQuestions: string[];
}

export interface MarketMacroEnhancement {
  id: string;
  label: string;
  category:
    | 'macro'
    | 'rates'
    | 'inflation'
    | 'growth'
    | 'commodity'
    | 'sentiment'
    | 'unknown';
  source: 'fred' | 'alpha_vantage';
  value?: number;
  unit?: string;
  asOf?: number;
  change1M?: number;
  change3M?: number;
  dataQuality: 'high' | 'medium' | 'low';
  interpretation?: string;
  warnings?: string[];
}

export interface MarketContextSourceHealth {
  source: 'stooq' | 'fred' | 'alpha_vantage';
  status: 'ok' | 'partial' | 'failed' | 'not_configured';
  expectedCount?: number;
  successCount?: number;
  warningCount?: number;
  lastUpdatedAt?: number;
  notes?: string[];
}

export interface MarketContextQualitySummary {
  status: 'ready' | 'degraded' | 'stale' | 'failed';
  confidence: 'high' | 'medium' | 'low';
  coverageRatio: number;
  instrumentCoverageRatio: number;
  enhancementCoverageRatio?: number;
  sourceHealth: MarketContextSourceHealth[];
  summary: string;
}

export interface MarketContext {
  generatedAt: number;
  asOf?: number;
  freshness: 'intraday' | 'daily' | 'delayed' | 'stale' | 'unknown';
  sourceSummary: string[];
  dataQuality: MarketDataQuality;

  instruments: MarketInstrumentSnapshot[];
  factors: MarketFactorSnapshot[];
  regime: MarketRegime;
  crossAssetSignals: CrossAssetSignal[];

  warnings: string[];
  macroEnhancements?: MarketMacroEnhancement[];
  qualitySummary?: MarketContextQualitySummary;
}
