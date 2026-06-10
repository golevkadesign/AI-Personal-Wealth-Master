import React, { useMemo } from 'react';
import { Card } from '../components/Card';
import { ReactECharts } from '../components/ReactECharts';
import { MaterialIcon } from '@/src/components/ui/MaterialIcon';
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
  'surface-base': 'bg-aw-surface-1',
  'surface-elevated': 'bg-aw-surface-2',
  'surface-highlight': 'bg-aw-surface-3',
  'danger-muted': 'bg-aw-danger/10',
  'warning-muted': 'bg-aw-warning/10',
  'transparent': 'bg-transparent'
};
const textMap: Record<string, string> = {
  'text-primary': 'aw-text-primary',
  'text-muted': 'aw-text-tertiary',
  'text-accent': 'text-aw-accent-mist',
  'danger': 'text-aw-danger',
  'warning': 'text-aw-warning',
  'success': 'text-aw-success'
};
const typoMap: Record<string, string> = {
  'h1': 'aw-title font-bold',
  'h2': 'aw-title font-semibold',
  'h3': 'aw-label font-semibold',
  'h3-serif': 'aw-label font-semibold',
  'body': 'aw-body',
  'body-sm': 'aw-body',
  'caption': 'aw-caption uppercase font-mono font-semibold'
};
const borderMap: Record<string, string> = {
  'border-subtle': 'border border-aw-border-subtle',
  'border-strong': 'border border-aw-border-strong',
  'danger': 'border border-aw-danger/30',
  'none': 'border-none'
};
const paddingMap: Record<string, string> = {
  'none': 'p-0', 'sm': 'p-2', 'md': 'p-4', 'lg': 'p-6'
};

