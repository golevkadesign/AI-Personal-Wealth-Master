import React, { useMemo } from 'react';
import { Card } from '../components/Card';
import { ReactECharts } from '../components/ReactECharts';
import { Sparkles, Activity, AlertTriangle, Zap, ArrowRight, ShieldAlert } from 'lucide-react';
import { getSDUIPieOption, getDonutOption, getExpenseOption, getWaterfallOption, getHoldingsOption, getOptionsOption, getCurrencySymbol } from '../components/chart-configs';
import { ChartWidget } from '../components/ChartWidget';
import { SDUIComponent } from '../types/terminal';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { useSDUIEventStore } from '../hooks/useSDUIEventStore';
import { useTranslation } from '../hooks/useTranslation';
import { PublicHoldingsView } from '../components/PublicHoldingsView';
import { PublicHoldingAccountsView } from '../components/PublicHoldingAccountsView';
import { getMetricVisibility, getChartVisibility } from './dashboard-visibility';
import { DASHBOARD_LAYOUT } from './dashboard-layout';

const bgMap: Record<string, string> = {
  'surface-base': 'bg-dash-surface',
  'surface-elevated': 'bg-dash-surface-hover',
  'surface-highlight': 'bg-white/5',
  'danger-muted': 'bg-red-500/10',
  'warning-muted': 'bg-amber-500/10',
  'transparent': 'bg-transparent'
};
const textMap: Record<string, string> = {
  'text-primary': 'text-white',
  'text-muted': 'text-slate-400',
  'text-accent': 'text-dash-primary',
  'danger': 'text-red-400',
  'warning': 'text-amber-400',
  'success': 'text-emerald-400'
};
const typoMap: Record<string, string> = {
  'h1': 'text-3xl font-bold',
  'h2': 'text-2xl font-bold',
  'h3': 'text-xl font-semibold',
  'h3-serif': 'text-xl font-serif font-medium tracking-wide',
  'body': 'text-base',
  'body-sm': 'text-sm',
  'caption': 'text-xs uppercase tracking-wider'
};
const borderMap: Record<string, string> = {
  'border-subtle': 'border border-dash-subtle',
  'border-strong': 'border border-slate-700',
  'danger': 'border border-red-500/30',
  'none': 'border-none'
};
const paddingMap: Record<string, string> = {
  'none': 'p-0', 'sm': 'p-2', 'md': 'p-4', 'lg': 'p-6'
};

