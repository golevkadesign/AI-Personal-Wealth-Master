import { createMarketContext } from '../../../src/lib/market-context';
import type { MarketContext, MarketInstrumentSnapshot, MarketDataQuality } from '../../../src/types/market-context';
import { DEFAULT_MARKET_UNIVERSE, MarketUniverseInstrument } from './instrumentUniverse';
import { fetchStooqDaily } from './stooqAdapter';
import { fetchYahooDaily } from './yahooAdapter';
import {
  calculateReturn,
  calculateVolatility20D,
  calculateMaxDrawdown,
  getLatestClose,
  getLatestAsOf
} from './analytics';
import { fetchFredEnhancements } from './fredAdapter';
import { fetchAlphaVantageEnhancements } from './alphaVantageAdapter';

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

// Convert cache to a robust Map to avoid key leakage and cache cross-contamination
const marketContextCacheMap = new Map<string, { timestamp: number; data: MarketContext }>();

const MARKET_CONTEXT_CACHE_TTL = 15 * 60 * 1000;

type InstrumentFetchSource = 'stooq' | 'yahoo';

function getYahooSymbol(item: MarketUniverseInstrument) {
  return item.yahooSymbol || item.symbol;
}

export async function buildMarketContext(options?: {
  universe?: MarketUniverseInstrument[];
  timeoutMs?: number;
  forceRefresh?: boolean;
  fredApiKey?: string;
  alphaVantageApiKey?: string;
}): Promise<MarketContext> {
  const universe = options?.universe || DEFAULT_MARKET_UNIVERSE;
  const timeoutMs = options?.timeoutMs ?? 5000;
  const forceRefresh = !!options?.forceRefresh;

  const cacheKey = `${options?.fredApiKey ? 'fred:on' : 'fred:off'}|${options?.alphaVantageApiKey ? 'av:on' : 'av:off'}`;

  // Utilize cache if valid and no force refresh requested
  const cached = marketContextCacheMap.get(cacheKey);
  if (!forceRefresh && cached && (Date.now() - cached.timestamp < MARKET_CONTEXT_CACHE_TTL)) {
    return cached.data;
  }

  try {
    const instruments: MarketInstrumentSnapshot[] = [];
    const warnings: string[] = [];
    const sourceStats = {
      stooqSuccessCount: 0,
      stooqFailedCount: 0,
      yahooSuccessCount: 0,
      yahooFailedCount: 0,
    };

    // Parallel fetch with concurrency limit of 4 to protect upstream/Stooq servers
    await asyncPool(4, universe, async (item) => {
      try {
        let bars = await fetchStooqDaily(item.stooqSymbol, { timeoutMs });
        let source: InstrumentFetchSource = 'stooq';

        if (bars && bars.length > 0) {
          sourceStats.stooqSuccessCount += 1;
        } else {
          sourceStats.stooqFailedCount += 1;
          const yahooSymbol = getYahooSymbol(item);
          const yahooBars = await fetchYahooDaily(yahooSymbol, { timeoutMs });
          if (yahooBars && yahooBars.length > 0) {
            bars = yahooBars;
            source = 'yahoo';
            sourceStats.yahooSuccessCount += 1;
          } else {
            sourceStats.yahooFailedCount += 1;
          }
        }
        
        if (!bars || bars.length === 0) {
          warnings.push(`无法获取或解析标的 ${item.symbol} 的公共延迟/历史日线数据。`);
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
        const dataQuality: MarketDataQuality = has3MReturn
          ? (source === 'stooq' ? 'high' : 'medium')
          : (source === 'stooq' ? 'medium' : 'low');

        const snapshot: MarketInstrumentSnapshot = {
          symbol: item.symbol,
          label: item.label,
          category: item.category,
          source,
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
    if (sourceStats.yahooSuccessCount > 0) {
      warnings.push(`Stooq 暂不可用或无数据，${sourceStats.yahooSuccessCount} 个标的已使用 Yahoo 延迟/历史日线兜底。`);
    }

    const sourceSummary = [
      sourceStats.stooqSuccessCount > 0 ? 'Stooq delayed/historical daily market data' : undefined,
      sourceStats.yahooSuccessCount > 0 ? 'Yahoo Finance delayed/historical daily fallback data' : undefined,
    ].filter((item): item is string => Boolean(item));

    const context = createMarketContext({
      instruments,
      freshness: 'daily',
      sourceSummary: sourceSummary.length > 0 ? sourceSummary : ['Public delayed/historical daily market data'],
      warnings
    });
    if (sourceStats.yahooSuccessCount > 0 && sourceStats.stooqSuccessCount === 0) {
      context.dataQuality = 'medium';
    }

    // Parallel fetch enhancements if requested securely
    const [fredEnhancements, alphaEnhancements] = await Promise.all([
      fetchFredEnhancements(options?.fredApiKey).catch(err => {
        console.warn('[market-context-service] Error fetching FRED enhancements:', err);
        return [];
      }),
      fetchAlphaVantageEnhancements(options?.alphaVantageApiKey).catch(err => {
        console.warn('[market-context-service] Error fetching Alpha Vantage enhancements:', err);
        return [];
      })
    ]);

    const macroEnhancements = [...fredEnhancements, ...alphaEnhancements];
    if (macroEnhancements.length > 0) {
      context.macroEnhancements = macroEnhancements;
    }

    if (fredEnhancements.length > 0) {
      context.sourceSummary.push('FRED macro series');
    } else if (options?.fredApiKey && options.fredApiKey.trim() !== '') {
      context.warnings.push('FRED enhancement requested but no usable series returned.');
    }

    if (alphaEnhancements.length > 0) {
      context.sourceSummary.push('Alpha Vantage macro/commodity series');
    } else if (options?.alphaVantageApiKey && options.alphaVantageApiKey.trim() !== '') {
      context.warnings.push('Alpha Vantage enhancement requested but no usable series returned.');
    }

    // Quality summary calculation
    const expectedInstrumentCount = universe.length;
    const instrumentSuccessCount = instruments.length;
    const instrumentCoverageRatio = expectedInstrumentCount > 0
      ? instrumentSuccessCount / expectedInstrumentCount
      : 0;

    const fredConfigured = Boolean(options?.fredApiKey?.trim());
    const avConfigured = Boolean(options?.alphaVantageApiKey?.trim());

    const fredExpectedCount = fredConfigured ? 5 : 0;
    const avExpectedCount = avConfigured ? 4 : 0;

    const enhancementExpectedCount = fredExpectedCount + avExpectedCount;
    const enhancementSuccessCount = fredEnhancements.length + alphaEnhancements.length;

    const enhancementCoverageRatio = enhancementExpectedCount > 0
      ? enhancementSuccessCount / enhancementExpectedCount
      : undefined;

    const coverageRatio = enhancementExpectedCount > 0
      ? (instrumentSuccessCount + enhancementSuccessCount) / (expectedInstrumentCount + enhancementExpectedCount)
      : instrumentCoverageRatio;

    let status: 'ready' | 'degraded' | 'stale' | 'failed';
    if (instrumentSuccessCount === 0) {
      status = 'failed';
    } else if (instrumentCoverageRatio < 0.5) {
      status = 'degraded';
    } else if (
      enhancementExpectedCount > 0 &&
      enhancementCoverageRatio !== undefined &&
      enhancementCoverageRatio < 0.5
    ) {
      status = 'degraded';
    } else {
      status = 'ready';
    }

    let confidence: 'high' | 'medium' | 'low';
    if (status === 'failed') {
      confidence = 'low';
    } else if (status === 'degraded') {
      confidence = 'medium';
    } else if (
      instrumentCoverageRatio >= 0.8 &&
      sourceStats.yahooSuccessCount === 0 &&
      (!enhancementCoverageRatio || enhancementCoverageRatio >= 0.5)
    ) {
      confidence = 'high';
    } else {
      confidence = 'medium';
    }

    const stooqWarningCount = sourceStats.stooqFailedCount;
    const yahooWarningCount = sourceStats.yahooFailedCount;

    const sourceHealth: any[] = [
      {
        source: 'stooq',
        status: sourceStats.stooqSuccessCount === expectedInstrumentCount ? 'ok' : sourceStats.stooqSuccessCount > 0 ? 'partial' : 'failed',
        expectedCount: expectedInstrumentCount,
        successCount: sourceStats.stooqSuccessCount,
        warningCount: stooqWarningCount,
        lastUpdatedAt: Date.now(),
        notes: sourceStats.stooqFailedCount > 0
          ? ['Some Stooq requests returned no usable CSV and were routed to Yahoo fallback.']
          : []
      },
      {
        source: 'yahoo',
        status: sourceStats.yahooSuccessCount === 0
          ? (sourceStats.stooqFailedCount > 0 ? 'failed' : 'not_configured')
          : sourceStats.yahooFailedCount > 0 ? 'partial' : 'ok',
        expectedCount: sourceStats.stooqFailedCount,
        successCount: sourceStats.yahooSuccessCount,
        warningCount: yahooWarningCount,
        lastUpdatedAt: Date.now(),
        notes: sourceStats.yahooSuccessCount > 0
          ? ['Yahoo Finance is used only as delayed/historical fallback context, not execution-grade quote data.']
          : []
      },
      {
        source: 'fred',
        status: !fredConfigured ? 'not_configured' : fredEnhancements.length > 0 ? (fredEnhancements.length === fredExpectedCount ? 'ok' : 'partial') : 'failed',
        expectedCount: fredExpectedCount,
        successCount: fredEnhancements.length,
        warningCount: options?.fredApiKey ? (fredEnhancements.length === 0 ? 1 : 0) : 0,
        lastUpdatedAt: Date.now(),
        notes: fredConfigured ? [] : ['No FRED API key configured.']
      },
      {
        source: 'alpha_vantage',
        status: !avConfigured ? 'not_configured' : alphaEnhancements.length > 0 ? (alphaEnhancements.length === avExpectedCount ? 'ok' : 'partial') : 'failed',
        expectedCount: avExpectedCount,
        successCount: alphaEnhancements.length,
        warningCount: options?.alphaVantageApiKey ? (alphaEnhancements.length === 0 ? 1 : 0) : 0,
        lastUpdatedAt: Date.now(),
        notes: avConfigured ? [] : ['No Alpha Vantage API key configured.']
      }
    ];

    let summaryText = '';
    if (status === 'failed') {
      summaryText = 'Market context failed to retrieve usable market instruments; downstream analysis must treat market context as unavailable.';
    } else if (status === 'degraded') {
      summaryText = 'Market context is available but some configured sources returned partial or no usable data.';
    } else {
      summaryText = sourceStats.yahooSuccessCount > 0
        ? 'Market context is ready with public delayed/historical coverage; Yahoo fallback was used where Stooq was unavailable.'
        : 'Market context is ready with broad Stooq coverage and optional macro enhancements where configured.';
    }

    context.qualitySummary = {
      status,
      confidence,
      coverageRatio,
      instrumentCoverageRatio,
      enhancementCoverageRatio,
      sourceHealth,
      summary: summaryText
    };

    // Update the cache Map safely
    marketContextCacheMap.set(cacheKey, {
      timestamp: Date.now(),
      data: context
    });

    return context;
  } catch (globalError: any) {
    console.error('[market-context-service] Global failure in buildMarketContext:', globalError);
    const cached = marketContextCacheMap.get(cacheKey);
    if (cached) {
      // Return previous cache but append failure warning
      const updatedWarnings = Array.from(new Set([
        ...(cached.data.warnings || []),
        '本轮市场上下文刷新失败，返回上一轮缓存数据。'
      ]));
      const staleQualitySummary = cached.data.qualitySummary ? {
        ...cached.data.qualitySummary,
        status: 'stale' as const,
        summary: 'Market context is stale. Previous data is returned because the latest refresh failed.'
      } : undefined;
      return {
        ...cached.data,
        warnings: updatedWarnings,
        qualitySummary: staleQualitySummary
      };
    }

    // No cache available, return empty fallback context
    const fallback = createMarketContext({
      instruments: [],
      freshness: 'stale',
      sourceSummary: ['Stooq delayed/historical daily market data'],
      warnings: ['市场上下文刷新失败，暂无可用缓存。']
    });

    const fredConfigured = Boolean(options?.fredApiKey?.trim());
    const avConfigured = Boolean(options?.alphaVantageApiKey?.trim());

    fallback.qualitySummary = {
      status: 'stale',
      confidence: 'low',
      coverageRatio: 0,
      instrumentCoverageRatio: 0,
      enhancementCoverageRatio: undefined,
      sourceHealth: [
        { source: 'stooq', status: 'failed', expectedCount: universe.length, successCount: 0, warningCount: 1, lastUpdatedAt: Date.now(), notes: ['Market context refresh failed and no cache is available.'] },
        { source: 'yahoo', status: 'failed', expectedCount: universe.length, successCount: 0, warningCount: 1, lastUpdatedAt: Date.now(), notes: ['Yahoo fallback was unavailable during market context refresh.'] },
        { source: 'fred', status: fredConfigured ? 'failed' : 'not_configured', expectedCount: fredConfigured ? 5 : 0, successCount: 0, warningCount: fredConfigured ? 1 : 0, lastUpdatedAt: Date.now() },
        { source: 'alpha_vantage', status: avConfigured ? 'failed' : 'not_configured', expectedCount: avConfigured ? 4 : 0, successCount: 0, warningCount: avConfigured ? 1 : 0, lastUpdatedAt: Date.now() }
      ],
      summary: 'Market context is stale or unavailable because refresh failed and no cache was available.'
    };

    return fallback;
  }
}
