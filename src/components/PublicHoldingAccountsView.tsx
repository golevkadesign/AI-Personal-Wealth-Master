import React from 'react';
import { ChartWidget } from './ChartWidget';
import { getCurrencySymbol, getHoldingMarketValue } from './chart-configs';
import { useWealthStore } from '../hooks/useWealthStore';
import { AccountPortfolio } from '../types/terminal';
import { MaterialIcon } from './ui/MaterialIcon';
import { getAwChartPalette } from '../lib/design-tokens';
import { useInteractionStore } from '../hooks/useInteractionStore';
import {
  createHoldingWorkbenchSession,
  createPortfolioIntelligenceWorkbenchSession,
  createPortfolioReviewWorkbenchSession,
} from '../lib/workbench-session';
import { PortfolioIntelligenceMapView } from './PortfolioIntelligenceMapView';
import { Arbitra2DChart } from './charts/Arbitra2DChart';

interface PublicHoldingAccountsViewProps {
  title: string;
  chartType: string;
  accountPortfolios: AccountPortfolio[];
  syncStatus: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  syncError?: string;
  lastSyncAt?: number;
  chartHeight?: string;
  delay?: number;
  selectedHolding?: any;
  setSelectedHolding?: (holding: any) => void;
  t: (key: string) => string;
  globalData?: any;
}

