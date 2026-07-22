import { SDUIComponent } from '../types/terminal';

export const DASHBOARD_SCHEMA_VERSION = '2026-portfolio-section-v1';

export const DEFAULT_DASHBOARD_SCHEMA: SDUIComponent[] = [
  {
    id: "metrics-grid",
    type: "Grid",
    props: { preset: 'metrics', gap: 6, className: "mb-8" },
    children: [
      { id: "m1", type: "MetricCard", props: { titleKey: "dashboard.metricNetWorthTitle", title: "Net Worth", dataKey: "netWorth", isLongSubText: true } },
      { id: "m2", type: "MetricCard", props: { titleKey: "dashboard.metricLiquidityTitle", title: "Liquidity", dataKey: "liquidity", isLongSubText: true } },
      { id: "m3", type: "MetricCard", props: { titleKey: "dashboard.metricSafetyRatioTitle", title: "Safety Ratio", dataKey: "safetyRatio", isLongSubText: true } },
      { id: "m4", type: "MetricCard", props: { titleKey: "dashboard.metricFcfTitle", title: "Monthly Free Cash Flow", dataKey: "fcf", isLongSubText: true } }
    ]
  },
  {
    id: "primary-public-market-section",
    type: "Grid",
    props: { preset: "sections", gap: 6, className: "mb-8" },
    children: [
      { id: "c2", type: "DynamicChart", props: { titleKey: "dashboard.multiAccountHoldings", title: "Multi-Account Public Holdings", chartType: "publicHoldings", layoutSize: "lg", layoutSpan: "full", dashboardRole: "primary-section", delay: 0.2 } }
    ]
  },
  {
    id: "asset-structure-grid",
    type: "Grid",
    props: { preset: 'charts', gap: 6, className: "mb-8" },
    children: [
      { id: "c1", type: "DynamicChart", props: { titleKey: "dashboard.chartLiquidityTitle", title: "Liquidity Pool", chartType: "liquidity", layoutSize: "md", delay: 0.3 } },
      { id: "c4", type: "DynamicChart", props: { titleKey: "dashboard.chartPrivateAssetsTitle", title: "Private Asset Valuation", chartType: "privateAssets", layoutSize: "md", delay: 0.4 } },
      { id: "c5", type: "DynamicChart", props: { titleKey: "dashboard.chartExpensesTitle", title: "Expense Structure", chartType: "expenses", layoutSize: "md", delay: 0.5 } },
      { id: "c3", type: "DynamicChart", props: { titleKey: "dashboard.chartOptionsTitle", title: "Derivatives and Options", chartType: "options", layoutSize: "md", delay: 0.6 } }
    ]
  }
];
