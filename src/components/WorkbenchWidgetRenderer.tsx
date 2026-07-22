import React from 'react';
import {
  AgentRailResult,
  SharedFactBundle,
  WorkbenchSessionSpec,
  WorkbenchWidgetManifest,
  WorkbenchWidgetStatus,
  WorkbenchWidgetType,
} from '../types/workbench';
import { useTranslation } from '../hooks/useTranslation';
import { MaterialIcon } from './ui/MaterialIcon';
import { PortfolioIntelligenceMapView } from './PortfolioIntelligenceMapView';
import { buildPortfolioIntelligenceMap } from '../lib/portfolio-intelligence';
import { Arbitra2DChart } from './charts/Arbitra2DChart';
import { getCurrencySymbol, getHoldingMarketValue } from './chart-configs';
import { MemoryInboxItemCard } from './MemoryInboxItemCard';

interface WorkbenchWidgetRendererProps {
  session: WorkbenchSessionSpec;
  widget: WorkbenchWidgetManifest;
}

const WIDGET_ICON: Record<WorkbenchWidgetType, string> = {
  shared_facts: 'hub',
  rail_card: 'account_tree',
  cio_brief: 'psychology',
  evidence: 'fact_check',
  source: 'database',
  confidence: 'verified_user',
  memory_candidate: 'inbox',
  action_queue: 'task_alt',
  portfolio_map: 'grid_view',
  current_exposure: 'monitoring',
  intent_fingerprint: 'fingerprint',
  missing_pieces: 'extension',
  suggested_tilt: 'near_me',
  projected_exposure: 'view_in_ar',
  holding_quote_snapshot: 'query_stats',
  holding_value_summary: 'account_balance_wallet',
  holding_sync_status: 'sync',
  holding_trend_chart: 'show_chart',
  holding_quant_indicators: 'analytics',
  holding_strategy_deductions: 'psychology_alt',
  holding_analysis_snapshot_diff: 'history',
};

const PORTFOLIO_INTELLIGENCE_WIDGETS = new Set<WorkbenchWidgetType>([
  'portfolio_map',
  'current_exposure',
  'intent_fingerprint',
  'missing_pieces',
  'suggested_tilt',
  'projected_exposure',
]);

function statusLabel(status: WorkbenchWidgetStatus | undefined, t: (key: string) => string) {
  if (status === 'waiting_signals') return t('workbench.waitingSignals');
  if (status === 'awaiting_context') return t('workbench.awaitingContext');
  if (status === 'ready') return t('workbench.ready');
  if (status === 'partial') return t('workbench.partial');
  if (status === 'blocked') return t('workbench.blocked');
  if (status === 'error') return t('workbench.error');
  return t('workbench.awaitingContext');
}

function holdingAnalysisStatusLabel(status: string | undefined, t: (key: string) => string) {
  if (!status) return t('workbench.awaitingContext');
  return t(`workbench.holding.analysisStatuses.${status}`);
}

function statusClass(status: WorkbenchWidgetStatus | undefined) {
  if (status === 'ready') return 'text-aw-success';
  if (status === 'partial') return 'text-aw-info';
  if (status === 'blocked' || status === 'error') return 'text-aw-danger';
  if (status === 'waiting_signals') return 'text-aw-warning';
  return 'aw-text-tertiary';
}

function actionStatusLabel(status: 'pending' | 'ready' | 'blocked' | undefined, t: (key: string) => string) {
  if (status === 'ready') return t('workbench.ready');
  if (status === 'blocked') return t('workbench.blocked');
  return t('workbench.awaitingContext');
}

function getFactSummary(facts?: Partial<SharedFactBundle>) {
  return {
    sourceCount: facts?.summary?.sourceCount || facts?.sourceRefs?.length || 0,
    missingCount: facts?.summary?.missingFactCount || facts?.missingFacts?.length || 0,
    accountCount: facts?.summary?.accountCount || 0,
    positionCount: facts?.summary?.positionCount || 0,
    holdingCount: facts?.summary?.publicHoldingCount || 0,
    hasMarket: Boolean(facts?.summary?.hasMarketContext),
    hasProfile: Boolean(facts?.summary?.hasSovereignProfile),
    hasPrompt: Boolean(facts?.summary?.hasUserPrompt),
    hasSelectedHolding: Boolean(facts?.summary?.hasSelectedHolding),
    confidence: facts?.confidence || 'unknown',
  };
}

