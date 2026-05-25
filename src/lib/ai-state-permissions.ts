/**
 * Gating system for AI-generated state inputs.
 * Strips any forbidden fields from updateGlobalState safely,
 * supporting a source-aware permission model.
 */

export interface FilterOptions {
  allowMemoryWrite?: boolean;
  allowTrustedFactWrite?: boolean;
  livePortfolio?: any[];
  livePortfolioAccounts?: any[];
}

export function filterAiWritableStatePatch(
  input: any,
  options?: FilterOptions
): any {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const allowTrustedFactWrite = options?.allowTrustedFactWrite ?? false;

  // Top-level writable fields by AI by default (all non-fact modules)
  const allowedTopLevel = [
    'insights',
    'userPersona',
    'goal',
    'lifeStrategiesShort',
    'lifeStrategiesLong',
    'dynamicWidgets',
    'dashboardSchema',
    'agentMemorySnapshots'
  ];

  if (allowTrustedFactWrite) {
    allowedTopLevel.push('metrics');
    allowedTopLevel.push('distributions');
  }

  const filtered: any = {};

  for (const key of allowedTopLevel) {
    if (key in input) {
      if (key === 'distributions') {
        const dist = input[key];
        if (dist && typeof dist === 'object' && !Array.isArray(dist)) {
          const filteredDist: any = {};
          for (const distKey of Object.keys(dist)) {
            // Even if allowTrustedFactWrite=true, publicHoldings is banned unless it matches/comes from explicit backend data
            if (distKey === 'publicHoldings') {
              const livePortfolio = options?.livePortfolio;
              const livePortfolioAccounts = options?.livePortfolioAccounts;
              
              let isMatch = false;
              if (livePortfolio) {
                try {
                  if (JSON.stringify(dist.publicHoldings) === JSON.stringify(livePortfolio)) {
                    isMatch = true;
                  }
                } catch {}
              }
              if (!isMatch && livePortfolioAccounts) {
                try {
                  if (JSON.stringify(dist.publicHoldings) === JSON.stringify(livePortfolioAccounts)) {
                    isMatch = true;
                  }
                } catch {}
              }

              if (isMatch) {
                filteredDist.publicHoldings = dist.publicHoldings;
              }
            } else {
              filteredDist[distKey] = dist[distKey];
            }
          }
          filtered.distributions = filteredDist;
        }
      } else {
        filtered[key] = input[key];
      }
    }
  }

  // Explicitly strip any banned top-level metadata, live valuation, or auth properties
  const blacklist = [
    '_liveSources',
    '_liveValuationVersion',
    '_liveFetchedAt',
    'publicHoldingsSyncStatus',
    'publicHoldingsError',
    'publicHoldingsLastSyncAt',
    'user',
    'loadingAuth',
    'persistenceMode'
  ];

  for (const key of blacklist) {
    delete filtered[key];
  }

  return filtered;
}
