/**
 * Dashboard Visibility Utility
 * Shared rules to identify 'empty', 'pending', and 'active' status for MetricCards and dynamic charts
 * ensuring a clean desktop terminal view free of meaningless placeholders when database profile is unhydrated.
 */

export function hasMeaningfulNumber(value: any, explicitZeroAllowed = false): boolean {
  if (value === undefined || value === null) return false;
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return false;
  if (num === 0) {
    return explicitZeroAllowed;
  }
  return true;
}

export function hasDistributionData(items: any[]): boolean {
  if (!Array.isArray(items)) return false;
  return items.some(item => {
    if (!item) return false;
    const val = Number(item.value ?? item.marketValue ?? item.amount ?? 0);
    if (val > 0) return true;
    
    // Check quantity * price if available
    const q = Number(item.quantity ?? 0);
    const p = Number(item.price ?? 0);
    if (q * p > 0) return true;

    // Check positions in accounts if recursive
    if (Array.isArray(item.positions) && item.positions.length > 0) {
      return item.positions.some((pos: any) => {
        const pVal = Number(pos.value ?? pos.marketValue ?? pos.amount ?? 0);
        if (pVal > 0) return true;
        const pq = Number(pos.quantity ?? 0);
        const pp = Number(pos.price ?? pos._livePrice ?? 0);
        return pq * pp > 0;
      });
    }

    return false;
  });
}

export interface VisibilityResult<T extends string> {
  visible: boolean;
  mode: T;
  reason?: string;
}

export function getMetricVisibility(globalData: any, dataKey: string): VisibilityResult<'value' | 'pending' | 'hidden'> {
  if (!globalData) {
    return { visible: false, mode: 'hidden', reason: 'No global data' };
  }

  const metrics = globalData.metrics || {};
  const value = metrics[dataKey];
  const hasValue = hasMeaningfulNumber(value);

  // If there's a strong/meaningful value
  if (hasValue) {
    return { visible: true, mode: 'value' };
  }

  // Check if there is an analytical summary in metadata but no hard value
  const summaryKey = `${dataKey}Summary`;
  const summary = metrics[summaryKey];
  if (summary && typeof summary === 'string' && summary.trim().length > 0) {
    return { visible: false, mode: 'pending', reason: 'Summary exists without numeric value. Staggered card hidden.' };
  }

  return { visible: false, mode: 'hidden', reason: 'No numeric data or summary metadata found' };
}

export function getChartVisibility(globalData: any, chartType: string): VisibilityResult<'data' | 'empty-critical' | 'hidden'> {
  if (!globalData) {
    return { visible: false, mode: 'hidden', reason: 'No global data' };
  }

  // Resolve distributions safely
  const dists = globalData.distributions || {};
  const list = dists[chartType] || globalData[chartType] || [];

  const publicHoldingAccounts = globalData.publicHoldingAccounts || dists.publicHoldingAccounts || [];

  // Special case: publicHoldings is a critical financial workspace element
  if (chartType === 'publicHoldings') {
    const hasAccounts = hasDistributionData(publicHoldingAccounts);
    const hasHoldings = hasDistributionData(list);
    
    if (hasAccounts || hasHoldings) {
      return { visible: true, mode: 'data' };
    }

    // Critical charts display empty/sync fallback interface instead of disappearing silently
    return { 
      visible: true, 
      mode: 'empty-critical', 
      reason: 'No holdings active, showing critical sync status terminal card' 
    };
  }

  // Optional charts are hidden when database rows are empty or zero-valued
  const optionalCharts = ['liquidity', 'privateAssets', 'options', 'expenses', 'fixedAssets'];
  if (optionalCharts.includes(chartType)) {
    if (hasDistributionData(list)) {
      return { visible: true, mode: 'data' };
    }
    return { visible: false, mode: 'hidden', reason: `Optional chart '${chartType}' has no active assets` };
  }

  // Default to visible for unknown/AI widgets to keep robust dynamic parsing
  return { visible: true, mode: 'data', reason: 'Fallback visibility for generic components' };
}
