import React, { useMemo, Suspense, useState } from 'react';
import { motion } from 'motion/react';
import { PieChart, RefreshCw, Activity } from 'lucide-react';
import { useInteractionStore } from '../hooks/useInteractionStore';

const ReactEChartsLazy = React.lazy(() => import('./ReactECharts').then(m => ({ default: m.ReactECharts })));

const ChartSkeleton = () => (
  <div className="w-full h-full flex flex-col items-center justify-center arbitra-panel border-dash-subtle animate-pulse min-h-[250px] rounded-[16px]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-4 h-4 rounded-full border border-dash-primary/30 border-t-dash-primary animate-spin" />
      <span className="text-[10px] arbitra-text-tertiary font-mono tracking-widest uppercase">Initializing Context...</span>
    </div>
  </div>
);

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
  sm: 'min-h-[280px]',
  md: 'min-h-[340px]',
  lg: 'min-h-[420px]',
  auto: 'min-h-[280px]'
};

export function ChartWidget({ title, type, dataLength, insight, option, delay = 0, chartHeight = '250px', children, status, onReload, showReload, reloadLabel = '刷新实盘', isReloading, badge, onChartClick, className, size }: ChartWidgetProps) {
  // If status is provided, use it, else derive from dataLength
  const currentStatus = status || (dataLength > 0 ? 'success' : 'empty');
  
  const chartEvents = useMemo(() => onChartClick ? { click: onChartClick } : undefined, [onChartClick]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25, delay: delay }}
      className={`arbitra-panel arbitra-panel-hover rounded-2xl p-6 sm:p-8 flex flex-col relative overflow-hidden group min-w-[260px] sm:min-w-[300px] max-w-full ${sizeClassMap[size || 'md']} ${className || 'h-full'}`}
    >
      <h3 className="arbitra-text-secondary text-[11px] arbitra-text-mono font-semibold mb-6 flex justify-between items-start z-10 shrink-0 uppercase tracking-widest gap-2 min-w-0">
        <span className="flex items-center gap-2 min-w-0 truncate">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {showReload && onReload && (
            <button
              onClick={() => onReload()}
              disabled={isReloading}
              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity border border-[#C9B284]/25 hover:border-[#C9B284]/50 bg-[#16181A] hover:bg-[#C9B284]/10 text-[#C9B284] px-2.5 py-1 font-semibold text-[10px] rounded-[8px] transition-all cursor-pointer flex items-center gap-1 shadow-sm font-sans whitespace-nowrap shrink-0"
              title={reloadLabel}
            >
              <RefreshCw className={`w-3 h-3 ${isReloading ? 'animate-spin' : ''}`} />
              <span className="whitespace-nowrap">{reloadLabel}</span>
            </button>
          )}
          {badge && <div className="shrink-0">{badge}</div>}
          <button
             className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity border border-[#C9B284]/25 hover:border-[#C9B284]/50 bg-[#16181A] hover:bg-[#C9B284]/10 text-[#C9B284] px-2.5 py-1 font-semibold text-[10px] rounded-[8px] transition-all cursor-pointer flex items-center gap-1 shadow-sm font-sans whitespace-nowrap shrink-0"
             onClick={() => {
               const roleName = title === '公开市场持仓视图' ? '首席组合策略师' : '数据分析专家';
               useInteractionStore.getState().openCopilot(title as string, { insight }, roleName);
             }}
             title="专家探讨"
             aria-label="专家探讨"
          >
             <span>✨</span><span className="whitespace-nowrap">专家探讨</span>
          </button>
        </div>
      </h3>
      
      {currentStatus === 'loading' && (
         <div className="flex-1 flex flex-col items-center justify-center min-h-[220px] gap-4">
             <div className="w-10 h-10 rounded-[12px] bg-surface flex items-center justify-center border border-dash-subtle shadow-inner">
                 <div className="w-4 h-4 rounded-full border border-dash-primary/30 border-t-dash-primary animate-spin" />
             </div>
             <p className="arbitra-text-mono text-[10px] tracking-[0.2em] arbitra-text-tertiary uppercase mb-1">SYSTEM STATUS</p>
             <div className="text-xs arbitra-text-secondary">Resource Loading</div>
         </div>
      )}

      {currentStatus === 'empty' && (
         <div className="flex-1 flex flex-col items-center justify-center min-h-[220px] text-dash-tertiary">
           <PieChart className="w-8 h-8 mb-3 opacity-30 arbitra-text-gold" />
           <p className="arbitra-text-mono text-[10px] tracking-[0.2em] arbitra-text-tertiary uppercase mb-1">等待上下文</p>
           <span className="text-xs arbitra-text-secondary font-medium">暂无数据</span>
         </div>
      )}

      {currentStatus === 'error' && (
         <div className="flex-1 flex flex-col items-center justify-center min-h-[220px] gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shadow-inner mb-2">
                 <RefreshCw className="w-4 h-4 text-rose-500" />
            </div>
            <p className="arbitra-text-mono text-[10px] tracking-[0.2em] text-rose-500/70 uppercase">ERROR STATE</p>
            <span className="text-xs text-rose-400 font-medium tracking-wide">Data Load Error</span>
            {(onReload || showReload) && (
               <button onClick={() => onReload && onReload()} disabled={isReloading} className="opacity-80 hover:opacity-100 transition-opacity border border-rose-500/25 hover:border-rose-500/50 bg-rose-500/10 text-rose-400 px-3 py-1.5 font-semibold text-[11px] rounded-[6px] tracking-wide cursor-pointer flex items-center gap-1 shadow-sm font-mono mt-2">
                  <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} /> RETRY
               </button>
            )}
         </div>
      )}

      {currentStatus === 'success' && (
        <div className="flex-1 flex flex-col min-h-0">
          {option || children ? (
            <div className="w-full relative z-10 shrink-0 mb-6" style={{ height: chartHeight }}>
              {children ? children : (
                <Suspense fallback={<ChartSkeleton />}>
                  <ReactEChartsLazy option={option} onEvents={chartEvents} className="w-full h-full" />
                </Suspense>
              )}
            </div>
          ) : null}
          
          {insight && insight !== "暂无非公开资产数据" && insight !== "暂无公开市场持仓" && (
            <div className="mt-auto pt-6 border-t border-dash-subtle relative z-10 flex-1 overflow-y-auto custom-scroll pr-2">
              <h4 className="text-[11px] font-semibold text-dash-tertiary mb-3 tracking-[0.1em] uppercase block w-full">Terminal Diagnostics</h4>
              {typeof insight === 'string' ? (
                 <p className="text-[13px] text-dash-primary leading-relaxed bg-dash-surface-hover p-4 rounded-2xl border border-dash-subtle">{insight}</p>
              ) : (
                 <div className="bg-dash-surface-hover p-4 rounded-2xl border border-dash-subtle text-[13px] text-dash-primary leading-relaxed">{insight}</div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

