import { SDUIComponent } from '../types/terminal';

export const DASHBOARD_SCHEMA_VERSION = '2026-portfolio-section-v1';

export const DEFAULT_DASHBOARD_SCHEMA: SDUIComponent[] = [
  {
    id: "metrics-grid",
    type: "Grid",
    props: { preset: 'metrics', gap: 6, className: "mb-8" },
    children: [
      { id: "m1", type: "MetricCard", props: { title: "总净资产 (Net Worth)", dataKey: "netWorth", isLongSubText: true } },
      { id: "m2", type: "MetricCard", props: { title: "可用现金池 (Liquidity)", dataKey: "liquidity", isLongSubText: true } },
      { id: "m3", type: "MetricCard", props: { title: "抗风险系数 (Safety Ratio)", dataKey: "safetyRatio", isLongSubText: true } },
      { id: "m4", type: "MetricCard", props: { title: "月自由现金流 (FCF)", dataKey: "fcf", isLongSubText: true } }
    ]
  },
  {
    id: "primary-public-market-section",
    type: "Grid",
    props: { preset: "sections", gap: 6, className: "mb-8" },
    children: [
      { id: "c2", type: "DynamicChart", props: { title: "多账户公开市场持仓", chartType: "publicHoldings", layoutSize: "lg", layoutSpan: "full", dashboardRole: "primary-section", delay: 0.2 } }
    ]
  },
  {
    id: "asset-structure-grid",
    type: "Grid",
    props: { preset: 'charts', gap: 6, className: "mb-8" },
    children: [
      { id: "c1", type: "DynamicChart", props: { title: "流动资金池", chartType: "liquidity", layoutSize: "md", delay: 0.3 } },
      { id: "c4", type: "DynamicChart", props: { title: "非公开资产估值", chartType: "privateAssets", layoutSize: "md", delay: 0.4 } },
      { id: "c5", type: "DynamicChart", props: { title: "开支结构分析", chartType: "expenses", layoutSize: "md", delay: 0.5 } },
      { id: "c3", type: "DynamicChart", props: { title: "衍生品及期权", chartType: "options", layoutSize: "md", delay: 0.6 } }
    ]
  }
];
