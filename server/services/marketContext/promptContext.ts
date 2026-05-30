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
    qualitySummary: marketContext.qualitySummary ? {
      status: marketContext.qualitySummary.status,
      confidence: marketContext.qualitySummary.confidence,
      coverageRatio: marketContext.qualitySummary.coverageRatio,
      instrumentCoverageRatio: marketContext.qualitySummary.instrumentCoverageRatio,
      enhancementCoverageRatio: marketContext.qualitySummary.enhancementCoverageRatio,
      sourceHealth: (marketContext.qualitySummary.sourceHealth || []).map((sh: any) => ({
        source: sh.source,
        status: sh.status,
        expectedCount: sh.expectedCount,
        successCount: sh.successCount,
        warningCount: sh.warningCount,
        notes: sh.notes
      })),
      summary: marketContext.qualitySummary.summary
    } : undefined,
    macroEnhancements: (marketContext.macroEnhancements || []).slice(0, 12).map((item: any) => ({
      id: item.id,
      label: item.label,
      category: item.category,
      source: item.source,
      value: item.value,
      unit: item.unit,
      asOf: item.asOf ? new Date(item.asOf).toISOString() : undefined,
      change1M: item.change1M,
      change3M: item.change3M,
      dataQuality: item.dataQuality,
      interpretation: item.interpretation,
      warnings: (item.warnings || []).slice(0, 2)
    })),
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
