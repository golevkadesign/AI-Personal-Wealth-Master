import { AccountPortfolio } from '../../types/terminal';
import { PortfolioReviewSnapshot, ReviewHolding } from '../../types/portfolio-review';
import { translateI18n, type AppLanguage } from '../../i18n/translations';

interface CreateSnapshotParams {
  accountPortfolios: AccountPortfolio[];
  source?: 'longbridge' | 'screenshot' | 'manual' | 'mixed';
  language?: AppLanguage;
}

export function createPortfolioReviewSnapshot(params: CreateSnapshotParams): PortfolioReviewSnapshot {
  const accountPortfolios = params.accountPortfolios || [];
  const source = params.source || 'manual';
  const language = params.language || 'zh-CN';
  const t = (key: string, values?: Record<string, string | number>) => translateI18n(language, key, values);
  
  const id = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : `snap_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  const createdAt = Date.now();
  const flattenedHoldings: ReviewHolding[] = [];
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  let totalMarketValue = 0;
  let accountCount = accountPortfolios.length;
  let positionCount = 0;
  let validMarketValueCount = 0;
  let totalMeasuredPositions = 0;

  accountPortfolios.forEach(acc => {
    const positions = acc.positions || [];
    if (positions.length === 0) {
      warnings.push(t('portfolioReview.snapshotWarnings.accountNoPositions', {
        account: acc.accountName || acc.accountId || '-',
      }));
    }

    positions.forEach(pos => {
      positionCount++;
      totalMeasuredPositions++;

      // Check missing fields
      const missingInPos: string[] = [];
      if (pos.quantity === undefined || pos.quantity === null) {
        missingInPos.push('quantity');
      }
      if (pos.costPrice === undefined || pos.costPrice === null) {
        missingInPos.push('costPrice');
      }
      if (pos.currentPrice === undefined || pos.currentPrice === null) {
        missingInPos.push('currentPrice');
      }
      if (pos.marketValue === undefined || pos.marketValue === null) {
        missingInPos.push('marketValue');
      }

      if (missingInPos.length > 0) {
        missingFields.push(t('portfolioReview.snapshotWarnings.missingFields', {
          account: acc.accountName || acc.accountId || '-',
          symbol: pos.symbol || pos.name || t('portfolioReview.snapshotWarnings.unknownInstrument'),
          fields: missingInPos.join(', '),
        }));
      }

      // Calculate holding's value
      let calculatedValue = 0;
      if (pos.marketValue !== undefined && pos.marketValue !== null) {
        calculatedValue = pos.marketValue;
        validMarketValueCount++;
      } else if ((pos as any).value !== undefined && (pos as any).value !== null) {
        calculatedValue = (pos as any).value;
        validMarketValueCount++;
      } else if (pos.quantity && pos.currentPrice) {
        calculatedValue = pos.quantity * pos.currentPrice;
        validMarketValueCount++;
      }

      totalMarketValue += calculatedValue;

      flattenedHoldings.push({
        accountId: acc.accountId,
        accountName: acc.accountName,
        symbol: pos.symbol,
        name: pos.name,
        quantity: pos.quantity,
        costPrice: pos.costPrice,
        currentPrice: pos.currentPrice,
        marketValue: calculatedValue,
        currency: pos.currency,
        raw: pos
      });
    });
  });

  // Calculate dataConfidence
  let dataConfidence: 'high' | 'medium' | 'low' = 'high';
  if (accountCount === 0 || totalMeasuredPositions === 0) {
    dataConfidence = 'low';
    warnings.push(t('portfolioReview.snapshotWarnings.noValidHoldings'));
  } else {
    const validRatio = validMarketValueCount / totalMeasuredPositions;
    if (validRatio < 0.5) {
      dataConfidence = 'low';
      warnings.push(t('portfolioReview.snapshotWarnings.lowValuationCoverage'));
    } else if (validRatio < 0.85 || missingFields.length > 0) {
      dataConfidence = 'medium';
      warnings.push(t('portfolioReview.snapshotWarnings.incompleteFields'));
    }
  }

  return {
    id,
    createdAt,
    source,
    accountPortfolios,
    flattenedHoldings,
    totalMarketValue,
    accountCount,
    positionCount,
    dataConfidence,
    missingFields,
    warnings
  };
}
