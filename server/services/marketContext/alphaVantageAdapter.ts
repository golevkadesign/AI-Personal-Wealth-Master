import { MarketMacroEnhancement } from '../../../src/types/market-context';

export interface AlphaVantageSeriesConfig {
  id: string;
  functionName: string;
  label: string;
  category: 'commodity' | 'inflation' | 'growth' | 'sentiment' | 'unknown';
  interval?: 'daily' | 'weekly' | 'monthly';
  unit?: string;
}

export const DEFAULT_ALPHA_VANTAGE_SERIES: AlphaVantageSeriesConfig[] = [
  { id: 'av_wti', functionName: 'WTI', label: 'WTI Crude Oil', category: 'commodity', interval: 'monthly', unit: 'USD/barrel' },
  { id: 'av_brent', functionName: 'BRENT', label: 'Brent Crude Oil', category: 'commodity', interval: 'monthly', unit: 'USD/barrel' },
  { id: 'av_copper', functionName: 'COPPER', label: 'Copper', category: 'commodity', interval: 'monthly', unit: 'USD' },
  { id: 'av_cpi', functionName: 'CPI', label: 'US CPI', category: 'inflation', interval: 'monthly', unit: 'index' }
];

export async function fetchAlphaVantageSeries(
  apiKey: string,
  series: AlphaVantageSeriesConfig,
  options?: { timeoutMs?: number }
): Promise<MarketMacroEnhancement | null> {
  const timeoutMs = options?.timeoutMs || 5000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://www.alphavantage.co/query?function=${series.functionName}&interval=${series.interval || 'monthly'}&apikey=${apiKey}`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Alpha Vantage Adapter] Failed to fetch function ${series.functionName}: HTTP status ${response.status}`);
      return null;
    }

    const payload = await response.json() as any;
    if (!payload) {
      return null;
    }

    if (payload.Note || payload.Information || payload['Error Message']) {
      const msg = payload.Note || payload.Information || payload['Error Message'];
      console.warn(`[Alpha Vantage Adapter] API restriction or notice for function ${series.functionName}:`, msg);
      return null;
    }

    if (!Array.isArray(payload.data) || payload.data.length === 0) {
      console.warn(`[Alpha Vantage Adapter] Empty data or unexpected layout for function ${series.functionName}`);
      return null;
    }

    const validData = payload.data
      .map((item: any) => ({
        date: item.date,
        value: item.value !== undefined && item.value !== '.' ? Number(item.value) : NaN
      }))
      .filter((item: any) => !isNaN(item.value));

    if (validData.length === 0) {
      console.warn(`[Alpha Vantage Adapter] No valid numeric data for function ${series.functionName}`);
      return null;
    }

    const latest = validData[0];
    const latestValue = latest.value;
    const latestAsOf = new Date(latest.date).getTime();

    let change1M: number | undefined;
    let change3M: number | undefined;

    if (validData.length > 1) {
      change1M = latestValue - validData[1].value;
    }
    if (validData.length > 3) {
      change3M = latestValue - validData[3].value;
    }

    return {
      id: series.id,
      label: series.label,
      category: series.category,
      source: 'alpha_vantage',
      value: latestValue,
      unit: series.unit || payload.unit,
      asOf: latestAsOf,
      change1M,
      change3M,
      dataQuality: 'high',
      interpretation: `Latest Alpha Vantage value as of ${latest.date}.`
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[Alpha Vantage Adapter] Error processing function ${series.functionName}:`, err?.message || err);
    return null;
  }
}

export async function fetchAlphaVantageEnhancements(
  apiKey?: string,
  options?: { timeoutMs?: number }
): Promise<MarketMacroEnhancement[]> {
  if (!apiKey || apiKey.trim() === '') {
    return [];
  }

  const results = await Promise.all(
    DEFAULT_ALPHA_VANTAGE_SERIES.map(series => fetchAlphaVantageSeries(apiKey.trim(), series, options))
  );

  return results.filter((res): res is MarketMacroEnhancement => res !== null);
}
