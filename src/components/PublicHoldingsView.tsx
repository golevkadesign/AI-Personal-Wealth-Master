import React from 'react';
import { ChartWidget } from './ChartWidget';
import { getCurrencySymbol, getHoldingMarketValue } from './chart-configs';
import { useWealthStore } from '../hooks/useWealthStore';
import { MaterialIcon } from './ui/MaterialIcon';
import { getAwChartPalette } from '../lib/design-tokens';
import { useInteractionStore } from '../hooks/useInteractionStore';
import {
  createHoldingWorkbenchSession,
  createPortfolioIntelligenceWorkbenchSession,
} from '../lib/workbench-session';
import { PortfolioIntelligenceMapView } from './PortfolioIntelligenceMapView';
import { Arbitra2DChart } from './charts/Arbitra2DChart';

interface PublicHoldingsViewProps {
  title: string;
  chartType: string;
  distData: any[];
  globalData: any;
  chartHeight?: string;
  delay?: number;
  selectedHolding?: any;
  setSelectedHolding?: (holding: any) => void;
  t: (key: string) => string;
}

export const PublicHoldingsView: React.FC<PublicHoldingsViewProps> = ({
  title,
  chartType,
  distData,
  globalData,
  chartHeight,
  delay,
  selectedHolding,
  setSelectedHolding,
  t
}) => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const fetchLongbridge = useWealthStore(state => state.fetchLongbridge);
  const fetchLongbridgeAccountPortfolios = useWealthStore(state => state.fetchLongbridgeAccountPortfolios);
  const openWorkbench = useInteractionStore(state => state.openWorkbench);
  const displayTitle = title;

  const handleReload = async () => {
    setIsRefreshing(true);
    try {
      let hasAccounts = false;
      try {
        await fetchLongbridgeAccountPortfolios();
        const state = useWealthStore.getState();
        const accounts = state.data.publicHoldingAccounts || (state.data.distributions as any)?.publicHoldingAccounts || [];
        if (accounts.length > 0) {
          hasAccounts = true;
        }
      } catch (err) {
        console.error("fetchLongbridgeAccountPortfolios failed, falling back to fetchLongbridge:", err);
      }

      if (!hasAccounts) {
        await fetchLongbridge();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // High-fidelity Dual Column Layout for Public Holdings Redesign
  const hasData = distData && distData.length > 0;
  
  const rawStatus = useWealthStore(state => state.publicHoldingsSyncStatus) || 'idle';
  const errorMessage = useWealthStore(state => state.publicHoldingsError);
  
  // Decide what status ChartWidget receives
  // If we have data, we always want to show it, so we pass 'success' (unless it's currently hard loading without any old data, which shouldn't happen because we have old data)
  let widgetStatus: 'loading' | 'empty' | 'error' | 'success' = 'success';
  if (rawStatus === 'loading' && !hasData) widgetStatus = 'loading';
  else if (rawStatus === 'empty') widgetStatus = 'empty';
  else if (rawStatus === 'error' && !hasData) widgetStatus = 'error';
  else if (!hasData) widgetStatus = 'empty'; // fallback

  const sortedArr = [...distData].sort((a: any, b: any) => getHoldingMarketValue(b) - getHoldingMarketValue(a));
  const totalHoldingsVal = sortedArr.reduce((sum, h) => sum + getHoldingMarketValue(h), 0);
  const currSym = getCurrencySymbol(sortedArr[0]?.currency || 'CNY');
  const formattedTotal = currSym + ' ' + totalHoldingsVal.toLocaleString('en-US', { maximumFractionDigits: 0 });

  const colors = getAwChartPalette();

  const validPieData = sortedArr
    .filter((v: any) => getHoldingMarketValue(v) > 0)
    .map((v: any, index: number) => ({
      name: v.name || v.symbol,
      value: getHoldingMarketValue(v),
      color: colors[index % colors.length],
      currency: v.currency,
      meta: v,
    }));

  const handleOpenHoldingWorkbench = React.useCallback((holding: any) => {
    if (!holding) return;
    setSelectedHolding?.(holding);
    openWorkbench(createHoldingWorkbenchSession(holding, useWealthStore.getState().data));
  }, [openWorkbench, setSelectedHolding]);

  const handleDonutDataClick = (params: any) => {
    if (params.name) {
      const hit = sortedArr.find((h: any) => h.name === params.name || h.symbol === params.name);
      if (hit) handleOpenHoldingWorkbench(hit);
    }
  };

  const handleOpenPortfolioIntelligence = () => {
    openWorkbench(createPortfolioIntelligenceWorkbenchSession({
      terminalState: globalData,
    }));
  };

  return (
    <div className="space-y-2">
      <PortfolioIntelligenceMapView
        terminalState={globalData}
        showAction
        onOpenWorkbench={handleOpenPortfolioIntelligence}
      />
      <ChartWidget
        title={displayTitle}
        type={chartType}
        dataLength={distData.length}
        insight={globalData?.insights?.public || ""}
        delay={delay}
        chartHeight={chartHeight}
        badge={<span className="aw-caption aw-text-tertiary font-mono font-semibold">{t('dashboard.allocationAnalysis')}</span>}
        status={widgetStatus}
        size="auto"
        className="aw-public-holdings-card h-auto overflow-hidden"
        onReload={handleReload}
        showReload={true}
        isReloading={isRefreshing}
      >
      {/* If we have old data but status is loading/error, we show a lightweight banner at top */}
      {hasData && errorMessage && (
          <div className="absolute top-0 inset-x-0 py-0.5 min-h-[24px] bg-aw-warning/10 border-b border-aw-warning/30 flex items-center justify-center -mx-4 sm:-mx-5 z-20 px-4">
          <span className="aw-caption font-mono text-aw-warning font-medium tracking-wide text-center">
            {errorMessage}
          </span>
        </div>
      )}
      {hasData && !errorMessage && rawStatus === 'error' && (
          <div className="absolute top-0 inset-x-0 py-0.5 min-h-[24px] bg-aw-danger/10 border-b border-aw-danger/30 flex items-center justify-center -mx-4 sm:-mx-5 z-20 px-4">
          <span className="aw-caption font-mono text-aw-danger font-medium tracking-wide text-center">
            {t('drawer.syncFailed') || 'SYNC FAILED - SHOWING LAST KNOWN STATE'}
          </span>
        </div>
      )}
      {hasData && (rawStatus === 'loading' || isRefreshing) && (
        <div className="absolute top-0 inset-x-0 h-1 bg-aw-bg z-50">
           <div className="h-full bg-aw-accent-mist/50 animate-pulse w-full origin-left" />
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-center gap-3 h-full min-h-[178px] relative z-10 pt-1">
        {/* Left: Pie Donut Chart (Col 5) */}
        <div className="w-full lg:w-[42%] flex items-center justify-center relative min-h-[150px]">
          <div className="w-[152px] h-[152px] relative shrink-0">
            <Arbitra2DChart
              variant="donut"
              data={validPieData}
              compact
              onDataClick={handleDonutDataClick}
              className="w-full h-full"
            />
            {/* Centered Total Assets Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="aw-caption font-mono aw-text-tertiary uppercase leading-none mb-1">{t('dashboard.totalLimit')}</span>
              <span className="aw-body font-bold aw-text-primary font-mono leading-none tracking-normal">{formattedTotal}</span>
            </div>
          </div>
        </div>

        {/* Right: Interactive Holdings List (Col 7) */}
        <div className="w-full lg:w-[58%] flex flex-col justify-start custom-scroll pr-1 pb-1">
          <div className="grid grid-cols-12 aw-caption font-mono font-semibold aw-text-tertiary uppercase pb-2 border-b border-aw-border-subtle mb-2 px-3">
            <div className="col-span-6">{t('dashboard.instrument')}</div>
            <div className="col-span-4 text-right">{t('dashboard.estValue')}</div>
            <div className="col-span-2 text-right">{t('dashboard.ratio')}</div>
          </div>

          <div className="space-y-1.5 max-h-[168px] overflow-y-auto custom-scroll pr-1">
            {sortedArr.map((item: any, idx: number) => {
              const isSelected = selectedHolding && (selectedHolding.symbol === item.symbol || selectedHolding.name === item.name);
              const val = getHoldingMarketValue(item);
              const pct = totalHoldingsVal > 0 ? ((val / totalHoldingsVal) * 100).toFixed(1) + '%' : '0.0%';
              const itemColor = colors[idx % colors.length];

              return (
                <div
                  key={item.symbol || idx}
                  onClick={() => handleOpenHoldingWorkbench(item)}
	                  className={`aw-holding-row grid grid-cols-12 items-center px-3 py-2 cursor-pointer transition-all border ${
                    isSelected 
                      ? 'bg-aw-surface-3 border-aw-border-strong aw-text-primary'
                      : 'border-aw-border-subtle hover:bg-aw-surface-3 aw-text-secondary'
                  }`}
                >
                  {/* Name with Matching Dot */}
                  <div className="col-span-6 flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: itemColor }} />
                    <span className={`aw-body truncate ${isSelected ? 'font-bold aw-text-primary tracking-normal' : 'font-medium'}`}>
                      {item.name || item.symbol}
                    </span>
                  </div>

                  {/* Currency / Value */}
                  <div className={`col-span-4 text-right font-mono ${val > 0 ? 'aw-caption font-semibold aw-text-primary' : 'aw-caption text-aw-danger font-medium'}`}>
                    {val > 0 ? `${currSym}${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : t('dashboard.valuationMissing')}
                  </div>

                  {/* Percentage and action arrow */}
                  <div className={`col-span-2 flex items-center justify-end gap-1.5 text-right font-mono aw-caption font-semibold ${val > 0 ? 'aw-text-secondary' : 'aw-text-tertiary'}`}>
                    <span>{val > 0 ? pct : '--'}</span>
                    <MaterialIcon name="chevron_right" size={16} className={`transition-transform ${isSelected ? 'translate-x-0.5' : 'opacity-30'}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </ChartWidget>
    </div>
  );
};
