import React, { useMemo, Suspense } from 'react';
import { motion } from 'motion/react';
import { PieChart, RefreshCw, Sparkles } from 'lucide-react';
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
  title: string | React.ReactNode;
  dataLength: number;
  insight?: string | React.ReactNode;
  option?: any;
  delay?: number;
  chartHeight?: string;
  children?: React.ReactNode;
  status?: 'loading' | 'empty' | 'error' | 'success'; 
  onReload?: () => void;
  badge?: React.ReactNode;
  onChartClick?: (params: any) => void;
}

export function ChartWidget({ title, dataLength, insight, option, delay = 0, chartHeight = '250px', children, status, onReload, badge, onChartClick }: ChartWidgetProps) {
  // If status is provided, use it, else derive from dataLength
  const currentStatus = status || (dataLength > 0 ? 'success' : 'empty');
  
  const chartEvents = useMemo(() => onChartClick ? { click: onChartClick } : undefined, [onChartClick]);

  let cnTitle = title;
  let enTitle = "";
  if (typeof title === 'string') {
    const titleParts = title.split(' ');
    cnTitle = titleParts[0];
    enTitle = titleParts.slice(1).join(' ');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25, delay: delay }}
      className="arbitra-panel arbitra-panel-subtle shadow-sm rounded-[16px] md:rounded-[20px] p-5 md:p-6 lg:p-8 flex flex-col relative overflow-hidden h-full group"
    >
      <div className="flex justify-between items-start z-10 shrink-0 mb-4 md:mb-6">
        <h3 className="flex items-center gap-2 text-[14px] font-medium text-dash-primary font-sans tracking-wide">
          <span>{cnTitle}</span>
          {enTitle && <span className="text-[10px] sm:text-[11px] uppercase tracking-widest text-dash-secondary font-sans font-normal opacity-70 mt-0.5">{enTitle}</span>}
        </h3>
        
        <div className="flex items-center gap-2">
          {badge && <div>{badge}</div>}
          <button
             className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:text-dash-gold text-dash-tertiary"
             onClick={() => useInteractionStore.getState().openCopilot(typeof title === 'string' ? title : '图表分析', { insight }, '数据分析专家')}
             title="AI Insight"
             aria-label="AI Insight"
          >
             <Sparkles className="w-3.5 h-3.5" /> 
             <span className="text-[11px] font-sans">AI Insight</span>
          </button>
        </div>
      </div>
      
      {currentStatus === 'loading' && (
         <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] gap-4">
             <div className="w-10 h-10 rounded-[12px] bg-dash-surface flex items-center justify-center border border-dash-subtle shadow-inner">
                 <div className="w-4 h-4 rounded-full border border-dash-primary/30 border-t-dash-primary animate-spin" />
             </div>
             <p className="font-mono text-[10px] tracking-[0.2em] text-dash-tertiary uppercase mb-1">SYSTEM STATUS</p>
             <div className="text-xs text-dash-secondary">Resource Loading</div>
         </div>
      )}

      {currentStatus === 'empty' && (
         <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] text-dash-tertiary">
           <PieChart className="w-8 h-8 mb-3 opacity-30 text-dash-gold" />
           <p className="font-mono text-[10px] tracking-[0.2em] text-dash-tertiary uppercase mb-1">等待上下文</p>
           <span className="text-xs text-dash-secondary font-medium">暂无数据</span>
         </div>
      )}

      {currentStatus === 'error' && (
         <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shadow-inner mb-2">
                 <RefreshCw className="w-4 h-4 text-rose-500" />
            </div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-rose-500/70 uppercase">ERROR STATE</p>
            <span className="text-xs text-rose-400 font-medium tracking-wide">Data Load Error</span>
            {onReload && (
               <button onClick={onReload} className="arbitra-btn-base arbitra-btn-ghost !text-xs !px-3 !py-1.5 arbitra-focus-ring mt-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
               </button>
            )}
         </div>
      )}

      {currentStatus === 'success' && (
        <div className="flex-1 flex flex-col min-h-0 pl-0">
          <div className="flex flex-col xl:flex-row h-full gap-4">
             <div className="w-full xl:w-[65%] relative z-10 shrink-0" style={{ height: chartHeight }}>
               {children ? children : (
                 <Suspense fallback={<ChartSkeleton />}>
                   <ReactEChartsLazy option={option} onEvents={chartEvents} className="w-full h-full" />
                 </Suspense>
               )}
             </div>
             
             <div className="w-full xl:w-[35%] flex flex-col justify-center xl:pl-4 mt-2 xl:mt-0 relative z-10">
               {insight && insight !== "暂无非公开资产数据" && insight !== "暂无公开市场持仓" && (
                 <div>
                   <h4 className="text-[12px] font-semibold text-dash-primary mb-2 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-dash-gold" />关键洞察</h4>
                   {typeof insight === 'string' ? (
                      <p className="text-[13px] text-dash-secondary leading-relaxed">{insight}</p>
                   ) : (
                      <div className="text-[13px] text-dash-secondary leading-relaxed">{insight}</div>
                   )}
                 </div>
               )}
               {/* Values/Legend placeholder depending on design, injected via child or echarts legend */}
             </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

