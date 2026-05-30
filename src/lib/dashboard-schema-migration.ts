import { DEFAULT_DASHBOARD_SCHEMA, DASHBOARD_SCHEMA_VERSION } from './default-schema';
import type { TerminalState, SDUIComponent } from '../types/terminal';

export function isCurrentDashboardSchema(schema: any): boolean {
  if (!Array.isArray(schema)) return false;

  const metricsGrid = schema.find(item => item && item.id === 'metrics-grid');
  if (!metricsGrid) return false;

  const primarySection = schema.find(item => item && item.id === 'primary-public-market-section');
  if (!primarySection) return false;

  const findPublicHoldings = (components: SDUIComponent[]): any => {
    for (const comp of components) {
      if (comp && comp.props && comp.props.chartType === 'publicHoldings') {
        return comp;
      }
      if (comp && Array.isArray(comp.children)) {
        const found = findPublicHoldings(comp.children);
        if (found) return found;
      }
    }
    return null;
  };

  const publicHoldingsComp = findPublicHoldings(primarySection.children || []);
  if (!publicHoldingsComp) return false;

  if (publicHoldingsComp.props.layoutSpan !== 'full') return false;

  const assetStructureGrid = schema.find(item => item && item.id === 'asset-structure-grid');
  if (!assetStructureGrid) return false;

  const hasPublicHoldingsInAssetStructure = findPublicHoldings(assetStructureGrid.children || []);
  if (hasPublicHoldingsInAssetStructure) return false;

  return true;
}

export function normalizeDashboardSchema<T extends Partial<TerminalState>>(data: T): T {
  if (!data) return data;

  const needsSchemaInit = !data.dashboardSchema;
  const needsVersionUpdate = data._dashboardSchemaVersion !== DASHBOARD_SCHEMA_VERSION;
  const needsSchemaFix = data.dashboardSchema && !isCurrentDashboardSchema(data.dashboardSchema);

  if (needsSchemaInit || needsVersionUpdate || needsSchemaFix) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[dashboard-schema] Migrated stale dashboardSchema to ${DASHBOARD_SCHEMA_VERSION}`);
    }
    return {
      ...data,
      dashboardSchema: DEFAULT_DASHBOARD_SCHEMA,
      _dashboardSchemaVersion: DASHBOARD_SCHEMA_VERSION,
    };
  }

  return data;
}
