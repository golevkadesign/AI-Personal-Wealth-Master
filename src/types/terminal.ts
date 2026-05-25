export const LIVE_VALUATION_VERSION = 3;

export interface UserPersona {
  tags: string[];
  description: string;
}

export interface UserProfile {
  [key: string]: any;
}

export interface Metrics {
  netWorth: number;
  netWorthSummary?: string;
  liquidity: number;
  liquiditySummary?: string;
  safetyRatio: number;
  safetyRatioSummary: string;
  fcf: number;
  fcfSummary: string;
}

export interface PublicHolding {
  name: string;
  value: number;
  
  symbol?: string;
  quantity?: number;
  costPrice?: number;
  quantSignals?: {
    currentPrice: number;
    changePercent: number;
    trend: 'up' | 'down';
    rsi: number;
    macdHist: number;
    adx: number;
    signal: 'buy' | 'sell' | 'hold';
    buyPrice: number;
    sellPrice: number;
  };
}

export interface DistributionItem {
  id?: string;
  name?: string;
  value?: number;
  currency?: string;
  category?: string;
  type?: string;
  [key: string]: any;
}

export interface Distributions {
  liquidity: DistributionItem[];
  expenses: DistributionItem[];
  privateAssets: DistributionItem[];
  publicHoldings: DistributionItem[];
  fixedAssets: DistributionItem[];
  options: DistributionItem[];
}

export interface Goal {
  name: string;
  current: number;
  target: number;
  index: number;
}

export interface Insights {
  global: string;
  private: string;
  liquidity?: string;
  publicText?: string;
  publicSummary?: string;
  options?: string;
  fixedAssets?: string;
  expenses?: string;
  public?: any;
}

export interface LifeStrategy {
  title: string;
  description: string;
  timeNode: string;
}

export interface Snapshot {
  timestamp: number;
  metrics: any;
  distributions: any;
}

export interface AccountPosition {
  symbol: string;
  name: string;
  quantity: number;
  costPrice: number;
  currentPrice?: number;
  marketValue?: number;
  currency?: string;
  valuationSource?: string;
  accountId: string;
  accountName: string;
}

export interface AccountPortfolio {
  accountId: string;
  accountName: string;
  positions: AccountPosition[];
  meta: {
    positionCount: number;
    quoteCoverage?: number;
    missingQuoteSymbols?: string[];
    generatedAt: number;
    error?: string;
  };
}

export interface SDUIComponent {
  id: string;
  type: string;
  props: Record<string, any>;
  children?: SDUIComponent[];
}

export interface TerminalState {
  userPersona: UserPersona;
  userProfile: UserProfile;
  metrics: Metrics;
  distributions: Distributions;
  goal: Goal;
  insights: Insights;
  lifeStrategiesShort: LifeStrategy[];
  lifeStrategiesLong: LifeStrategy[];
  _liveSources?: string[];
  _liveValuationVersion?: number;
  _liveFetchedAt?: number;
  dynamicWidgets?: SDUIComponent[];
  dashboardSchema?: SDUIComponent[];
  historicalSnapshots?: Snapshot[];
  publicHoldingsSyncStatus?: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  publicHoldingsError?: string;
  publicHoldingsLastSyncAt?: number;
  publicHoldingAccounts?: AccountPortfolio[];
  publicHoldingAccountsSyncStatus?: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  publicHoldingAccountsError?: string;
  publicHoldingAccountsLastSyncAt?: number;
  [key: string]: any;
}
