import type { StooqDailyBar } from './stooqAdapter';

export function calculateReturn(
  bars: StooqDailyBar[],
  lookbackTradingDays: number
): number | undefined {
  if (bars.length < lookbackTradingDays + 1) return undefined;
  
  const latest = bars[bars.length - 1];
  const historical = bars[bars.length - 1 - lookbackTradingDays];

  if (latest && historical && latest.close !== undefined && historical.close !== undefined && historical.close > 0) {
    return ((latest.close - historical.close) / historical.close) * 100;
  }
  return undefined;
}

export function calculateVolatility20D(
  bars: StooqDailyBar[]
): number | undefined {
  // 20 trading days' returns requires 21 close bars
  if (bars.length < 21) return undefined;

  const recentBars = bars.slice(-21);
  const returns: number[] = [];

  for (let i = 1; i < recentBars.length; i++) {
    const c1 = recentBars[i].close;
    const c0 = recentBars[i - 1].close;

    if (c1 !== undefined && c0 !== undefined && c0 > 0) {
      returns.push(Math.log(c1 / c0));
    } else {
      return undefined;
    }
  }

  if (returns.length < 2) return undefined;

  const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
  const variance = returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (returns.length - 1);
  const std = Math.sqrt(variance);

  // Annualize: standard deviation multiplied by square root of 252 (trading days per year)
  return std * Math.sqrt(252);
}

export function calculateMaxDrawdown(
  bars: StooqDailyBar[],
  lookbackTradingDays: number
): number | undefined {
  if (bars.length < lookbackTradingDays) return undefined;
  if (lookbackTradingDays < 2) return undefined;

  const subset = bars.slice(-lookbackTradingDays);
  if (subset.length === 0) return undefined;

  let maxDrawdown = 0;
  let peak = -Infinity;

  for (const bar of subset) {
    if (bar.close === undefined) continue;

    if (bar.close > peak) {
      peak = bar.close;
    }

    if (peak > 0) {
      const dd = ((bar.close - peak) / peak) * 100;
      if (dd < maxDrawdown) {
        maxDrawdown = dd;
      }
    }
  }

  return maxDrawdown;
}

export function getLatestClose(
  bars: StooqDailyBar[]
): number | undefined {
  if (bars.length === 0) return undefined;
  return bars[bars.length - 1].close;
}

export function getLatestAsOf(
  bars: StooqDailyBar[]
): number | undefined {
  if (bars.length === 0) return undefined;
  const dateStr = bars[bars.length - 1].date;
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? Date.now() : parsed;
}
