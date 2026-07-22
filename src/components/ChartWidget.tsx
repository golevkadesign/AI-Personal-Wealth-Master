import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { MaterialIcon } from './ui/MaterialIcon';
import { useTranslation } from '../hooks/useTranslation';
import { EMPTY_STATE } from '../hooks/useWealthStore';
import { Arbitra2DChart } from './charts/Arbitra2DChart';
import { isKnownI18nText } from '../i18n/translations';

const ChartSkeleton = () => {
  const { t } = useTranslation();
  return (
    <div className="w-full h-full flex flex-col items-center justify-center aw-panel animate-pulse min-h-[250px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-4 h-4 rounded-full border border-aw-border-strong border-t-aw-accent-mist animate-spin" />
        <span className="aw-caption aw-text-tertiary font-mono uppercase">{t('charts.initializing')}</span>
      </div>
    </div>
  );
};

interface ChartWidgetProps {
  title: React.ReactNode;
  type?: string;
  dataLength: number;
  insight?: string | React.ReactNode;
  option?: any;
  delay?: number;
  chartHeight?: string;
  children?: React.ReactNode;
  status?: 'loading' | 'empty' | 'error' | 'success'; 
  onReload?: () => Promise<void> | void;
  showReload?: boolean;
  reloadLabel?: string;
  isReloading?: boolean;
  badge?: React.ReactNode;
  onChartClick?: (params: any) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'auto';
}

const sizeClassMap = {
  sm: 'aw-chart-min-sm',
  md: 'aw-chart-min-md',
  lg: 'aw-chart-min-lg',
  auto: 'aw-chart-min-auto'
};

export function ChartWidget({ title, type, dataLength, insight, option, delay = 0, chartHeight = '250px', children, status, onReload, showReload, reloadLabel, isReloading, badge, onChartClick, className, size }: ChartWidgetProps) {
  const { t } = useTranslation();
  // If status is provided, use it, else derive from dataLength
  const currentStatus = status || (dataLength > 0 ? 'success' : 'empty');
  const resolvedReloadLabel = reloadLabel || t('dashboard.refreshLive');
  
  const chartEvents = useMemo(() => onChartClick ? { click: onChartClick } : undefined, [onChartClick]);
  const titleText = typeof title === 'string' ? title : t('dashboard.holdings');
  const shouldShowInsight =
    !!insight &&
    insight !== EMPTY_STATE.insights.private &&
    !(typeof insight === 'string' && isKnownI18nText(insight, 'dashboard.privateInsightFallback')) &&
    insight !== t('dashboard.noPublicHoldings');
  const resolvedSizeClass = currentStatus === 'empty'
    ? 'aw-chart-min-empty'
    : currentStatus === 'error'
      ? 'aw-chart-min-error'
      : sizeClassMap[size || 'md'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25, delay: delay }}
      className={`aw-chart-shell aw-module-data p-4 sm:p-5 flex flex-col relative overflow-hidden group ${resolvedSizeClass} ${className || 'h-full'}`}
    >
      <h3 className="aw-chart-title mb-4 flex justify-between items-start z-10 shrink-0">
        <span className="flex items-center gap-2">{title}</span>
        <div className="flex items-center gap-2">
          {showReload && onReload && (
            <button
              onClick={() => onReload()}
              disabled={isReloading}
              className="aw-chart-action opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={resolvedReloadLabel}
            >
              <MaterialIcon name="refresh" size={16} className={isReloading ? 'animate-spin' : ''} />
              <span>{resolvedReloadLabel}</span>
            </button>
          )}
          {badge && <div>{badge}</div>}
          <button
             className="aw-chart-action opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
             onClick={() => {
	               const roleName = titleText === t('dashboard.holdings') ? t('charts.portfolioStrategist') : t('charts.dataAnalyst');
               useInteractionStore.getState().openWidgetWorkbench(titleText, { insight }, roleName);
             }}
             title={t('charts.expertReview')}
             aria-label={t('charts.expertReview')}
          >
             <MaterialIcon name="auto_awesome" size={16} filled />
             <span>{t('charts.expertReview')}</span>
          </button>
        </div>
      </h3>
      
      {currentStatus === 'loading' && (
         <div className="flex-1 flex flex-col items-center justify-center min-h-[160px] gap-4">
             <div className="aw-chart-state-icon">
                 <div className="w-4 h-4 rounded-full border border-aw-border-strong border-t-aw-accent-mist animate-spin" />
             </div>
             <p className="aw-chart-state-caption mb-1">{t('charts.systemStatus')}</p>
             <div className="aw-body aw-text-secondary">{t('charts.resourceLoading')}</div>
         </div>
      )}

      {currentStatus === 'empty' && (
         <div className="aw-chart-empty-state flex-1 flex flex-col items-center justify-center aw-text-tertiary">
           <div className="flex items-center gap-2">
             <MaterialIcon name="query_stats" size={20} className="opacity-70" />
             <div>
               <p className="aw-chart-state-caption mb-1">{t('charts.awaitingContext')}</p>
               <span className="aw-body aw-text-secondary font-medium">{t('charts.noData')}</span>
             </div>
           </div>
         </div>
      )}

      {currentStatus === 'error' && (
         <div className="flex-1 flex flex-col items-center justify-center min-h-[160px] gap-3">
            <div className="aw-chart-state-icon mb-2">
                 <MaterialIcon name="sync_problem" size={20} className="text-aw-danger" />
            </div>
            <p className="aw-chart-state-caption text-aw-danger">{t('charts.errorState')}</p>
            <span className="aw-body text-aw-danger font-medium tracking-wide">{t('charts.dataLoadError')}</span>
            {(onReload || showReload) && (
               <button onClick={() => onReload && onReload()} disabled={isReloading} className="aw-chart-action cursor-pointer mt-2 disabled:opacity-40 disabled:cursor-not-allowed">
                  <MaterialIcon name="refresh" size={16} className={isReloading ? 'animate-spin' : ''} />
                  {t('charts.retry')}
               </button>
            )}
         </div>
      )}

      {currentStatus === 'success' && (
        <div className="flex-1 flex flex-col min-h-0">
          {option || children ? (
            <div className="w-full relative z-10 shrink-0 mb-4" style={{ height: chartHeight }}>
              {children ? children : (
                <Arbitra2DChart option={option} type={type} onDataClick={chartEvents?.click} className="w-full h-full" />
              )}
            </div>
          ) : null}
          
          {shouldShowInsight && (
            <div className="mt-auto pt-4 border-t border-aw-border-subtle relative z-10 flex-1 overflow-y-auto custom-scroll pr-2">
              <h4 className="aw-caption font-semibold aw-text-tertiary mb-3 uppercase block w-full">{t('charts.terminalDiagnostics')}</h4>
              {typeof insight === 'string' ? (
                 <p className="aw-chart-insight p-4">{insight}</p>
              ) : (
                 <div className="aw-chart-insight p-4">{insight}</div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