function getRailResults(session: WorkbenchSessionSpec, widget: WorkbenchWidgetManifest): AgentRailResult[] {
  const rails = session.railRun?.railResults || [];
  if (!widget.railId) return rails;
  return rails.filter((rail) => rail.railId === widget.railId);
}

function getWidgetRail(session: WorkbenchSessionSpec, widget: WorkbenchWidgetManifest) {
  return session.railRun?.railResults.find((rail) => rail.railId === widget.railId);
}

function MetricChip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="aw-status-pill font-mono">
      <span className="aw-text-tertiary">{label}</span>
      <span className="aw-text-primary">{value}</span>
    </span>
  );
}

function formatNumber(value: unknown, fallback = '--') {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return next.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function compactWidgetText(value: unknown, limit = 220) {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function getWidgetSections(widget: WorkbenchWidgetManifest): Array<{ section?: string; summary?: string; text?: string }> {
  return Array.isArray(widget.props?.sections)
    ? widget.props.sections.filter((item: any) => item && typeof item === 'object')
    : [];
}

function ChatSectionList({
  sections,
  t,
}: {
  sections: Array<{ section?: string; summary?: string; text?: string }>;
  t: (key: string) => string;
}) {
  if (sections.length === 0) return null;
  return (
    <div className="space-y-2">
      {sections.slice(0, 3).map((section, index) => (
        <div key={`${section.section || index}`} className="aw-panel-muted px-3 py-2">
          <p className="aw-caption aw-text-primary truncate font-mono font-semibold uppercase">
            {String(section.section || t('workbench.evidence'))}
          </p>
          <p className="mt-1 aw-caption aw-text-secondary leading-relaxed">
            {compactWidgetText(section.summary || section.text)}
          </p>
        </div>
      ))}
    </div>
  );
}

function formatMoney(value: unknown, currency?: string) {
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) return '--';
  return `${getCurrencySymbol(currency)}${next.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatCurrencyValue(
  value: unknown,
  currency?: string,
  options: { maximumFractionDigits?: number; allowNegative?: boolean } = {},
) {
  const next = Number(value);
  if (!Number.isFinite(next)) return '--';
  if (!options.allowNegative && next <= 0) return '--';
  const abs = Math.abs(next);
  const sign = next < 0 ? '-' : '';
  return `${sign}${getCurrencySymbol(currency)}${abs.toLocaleString('en-US', {
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  })}`;
}

function formatPercent(value: unknown, options: { signed?: boolean; fallback?: string } = {}) {
  const next = Number(value);
  if (!Number.isFinite(next)) return options.fallback || '--';
  const sign = options.signed && next > 0 ? '+' : '';
  return `${sign}${next.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function getToneByNumber(value: unknown, positiveIsGood = true) {
  const next = Number(value);
  if (!Number.isFinite(next) || next === 0) return 'aw-text-tertiary';
  const good = positiveIsGood ? next > 0 : next < 0;
  return good ? 'text-aw-success' : 'text-aw-danger';
}

function getIndicatorTone(key: string, value: unknown) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 'aw-text-tertiary';
  if (key === 'rsi') {
    if (next >= 70) return 'text-aw-danger';
    if (next <= 30) return 'text-aw-success';
  }
  if (key === 'adx') return next >= 25 ? 'text-aw-warning' : 'aw-text-primary';
  return 'aw-text-primary';
}

function getTrendLabel(value: unknown, t: (key: string) => string) {
  const trend = String(value || 'unknown').toLowerCase();
  if (trend === 'up') return t('workbench.holding.trendValues.up');
  if (trend === 'down') return t('workbench.holding.trendValues.down');
  return t('workbench.holding.trendValues.unknown');
}

function getSignalLabel(value: unknown, t: (key: string) => string) {
  const signal = String(value || 'unknown').toLowerCase();
  if (signal === 'buy') return t('workbench.holding.signalValues.buy');
  if (signal === 'sell') return t('workbench.holding.signalValues.sell');
  if (signal === 'hold') return t('workbench.holding.signalValues.hold');
  return t('workbench.holding.signalValues.unknown');
}

function getHoldingHistoryPoint(item: any) {
  return {
    date: Array.isArray(item) ? String(item[0] || '') : String(item?.date || ''),
    open: Number(Array.isArray(item) ? item[1] : item?.open),
    close: Number(Array.isArray(item) ? item[2] : item?.close),
    low: Number(Array.isArray(item) ? item[3] : item?.low),
    high: Number(Array.isArray(item) ? item[4] : item?.high),
  };
}

function buildHoldingTrendOption(history: any[], currency?: string) {
  const points = history.map(getHoldingHistoryPoint).filter((item) => item.date && Number.isFinite(item.close));
  const values = points.map((item) => item.close);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const padding = Math.max((max - min) * 0.18, max * 0.015, 1);
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => {
        const point = params?.[0];
        if (!point) return '';
        return `${point.axisValue}<br/>${formatCurrencyValue(point.value, currency)}`;
      },
    },
    grid: { left: 8, right: 44, top: 8, bottom: 24, containLabel: false },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map((item) => item.date),
      axisTick: { show: false },
      axisLabel: {
        interval: Math.max(1, Math.floor(points.length / 4)),
        margin: 10,
      },
    },
    yAxis: {
      type: 'value',
      position: 'right',
      min: Math.max(0, min - padding),
      max: max + padding,
      splitNumber: 3,
      axisLabel: {
        formatter: (value: number) => formatCurrencyValue(value, currency, { maximumFractionDigits: 0 }),
      },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: values,
        lineStyle: { color: '#A8C9A3', width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(168, 201, 163, 0.20)' },
              { offset: 1, color: 'rgba(168, 201, 163, 0.00)' },
            ],
          },
        },
      },
    ],
  };
}

