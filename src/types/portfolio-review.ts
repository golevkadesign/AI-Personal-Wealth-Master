import { AccountPortfolio } from './terminal';

export interface ReviewHolding {
  accountId?: string;
  accountName?: string;
  symbol?: string;
  name?: string;
  quantity?: number;
  costPrice?: number;
  currentPrice?: number;
  marketValue?: number;
  currency?: string;
  raw?: any;
}

export interface PortfolioReviewSnapshot {
  id: string;
  createdAt: number;
  source: 'longbridge' | 'screenshot' | 'manual' | 'mixed';
  accountPortfolios: AccountPortfolio[];
  flattenedHoldings: ReviewHolding[];
  totalMarketValue: number;
  accountCount: number;
  positionCount: number;
  dataConfidence: 'high' | 'medium' | 'low';
  missingFields: string[];
  warnings: string[];
}

export interface PositionDelta {
  symbol: string;
  name?: string;
  accountId?: string;
  accountName?: string;
  previousQuantity?: number;
  currentQuantity?: number;
  previousMarketValue?: number;
  currentMarketValue?: number;
  quantityDelta?: number;
  marketValueDelta?: number;
  actionType: 'new_position' | 'increase' | 'reduce' | 'exit' | 'unchanged' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface ActionPlanItem {
  title: string;
  rationale: string;
  triggerCondition?: string;
  invalidationCondition?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface PositionReview {
  symbol: string;
  name?: string;
  accountName?: string;
  currentRole: string;
  actionEvaluation: string;
  recommendation: '增持' | '继续持有' | '观察等待' | '分批止盈' | '降低仓位' | '清仓' | '换仓' | '对冲' | '暂不适合操作';
  recommendationStrength: '强' | '中' | '弱';
  horizon: '短线' | '波段' | '中线' | '长线';
  triggerConditions: string[];
  invalidationConditions: string[];
  risks: string[];
}

export interface PortfolioReviewReport {
  summary: string;
  portfolioDiagnosis: {
    portfolioType: string;
    topRisks: string[];
    topOpportunities: string[];
    avoidActions: string[];
  };
  positionReviews: PositionReview[];
  actionPlan: {
    shortTerm: ActionPlanItem[];
    midTerm: ActionPlanItem[];
    longTerm: ActionPlanItem[];
  };
  nextReviewNeeds: string[];
}

export interface PortfolioReviewSession {
  id: string;
  createdAt: number;
  currentSnapshot: PortfolioReviewSnapshot;
  previousSnapshot?: PortfolioReviewSnapshot;
  deltas: PositionDelta[];
  status: 'draft' | 'analyzing' | 'ready' | 'error';
  report?: PortfolioReviewReport;
  error?: string;
  reviewParams?: {
    riskPreference?: '保守' | '中性' | '激进' | '高波动可接受' | '';
    maxDrawdownTolerance?: '5%' | '10%' | '20%' | string;
    allowMargin?: '是' | '否' | '';
    allowOptions?: '是' | '否' | '';
    allowCrypto?: '是' | '否' | '';
  };
}

export interface PortfolioReviewMemory {
  lastReviewId: string;
  updatedAt: number;
  behavioralPatterns: string[];
  recurringMistakes: string[];
  riskPreferenceObserved?: string;
  lastActionItems: ActionPlanItem[];
  nextReviewFocus: string[];
}

