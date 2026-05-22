import React from 'react';
import { ChartWidget } from './ChartWidget';
import { ReactECharts } from './ReactECharts';
import { getCurrencySymbol, getHoldingMarketValue } from './chart-configs';
import { useWealthStore } from '../hooks/useWealthStore';

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

  const handleReload = async () => {
    setIsRefreshing(true);
    try {
      await fetchLongbridge();
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

  const colors = ['#C9B284', '#6B8E6B', '#4A7FB0', '#A87BB0', '#D39C5E', '#A1A658', '#428C8C', '#8C8C8C'];

  const pieOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(26, 29, 31, 0.95)',
      borderColor: 'rgba(201, 178, 132, 0.28)',
      borderWidth: 1,
      textStyle: { color: '#E7D7B0', fontFamily: 'Inter', fontSize: 11 },
      formatter: (p: any) => `${p.name}: ${getCurrencySymbol(sortedArr[p.dataIndex]?.currency)}${(p.value || 0).toLocaleString()} (${p.percent}%)`
    },
    color: colors,
    series: [{
      type: 'pie',
      radius: ['60%', '82%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#121415', borderWidth: 2 },
      label: { show: false },
      emphasis: { 
        scale: true,
        scaleSize: 6,
        label: { show: false } 
      },
      data: sortedArr.map((v: any) => ({ name: v.name || v.symbol, value: getHoldingMarketValue(v) }))
    }]
  };

  const chartEvents = {
    click: (params: any) => {
      if (params.name && setSelectedHolding) {
        const hit = sortedArr.find((h: any) => h.name === params.name || h.symbol === params.name);
        if (hit) setSelectedHolding(hit);
      }
    }
  };

  return (
    <ChartWidget
      title={title}
      type={chartType}
      dataLength={distData.length}
      insight={globalData?.insights?.public || ""}
      delay={delay}
      chartHeight={chartHeight}
      badge={<span className="text-[10px] text-[#A39167] font-mono font-semibold tracking-wider">{t('dashboard.allocationAnalysis')}</span>}
      status={widgetStatus}
      onReload={handleReload}
      showReload={true}
      isReloading={isRefreshing}
    >
      {/* If we have old data but status is loading/error, we show a lightweight banner at top */}
      {hasData && rawStatus === 'error' && (
        <div className="absolute top-0 inset-x-0 h-6 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-center -mx-6 sm:-mx-8 z-20">
          <span className="text-[9px] font-mono text-rose-400 font-medium tracking-wide">
            {t('drawer.syncFailed') || 'SYNC FAILED - SHOWING LAST KNOWN STATE'}
          </span>
        </div>
      )}
      {hasData && (rawStatus === 'loading' || isRefreshing) && (
        <div className="absolute top-0 inset-x-0 h-1 bg-[#121415] z-50">
           <div className="h-full bg-[#C9B284]/50 animate-pulse w-full origin-left" />
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-center gap-6 h-full min-h-[260px] relative z-10 pt-2">
        {/* Left: Pie Donut Chart (Col 5) */}
        <div className="w-full lg:w-[42%] flex items-center justify-center relative min-h-[200px]">
          <div className="w-[200px] h-[200px] relative shrink-0">
            <ReactECharts option={pieOption} onEvents={chartEvents} className="w-full h-full" />
            {/* Centered Total Assets Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-mono text-[#8C8370] uppercase tracking-widest leading-none mb-1">{t('dashboard.totalLimit')}</span>
              <span className="text-[13px] font-extrabold text-[#E7D7B0] font-mono leading-none tracking-tight">{formattedTotal}</span>
            </div>
          </div>
        </div>

        {/* Right: Interactive Holdings List (Col 7) */}
        <div className="w-full lg:w-[58%] flex flex-col justify-start custom-scroll pr-1 pb-1">
          <div className="grid grid-cols-12 text-[9px] font-mono font-bold tracking-widest text-[#8C8370] uppercase pb-2 border-b border-[#C9B284]/12 mb-2 px-3">
            <div className="col-span-6">{t('dashboard.instrument')}</div>
            <div className="col-span-4 text-right">{t('dashboard.estValue')}</div>
            <div className="col-span-2 text-right">{t('dashboard.ratio')}</div>
          </div>

          <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scroll pr-1">
            {sortedArr.map((item: any, idx: number) => {
              const isSelected = selectedHolding && (selectedHolding.symbol === item.symbol || selectedHolding.name === item.name);
              const val = getHoldingMarketValue(item);
              const pct = totalHoldingsVal > 0 ? ((val / totalHoldingsVal) * 100).toFixed(1) + '%' : '0.0%';
              const itemColor = colors[idx % colors.length];

              return (
                <div
                  key={item.symbol || idx}
                  onClick={() => setSelectedHolding && setSelectedHolding(item)}
                  className={`grid grid-cols-12 items-center px-3 py-2 cursor-pointer rounded-xl transition-all border ${
                    isSelected 
                      ? 'bg-[#C9B284]/10 border-[#C9B284]/45 shadow-[0_2px_12px_rgba(201,178,132,0.12)] text-[#E7D7B0]' 
                      : 'border-white/[0.02] hover:bg-white/5 text-slate-300'
                  }`}
                >
                  {/* Name with Matching Dot */}
                  <div className="col-span-6 flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: itemColor }} />
                    <span className={`text-[12.5px] truncate ${isSelected ? 'font-bold text-[#E7D7B0] tracking-tight' : 'font-medium'}`}>
                      {item.name || item.symbol}
                    </span>
                  </div>

                  {/* Currency / Value */}
                  <div className="col-span-4 text-right font-mono text-xs font-semibold text-slate-200">
                    {currSym}{val.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </div>

                  {/* Percentage and action arrow */}
                  <div className="col-span-2 flex items-center justify-end gap-1.5 text-right font-mono text-xs font-semibold text-[#C9B284]/90">
                    <span>{pct}</span>
                    <svg className={`w-3 h-3 text-[#C9B284]/65 transition-transform ${isSelected ? 'translate-x-[2px]' : 'opacity-30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.8} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ChartWidget>
  );
};
