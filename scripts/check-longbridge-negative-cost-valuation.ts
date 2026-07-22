import { _testDetermineValuation } from '../server/services/longbridgeAdapter';
import { getHoldingMarketValue } from '../src/components/chart-configs';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function main() {
  const valuation = _testDetermineValuation(
    12,
    undefined,
    undefined,
    undefined,
    -8.5,
  );

  assert(valuation.valuationSource === 'negative_cost_basis_estimate', 'negative cost should use negative cost-basis estimate');
  assert(valuation.currentPrice === 8.5, 'negative cost fallback should use absolute cost as display price');
  assert(valuation.marketValue === 102, 'negative cost fallback should still produce a positive market value');
  assert(valuation._staleQuote === true, 'negative cost fallback should mark stale quote');

  const renderedValue = getHoldingMarketValue({
    symbol: 'NEG.US',
    quantity: 12,
    costPrice: -8.5,
    currentPrice: valuation.currentPrice,
    marketValue: valuation.marketValue,
    valuationSource: valuation.valuationSource,
    _staleQuote: valuation._staleQuote,
  });

  assert(renderedValue === 102, 'holding chart value helper should render negative-cost valuation');

  const missingValuationSymbols = [
    {
      symbol: 'NEG.US',
      marketValue: valuation.marketValue,
      valuationSource: valuation.valuationSource,
    },
  ]
    .filter((position) => position.marketValue === undefined)
    .map((position) => position.symbol);

  const estimatedValuationSymbols = [
    {
      symbol: 'NEG.US',
      marketValue: valuation.marketValue,
      valuationSource: valuation.valuationSource,
    },
  ]
    .filter((position) => position.valuationSource === 'cost_basis_estimate' || position.valuationSource === 'negative_cost_basis_estimate')
    .map((position) => position.symbol);

  assert(missingValuationSymbols.length === 0, 'negative-cost valuation should not be marked valuation-missing');
  assert(estimatedValuationSymbols.includes('NEG.US'), 'negative-cost valuation should be marked as estimated');

  console.log(JSON.stringify({
    status: 'ok',
    checked: [
      'negative-cost-fallback-market-value',
      'negative-cost-not-valuation-missing',
      'negative-cost-render-helper',
      'negative-cost-estimated-symbol-meta',
    ],
    valuation,
    renderedValue,
    missingValuationSymbols,
    estimatedValuationSymbols,
  }));
}

main();
