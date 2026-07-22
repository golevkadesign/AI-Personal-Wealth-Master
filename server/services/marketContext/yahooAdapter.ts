import type { StooqDailyBar } from './stooqAdapter';

function toDateString(timestampSeconds: number) {
  const date = new Date(timestampSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function fetchYahooDaily(
  yahooSymbol: string,
  options?: { timeoutMs?: number }
): Promise<StooqDailyBar[]> {
  const timeoutMs = options?.timeoutMs ?? 5000;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1y&interval=1d`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[yahoo-market-adapter] Failed to fetch ${yahooSymbol}: HTTP ${res.status}`);
      return [];
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
    const quote = result?.indicators?.quote?.[0];

    if (!timestamps.length || !quote) {
      console.warn(`[yahoo-market-adapter] Empty chart payload for ${yahooSymbol}`);
      return [];
    }

    const bars: StooqDailyBar[] = timestamps
      .map((timestamp: number, index: number) => {
        const open = quote.open?.[index];
        const high = quote.high?.[index];
        const low = quote.low?.[index];
        const close = quote.close?.[index];
        const volume = quote.volume?.[index];

        if (!isFiniteNumber(timestamp) || !isFiniteNumber(close)) return null;

        return {
          date: toDateString(timestamp),
          open: isFiniteNumber(open) ? open : undefined,
          high: isFiniteNumber(high) ? high : undefined,
          low: isFiniteNumber(low) ? low : undefined,
          close,
          volume: isFiniteNumber(volume) ? volume : undefined,
        };
      })
      .filter((bar): bar is StooqDailyBar => Boolean(bar))
      .sort((a, b) => a.date.localeCompare(b.date));

    return bars.slice(-260);
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.warn(`[yahoo-market-adapter] Error fetching ${yahooSymbol}:`, error?.message || error);
    return [];
  }
}
