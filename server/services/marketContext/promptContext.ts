export function compactMarketContextForPrompt(marketContext: any, capturedAt?: number) {
  if (!marketContext) return null;
  const sourceInstruments = Array.isArray(marketContext.instruments)
    ? marketContext.instruments
    : Array.isArray(marketContext.keyInstruments)
      ? marketContext.keyInstruments
      : [];

  return {
    capturedAt: capturedAt ? new Date(capturedAt).toISOString() : undefined,
    freshness: marketContext.freshness,
    dataQuality: marketContext.dataQuality,
    sourceSummary: marketContext.sourceSummary || [],
    warnings: marketContext.warnings || [],
    regime: marketContext.regime ? {
      riskMode: marketContext.regime.riskMode,
      ratePressure: marketContext.regime.ratePressure,
      dollarPressure: marketContext.regime.dollarPressure,
      creditStress: marketContext.regime.creditStress,
      commodityImpulse: marketContext.regime.commodityImpulse,
      volatilityState: marketContext.regime.volatilityState,
      summary: marketContext.regime.summary
    } : null,
    crossAssetSignals: (marketContext.crossAssetSignals || []).slice(0, 6).map((signal: any) => ({
      title: signal.title,
      severity: signal.severity,
      affectedExposures: signal.affectedExposures || [],
      interpretation: signal.interpretation,
      evidence: (signal.evidence || []).slice(0, 3)
    })),
    keyInstruments: sourceInstruments.slice(0, 16).map((item: any) => ({
      symbol: item.symbol,
      label: item.label,
      category: item.category,
      close: item.close,
      change1M: item.change1M,
      change3M: item.change3M,
      change6M: item.change6M,
      volatility20D: item.volatility20D,
      maxDrawdown3M: item.maxDrawdown3M,
      dataQuality: item.dataQuality,
      asOf: item.asOf ? new Date(item.asOf).toISOString() : undefined
    }))
  };
}
