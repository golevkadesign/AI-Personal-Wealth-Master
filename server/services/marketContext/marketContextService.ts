import { createMarketContext } from '../../../src/lib/market-context';
import type { MarketContext, MarketInstrumentSnapshot, MarketDataQuality } from '../../../src/types/market-context';
import { DEFAULT_MARKET_UNIVERSE, MarketUniverseInstrument } from './instrumentUniverse';
import { fetchStooqDaily } from './stooqAdapter';
import {
  calculateReturn,
  calculateVolatility20D,
  calculateMaxDrawdown,
  getLatestClose,
  getLatestAsOf
} from './analytics';

/**
 * Concurrency limiting async helper pool
 */
async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: Promise<R>[] = [];
  const executing: Promise<unknown>[] = [];
  
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    
    if (concurrency <= items.length) {
      const e: Promise<unknown> = p.then(() => {
        const index = executing.indexOf(e);
        if (index > -1) {
          executing.splice(index, 1);
        }
      });
      executing.push(e);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

let marketContextCache: {
  timestamp: number;
  data: MarketContext;
} | null = null;

const MARKET_CONTEXT_CACHE_TTL = 15 * 60 * 1000;

export async function buildMarketContext(options?: {
  universe?: MarketUniverseInstrument[];
  timeoutMs?: number;
  forceRefresh?: boolean;
}): Promise<MarketContext> {
  const universe = options?.universe || DEFAULT_MARKET_UNIVERSE;
  const timeoutMs = options?.timeoutMs ?? 5000;
  const forceRefresh = !!options?.forceRefresh;

  // Utilize cache if valid and no force refresh requested
  if (!forceRefresh && marketContextCache && (Date.now() - marketContextCache.timestamp < MARKET_CONTEXT_CACHE_TTL)) {
    return marketContextCache.data;
  }

  try {
    const instruments: MarketInstrumentSnapshot[] = [];
    const warnings: string[] = [];

    // Parallel fetch with concurrency limit of 4 to protect upstream/Stooq servers
    await asyncPool(4, universe, async (item) => {
      try {
        const bars = await fetchStooqDaily(item.stooqSymbol, { timeoutMs });
        
        if (!bars || bars.length === 0) {
          warnings.push(`无法获取或解析标的 ${item.symbol} (${item.stooqSymbol}) 的 Stooq 数据。`);
          return;
        }

        const close = getLatestClose(bars);
        const asOf = getLatestAsOf(bars);

        if (close === undefined || asOf === undefined) {
          warnings.push(`标的 ${item.symbol} 的数据中没有可用的 Close 价格或日期。`);
          return;
        }

        const change1D = calculateReturn(bars, 1);
        const change1M = calculateReturn(bars, 21);
        const change3M = calculateReturn(bars, 63);
        const change6M = calculateReturn(bars, 126);
        const volatility20D = calculateVolatility20D(bars);
        const maxDrawdown3M = calculateMaxDrawdown(bars, 63);

        const has3MReturn = change3M !== undefined;
        const dataQuality: MarketDataQuality = has3MReturn ? 'high' : 'medium';

        const snapshot: MarketInstrumentSnapshot = {
          symbol: item.symbol,
          label: item.label,
          category: item.category,
          source: 'stooq',
          asOf,
          close,
          change1D,
          change1M,
          change3M,
          change6M,
          volatility20D,
          maxDrawdown3M,
          dataQuality,
          warnings: []
        };

        instruments.push(snapshot);
      } catch (err: any) {
        console.warn(`[market-context-service] Error processing ${item.symbol}:`, err?.message || err);
        warnings.push(`处理标的 ${item.symbol} 的数据时发生未预料异常: ${err?.message || 'Unknown error'}`);
      }
    });

    // Call shared pure calculation layer
    const context = createMarketContext({
      instruments,
      freshness: 'daily',
      sourceSummary: ['Stooq delayed/historical daily market data'],
      warnings
    });

    // Update the cache
    marketContextCache = {
      timestamp: Date.now(),
      data: context
    };

    return context;
  } catch (globalError: any) {
    console.error('[market-context-service] Global failure in buildMarketContext:', globalError);
    if (marketContextCache) {
      // Return previous cache but append failure warning
      const updatedWarnings = Array.from(new Set([
        ...(marketContextCache.data.warnings || []),
        '本轮市场上下文刷新失败，返回上一轮缓存数据。'
      ]));
      return {
        ...marketContextCache.data,
        warnings: updatedWarnings
      };
    }

    // No cache available, return empty fallback context
    return createMarketContext({
      instruments: [],
      freshness: 'stale',
      sourceSummary: ['Stooq delayed/historical daily market data'],
      warnings: ['市场上下文刷新失败，暂无可用缓存。']
    });
  }
}
