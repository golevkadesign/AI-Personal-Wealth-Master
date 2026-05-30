import process from 'node:process';

function formatPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}%` : 'N/A';
}

function safeText(value, fallback = 'N/A') {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

async function main() {
  const args = process.argv.slice(2);
  const isForce = args.includes('--force');
  const isJson = args.includes('--json');

  const baseUrl = process.env.MARKET_CONTEXT_BASE_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/market-context${isForce ? '?force=1' : ''}`;

  console.log(`[Diagnostic] Requesting Market Context...`);
  console.log(`[Diagnostic] URL: ${url}`);
  console.log(`[Diagnostic] Timeout: 15s`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`\n❌ Error: HTTP Status ${res.status} ${res.statusText}`);
      process.exit(1);
    }

    const payload = await res.json();

    if (!payload || payload.success !== true) {
      console.error(`\n❌ Error: Response success field was not true or body is malformed.`);
      console.error(JSON.stringify(payload, null, 2));
      process.exit(1);
    }

    const data = payload.data;
    if (!data) {
      console.error(`\n❌ Error: Payload does not contain a "data" property.`);
      process.exit(1);
    }

    // Regime validation is mandatory
    if (!data.regime) {
      console.error(`\n❌ Error: Market regime data is missing.`);
      process.exit(1);
    }

    // Unified instruments or keyInstruments identification
    const instruments = Array.isArray(data.instruments)
      ? data.instruments
      : Array.isArray(data.keyInstruments)
        ? data.keyInstruments
        : [];

    if (instruments.length === 0) {
      console.warn(`\n⚠️  [Warning] No market context instruments or keyInstruments retrieved.`);
    }

    console.log(`\n==================================================`);
    console.log(`📊 AI财富终端 - Market Context E2E 诊断报告`);
    console.log(`==================================================`);
    console.log(`• Success Status : ${payload.success}`);
    console.log(`• Generated At   : ${data.generatedAt || 'N/A'}`);
    console.log(`• Freshness      : ${data.freshness || 'N/A'}`);
    console.log(`• Data Quality   : ${data.dataQuality || 'N/A'}`);
    console.log(`• Source Summary : ${JSON.stringify(data.sourceSummary || [])}`);
    
    console.log(`\n⚠️  [Disclaimer]`);
    console.log(`👉 Market Context is delayed/historical context, not execution-grade quote data. 👈`);

    console.log(`\n• Warnings (Top 5):`);
    const warnings = data.warnings || [];
    if (warnings.length === 0) {
      console.log(`  - No warnings returned.`);
    } else {
      warnings.slice(0, 5).forEach((w, index) => {
        console.log(`  ${index + 1}. ${w}`);
      });
    }

    console.log(`\n• Macro Regime Indicators:`);
    console.log(`  - Risk Mode        : ${data.regime.riskMode}`);
    console.log(`  - Rate Pressure    : ${data.regime.ratePressure}`);
    console.log(`  - Dollar Pressure  : ${data.regime.dollarPressure}`);
    console.log(`  - Credit Stress    : ${data.regime.creditStress}`);
    console.log(`  - Commodity Impulse: ${data.regime.commodityImpulse}`);
    console.log(`  - Volatility State : ${data.regime.volatilityState}`);
    console.log(`  - Summary          : ${data.regime.summary || 'None'}`);

    if (data.qualitySummary) {
      console.log(`\n• Unified Quality Summary:`);
      console.log(`  - Status                  : ${safeText(data.qualitySummary.status)}`);
      console.log(`  - Confidence              : ${safeText(data.qualitySummary.confidence)}`);
      console.log(`  - Coverage Ratio          : ${formatPercent(data.qualitySummary.coverageRatio)}`);
      console.log(`  - Instrument Coverage    : ${formatPercent(data.qualitySummary.instrumentCoverageRatio)}`);
      console.log(`  - Enhancement Coverage  : ${data.qualitySummary.enhancementCoverageRatio !== undefined ? formatPercent(data.qualitySummary.enhancementCoverageRatio) : 'N/A'}`);
      console.log(`  - Summary                 : ${safeText(data.qualitySummary.summary)}`);
      
      if (Array.isArray(data.qualitySummary.sourceHealth)) {
        console.log(`  - Source Health Assessment:`);
        data.qualitySummary.sourceHealth.forEach(sh => {
          console.log(`    * ${safeText(sh.source).toUpperCase()}: status: ${sh.status} | success: ${sh.successCount || 0}/${sh.expectedCount || 0} | warnings: ${sh.warningCount || 0}`);
        });
      }
    } else {
      console.log(`\n• Unified Quality Summary: N/A (Missing)`);
    }

    const macroEnhancements = data.macroEnhancements || [];
    console.log(`\n• Macro Enhancements (${macroEnhancements.length}):`);
    if (macroEnhancements.length === 0) {
      console.log(`  - No macro enhancements configured or returned.`);
    } else {
      macroEnhancements.slice(0, 8).forEach((item, index) => {
        const valStr = item.value !== undefined && item.value !== null ? item.value.toFixed(2) : 'N/A';
        const unitStr = item.unit || '';
        const chg1MText = item.change1M !== undefined && item.change1M !== null ? `${item.change1M > 0 ? '+' : ''}${item.change1M.toFixed(2)}` : 'N/A';
        console.log(`  [${index + 1}] Label: ${safeText(item.label).padEnd(20)} | Source: ${safeText(item.source).toUpperCase()} | Value: ${valStr}${unitStr} | Change1M: ${chg1MText}`);
      });
    }

    console.log(`\n• Coverage Statistics:`);
    console.log(`  - Instruments count   : ${instruments.length}`);
    if (Array.isArray(data.keyInstruments)) {
      console.log(`  - KeyInstruments count: ${data.keyInstruments.length}`);
    }
    console.log(`  - Signals count       : ${Array.isArray(data.crossAssetSignals) ? data.crossAssetSignals.length : 0}`);

    console.log(`\n• Market Instruments Snapshot (Top 8):`);
    if (instruments.length === 0) {
      console.log(`  - No instrument records available.`);
    } else {
      instruments.slice(0, 8).forEach((item, index) => {
        const sym = safeText(item.symbol).padEnd(8);
        const cat = safeText(item.category).padEnd(12);
        const chg = formatPercent(item.change3M !== undefined && item.change3M !== null ? Number(item.change3M) : undefined);
        const qual = safeText(item.dataQuality);
        console.log(`  [${index + 1}] Symbol: ${sym} | Category: ${cat} | Change3M: ${chg.padEnd(6)} | Quality: ${qual}`);
      });
    }

    if (isJson) {
      console.log(`\n==================================================`);
      console.log(`📦 [JSON Output] Full Payload:`);
      console.log(`==================================================`);
      console.log(JSON.stringify(payload, null, 2));
    }

    console.log(`\n✅ E2E Diagnostic execution complete.`);

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error(`\n❌ Error: Diagnostic request aborted due to exceeding the 15-second timeout.`);
    } else {
      console.error(`\n❌ Error fetching Market Context E2E:`, err.message || err);
    }
    process.exit(1);
  }
}

main();
