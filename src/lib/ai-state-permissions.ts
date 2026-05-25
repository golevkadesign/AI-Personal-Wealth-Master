/**
 * Gating system for AI-generated state inputs.
 * Strips any forbidden fields from updateGlobalState safely.
 */
export function filterAiWritableStatePatch(input: any): any {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  // Top-level writable fields by AI
  const allowedTopLevel = [
    'insights',
    'userPersona',
    'goal',
    'lifeStrategiesShort',
    'lifeStrategiesLong',
    'dynamicWidgets',
    'dashboardSchema',
    'agentMemorySnapshots',
    'metrics',
    'distributions'
  ];

  const filtered: any = {};

  for (const key of allowedTopLevel) {
    if (key in input) {
      if (key === 'distributions') {
        const dist = input[key];
        if (dist && typeof dist === 'object' && !Array.isArray(dist)) {
          const filteredDist: any = {};
          for (const distKey of Object.keys(dist)) {
            if (distKey !== 'publicHoldings') {
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

  // Explicitly strip any banned top-level metadata or auth properties
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
