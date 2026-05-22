export interface QuantSignals {
  currentPrice: number;
  changePercent: number;
  trend: string;
  ma5: number | null;
  ma20: number | null;
  rsi: number | null;
  macdHist: number | null;
  adx: number | null;
  signal: string;
  bbUpper: number | null;
  bbLower: number | null;
  buyPrice: number;
  sellPrice: number;
  support: number;
  resistance: number;
  stopLoss: number;
  takeProfit: number;
  missingIndicators?: string[];
}

export interface DeterministicAdvice {
  risks: string[];
  opportunities: string[];
  suggestedActions: string[];
}

export interface HistorySummary {
  sampleCount: number;
  startDate: string;
  endDate: string;
  interval: string;
}

export interface PositionAnalysisResult {
  symbol: string;
  source: string;
  fallbackUsed: boolean;
  history: any[];
  historySummary: HistorySummary;
  quantSignals: QuantSignals;
  deterministicAdvice: DeterministicAdvice;
}

export interface HoldingSnapshot {
  symbol: string;
  name?: string;
  quantity: number;
  marketValue: number;
  currency: string;
  currentPrice: number;
  costPrice?: number;
}

export interface AgentAnalysisSnapshot {
  id: string;
  timestamp: number;
  holdingSnapshot: HoldingSnapshot;
  quantSignals: QuantSignals;
  deterministicAdvice: DeterministicAdvice;
  historySummary: HistorySummary;
  marketDataSource: string;
  fallbackUsed: boolean;
  analysisStatus: 'idle' | 'loading' | 'success' | 'partial' | 'error';
}
