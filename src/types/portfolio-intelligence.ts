export type PortfolioExposureAxisId = 'growth' | 'defense' | 'liquidity' | 'hedge';

export interface PortfolioExposureAxis {
  id: PortfolioExposureAxisId;
  labelKey: string;
  value: number;
  projectedValue: number;
  color: string;
  sourceSymbols: string[];
}

export interface PortfolioIntelligencePosition {
  id: string;
  symbol: string;
  name: string;
  accountId?: string;
  accountName?: string;
  marketValue: number;
  weight: number;
  axis: PortfolioExposureAxisId;
  confidence: 'high' | 'medium' | 'low';
}

export interface PortfolioMissingPiece {
  id: string;
  labelKey: string;
  axis: PortfolioExposureAxisId;
  severity: 'high' | 'medium' | 'low';
  currentValue: number;
  targetValue: number;
}

export interface PortfolioSuggestedTilt {
  id: string;
  labelKey: string;
  fromAxis?: PortfolioExposureAxisId;
  toAxis: PortfolioExposureAxisId;
  magnitude: number;
  priority: 'high' | 'medium' | 'low';
}

export interface PortfolioIntentFingerprint {
  labelKey: string;
  concentrationScore: number;
  diversificationScore: number;
  dominantAxis: PortfolioExposureAxisId;
  topPositionWeight: number;
  topThreeWeight: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface PortfolioIntelligenceMap {
  id: string;
  generatedAt: number;
  totalMarketValue: number;
  currency: string;
  axes: PortfolioExposureAxis[];
  positions: PortfolioIntelligencePosition[];
  intentFingerprint: PortfolioIntentFingerprint;
  missingPieces: PortfolioMissingPiece[];
  suggestedTilts: PortfolioSuggestedTilt[];
  sourceRefs: string[];
  dataQuality: {
    accountCount: number;
    positionCount: number;
    valuedPositionCount: number;
    valuationCoverage: number;
    heuristicClassification: boolean;
  };
}