export const ComponentRegistry: Record<string, React.FC<any>> = {
  Grid: ({ columns = 1, gap = 6, preset, className = "", children }) => {
    const visibleChildren = React.Children.toArray(children).filter(Boolean);
    if (visibleChildren.length === 0) {
      return null;
    }

    const gapMap: Record<number, string> = {
      4: 'gap-4',
      5: 'gap-5',
      6: 'gap-6',
      7: 'gap-7',
      8: 'gap-8'
    };
    const gapClass = gapMap[gap] || 'gap-6';

    let layoutClass = "";
    if (preset) {
      layoutClass = preset === 'metrics' ? DASHBOARD_LAYOUT.grid.metrics :
                    preset === 'charts' ? DASHBOARD_LAYOUT.grid.charts :
                    preset === 'sections' ? DASHBOARD_LAYOUT.grid.sections : '';
    } else {
      const colClass = columns === 4 ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" : 
                       columns === 3 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" :
                       columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1";
      layoutClass = `${colClass} ${gapClass}`;
    }

    return (
      <div className={`grid ${layoutClass} ${className}`}>
        {visibleChildren}
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
  DynamicChart: ({ title, chartType, chartHeight, layoutSize, delay, globalData, layoutSpan }) => {
    const { t } = useTranslation();
    const dispatchEvent = useSDUIEventStore.getState().dispatch;
    const { selectedHolding, setSelectedHolding } = globalData || {};

    const visibility = getChartVisibility(globalData, chartType);
    if (!visibility.visible) {
      return null;
    }
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

    let renderContent: React.ReactElement | null = null;

    if (chartType === 'publicHoldings') {
      const publicHoldingAccounts = globalData?.publicHoldingAccounts || [];
      if (publicHoldingAccounts.length > 0) {
        renderContent = (
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
      } else {
        renderContent = (
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
    } else {
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

      renderContent = (
        <ChartWidget
          title={title}
          type={chartType}
          option={option}
          chartHeight={resolvedHeight}
          size={layoutSize || 'md'}
          delay={delay}
          insight={globalData?.insights?.[insightKey] || ""}
          dataLength={distData.length}
          onChartClick={(params) => dispatchEvent('CHART_CLICK', params)}
        />
      );
    }

    const spanClassMap: Record<string, string> = {
      normal: 'min-w-0 w-full',
      wide: 'col-span-1 xl:col-span-2 2xl:col-span-2 min-w-0 w-full',
      full: 'col-span-full min-w-0 w-full'
    };
    const spanClass = spanClassMap[layoutSpan as string] || 'min-w-0 w-full';

    return (
      <div className={spanClass}>
        {renderContent}
      </div>
    );
  },
  Flex: ({ direction = 'row', justify = 'start', align = 'stretch', gap = 4, className = '', children }) => {
    const dirClass = direction === 'col' ? 'flex-col' : 'flex-row';
    const justifyClass = `justify-${justify}`;
    const alignClass = `items-${align}`;
    const gapMap: Record<number | string, string> = {
      2: 'gap-2',
      3: 'gap-3',
      4: 'gap-4',
      5: 'gap-5',
      6: 'gap-6',
      8: 'gap-8'
    };
    const gapClass = gapMap[gap as keyof typeof gapMap] || 'gap-4';
    return (
      <div className={`flex ${dirClass} ${justifyClass} ${alignClass} ${gapClass} ${className}`}>
        {children}
      </div>
    );
  },
  Box: ({ bg = 'transparent', border = 'none', padding = 'none', className = '', children, globalData }) => {
    const bgClasses = {
      'surface': 'bg-aw-surface-1',
      'surface-elevated': 'bg-aw-surface-2',
      'danger-muted': 'bg-aw-danger/10',
      'accent-muted': 'bg-aw-surface-3',
    };
    const borderClasses = {
      'subtle': 'border border-aw-border-subtle',
      'danger': 'border border-aw-danger/30',
      'accent': 'border border-aw-border-strong',
    };
    const paddingClasses = { 'none': '', 'sm': 'p-3', 'md': 'p-5', 'lg': 'p-8' };
    const boxClass = `aw-structured-card ${bgClasses[bg as keyof typeof bgClasses] || ''} ${borderClasses[border as keyof typeof borderClasses] || ''} ${paddingClasses[padding as keyof typeof paddingClasses] || 'p-5'} ${className || ''}`;
    return <div className={boxClass.trim()}>{children}</div>;
  },
  Typography: ({ variant = 'body', color = 'text-primary', text, className = '' }) => {
    const variantClasses = {
      'h1': 'aw-title font-bold aw-text-primary',
      'h2': 'aw-title font-semibold aw-text-primary',
      'h3-serif': 'aw-label font-semibold text-aw-accent-mist',
      'h3': 'aw-label font-bold aw-text-primary',
      'body': 'aw-body aw-text-secondary',
      'caption': 'aw-caption aw-text-tertiary uppercase font-mono font-semibold',
    };
    const colorClasses = {
      'text-accent': 'text-aw-accent-mist',
      'text-muted': 'aw-text-tertiary',
      'danger': 'text-aw-danger',
      'success': 'text-aw-success',
    };
    const classes = `${variantClasses[variant as keyof typeof variantClasses] || variantClasses.body} ${colorClasses[color as keyof typeof colorClasses] || ''} ${className}`;
    return <div className={classes.trim()}>{text}</div>;
  },
  Badge: ({ intent = 'default', text, className = '' }) => {
    const badgeIntentClasses = {
      'info': 'aw-state-chip-info',
      'critical': 'aw-state-chip-danger',
      'success': 'aw-state-chip-success',
    };
    const classes = `aw-state-chip ${badgeIntentClasses[intent as keyof typeof badgeIntentClasses] || badgeIntentClasses.info} ${className}`;
    return <span className={classes.trim()}>{text}</span>;
  },
  ActionButton: ({ actionIntent, prompt, label, variant = 'primary', className = '' }) => {
    const openDrawerWithIntent = useInteractionStore(state => state.openDrawerWithIntent);
    const resolvedIntent = actionIntent || prompt;
    if (!resolvedIntent) {
      return null;
    }
    const variantStyles: Record<string, string> = {
      'primary': 'aw-button aw-button-primary',
      'danger': 'aw-button border border-aw-danger text-aw-danger hover:bg-aw-danger/10',
      'outline': 'aw-button aw-button-ghost'
    };
    const classes = `${variantStyles[variant] || variantStyles.primary} cursor-pointer ${className}`;
    return (
      <button onClick={() => openDrawerWithIntent(resolvedIntent)} className={classes}>
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
        <div className="aw-panel p-6 h-[350px] flex flex-col items-center justify-center animate-pulse">
          <div className="w-40 h-40 rounded-full border-8 border-aw-border-subtle border-t-aw-border-strong animate-spin" />
          <div className="mt-6 h-3 w-24 bg-aw-surface-3 rounded-full" />
        </div>
      );
    }
    return (
      <div className="aw-panel p-6 h-[350px] flex flex-col">
         <div className="flex-1 min-h-0">
            <ReactECharts option={option} />
         </div>
      </div>
    );
  },
  Timeline12X: ({ title, nodes }) => {
    if (!nodes || nodes.length === 0) {
      return (
         <div className="aw-panel p-6 relative overflow-hidden animate-pulse">
            <div className="h-6 w-48 bg-aw-surface-3 rounded-lg mb-8" />
            <div className="relative border-l border-aw-border-subtle ml-4 space-y-10 my-4">
               {[1,2,3].map(i => (
                 <div key={i} className="pl-8 relative">
                    <div className="absolute w-4 h-4 bg-aw-surface-3 rounded-full -left-[8.5px] top-1" />
                    <div className="h-5 w-20 bg-aw-surface-3 rounded-md mb-3" />
                    <div className="h-6 w-1/3 bg-aw-surface-3 rounded mb-2" />
                    <div className="h-20 w-full bg-aw-surface-2 rounded-xl" />
                 </div>
               ))}
            </div>
         </div>
      );
    }
    return (
      <div className="aw-panel p-6 relative overflow-hidden">
        <h3 className="aw-label font-bold aw-text-primary mb-6 flex items-center gap-2 tracking-normal">
            <MaterialIcon name="auto_awesome" size={20} className="text-aw-accent-mist" /> {title}
        </h3>
        <div className="relative border-l border-aw-border-subtle ml-4 space-y-10 my-4">
           {nodes?.map((item: any, idx: number) => (
             <div key={idx} className="pl-8 relative">
                 <div className="absolute w-4 h-4 bg-aw-accent-mist rounded-full -left-[8.5px] top-1 ring-4 ring-aw-bg" />
                 <div className="aw-state-chip mb-3">
                   {item.timeNode}
                 </div>
                 <h4 className="aw-label font-medium aw-text-primary mb-2">{item.title}</h4>
                 <p className="aw-body aw-text-secondary leading-relaxed bg-aw-surface-2 p-4 rounded-xl border border-aw-border-subtle">
                   {item.description}
                 </p>
             </div>
           ))}
        </div>
      </div>
    );
  },
  SystemAlert: ({ message }) => (
    <div className="aw-danger-panel p-4 my-4 flex items-center gap-3 aw-body text-aw-danger font-medium">
      <MaterialIcon name="monitoring" size={20} className="shrink-0" />
      {message}
    </div>
  ),
  InterventionCard: ({ title, description, level = 'warning', actions = [] }) => {
    const isCritical = level === 'critical';
    const openDrawerWithIntent = useInteractionStore(state => state.openDrawerWithIntent);
    
    return (
      <div className={`relative overflow-hidden p-6 w-full ${isCritical ? 'aw-danger-panel' : 'aw-warning-panel'}`}>
         <div className="relative z-10 flex items-start gap-4">
            <div className={`mt-1 shrink-0 ${isCritical ? 'text-aw-danger animate-pulse' : 'text-aw-warning'}`}>
               <MaterialIcon name={isCritical ? 'shield_alert' : 'warning'} size={32} />
            </div>
            <div className="flex-1">
               <h3 className={`aw-label font-bold mb-2 tracking-normal ${isCritical ? 'text-aw-danger' : 'text-aw-warning'}`}>
                  {title}
               </h3>
               <p className="aw-body aw-text-secondary leading-relaxed mb-6">
                  {description}
               </p>
               
               {actions?.length > 0 && (
                 <div className="flex flex-wrap gap-3">
                   {actions.map((action: any, idx: number) => {
                     const intent = action.actionIntent || action.prompt;
                     if (!intent) return null;
                     const isPrimary = action.type === 'primary';
                     return (
                       <button
                         key={idx}
                         onClick={() => openDrawerWithIntent(intent)}
                         className={`aw-button cursor-pointer
                           ${isPrimary 
                             ? (isCritical ? 'border border-aw-danger text-aw-danger hover:bg-aw-danger/10' : 'border border-aw-warning text-aw-warning hover:bg-aw-warning/10') 
                             : 'aw-button-ghost'}
                         `}
                       >
                         {isPrimary && <MaterialIcon name="bolt" size={16} />}
                         {action.label}
                         {isPrimary && <MaterialIcon name="arrow_forward" size={16} className="opacity-60" />}
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
    const openDrawerWithIntent = useInteractionStore(state => state.openDrawerWithIntent);
    if (!buttons || buttons.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-aw-border-subtle">
        {buttons.map((btn: any, idx: number) => {
          const intent = btn.actionIntent || btn.prompt;
          if (!intent) return null;
          const isPrimary = btn.type === 'primary';
          return (
             <button
               key={idx}
               onClick={() => openDrawerWithIntent(intent)}
               className={`aw-button cursor-pointer
                 ${isPrimary 
                   ? 'aw-button-primary' 
                   : 'aw-button-ghost'}
               `}
             >
               {isPrimary && <MaterialIcon name="bolt" size={16} />}
               {btn.label}
               {isPrimary && <MaterialIcon name="arrow_forward" size={16} className="opacity-60" />}
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
             <div key={block.id || i} className="aw-panel-muted p-4 aw-body aw-text-tertiary mb-4 border-dashed">
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
