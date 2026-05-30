import { MarketMacroEnhancement } from '../../../src/types/market-context';

export interface FredObservation {
  date: string;
  value?: string;
}

export interface FredSeriesConfig {
  id: string;
  seriesId: string;
  label: string;
  category: 'macro' | 'rates' | 'inflation' | 'growth' | 'unknown';
  unit?: string;
}

export const DEFAULT_FRED_SERIES: FredSeriesConfig[] = [
  { id: 'fred_dgs10', seriesId: 'DGS10', label: '10Y Treasury Yield', category: 'rates', unit: '%' },
  { id: 'fred_dgs2', seriesId: 'DGS2', label: '2Y Treasury Yield', category: 'rates', unit: '%' },
  { id: 'fred_fedfunds', seriesId: 'FEDFUNDS', label: 'Effective Fed Funds Rate', category: 'rates', unit: '%' },
  { id: 'fred_cpi', seriesId: 'CPIAUCSL', label: 'US CPI Index', category: 'inflation', unit: 'index' },
  { id: 'fred_unrate', seriesId: 'UNRATE', label: 'US Unemployment Rate', category: 'growth', unit: '%' }
];

export async function fetchFredSeries(
  apiKey: string,
  series: FredSeriesConfig,
  options?: { timeoutMs?: number }
): Promise<MarketMacroEnhancement | null> {
  const timeoutMs = options?.timeoutMs || 5000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series.seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=120`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[FRED Adapter] Failed to fetch series ${series.seriesId}: HTTP status ${response.status}`);
      return null;
    }

    const data = await response.json() as any;
    if (!data || !Array.isArray(data.observations)) {
      console.warn(`[FRED Adapter] Invalid observation payload for ${series.seriesId}`);
      return null;
    }

    const validObs = data.observations
      .map((obs: any) => ({
        date: obs.date,
        value: obs.value !== undefined && obs.value !== '.' ? Number(obs.value) : NaN
      }))
      .filter((obs: any) => !isNaN(obs.value));

    if (validObs.length === 0) {
      console.warn(`[FRED Adapter] No valid numeric observations for ${series.seriesId}`);
      return null;
    }

    const latest = validObs[0];
    const latestValue = latest.value;
    const latestAsOf = new Date(latest.date).getTime();

    let isDaily = false;
    if (validObs.length > 5) {
      const dayDiff = (new Date(validObs[0].date).getTime() - new Date(validObs[4].date).getTime()) / (1000 * 60 * 60 * 24);
      if (dayDiff < 15) {
        isDaily = true;
      }
    }

    let change1M: number | undefined;
    let change3M: number | undefined;

    if (isDaily) {
      const idx1M = Math.min(21, validObs.length - 1);
      const idx3M = Math.min(63, validObs.length - 1);
      if (idx1M > 0) change1M = latestValue - validObs[idx1M].value;
      if (idx3M > 0) change3M = latestValue - validObs[idx3M].value;
    } else {
      const idx1M = Math.min(1, validObs.length - 1);
      const idx3M = Math.min(3, validObs.length - 1);
      if (idx1M > 0) change1M = latestValue - validObs[idx1M].value;
      if (idx3M > 0) change3M = latestValue - validObs[idx3M].value;
    }

    return {
      id: series.id,
      label: series.label,
      category: series.category,
      source: 'fred',
      value: latestValue,
      unit: series.unit,
      asOf: latestAsOf,
      change1M,
      change3M,
      dataQuality: 'high',
      interpretation: `Latest observed value as of ${latest.date}.`
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[FRED Adapter] Error processing series ${series.seriesId}:`, err?.message || err);
    return null;
  }
}

export async function fetchFredEnhancements(
  apiKey?: string,
  options?: { timeoutMs?: number }
): Promise<MarketMacroEnhancement[]> {
  if (!apiKey || apiKey.trim() === '') {
    return [];
  }

  const results = await Promise.all(
    DEFAULT_FRED_SERIES.map(series => fetchFredSeries(apiKey.trim(), series, options))
  );

  return results.filter((res): res is MarketMacroEnhancement => res !== null);
}