export const ComponentRegistry: Record<string, React.FC<any>> = {
  Grid: ({ columns = 1, gap = 6, className = "", children }) => {
    // Handling dynamic grid cols can be tricky with Tailwind if not purged correctly,
    // but typically `grid-cols-1`, `md:grid-cols-2`, `md:grid-cols-3` are common or we can map it
    const colClass = columns === 4 ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4" : 
                     columns === 2 ? "grid-cols-1 md:grid-cols-2" : 
                     columns === 3 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1";
    return (
      <div className={`grid ${colClass} gap-${gap} ${className}`}>
        {children}
      </div>
    );
  },
  MetricCard: ({ title, dataKey, isLongSubText, globalData }) => {
    const visibility = getMetricVisibility(globalData, dataKey);
    if (!visibility.visible) {
      return null;
    }
    const metrics = globalData?.metrics || {};
    const valueNum = metrics[dataKey];
    let currency = 'USD';
    const dist = globalData?.distributions;
    if (dist?.liquidity?.[0]?.currency) currency = dist.liquidity[0].currency;
    else if (dist?.publicHoldings?.[0]?.currency) currency = dist.publicHoldings[0].currency;
    else if (dist?.privateAssets?.[0]?.currency) currency = dist.privateAssets[0].currency;
    const sym = getCurrencySymbol(currency);
    const valueStr = valueNum !== undefined ? `${sym}${Number(valueNum).toLocaleString()}` : 'N/A';
    const subValue = metrics[`${dataKey}Summary`] || '';
    return <Card title={title} value={valueStr} subValue={subValue} isLongSubText={isLongSubText} />;
  },
  DynamicChart: ({ title, chartType, chartHeight, layoutSize, delay, globalData }) => {
    const visibility = getChartVisibility(globalData, chartType);
    if (!visibility.visible) {
      return null;
    }
    const dispatchEvent = useSDUIEventStore.getState().dispatch;
    const { t } = useTranslation();
    const { selectedHolding, setSelectedHolding } = globalData || {};
    const distData = globalData?.distributions?.[chartType] || [];

    let resolvedHeight = chartHeight;
    if (!resolvedHeight && layoutSize) {
      const layoutSetting = DASHBOARD_LAYOUT.chart[layoutSize as keyof typeof DASHBOARD_LAYOUT.chart];
      if (layoutSetting) {
        resolvedHeight = layoutSetting.chartHeight;
      }
    }
    if (!resolvedHeight) {
      resolvedHeight = '240px';
    }

    if (chartType === 'publicHoldings') {
      const publicHoldingAccounts = globalData?.publicHoldingAccounts || [];
      if (publicHoldingAccounts.length > 0) {
        return (
          <PublicHoldingAccountsView
            title={title}
            chartType={chartType}
            accountPortfolios={publicHoldingAccounts}
            syncStatus={globalData?.publicHoldingAccountsSyncStatus || 'idle'}
            syncError={globalData?.publicHoldingAccountsError}
            lastSyncAt={globalData?.publicHoldingAccountsLastSyncAt}
            chartHeight={resolvedHeight}
            delay={delay}
            selectedHolding={selectedHolding}
            setSelectedHolding={setSelectedHolding}
            t={t}
            globalData={globalData}
          />
        );
      }
      return (
        <PublicHoldingsView
          title={title}
          chartType={chartType}
          distData={distData}
          globalData={globalData}
          chartHeight={resolvedHeight}
          delay={delay}
          selectedHolding={selectedHolding}
          setSelectedHolding={setSelectedHolding}
          t={t}
        />
      );
    }

    // Default chart renderer for normal widgets: liquidity, expenses, options, etc.
    let option = {};
    const chartContextData = { ...globalData, distributions: { ...globalData?.distributions, [chartType]: distData } };
    
    if (chartType === 'liquidity') option = getDonutOption(chartContextData, t);
    else if (chartType === 'expenses') option = getExpenseOption(chartContextData, t);
    else if (chartType === 'privateAssets') option = getWaterfallOption(chartContextData, t);
    else if (chartType === 'publicHoldings') option = getHoldingsOption(chartContextData, t);
    else if (chartType === 'options') option = getOptionsOption(chartContextData, t);

    let insightKey = 'global';
    if (chartType === 'publicHoldings' || chartType === 'options') insightKey = 'public';
    if (chartType === 'privateAssets') insightKey = 'private';

    return (
      <ChartWidget
        title={title}
        type={chartType}
        option={option}
        chartHeight={resolvedHeight}
        delay={delay}
        insight={globalData?.insights?.[insightKey] || ""}
        dataLength={distData.length}
        onChartClick={(params) => dispatchEvent('CHART_CLICK', params)}
      />
    );
  },
  Flex: ({ direction = 'row', justify = 'start', align = 'stretch', gap = 4, className = '', children }) => {
    const dirClass = direction === 'col' ? 'flex-col' : 'flex-row';
    const justifyClass = `justify-${justify}`;
    const alignClass = `items-${align}`;
    const gapClass = `gap-${gap}`;
    return (
      <div className={`flex ${dirClass} ${justifyClass} ${alignClass} ${gapClass} ${className}`}>
        {children}
      </div>
    );
  },
  Box: ({ bg = 'transparent', border = 'none', padding = 'none', className = '', children, globalData }) => {
    const bgClasses = {
      'surface': 'bg-dash-surface',
      'surface-elevated': 'bg-dash-surface-hover shadow-lg shadow-black/50',
      'danger-muted': 'bg-dash-red/10',
      'accent-muted': 'bg-dash-primary/5',
    };
    const borderClasses = {
      'subtle': 'border border-dash-subtle',
      'danger': 'border border-dash-red/30',
      'accent': 'border border-dash-primary/30',
    };
    const paddingClasses = { 'none': '', 'sm': 'p-3', 'md': 'p-5', 'lg': 'p-8' };
    const boxClass = `rounded-2xl backdrop-blur-sm ${bgClasses[bg as keyof typeof bgClasses] || ''} ${borderClasses[border as keyof typeof borderClasses] || ''} ${paddingClasses[padding as keyof typeof paddingClasses] || 'p-5'} ${className || ''}`;
    return <div className={boxClass.trim()}>{children}</div>;
  },
  Typography: ({ variant = 'body', color = 'text-primary', text, className = '' }) => {
    const variantClasses = {
      'h1': 'text-4xl font-serif font-bold text-white tracking-tight',
      'h2': 'text-2xl font-serif font-semibold text-slate-100',
      'h3-serif': 'text-xl font-serif font-semibold text-dash-primary',
      'h3': 'text-lg font-bold text-white',
      'body': 'text-sm text-slate-300 leading-relaxed',
      'caption': 'text-xs text-slate-500 uppercase tracking-widest font-semibold',
    };
    const colorClasses = {
      'text-accent': 'text-dash-primary',
      'text-muted': 'text-slate-400',
      'danger': 'text-dash-red',
      'success': 'text-dash-green',
    };
    const classes = `${variantClasses[variant as keyof typeof variantClasses] || variantClasses.body} ${colorClasses[color as keyof typeof colorClasses] || ''} ${className}`;
    return <div className={classes.trim()}>{text}</div>;
  },
  Badge: ({ intent = 'default', text, className = '' }) => {
    const badgeIntentClasses = {
      'info': 'bg-dash-primary/10 text-dash-primary border-dash-primary/30',
      'critical': 'bg-dash-red/10 text-dash-red border-dash-red/30',
      'success': 'bg-dash-green/10 text-dash-green border-dash-green/30',
    };
    const classes = `inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${badgeIntentClasses[intent as keyof typeof badgeIntentClasses] || badgeIntentClasses.info} ${className}`;
    return <span className={classes.trim()}>{text}</span>;
  },
  ActionButton: ({ actionIntent, label, variant = 'primary', className = '' }) => {
    const openDrawerWithIntent = useInteractionStore(state => state.openDrawerWithIntent);
    const variantStyles: Record<string, string> = {
      'primary': 'bg-dash-primary text-black hover:bg-dash-primary/90',
      'danger': 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30',
      'outline': 'bg-transparent border border-dash-subtle text-white hover:bg-dash-surface-hover'
    };
    const classes = `px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${variantStyles[variant] || variantStyles['primary']} ${className}`;
    return (
      <button onClick={() => actionIntent && openDrawerWithIntent(actionIntent)} className={classes}>
        {label}
      </button>
    );
  },
  ChartWidget: (props) => <ChartWidget {...props} />,
  MetricsCard: ({ title, value, globalData }) => {
    let currency = 'USD';
    const dist = globalData?.distributions;
    if (dist?.liquidity?.[0]?.currency) currency = dist.liquidity[0].currency;
    else if (dist?.publicHoldings?.[0]?.currency) currency = dist.publicHoldings[0].currency;
    else if (dist?.privateAssets?.[0]?.currency) currency = dist.privateAssets[0].currency;
    const sym = getCurrencySymbol(currency);
    return <Card title={title} value={ typeof value === 'number' ? `${sym}${value.toLocaleString()}` : value } />
  },
  EChartsPie: ({ data }) => {
    const { t } = useTranslation();
    const option = useMemo(() => getSDUIPieOption(data, t), [data, t]);

    if (!data || data.length === 0) {
      return (
        <div className="arbitra-panel arbitra-panel-hover rounded-2xl p-6 h-[350px] flex flex-col items-center justify-center animate-pulse">
          <div className="w-40 h-40 rounded-full border-8 border-dash-subtle/30 border-t-dash-subtle/60 animate-spin" />
          <div className="mt-6 h-3 w-24 bg-dash-subtle/50 rounded-full" />
        </div>
      );
    }
    return (
      <div className="arbitra-panel arbitra-panel-hover rounded-2xl p-6 h-[350px] flex flex-col">
         <div className="flex-1 min-h-0">
            <ReactECharts option={option} />
         </div>
      </div>
    );
  },
  Timeline12X: ({ title, nodes }) => {
    if (!nodes || nodes.length === 0) {
      return (
         <div className="arbitra-panel arbitra-panel-hover rounded-2xl p-6 relative overflow-hidden animate-pulse">
            <div className="h-6 w-48 bg-dash-subtle/50 rounded-lg mb-8" />
            <div className="relative border-l border-dash-subtle ml-4 space-y-10 my-4">
               {[1,2,3].map(i => (
                 <div key={i} className="pl-8 relative">
                    <div className="absolute w-4 h-4 bg-dash-subtle rounded-full -left-[8.5px] top-1" />
                    <div className="h-5 w-20 bg-dash-subtle/50 rounded-md mb-3" />
                    <div className="h-6 w-1/3 bg-dash-subtle/50 rounded mb-2" />
                    <div className="h-20 w-full bg-dash-surface rounded-2xl" />
                 </div>
               ))}
            </div>
         </div>
      );
    }
    return (
      <div className="arbitra-panel arbitra-panel-hover rounded-2xl p-6 relative overflow-hidden">
        <h3 className="text-xl font-bold arbitra-text-primary mb-6 flex items-center gap-2 tracking-tight">
            <Sparkles className="w-5 h-5 arbitra-text-gold" /> {title}
        </h3>
        <div className="relative border-l border-dash-subtle ml-4 space-y-10 my-4">
           {nodes?.map((item: any, idx: number) => (
             <div key={idx} className="pl-8 relative">
                 <div className="absolute w-4 h-4 bg-dash-primary rounded-full -left-[8.5px] top-1 ring-4 ring-dash-base shadow-sm" />
                 <div className="inline-block bg-dash-surface arbitra-text-gold arbitra-text-mono font-semibold text-xs px-3 py-1 rounded-md mb-3 border border-dash-subtle">
                   {item.timeNode}
                 </div>
                 <h4 className="text-lg font-medium arbitra-text-primary mb-2">{item.title}</h4>
                 <p className="text-sm arbitra-text-secondary leading-relaxed bg-dash-surface p-4 rounded-xl border border-dash-subtle">
                   {item.description}
                 </p>
             </div>
           ))}
        </div>
      </div>
    );
  },
  SystemAlert: ({ message }) => (
    <div className="p-4 bg-dash-red/10 text-dash-red text-sm font-medium rounded-xl border border-dash-red/20 my-4 flex items-center gap-3">
      <Activity className="w-5 h-5 shrink-0" />
      {message}
    </div>
  ),
  InterventionCard: ({ title, description, level = 'warning', actions = [] }) => {
    const isCritical = level === 'critical';
    
    return (
      <div className={`relative overflow-hidden rounded-2xl border p-6 shadow-xl w-full
        ${isCritical ? 'bg-red-950/20 border-red-500/50 shadow-red-900/20' : 'bg-amber-950/20 border-amber-500/50 shadow-amber-900/20 hover:border-amber-500/80 transition-colors duration-300'}
      `}>
         {/* visual flair like a breathing light or corner accent */}
         {isCritical && (
           <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
             <div className="w-32 h-32 bg-red-500 blur-3xl rounded-full mix-blend-screen animate-pulse" />
           </div>
         )}
         {!isCritical && (
           <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
             <div className="w-32 h-32 bg-amber-500 blur-3xl rounded-full mix-blend-screen" />
           </div>
         )}
         
         <div className="relative z-10 flex items-start gap-4">
            <div className={`mt-1 shrink-0 ${isCritical ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>
               {isCritical ? <ShieldAlert className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
            </div>
            <div className="flex-1">
               <h3 className={`text-xl font-bold mb-2 tracking-tight ${isCritical ? 'text-red-400' : 'text-amber-400'}`}>
                  {title}
               </h3>
               <p className="text-sm text-dash-secondary leading-relaxed mb-6">
                  {description}
               </p>
               
               {actions?.length > 0 && (
                 <div className="flex flex-wrap gap-3">
                   {actions.map((action: any, idx: number) => {
                     const isPrimary = action.type === 'primary';
                     return (
                       <button
                         key={idx}
                         onClick={() => window.dispatchEvent(new CustomEvent('trigger-ai-drawer', { detail: action.prompt }))}
                         className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                           ${isPrimary 
                             ? (isCritical ? 'bg-red-500/20 text-red-100 hover:bg-red-500/40 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-amber-500/20 text-amber-100 hover:bg-amber-500/40 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]') 
                             : 'bg-black/40 text-dash-tertiary hover:text-dash-primary border border-dash-subtle hover:bg-black/60'}
                         `}
                       >
                         {isPrimary && <Zap className="w-4 h-4" />}
                         {action.label}
                         {isPrimary && <ArrowRight className="w-4 h-4 ml-1 opacity-50" />}
                       </button>
                     );
                   })}
                 </div>
               )}
            </div>
         </div>
      </div>
    );
  },
  ActionGroup: ({ buttons = [] }) => {
    if (!buttons || buttons.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-dash-subtle/50">
        {buttons.map((btn: any, idx: number) => {
          const isPrimary = btn.type === 'primary';
          return (
             <button
               key={idx}
               onClick={() => window.dispatchEvent(new CustomEvent('trigger-ai-drawer', { detail: btn.prompt }))}
               className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                 ${isPrimary 
                   ? 'bg-dash-primary/20 text-dash-primary hover:bg-dash-primary/30 border border-dash-primary/30' 
                   : 'bg-dash-surface text-dash-secondary hover:text-dash-primary border border-dash-subtle hover:bg-dash-surface-hover'}
               `}
             >
               {isPrimary && <Zap className="w-4 h-4" />}
               {btn.label}
               {isPrimary && <ArrowRight className="w-4 h-4 opacity-50" />}
             </button>
          )
        })}
      </div>
    );
  }
};

export const SDUIRenderer = ({ schema, globalData }: { schema?: SDUIComponent[], globalData?: any }) => {
  if (!schema || !Array.isArray(schema)) return null;

  return (
    <>
      {schema.map((block, i) => {
        const Component = ComponentRegistry[block.type] || ComponentRegistry[(block as any).component];
        if (!Component) {
           return (
             <div key={block.id || i} className="p-4 border border-dash-subtle rounded-xl bg-dash-surface text-dash-tertiary text-sm mb-4 border-dashed">
               Unknown Component: {block.type || (block as any).component}
             </div>
           );
        }
        return (
           <Component key={block.id || i} {...block.props} globalData={globalData}>
              {block.children && <SDUIRenderer schema={block.children} globalData={globalData} />}
           </Component>
        );
      })}
    </>
  );
};
