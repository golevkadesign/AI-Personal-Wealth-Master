import { __quantEngineTestHooks } from '../server/services/quantEngine';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

class DecimalLike {
  constructor(private readonly value: number | string) {}
  toString() {
    return String(this.value);
  }
}

const rows = __quantEngineTestHooks.normalizeLongbridgeCandlesticks([
  {
    timestamp: new Date('2026-06-02T00:00:00Z'),
    open: new DecimalLike(11),
    close: new DecimalLike(12),
    low: new DecimalLike(10),
    high: new DecimalLike(13),
  },
  {
    toJSON() {
      return {
        timestamp: '2026-06-01T00:00:00Z',
        open: '9',
        close: '10',
        low: '8',
        high: '10.5',
      };
    },
  },
]);

assert(__quantEngineTestHooks.getYahooSymbol('VOO.US') === 'VOO', 'Yahoo symbol should strip .US');
assert(__quantEngineTestHooks.getLongbridgeSymbol('VOO.US') === 'VOO.US', 'LongBridge symbol should preserve .US');
assert(__quantEngineTestHooks.getLongbridgeSymbol('700', { market: 'HK' }) === '700.HK', 'LongBridge symbol should add configured market suffix');
assert(rows.length === 2, 'LongBridge candle normalizer should keep valid rows');
assert(rows[0][0] === '2026-06-01', 'LongBridge candles should sort ascending by date');
assert(rows[1][2] === 12, 'LongBridge candles should parse Decimal-like close values');

console.log(JSON.stringify({
  status: 'ok',
  checked: [
    'longbridge-symbol-preserves-market-suffix',
    'longbridge-symbol-adds-market-suffix',
    'yahoo-symbol-remains-fallback-safe',
    'longbridge-candlestick-normalization',
  ],
  rows,
}));
