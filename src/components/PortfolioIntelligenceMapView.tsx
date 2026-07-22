import React from 'react';
import { buildPortfolioIntelligenceMap } from '../lib/portfolio-intelligence';
import { AccountPortfolio, TerminalState } from '../types/terminal';
import { PortfolioExposureAxisId, PortfolioIntelligenceMap } from '../types/portfolio-intelligence';
import { DashboardProjection } from '../types/workbench';
import { useTranslation } from '../hooks/useTranslation';
import { MaterialIcon } from './ui/MaterialIcon';
import { PortfolioIntelligenceCanvasScene } from './PortfolioIntelligenceCanvasScene';

interface PortfolioIntelligenceMapViewProps {
  map?: PortfolioIntelligenceMap;
  accountPortfolios?: AccountPortfolio[];
  terminalState?: TerminalState;
  dashboardProjection?: DashboardProjection;
  variant?: 'dashboard' | 'workbench';
  showAction?: boolean;
  onOpenWorkbench?: () => void;
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  awaiting_context: 'workbench.awaitingContext',
  waiting_signals: 'workbench.waitingSignals',
  ready: 'workbench.ready',
  partial: 'workbench.partial',
  blocked: 'workbench.blocked',
  error: 'workbench.error',
};

const AXIS_POSITION: Record<PortfolioExposureAxisId, { x: number; y: number }> = {
  growth: { x: 72, y: 24 },
  defense: { x: 84, y: 62 },
  liquidity: { x: 28, y: 76 },
  hedge: { x: 16, y: 48 },
};

const severityClass = {
  high: 'text-aw-danger border-aw-danger/30',
  medium: 'text-aw-warning border-aw-warning/30',
  low: 'text-aw-info border-aw-info/30',
};

const priorityIcon = {
  high: 'priority_high',
  medium: 'radio_button_checked',
  low: 'fiber_manual_record',
};

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

function AxisMetric({ axis }: { axis: PortfolioIntelligenceMap['axes'][number] }) {
  const { t } = useTranslation();
  const delta = Math.round((axis.projectedValue - axis.value) * 10) / 10;
  return (
    <div className="aw-pim-axis-row">
      <span className="aw-pim-axis-dot" style={{ backgroundColor: axis.color, boxShadow: `0 0 18px ${axis.color}` }} />
      <span className="aw-body aw-text-primary font-semibold truncate">{t(axis.labelKey)}</span>
      <span className="aw-caption aw-text-secondary font-mono">{axis.value.toFixed(1)}%</span>
      <span className={`aw-caption font-mono ${delta >= 0 ? 'text-aw-success' : 'text-aw-warning'}`}>
        {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
      </span>
    </div>
  );
}

function ExposureScene({ intelligenceMap, hasData }: { intelligenceMap: PortfolioIntelligenceMap; hasData: boolean }) {
  const { t } = useTranslation();

  return (
    <div
      className={`aw-pim-scene ${!hasData ? 'aw-pim-scene-empty' : ''}`}
      data-arbitra-portfolio-intelligence-scene="true"
      aria-label={t('portfolioIntelligence.sceneLabel')}
    >
      {hasData ? (
        <>
          <PortfolioIntelligenceCanvasScene intelligenceMap={intelligenceMap} />
          {intelligenceMap.axes.map((axis) => {
            const pos = AXIS_POSITION[axis.id];
            return (
              <React.Fragment key={axis.id}>
                <span
                  className="aw-pim-axis-label"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, color: axis.color }}
                >
                  {t(axis.labelKey)}
                </span>
              </React.Fragment>
            );
          })}
          <div className="aw-pim-core">
            <span className="aw-caption aw-text-tertiary font-mono uppercase">{t('portfolioIntelligence.total')}</span>
            <strong>{formatCurrency(intelligenceMap.totalMarketValue)}</strong>
          </div>
        </>
      ) : (
        <div className="aw-pim-empty-state" role="status">
          <MaterialIcon name="account_balance_wallet" size={24} />
          <strong>{t('workbench.awaitingContext')}</strong>
          <span>{t('portfolioIntelligence.missing.awaiting')}</span>
        </div>
      )}
    </div>
  );
}

