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
  legacy_chat: 'forum',
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

function WorkbenchWidgetBody({ session, widget }: WorkbenchWidgetRendererProps) {
  const { t } = useTranslation();
  const facts = getFactSummary(session.facts);
  const rails = getRailResults(session, widget);
  const rail = getWidgetRail(session, widget);

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
    return (
      <div className="flex flex-wrap gap-2">
        <MetricChip label={t('workbench.metrics.sources')} value={facts.sourceCount} />
        <MetricChip label={t('workbench.metrics.market')} value={facts.hasMarket ? t('workbench.yes') : t('workbench.no')} />
        <MetricChip label={t('workbench.metrics.profile')} value={facts.hasProfile ? t('workbench.yes') : t('workbench.no')} />
      </div>
    );
  }

  if (widget.type === 'evidence') {
    return (
      <div className="aw-chart-plane h-28" aria-hidden="true" />
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
    const candidates = rails.flatMap((item) => item.memoryCandidates);
    if (candidates.length === 0) {
      return <p className="aw-body aw-text-secondary">{t('workbench.emptyStates.noMemoryCandidates')}</p>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {candidates.map((candidate) => (
          <span key={candidate.id} className="aw-status-pill font-mono">{candidate.title}</span>
        ))}
      </div>
    );
  }

  if (widget.type === 'cio_brief') {
    return (
      <div className="space-y-2">
        <p className="aw-body aw-text-secondary">{t('workbench.emptyStates.awaitingCio')}</p>
        <div className="flex flex-wrap gap-2">
          <MetricChip label={t('workbench.metrics.readyRails')} value={session.railRun?.summary.readyCount || 0} />
          <MetricChip label={t('workbench.metrics.partialRails')} value={session.railRun?.summary.partialCount || 0} />
          <MetricChip label={t('workbench.metrics.blockedRails')} value={session.railRun?.summary.blockedCount || 0} />
        </div>
      </div>
    );
  }

  if (widget.type === 'legacy_chat') {
    return <p className="aw-body aw-text-secondary">{t('workbench.legacyModeDesc')}</p>;
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

    if (widget.type === 'portfolio_map' || widget.type === 'current_exposure' || widget.type === 'projected_exposure') {
      return (
        <div className="space-y-2">
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
      const pieces = portfolioMap.missingPieces.length > 0
        ? portfolioMap.missingPieces
        : [{ id: 'none', labelKey: 'portfolioIntelligence.missing.none' }];
      return (
        <div className="space-y-2">
          {pieces.map((piece) => (
            <div key={piece.id} className="aw-panel-muted flex items-center gap-2 px-3 py-2">
              <MaterialIcon name={piece.id === 'none' ? 'check_circle' : 'add_circle'} size={16} className={piece.id === 'none' ? 'text-aw-success' : 'text-aw-warning'} />
              <span className="aw-body aw-text-primary">{t(piece.labelKey)}</span>
            </div>
          ))}
        </div>
      );
    }

    if (widget.type === 'suggested_tilt') {
      const tilts = portfolioMap.suggestedTilts.length > 0
        ? portfolioMap.suggestedTilts
        : [{ id: 'none', labelKey: 'portfolioIntelligence.tilts.none', magnitude: 0 }];
      return (
        <div className="space-y-2">
          {tilts.slice(0, 4).map((tilt) => (
            <div key={tilt.id} className="aw-panel-muted flex items-center justify-between gap-3 px-3 py-2">
              <span className="aw-body aw-text-primary">{t(tilt.labelKey)}</span>
              <span className="aw-caption aw-text-secondary font-mono">{tilt.magnitude.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div className="space-y-3">
      <div className="aw-chart-plane h-28" aria-hidden="true" />
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
    <article className="aw-reference-card p-4">
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