function MetricTile({
  label,
  value,
  tone = 'aw-text-primary',
  helper,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  helper?: React.ReactNode;
}) {
  return (
    <div className="aw-panel-muted min-w-0 px-3 py-3">
      <p className="aw-caption aw-text-tertiary truncate font-mono uppercase">{label}</p>
      <p className={`mt-1 aw-label truncate font-mono font-semibold ${tone}`}>{value}</p>
      {helper && <p className="mt-1 aw-caption aw-text-tertiary truncate">{helper}</p>}
    </div>
  );
}

function AdviceBlock({
  icon,
  title,
  tone,
  items,
  empty,
}: {
  icon: string;
  title: string;
  tone: string;
  items: string[];
  empty: string;
}) {
  const dotClass = tone === 'text-aw-danger'
    ? 'bg-aw-danger'
    : tone === 'text-aw-warning'
      ? 'bg-aw-warning'
      : tone === 'text-aw-info'
        ? 'bg-aw-info'
        : 'bg-aw-success';
  return (
    <div className="aw-panel-muted px-3 py-3">
      <div className="flex items-center gap-2">
        <MaterialIcon name={icon} size={16} className={tone} />
        <p className={`aw-caption font-mono font-semibold uppercase ${tone}`}>{title}</p>
      </div>
      <div className="mt-2 space-y-2">
        {(items.length ? items : [empty]).slice(0, 4).map((item, index) => (
          <div key={`${title}-${index}`} className="flex items-start gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
            <p className="aw-caption aw-text-secondary leading-relaxed">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getHoldingIdentity(holding: any, fallback: string) {
  return String(holding?.symbol || holding?.name || holding?.id || fallback || '--');
}

function HoldingAwaitingTool({ message }: { message: string }) {
  return (
    <div className="aw-panel-muted flex items-center gap-3 px-3 py-3">
      <div className="aw-chart-state-icon shrink-0">
        <MaterialIcon name="schedule" size={20} className="aw-text-tertiary" />
      </div>
      <p className="aw-body aw-text-secondary leading-relaxed">{message}</p>
    </div>
  );
}

function AwaitingPortfolioContext() {
  const { t } = useTranslation();
  return (
    <div className="aw-panel-muted flex items-center gap-3 px-3 py-3">
      <div className="aw-chart-state-icon shrink-0">
        <MaterialIcon name="schedule" size={20} className="aw-text-tertiary" />
      </div>
      <p className="aw-body aw-text-secondary leading-relaxed">
        {t('portfolioIntelligence.awaitingPortfolioContext')}
      </p>
    </div>
  );
}

function translateMaybeKey(value: string, t: (key: string) => string) {
  const prefixes = ['workbench.', 'portfolioIntelligence.'];
  if (value.includes(', ')) {
    return value.split(', ').map((item) => translateMaybeKey(item, t)).join(', ');
  }
  if (prefixes.some((prefix) => value.startsWith(prefix))) return t(value);
  return value;
}

function WorkbenchWidgetBody({ session, widget }: WorkbenchWidgetRendererProps) {
  const { t } = useTranslation();
  const facts = getFactSummary(session.facts);
  const selectedHolding = session.facts?.selectedHolding as any;
  const selectedHoldingAnalysis = session.facts?.selectedHoldingAnalysis;
  const rails = getRailResults(session, widget);
  const rail = getWidgetRail(session, widget);
  const widgetSections = getWidgetSections(widget);

  if (widget.type === 'shared_facts') {
    return (
      <div className="flex flex-wrap gap-2">
        <MetricChip label={t('workbench.metrics.sources')} value={facts.sourceCount} />
        <MetricChip label={t('workbench.metrics.missing')} value={facts.missingCount} />
        <MetricChip label={t('workbench.metrics.accounts')} value={facts.accountCount} />
        <MetricChip label={t('workbench.metrics.positions')} value={facts.positionCount} />
        <MetricChip label={t('workbench.metrics.holdings')} value={facts.holdingCount} />
      </div>
    );
  }

  if (widget.type === 'rail_card') {
    return (
      <div className="space-y-2">
        {rails.map((item) => (
          <div key={item.railId} className="aw-panel-muted flex items-center justify-between gap-3 px-3 py-2">
            <span className="aw-body aw-text-primary font-medium">{t(item.titleKey)}</span>
            <span className={`aw-caption font-mono uppercase ${statusClass(item.status)}`}>
              {statusLabel(item.status, t)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (widget.type === 'source') {
    const widgetSourceRefs = Array.isArray(widget.props?.sourceRefs)
      ? widget.props.sourceRefs.filter((item): item is string => typeof item === 'string')
      : widget.sourceRefs || [];
    const sectionCount = Number(widget.props?.sectionCount);
    return (
      <div className="flex flex-wrap gap-2">
        <MetricChip label={t('workbench.metrics.sources')} value={widgetSourceRefs.length || facts.sourceCount} />
        <MetricChip label={t('workbench.metrics.market')} value={facts.hasMarket ? t('workbench.yes') : t('workbench.no')} />
        <MetricChip label={t('workbench.metrics.profile')} value={facts.hasProfile ? t('workbench.yes') : t('workbench.no')} />
        {Number.isFinite(sectionCount) && (
          <MetricChip label={t('workbench.metrics.sections')} value={sectionCount} />
        )}
      </div>
    );
  }

  if (widget.type === 'evidence') {
    const sections = widgetSections;
    if (sections.length > 0) {
      return (
        <div className="space-y-2">
          {sections.slice(0, 4).map((section: any, index: number) => (
            <div key={`${section.section || index}`} className="aw-panel-muted px-3 py-2">
              <p className="aw-caption aw-text-primary truncate font-mono font-semibold uppercase">
                {String(section.section || t('workbench.evidence'))}
              </p>
              <p className="mt-1 aw-caption aw-text-secondary leading-relaxed">
                {compactWidgetText(section.summary || section.text)}
              </p>
            </div>
          ))}
        </div>
      );
    }
    return (
      <Arbitra2DChart variant="evidence" compact className="h-28" />
    );
  }

  if (widget.type === 'confidence') {
    return (
      <div className="flex items-center gap-3">
        <div className="aw-chart-state-icon">
          <MaterialIcon name="verified_user" size={20} className={statusClass(widget.status)} />
        </div>
        <div>
          <p className="aw-label aw-text-primary font-semibold">{t(`workbench.confidenceLevels.${facts.confidence}`)}</p>
          <p className="aw-caption aw-text-tertiary font-mono uppercase">{statusLabel(widget.status, t)}</p>
        </div>
      </div>
    );
  }

  if (widget.type === 'action_queue') {
    const actions = rails.flatMap((item) => item.actions);
    if (actions.length === 0) {
      if (widgetSections.length > 0) {
        return <ChatSectionList sections={widgetSections} t={t} />;
      }
      return <p className="aw-body aw-text-secondary">{t('workbench.emptyStates.noActions')}</p>;
    }
    return (
      <div className="space-y-2">
        {actions.map((action) => (
          <div key={action.id} className="aw-panel-muted flex items-center justify-between gap-3 px-3 py-2">
            <span className="aw-body aw-text-primary">{t(action.labelKey)}</span>
            <span className="aw-caption aw-text-tertiary font-mono uppercase">{actionStatusLabel(action.status, t)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (widget.type === 'memory_candidate') {
    const items = session.memoryInbox?.items || [];
    if (items.length === 0) {
      if (widgetSections.length > 0) {
        return <ChatSectionList sections={widgetSections} t={t} />;
      }
      return <p className="aw-body aw-text-secondary">{t('workbench.emptyStates.noMemoryCandidates')}</p>;
    }
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <MemoryInboxItemCard key={item.id} item={item} compact />
        ))}
      </div>
    );
  }

  if (widget.type === 'cio_brief') {
    const cioBrief = session.dashboardProjection?.cioBrief;
    return (
      <div className="space-y-2">
        <p className="aw-body aw-text-secondary">
          {cioBrief ? translateMaybeKey(cioBrief.summary, t) : t('workbench.emptyStates.awaitingCio')}
        </p>
        {cioBrief?.conflicts.map((conflict, index) => (
          <div key={`${conflict.description}-${index}`} className="aw-panel-muted px-3 py-2">
            <p className="aw-caption text-aw-warning font-mono uppercase">{t('workbench.cioBrief.conflict')}</p>
            <p className="mt-1 aw-caption aw-text-secondary">{translateMaybeKey(conflict.description, t)}</p>
            {conflict.resolution && (
              <p className="mt-1 aw-caption aw-text-tertiary">{translateMaybeKey(conflict.resolution, t)}</p>
            )}
          </div>
        ))}
        {cioBrief?.actions?.length ? (
          <div className="space-y-2">
            {cioBrief.actions.slice(0, 3).map((action) => (
              <div key={action.id} className="aw-panel-muted flex items-center justify-between gap-3 px-3 py-2">
                <span className="aw-body aw-text-primary">{t(action.labelKey)}</span>
                <span className="aw-caption aw-text-tertiary font-mono uppercase">{actionStatusLabel(action.status, t)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <MetricChip label={t('workbench.metrics.readyRails')} value={session.railRun?.summary.readyCount || 0} />
          <MetricChip label={t('workbench.metrics.partialRails')} value={session.railRun?.summary.partialCount || 0} />
          <MetricChip label={t('workbench.metrics.blockedRails')} value={session.railRun?.summary.blockedCount || 0} />
        </div>
      </div>
    );
  }

  if (widget.type === 'holding_quote_snapshot') {
    const quant = selectedHoldingAnalysis?.quantSignals || selectedHolding?.quantSignals || {};
    const currentPrice = quant.currentPrice ?? selectedHolding?.currentPrice ?? selectedHolding?.lastPrice ?? selectedHolding?.costPrice;
    const changePercent = quant.changePercent ?? selectedHolding?.dailyPnlPercent ?? selectedHolding?.pnlPercent;
    const identity = getHoldingIdentity(selectedHolding, session.subject || session.subjectSpec?.label || session.subjectSpec?.id || '');
    const instrumentType = selectedHolding?.type || selectedHolding?.category || t('drawer.notProvided');
    const domicile = selectedHolding?.domicile || selectedHolding?.region || t('drawer.notProvided');
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="aw-chart-state-icon mt-0.5 shrink-0">
              <MaterialIcon name="data_exploration" size={20} className={statusClass(widget.status)} />
            </div>
            <div className="min-w-0">
              <p className="aw-title aw-text-primary truncate font-semibold">{selectedHolding?.name || identity}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <MetricChip label={t('workbench.holding.symbol')} value={identity} />
                <MetricChip label={t('workbench.holding.type')} value={instrumentType} />
                <MetricChip label={t('drawer.jurisdiction')} value={domicile} />
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="aw-title aw-text-primary font-mono">{formatCurrencyValue(currentPrice, selectedHolding?.currency)}</p>
            <p className={`aw-caption font-mono ${getToneByNumber(changePercent)}`}>
              {formatPercent(changePercent, { signed: true })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetricChip label={t('workbench.holding.source')} value={selectedHoldingAnalysis?.source || selectedHolding?.valuationSource || '--'} />
          <MetricChip label={t('workbench.holding.analysisStatus')} value={selectedHoldingAnalysis?.analysisStatus ? holdingAnalysisStatusLabel(selectedHoldingAnalysis.analysisStatus, t) : statusLabel(widget.status, t)} />
          <MetricChip label={t('workbench.holding.fallback')} value={selectedHoldingAnalysis?.fallbackUsed ? t('workbench.yes') : t('workbench.no')} />
        </div>
      </div>
    );
  }

  if (widget.type === 'holding_value_summary') {
    const marketValue = selectedHolding?.marketValue ?? selectedHolding?.value ?? getHoldingMarketValue(selectedHolding);
    const quant = selectedHoldingAnalysis?.quantSignals || selectedHolding?.quantSignals || {};
    return (
      <div className="grid grid-cols-2 gap-2">
        <MetricTile label={t('workbench.holding.marketValue')} value={formatMoney(marketValue, selectedHolding?.currency)} />
        <MetricTile label={t('workbench.holding.allocation')} value={selectedHolding?.allocation || selectedHolding?.proportion || '--'} />
        <MetricTile label={t('workbench.holding.quantity')} value={formatNumber(selectedHolding?.quantity)} />
        <MetricTile
          label={t('workbench.holding.cost')}
          value={formatCurrencyValue(selectedHolding?.costPrice, selectedHolding?.currency, { allowNegative: true })}
          tone={Number(selectedHolding?.costPrice) < 0 ? 'text-aw-success' : 'aw-text-primary'}
        />
        <MetricTile label={t('workbench.holding.support')} value={formatCurrencyValue(quant.support, selectedHolding?.currency)} tone="text-aw-success" />
        <MetricTile label={t('workbench.holding.resistance')} value={formatCurrencyValue(quant.resistance, selectedHolding?.currency)} tone="text-aw-warning" />
      </div>
    );
  }

  if (widget.type === 'holding_sync_status') {
    const syncTime = selectedHolding?.lastSyncTime || session.facts?.freshness?.holdings;
    const summary = selectedHoldingAnalysis?.historySummary;
    return (
      <div className="flex flex-wrap gap-2">
        <MetricChip label={t('workbench.holding.sync')} value={syncTime ? new Date(syncTime).toISOString().slice(0, 16).replace('T', ' ') : t('workbench.holding.noSync')} />
        <MetricChip label={t('workbench.holding.analysisStatus')} value={selectedHoldingAnalysis?.analysisStatus ? holdingAnalysisStatusLabel(selectedHoldingAnalysis.analysisStatus, t) : statusLabel(widget.status, t)} />
        <MetricChip label={t('workbench.holding.fallback')} value={selectedHoldingAnalysis?.fallbackUsed ? t('workbench.yes') : t('workbench.no')} />
        <MetricChip label={t('workbench.holding.sampleCount')} value={summary?.sampleCount || '--'} />
        <MetricChip label={t('workbench.holding.sampleRange')} value={summary?.startDate && summary?.endDate ? `${summary.startDate} / ${summary.endDate}` : '--'} />
      </div>
    );
  }

  if (widget.type === 'holding_trend_chart') {
    if (!selectedHoldingAnalysis?.history?.length) {
      if (widgetSections.length > 0) {
        return <ChatSectionList sections={widgetSections} t={t} />;
      }
      return <HoldingAwaitingTool message={t('workbench.holding.awaitingQuantAnalysis')} />;
    }
    const quant = selectedHoldingAnalysis.quantSignals;
    const history = selectedHoldingAnalysis.history;
    const summary = selectedHoldingAnalysis.historySummary;
    const trendOption = buildHoldingTrendOption(history, selectedHolding?.currency);
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <MetricChip label={t('workbench.holding.dayChange')} value={<span className={getToneByNumber(quant?.changePercent)}>{formatPercent(quant?.changePercent, { signed: true })}</span>} />
          <MetricChip label={t('workbench.holding.trend')} value={getTrendLabel(quant?.trend, t)} />
          <MetricChip label={t('workbench.holding.sampleCount')} value={summary?.sampleCount || history.length} />
        </div>
        <Arbitra2DChart option={trendOption} compact className="h-36" />
      </div>
    );
  }

  if (widget.type === 'holding_quant_indicators') {
    const quant = selectedHoldingAnalysis?.quantSignals || selectedHolding?.quantSignals;
    if (!quant) {
      if (widgetSections.length > 0) {
        return <ChatSectionList sections={widgetSections} t={t} />;
      }
      return <HoldingAwaitingTool message={t('workbench.holding.awaitingQuantAnalysis')} />;
    }
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetricTile label="BB Low" value={formatCurrencyValue(quant.buyPrice || quant.bbLower, selectedHolding?.currency)} tone="text-aw-success" />
          <MetricTile label="BB High" value={formatCurrencyValue(quant.sellPrice || quant.bbUpper, selectedHolding?.currency)} tone="text-aw-danger" />
          <MetricTile label="RSI" value={formatNumber(quant.rsi)} tone={getIndicatorTone('rsi', quant.rsi)} helper={quant.rsi == null ? t('drawer.sampleInsufficient') : undefined} />
          <MetricTile label="ADX" value={formatNumber(quant.adx)} tone={getIndicatorTone('adx', quant.adx)} helper={quant.adx == null ? t('drawer.sampleInsufficient') : undefined} />
          <MetricTile label="MA5" value={formatCurrencyValue(quant.ma5, selectedHolding?.currency)} helper={quant.ma5 == null ? t('drawer.sampleInsufficient') : undefined} />
          <MetricTile label="MA20" value={formatCurrencyValue(quant.ma20, selectedHolding?.currency)} helper={quant.ma20 == null ? t('drawer.sampleInsufficient') : undefined} />
        </div>
        <div className="flex flex-wrap gap-2">
          <MetricChip label={t('workbench.holding.signal')} value={getSignalLabel(quant.signal, t)} />
          <MetricChip label={t('workbench.holding.stopLoss')} value={formatCurrencyValue(quant.stopLoss, selectedHolding?.currency)} />
          <MetricChip label={t('workbench.holding.takeProfit')} value={formatCurrencyValue(quant.takeProfit, selectedHolding?.currency)} />
          <MetricChip
            label={t('workbench.holding.missingIndicators')}
            value={quant.missingIndicators?.length ? quant.missingIndicators.join(', ') : t('workbench.holding.noMissingIndicators')}
          />
        </div>
      </div>
    );
  }

  if (widget.type === 'holding_strategy_deductions') {
    const advice = selectedHoldingAnalysis?.deterministicAdvice;
    if (!advice) {
      if (widgetSections.length > 0) {
        return <ChatSectionList sections={widgetSections} t={t} />;
      }
      return <HoldingAwaitingTool message={t('workbench.holding.awaitingQuantAnalysis')} />;
    }
    const quant = selectedHoldingAnalysis?.quantSignals;
    return (
      <div className="space-y-3">
        {quant?.missingIndicators?.length ? (
          <div className="aw-panel-muted px-3 py-2">
            <p className="aw-caption text-aw-warning leading-relaxed">
              {t('drawer.partialAnalysis')} {quant.missingIndicators.join(', ')}
            </p>
          </div>
        ) : null}
        <AdviceBlock
          icon="shield"
          title={t('workbench.holding.risks')}
          tone="text-aw-danger"
          items={advice.risks || []}
          empty={t('workbench.holding.unavailable')}
        />
        <AdviceBlock
          icon="trending_up"
          title={t('workbench.holding.opportunities')}
          tone="text-aw-success"
          items={advice.opportunities || []}
          empty={t('workbench.holding.unavailable')}
        />
        <AdviceBlock
          icon="task_alt"
          title={t('workbench.holding.suggestedActions')}
          tone="text-aw-warning"
          items={advice.suggestedActions || []}
          empty={t('workbench.holding.unavailable')}
        />
      </div>
    );
  }

  if (widget.type === 'holding_analysis_snapshot_diff') {
    if (!selectedHoldingAnalysis?.diffFromLastSnapshot) {
      return <HoldingAwaitingTool message={t('workbench.holding.noPreviousSnapshot')} />;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {Object.entries(selectedHoldingAnalysis.diffFromLastSnapshot).slice(0, 4).map(([key, value]) => (
          <MetricChip key={key} label={key} value={String(value)} />
        ))}
      </div>
    );
  }

  if (widget.type === 'portfolio_map' && !widget.railId) {
    return (
      <PortfolioIntelligenceMapView
        map={session.dashboardProjection?.portfolioIntelligenceMap}
        accountPortfolios={session.facts?.publicHoldingAccounts}
        terminalState={session.facts?.terminalState}
        variant="workbench"
      />
    );
  }

  if (PORTFOLIO_INTELLIGENCE_WIDGETS.has(widget.type)) {
    const portfolioMap = session.dashboardProjection?.portfolioIntelligenceMap || buildPortfolioIntelligenceMap({
      accountPortfolios: session.facts?.publicHoldingAccounts,
      terminalState: session.facts?.terminalState,
    });
    const hasValuedPositions = portfolioMap.dataQuality.valuedPositionCount > 0;

    if (!hasValuedPositions && widget.type !== 'portfolio_map') {
      if (widgetSections.length > 0) {
        return <ChatSectionList sections={widgetSections} t={t} />;
      }
      return <AwaitingPortfolioContext />;
    }

    if (widget.type === 'portfolio_map' || widget.type === 'current_exposure' || widget.type === 'projected_exposure') {
      const exposureData = portfolioMap.axes.map((axis) => ({
        name: t(axis.labelKey),
        value: widget.type === 'projected_exposure' ? axis.projectedValue : axis.value,
        color: axis.color,
      }));
      return (
        <div className="space-y-2">
          <Arbitra2DChart variant="radial" data={exposureData} compact className="h-28" />
          {portfolioMap.axes.map((axis) => {
            const value = widget.type === 'projected_exposure' ? axis.projectedValue : axis.value;
            return (
              <div key={axis.id} className="aw-panel-muted px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="aw-body aw-text-primary font-semibold">{t(axis.labelKey)}</span>
                  <span className="aw-caption aw-text-secondary font-mono">{value.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-aw-surface-3">
                  <span className="block h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, backgroundColor: axis.color }} />
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (widget.type === 'intent_fingerprint') {
      return (
        <div className="space-y-3">
          <p className="aw-body aw-text-secondary leading-relaxed">{t(portfolioMap.intentFingerprint.labelKey)}</p>
          <div className="flex flex-wrap gap-2">
            <MetricChip label={t('portfolioIntelligence.concentration')} value={portfolioMap.intentFingerprint.concentrationScore} />
            <MetricChip label={t('portfolioIntelligence.topThree')} value={`${portfolioMap.intentFingerprint.topThreeWeight.toFixed(1)}%`} />
          </div>
        </div>
      );
    }

    if (widget.type === 'missing_pieces') {
      const pieces = !hasValuedPositions
        ? [{ id: 'awaiting', labelKey: 'portfolioIntelligence.missing.awaiting' }]
        : portfolioMap.missingPieces.length > 0
        ? portfolioMap.missingPieces
        : [{ id: 'none', labelKey: 'portfolioIntelligence.missing.none' }];
      return (
        <div className="space-y-2">
          {pieces.map((piece) => (
              <div key={piece.id} className="aw-panel-muted flex items-center gap-2 px-3 py-2">
                <MaterialIcon name={piece.id === 'none' ? 'check_circle' : piece.id === 'awaiting' ? 'schedule' : 'add_circle'} size={16} className={piece.id === 'none' ? 'text-aw-success' : piece.id === 'awaiting' ? 'aw-text-tertiary' : 'text-aw-warning'} />
                <span className="aw-body aw-text-primary">{t(piece.labelKey)}</span>
              </div>
          ))}
        </div>
      );
    }

    if (widget.type === 'suggested_tilt') {
      const tilts = !hasValuedPositions
        ? [{ id: 'awaiting', labelKey: 'portfolioIntelligence.tilts.awaiting', magnitude: Number.NaN }]
        : portfolioMap.suggestedTilts.length > 0
        ? portfolioMap.suggestedTilts
        : [{ id: 'none', labelKey: 'portfolioIntelligence.tilts.none', magnitude: 0 }];
      return (
        <div className="space-y-2">
          {tilts.slice(0, 4).map((tilt) => (
            <div key={tilt.id} className="aw-panel-muted flex items-center justify-between gap-3 px-3 py-2">
              <span className="aw-body aw-text-primary">{t(tilt.labelKey)}</span>
              <span className="aw-caption aw-text-secondary font-mono">{Number.isFinite(tilt.magnitude) ? `${tilt.magnitude.toFixed(1)}%` : '--'}</span>
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div className="space-y-3">
      <Arbitra2DChart variant="route" compact className="h-28" />
      <div className="flex flex-wrap gap-2">
        {rail && <MetricChip label={t('workbench.metrics.rail')} value={t(rail.titleKey)} />}
        <MetricChip label={t('workbench.metrics.missing')} value={rail?.missingFacts.length || 0} />
      </div>
    </div>
  );
}

export function WorkbenchWidgetRenderer({ session, widget }: WorkbenchWidgetRendererProps) {
  const { t } = useTranslation();
  const iconName = WIDGET_ICON[widget.type] || 'widgets';

  return (
    <article
      className={`aw-reference-card aw-workbench-widget-card p-4 ${widget.type === 'cio_brief' ? 'aw-workbench-cio-card' : ''}`}
      data-aw-widget-type={widget.type}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="aw-chart-state-icon shrink-0">
            <MaterialIcon name={iconName} size={20} className={statusClass(widget.status)} />
          </div>
          <div className="min-w-0">
            <h3 className="aw-label aw-text-primary truncate font-semibold">{t(widget.titleKey)}</h3>
            {widget.railId && (
              <p className="aw-caption aw-text-tertiary font-mono uppercase">{t(`workbench.railTitles.${widget.railId}`)}</p>
            )}
          </div>
        </div>
        <span className={`aw-status-pill shrink-0 font-mono ${statusClass(widget.status)}`}>
          {statusLabel(widget.status, t)}
        </span>
      </div>
      <WorkbenchWidgetBody session={session} widget={widget} />
    </article>
  );
}