export function PortfolioIntelligenceMapView({
  map,
  accountPortfolios,
  terminalState,
  dashboardProjection,
  variant = 'dashboard',
  showAction = false,
  onOpenWorkbench,
}: PortfolioIntelligenceMapViewProps) {
  const { t } = useTranslation();
  const intelligenceMap = React.useMemo(
    () => map || buildPortfolioIntelligenceMap({ accountPortfolios, terminalState }),
    [accountPortfolios, map, terminalState],
  );
  const compact = variant === 'workbench';
  const hasValuedPositions = intelligenceMap.dataQuality.valuedPositionCount > 0;
  const missingPieces = !hasValuedPositions
    ? [{
      id: 'awaiting',
      axis: intelligenceMap.intentFingerprint.dominantAxis,
      labelKey: 'portfolioIntelligence.missing.awaiting',
      severity: 'low' as const,
      currentValue: 0,
      targetValue: 0,
    }]
    : intelligenceMap.missingPieces.length > 0
    ? intelligenceMap.missingPieces
    : [{
      id: 'none',
      axis: intelligenceMap.intentFingerprint.dominantAxis,
      labelKey: 'portfolioIntelligence.missing.none',
      severity: 'low' as const,
      currentValue: 0,
      targetValue: 0,
    }];
  const sourceStatus = hasValuedPositions ? t('workbench.ready') : t('workbench.awaitingContext');
  const dataFreshnessStatus = hasValuedPositions ? t('workbench.ready') : t('workbench.waitingSignals');
  const confidenceStatus = hasValuedPositions
    ? t(`workbench.confidenceLevels.${intelligenceMap.intentFingerprint.confidence}`)
    : t('workbench.awaitingContext');
  const projectionStatus = dashboardProjection?.status;
  const projectionStatusLabel = projectionStatus
    ? t(STATUS_LABEL_KEYS[String(projectionStatus)] || String(projectionStatus))
    : '';
  const projectionSourceCount = dashboardProjection?.sourceRefs?.length || dashboardProjection?.trace?.sourceRefs?.length || 0;

  if (!hasValuedPositions) {
    return (
      <section className={`aw-pim-card aw-pim-card-empty ${compact ? 'aw-pim-card-compact' : ''}`}>
        <header className="aw-pim-header">
          <div className="min-w-0">
            <p className="aw-section-kicker">{t('portfolioIntelligence.kicker')}</p>
            <h3 className="aw-label aw-text-primary font-semibold tracking-normal">{t('portfolioIntelligence.title')}</h3>
          </div>
          <span className="aw-status-pill font-mono">
            <MaterialIcon name="schedule" size={16} />
            {t('workbench.awaitingContext')}
          </span>
        </header>

        <div className="aw-pim-empty-layout" role="status" aria-label={t('portfolioIntelligence.sceneLabel')}>
          <div className="aw-pim-empty-icon" aria-hidden="true">
            <MaterialIcon name="account_balance_wallet" size={24} />
          </div>
          <div className="min-w-0">
            <strong className="aw-body aw-text-primary">{t('portfolioIntelligence.emptyTitle')}</strong>
            <p className="aw-body aw-text-secondary mt-1">{t('portfolioIntelligence.emptyDescription')}</p>
          </div>
          <div className="aw-pim-empty-statuses" aria-label={t('portfolioIntelligence.dataReadiness')}>
            <span><MaterialIcon name="database" size={16} />{t('portfolioIntelligence.sourceTrace')}: {t('workbench.awaitingContext')}</span>
            <span><MaterialIcon name="schedule" size={16} />{t('portfolioIntelligence.dataFreshness')}: {t('workbench.waitingSignals')}</span>
            <span><MaterialIcon name="verified_user" size={16} />{t('portfolioIntelligence.confidence')}: —</span>
          </div>
        </div>

        {showAction && (
          <footer className="aw-pim-empty-footer">
            <button type="button" className="aw-button aw-button-primary !min-h-8 !px-3 font-mono" onClick={onOpenWorkbench}>
              <MaterialIcon name="forum" size={16} />
              <span>{t('portfolioIntelligence.completeContext')}</span>
            </button>
          </footer>
        )}
      </section>
    );
  }

  return (
    <section className={`aw-pim-card ${compact ? 'aw-pim-card-compact' : ''}`}>
      <header className="aw-pim-header">
        <div className="min-w-0">
          <p className="aw-section-kicker">{t('portfolioIntelligence.kicker')}</p>
          <h3 className="aw-label aw-text-primary font-semibold tracking-normal">{t('portfolioIntelligence.title')}</h3>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="aw-status-pill font-mono">
            <MaterialIcon name="account_balance_wallet" size={16} />
            {intelligenceMap.dataQuality.accountCount} {t('portfolioIntelligence.accounts')}
          </span>
          <span className="aw-status-pill font-mono">
            <MaterialIcon name="verified" size={16} />
            {Math.round(intelligenceMap.dataQuality.valuationCoverage * 100)}%
          </span>
        </div>
      </header>

      <div className={compact ? 'aw-pim-layout-compact' : 'aw-pim-layout'}>
        <ExposureScene intelligenceMap={intelligenceMap} hasData={hasValuedPositions} />

        <div className="aw-pim-panel">
          <div className="flex items-center gap-2 mb-3">
            <MaterialIcon name="fingerprint" size={16} className="text-aw-accent-mist" />
            <span className="aw-body aw-text-primary font-semibold">{t('portfolioIntelligence.intentTitle')}</span>
          </div>
          <p className="aw-body aw-text-secondary leading-relaxed">{t(intelligenceMap.intentFingerprint.labelKey)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="aw-pim-metric">
              <span>{t('portfolioIntelligence.concentration')}</span>
              <strong>{intelligenceMap.intentFingerprint.concentrationScore}</strong>
            </div>
            <div className="aw-pim-metric">
              <span>{t('portfolioIntelligence.topThree')}</span>
              <strong>{intelligenceMap.intentFingerprint.topThreeWeight.toFixed(1)}%</strong>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {intelligenceMap.axes.map((axis) => (
              <AxisMetric key={axis.id} axis={axis} />
            ))}
          </div>
        </div>

        <div className="aw-pim-panel">
          <div className="flex items-center gap-2 mb-3">
            <MaterialIcon name="extension" size={16} className="text-aw-warning" />
            <span className="aw-body aw-text-primary font-semibold">{t('portfolioIntelligence.missingTitle')}</span>
          </div>
          <div className="space-y-2">
            {missingPieces.map((piece) => (
              <div key={piece.id} className={`aw-pim-chip ${severityClass[piece.severity]}`}>
                <MaterialIcon name={piece.id === 'none' ? 'check_circle' : piece.id === 'awaiting' ? 'schedule' : 'add_circle'} size={16} />
                <span>{t(piece.labelKey)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 mb-3">
            <MaterialIcon name="near_me" size={16} className="text-aw-success" />
            <span className="aw-body aw-text-primary font-semibold">{t('portfolioIntelligence.tiltTitle')}</span>
          </div>
          <div className="space-y-2">
            {!hasValuedPositions ? (
              <div className="aw-pim-tilt-row">
                <MaterialIcon name="schedule" size={16} className="aw-text-tertiary" />
                <span>{t('portfolioIntelligence.tilts.awaiting')}</span>
                <strong>--</strong>
              </div>
            ) : intelligenceMap.suggestedTilts.length > 0 ? intelligenceMap.suggestedTilts.slice(0, 3).map((tilt) => (
              <div key={tilt.id} className="aw-pim-tilt-row">
                <MaterialIcon name={priorityIcon[tilt.priority]} size={16} className={tilt.priority === 'high' ? 'text-aw-danger' : 'text-aw-success'} />
                <span className="truncate">{t(tilt.labelKey)}</span>
                <strong>{tilt.magnitude.toFixed(1)}%</strong>
              </div>
            )) : (
              <div className="aw-pim-tilt-row">
                <MaterialIcon name="check_circle" size={16} className="text-aw-success" />
                <span>{t('portfolioIntelligence.tilts.none')}</span>
                <strong>0%</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="aw-pim-footer">
        <div className="aw-pim-evidence-grid">
          <div className="aw-pim-evidence-chip aw-pim-evidence-chip-source">
            <MaterialIcon name="database" size={20} />
            <span>
              <strong>{t('portfolioIntelligence.sourceTrace')}</strong>
              <em>{sourceStatus}</em>
            </span>
          </div>
          <div className="aw-pim-evidence-chip aw-pim-evidence-chip-freshness">
            <MaterialIcon name="schedule" size={20} />
            <span>
              <strong>{t('portfolioIntelligence.dataFreshness')}</strong>
              <em>{dataFreshnessStatus}</em>
            </span>
          </div>
          <div className="aw-pim-evidence-chip aw-pim-evidence-chip-confidence">
            <MaterialIcon name="verified_user" size={20} />
            <span>
              <strong>{t('portfolioIntelligence.confidence')}</strong>
              <em>{confidenceStatus}</em>
            </span>
          </div>
          {projectionStatusLabel && (
            <div className="aw-pim-evidence-chip aw-pim-evidence-chip-source">
              <MaterialIcon name="auto_graph" size={20} />
              <span>
                <strong>{t('portfolioIntelligence.projectionTrace')}</strong>
                <em>
                  {projectionStatusLabel}
                  {projectionSourceCount > 0 ? ` · ${projectionSourceCount} ${t('portfolioIntelligence.sourcesShort')}` : ''}
                </em>
              </span>
            </div>
          )}
        </div>
        {showAction && (
          <button type="button" className="aw-button aw-button-primary !min-h-8 !px-3 font-mono" onClick={onOpenWorkbench}>
            <MaterialIcon name="open_in_new" size={16} />
            <span>{t('portfolioIntelligence.openWorkbench')}</span>
          </button>
        )}
      </footer>
    </section>
  );
}