export const PublicHoldingAccountsView: React.FC<PublicHoldingAccountsViewProps> = ({
  title,
  chartType,
  accountPortfolios = [],
  syncStatus,
  syncError,
  lastSyncAt,
  chartHeight,
  delay,
  selectedHolding,
  setSelectedHolding,
  t,
  globalData
}) => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [ctaError, setCtaError] = React.useState<string | null>(null);
  const fetchLongbridgeAccountPortfolios = useWealthStore(state => state.fetchLongbridgeAccountPortfolios);
  const createPortfolioReviewSession = useWealthStore(state => state.createPortfolioReviewSession);
  const openWorkbench = useInteractionStore(state => state.openWorkbench);

  const handleReload = async () => {
    setIsRefreshing(true);
    try {
      await fetchLongbridgeAccountPortfolios();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreatePortfolioReview = () => {
    setCtaError(null);
    const session = createPortfolioReviewSession();
    if (session) {
      openWorkbench(createPortfolioReviewWorkbenchSession({
        sessionId: session.id,
        accountPortfolios,
        terminalState: useWealthStore.getState().data,
      }));
    } else {
      setCtaError(t('dashboard.reviewUnavailable'));
    }
  };

  const handleOpenPortfolioIntelligence = () => {
    openWorkbench(createPortfolioIntelligenceWorkbenchSession({
      accountPortfolios,
      terminalState: useWealthStore.getState().data,
    }));
  };

  const hasData = accountPortfolios && accountPortfolios.length > 0;

  // Widget Level Status mapping for the overarching container
  let widgetStatus: 'loading' | 'empty' | 'error' | 'success' = 'success';
  if (syncStatus === 'loading' && !hasData) widgetStatus = 'loading';
  else if (syncStatus === 'empty') widgetStatus = 'empty';
  else if (syncStatus === 'error' && !hasData) widgetStatus = 'error';
  else if (!hasData) widgetStatus = 'empty'; // fallback

  const colors = getAwChartPalette();
  const formatAccountName = React.useCallback((account?: AccountPortfolio) => {
    if (!account) return t('dashboard.accountFallback');
    if (account.accountName === '__manual_single_account_holdings__') {
      return t('dashboard.manualSingleAccountHoldings');
    }
    return account.accountName || account.accountId || t('dashboard.accountFallback');
  }, [t]);

  const handleOpenHoldingWorkbench = React.useCallback((holding: any, account?: AccountPortfolio) => {
    if (!holding) return;
    const nextHolding = account
      ? {
          ...holding,
          accountId: account.accountId,
          accountName: formatAccountName(account),
        }
      : holding;
    setSelectedHolding?.(nextHolding);
    openWorkbench(createHoldingWorkbenchSession(nextHolding, useWealthStore.getState().data));
  }, [formatAccountName, openWorkbench, setSelectedHolding]);

  const dashboardProjection = globalData?.dashboardProjection;
  const projectedPortfolioMap = dashboardProjection?.portfolioIntelligenceMap || globalData?.portfolioIntelligenceMap;

  // Header status badge and subtitle logic
  let statusText = t('nav.synced');
  let badgeStyle = "border-aw-border-subtle text-aw-success bg-aw-surface-3";
  let statusDotClass = "aw-status-success";
  let statusSubText = t('dashboard.refreshed');

  if (isRefreshing || syncStatus === 'loading') {
    statusText = t('nav.syncing');
    badgeStyle = "border-aw-border-subtle text-aw-warning bg-aw-surface-3 animate-pulse";
    statusDotClass = "aw-status-warning";
    statusSubText = t('dashboard.refreshingBroker');
  } else if (syncStatus === 'error' || accountPortfolios.some(a => a.meta?.error)) {
    statusText = t('dashboard.partialException');
    badgeStyle = "border-aw-border-subtle text-aw-danger bg-aw-surface-3";
    statusDotClass = "aw-status-danger";
    statusSubText = t('dashboard.partialError');
  } else if (!hasData || syncStatus === 'empty') {
    statusText = t('dashboard.noHoldings');
    badgeStyle = "border-aw-border-subtle aw-text-tertiary bg-aw-surface-3";
    statusDotClass = "";
    statusSubText = t('dashboard.noHoldingsSynced');
  } else if (accountPortfolios.some(a => a.meta?.valuationCoverage !== undefined && a.meta.valuationCoverage < 1)) {
    statusText = t('dashboard.partialValuation');
    badgeStyle = "border-aw-border-subtle text-aw-warning bg-aw-surface-3";
    statusDotClass = "aw-status-warning";
    statusSubText = t('dashboard.valuationIncomplete');
  } else if (accountPortfolios.some(a => a.meta?.estimatedValuationSymbols && a.meta.estimatedValuationSymbols.length > 0)) {
    statusText = t('dashboard.estimatedValuation');
    badgeStyle = "border-aw-border-subtle text-aw-info bg-aw-surface-3";
    statusDotClass = "aw-status-info";
    statusSubText = t('dashboard.valuationEstimated');
  }

  return (
    <div className="w-full min-w-0 space-y-2">
      {/* Unified Multi-Account Group Header */}
      <div className="aw-panel flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <h2 className="aw-label font-semibold aw-text-primary tracking-normal">{t('dashboard.multiAccountHoldings')}</h2>
            {/* Unified Status Badge */}
            <span className={`aw-status-pill ${badgeStyle} font-mono select-none`}>
              <span className={`aw-status-dot ${statusDotClass}`} />
              {statusText}
            </span>
          </div>
          <p className="aw-caption aw-text-secondary select-none">{t('dashboard.splitByBroker')}</p>
          <p className="aw-caption aw-text-tertiary font-medium select-none mt-0.5 flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 rounded-full bg-aw-accent-sage" />
            {statusSubText}
          </p>
        </div>

        {/* Module Action Section */}
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center justify-end">
          <button
            onClick={handleReload}
            disabled={isRefreshing}
            className="aw-button aw-button-ghost !min-h-8 !px-3 font-mono cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none"
          >
            <MaterialIcon name="refresh" size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? t('nav.syncing') : t('dashboard.refreshLive')}</span>
          </button>

          <button
            onClick={handleCreatePortfolioReview}
            className="aw-button aw-button-primary !min-h-8 !px-3 font-mono cursor-pointer select-none"
          >
            <MaterialIcon name="auto_awesome" size={16} filled />
            <span>{t('dashboard.generateReview')}</span>
          </button>
        </div>
      </div>

      {ctaError && (
        <div className="aw-status-pill text-aw-danger font-mono px-3 py-1.5">
          <MaterialIcon name="warning" size={16} filled />
          {ctaError}
        </div>
      )}

      {/* Global Insight for Public Holdings if available */}
      {globalData?.insights?.public && (
        <div className="aw-panel p-4 relative overflow-hidden">
          <div className="absolute right-3 top-3 aw-caption font-mono aw-text-tertiary uppercase font-bold select-none">{t('dashboard.insight')}</div>
          <p className="aw-body aw-text-secondary leading-relaxed pr-16">{globalData.insights.public}</p>
        </div>
      )}

      <PortfolioIntelligenceMapView
        map={projectedPortfolioMap}
        accountPortfolios={accountPortfolios}
        terminalState={globalData}
        dashboardProjection={dashboardProjection}
        showAction
        onOpenWorkbench={handleOpenPortfolioIntelligence}
      />

      <div className={
        accountPortfolios.length >= 2
          ? "aw-account-holdings-grid grid grid-cols-1 min-[1440px]:grid-cols-2 gap-2 min-w-0"
          : "aw-account-holdings-grid grid grid-cols-1 gap-2 min-w-0"
      }>
        {accountPortfolios.map((account, accIdx) => {
          const positions = account.positions || [];
          const accountStatus: 'loading' | 'empty' | 'error' | 'success' =
            account.meta?.error ? 'error' :
            (syncStatus === 'loading' || isRefreshing) && positions.length === 0 ? 'loading' :
            positions.length === 0 ? 'empty' :
            'success';
          const sortedArr = [...positions].sort((a, b) => getHoldingMarketValue(b) - getHoldingMarketValue(a));
          const totalVal = sortedArr.reduce((sum, h) => sum + getHoldingMarketValue(h), 0);
          const currSym = getCurrencySymbol(sortedArr[0]?.currency || 'CNY');
          const formattedTotal = currSym + ' ' + totalVal.toLocaleString('en-US', { maximumFractionDigits: 0 });

          const validPieData = sortedArr
            .filter(v => getHoldingMarketValue(v) > 0)
            .map((v, index) => ({
              name: v.name || v.symbol,
              value: getHoldingMarketValue(v),
              color: colors[index % colors.length],
              currency: v.currency,
              meta: v,
            }));

          const handleDonutDataClick = (params: any) => {
            if (params.name) {
              const hit = sortedArr.find(h => h.name === params.name || h.symbol === params.name);
              if (hit) {
                handleOpenHoldingWorkbench(hit, account);
              }
            }
          };

          const hasEstimated = account.meta?.estimatedValuationSymbols && account.meta.estimatedValuationSymbols.length > 0;
          const displayAccountName = formatAccountName(account);
          const cardBadge = (
            <div className="flex flex-wrap items-center gap-2 relative mr-1 max-w-[240px] md:max-w-xs justify-end">
              {account.meta?.error && (
                <span className="aw-status-pill !min-h-5 text-aw-danger font-mono whitespace-nowrap shrink-0">
                  {t('dashboard.syncException')}
                </span>
              )}
              {hasEstimated && (
                <span className="aw-status-pill !min-h-5 text-aw-info font-mono whitespace-nowrap shrink-0">
                  {t('dashboard.estimated')}
                </span>
              )}
              <span 
                className="aw-caption aw-text-tertiary font-mono font-semibold truncate max-w-[120px] sm:max-w-[160px]"
                title={displayAccountName && account.accountId ? `${displayAccountName} (${account.accountId})` : account.accountId}
              >
                {displayAccountName}
              </span>
            </div>
          );

          const cardTitle = (
            <div className="flex items-center gap-2 select-none shrink-0">
              <div className="w-1.5 h-3 bg-aw-accent-mist rounded-sm" />
              <span className="aw-body font-semibold aw-text-primary tracking-normal">{t('dashboard.holdings')}</span>
            </div>
          );

          return (
            <ChartWidget
              key={account.accountId || accIdx}
              title={cardTitle}
              type={chartType}
              dataLength={positions.length}
              insight=""
              delay={delay}
              chartHeight="auto"
              size="auto"
              className="aw-account-card h-auto overflow-hidden"
              badge={cardBadge}
              status="success"
              onReload={undefined}
              showReload={false}
              isReloading={false}
            >
              {/* Synchronization alert banner specifically visible on this account */}
              {account.meta?.error && (
                <div className="absolute top-0 inset-x-0 py-1.5 min-h-[24px] bg-aw-warning/10 border-b border-aw-warning/30 flex items-center justify-center -mx-4 sm:-mx-5 z-20 px-4">
                  <span className="aw-caption font-mono text-aw-warning font-medium tracking-wide text-center">
                    {account.meta?.error || t('dashboard.accountSyncErrorCached')}
                  </span>
                </div>
              )}

              {isRefreshing && (
                <div className="absolute top-0 inset-x-0 h-1 bg-aw-bg z-50">
                   <div className="h-full bg-aw-accent-mist/50 animate-pulse w-full origin-left" />
                </div>
              )}

              {positions.length === 0 ? (
	                <div className="aw-panel-muted aw-holding-empty-state flex flex-col items-center justify-center text-center gap-2 p-4">
                  <MaterialIcon
                    name={accountStatus === 'error' ? 'sync_problem' : accountStatus === 'loading' ? 'progress_activity' : 'inventory_2'}
                    size={24}
                    className={accountStatus === 'error' ? 'text-aw-danger' : accountStatus === 'loading' ? 'text-aw-warning animate-spin' : 'aw-text-tertiary'}
                  />
                  <span className={`aw-body font-semibold ${accountStatus === 'error' ? 'text-aw-danger' : 'aw-text-secondary'}`}>
                    {accountStatus === 'error' ? t('dashboard.accountErrorTitle') :
                     accountStatus === 'loading' ? t('dashboard.accountLoadingTitle') :
                     t('dashboard.accountEmptyTitle')}
                  </span>
                  <span className="aw-caption font-mono aw-text-tertiary max-w-[320px] leading-relaxed">
                    {account.meta?.error || t('dashboard.accountEmptyDesc')}
                  </span>
                </div>
              ) : (
	                <div className="grid grid-cols-1 min-[1180px]:grid-cols-[150px_minmax(0,1fr)] gap-2 items-center min-w-0 relative z-10">
	                  {/* Left: Donut Chart */}
	                  <div className="w-full flex items-center justify-center min-w-0 relative min-h-[136px]">
	                    <div className="w-[132px] h-[132px] sm:w-[140px] sm:h-[140px] relative shrink-0">
                      <Arbitra2DChart
                        variant="donut"
                        data={validPieData}
                        compact
                        onDataClick={handleDonutDataClick}
                        className="w-full h-full"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="aw-caption font-mono aw-text-tertiary uppercase leading-none mb-1">{t('dashboard.total')}</span>
                        <span className="aw-body font-bold aw-text-primary font-mono leading-none tracking-normal">
                          {formattedTotal}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Interactive Holdings List */}
                  <div className="w-full min-w-0 overflow-hidden flex flex-col justify-start custom-scroll pr-1 pb-1">
                    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(100px,0.85fr)_minmax(56px,0.45fr)] gap-2 items-center aw-caption font-mono font-semibold aw-text-tertiary uppercase pb-2 border-b border-aw-border-subtle mb-2 px-3">
                      <div className="min-w-0 truncate">{t('dashboard.instrument')}</div>
                      <div className="min-w-0 text-right truncate">{t('dashboard.estValue')}</div>
                      <div className="text-right whitespace-nowrap">{t('dashboard.ratio')}</div>
                    </div>

	                    <div className="space-y-1.5 max-h-[148px] overflow-y-auto custom-scroll pr-1">
                      {sortedArr.map((item, idx) => {
                        const isSelected = selectedHolding && 
                          (selectedHolding.symbol === item.symbol || selectedHolding.name === item.name) &&
                          selectedHolding.accountId === account.accountId;

                        const val = getHoldingMarketValue(item);
                        const pct = totalVal > 0 ? ((val / totalVal) * 100).toFixed(1) + '%' : '0.0%';
                        const itemColor = colors[idx % colors.length];

                        return (
                          <div
                            key={`${item.symbol || idx}-${account.accountId}`}
                            onClick={() => handleOpenHoldingWorkbench(item, account)}
	                            className={`aw-holding-row grid grid-cols-[minmax(0,1.4fr)_minmax(100px,0.85fr)_minmax(56px,0.45fr)] gap-2 items-center px-3 py-2 cursor-pointer transition-all border ${
                              isSelected 
                                ? 'bg-aw-surface-3 border-aw-border-strong aw-text-primary'
                                : 'border-aw-border-subtle hover:bg-aw-surface-3 aw-text-secondary'
                            }`}
                          >
                            {/* Name with Dot */}
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="w-2 rounded-full h-2 shrink-0 shadow-sm" style={{ backgroundColor: itemColor }} />
                              <span className={`aw-body truncate ${isSelected ? 'font-bold aw-text-primary tracking-normal' : 'font-medium'}`}>
                                {item.name || item.symbol}
                              </span>
                            </div>

                            {/* Value */}
                            <div className={`min-w-0 flex items-center justify-end gap-1 text-right font-mono ${val > 0 ? 'aw-caption font-semibold aw-text-primary' : 'aw-caption text-aw-danger font-medium'}`}>
                              {val > 0 ? (
                                <>
                                  <span className="truncate">{currSym}{val.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                                  {(item._staleQuote || item.valuationSource === 'cost_basis_estimate' || item.valuationSource === 'negative_cost_basis_estimate') && (
                                    <span className="aw-caption font-sans font-normal px-1 py-0.5 aw-mini-token bg-aw-surface-3 text-aw-warning border border-aw-border-subtle scale-90 origin-right whitespace-nowrap select-none shrink-0">
                                      {t('dashboard.estimateShort')}
                                    </span>
                                  )}
                                  {(!item._staleQuote && item.valuationSource === 'longbridge_position_value') && (
                                    <span className="aw-caption font-sans font-normal px-1 py-0.5 aw-mini-token bg-aw-surface-3 text-aw-success border border-aw-border-subtle scale-90 origin-right whitespace-nowrap select-none shrink-0">
                                      {t('dashboard.positionValue')}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="truncate">{t('dashboard.valuationMissing')}</span>
                              )}
                            </div>

                            {/* Percentage / Arrow */}
                            <div className={`text-right font-mono aw-caption font-semibold whitespace-nowrap flex items-center justify-end gap-1 ${val > 0 ? 'aw-text-secondary' : 'aw-text-tertiary'}`}>
                              <span>{val > 0 ? pct : '--'}</span>
                              <MaterialIcon name="chevron_right" size={16} className={`transition-transform ${isSelected ? 'translate-x-0.5' : 'opacity-30'} shrink-0`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </ChartWidget>
          );
        })}
      </div>
    </div>
  );
};
