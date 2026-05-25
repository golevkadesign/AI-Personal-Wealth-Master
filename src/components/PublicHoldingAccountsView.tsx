import React from 'react';
import { ChartWidget } from './ChartWidget';
import { ReactECharts } from './ReactECharts';
import { getCurrencySymbol, getHoldingMarketValue } from './chart-configs';
import { useWealthStore } from '../hooks/useWealthStore';
import { AccountPortfolio } from '../types/terminal';

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
  const fetchLongbridgeAccountPortfolios = useWealthStore(state => state.fetchLongbridgeAccountPortfolios);

  const handleReload = async () => {
    setIsRefreshing(true);
    try {
      await fetchLongbridgeAccountPortfolios();
    } finally {
      setIsRefreshing(false);
    }
  };

  const hasData = accountPortfolios && accountPortfolios.length > 0;

  // Widget Level Status mapping for the overarching container
  let widgetStatus: 'loading' | 'empty' | 'error' | 'success' = 'success';
  if (syncStatus === 'loading' && !hasData) widgetStatus = 'loading';
  else if (syncStatus === 'empty') widgetStatus = 'empty';
  else if (syncStatus === 'error' && !hasData) widgetStatus = 'error';
  else if (!hasData) widgetStatus = 'empty'; // fallback

  const colors = ['#C9B284', '#6B8E6B', '#4A7FB0', '#A87BB0', '#D39C5E', '#A1A658', '#428C8C', '#8C8C8C'];

  return (
    <ChartWidget
      title={title}
      type={chartType}
      dataLength={accountPortfolios.length}
      insight={globalData?.insights?.public || ""}
      delay={delay}
      chartHeight={chartHeight || "auto"}
      badge={<span className="text-[10px] text-[#A39167] font-mono font-semibold tracking-wider">{t('dashboard.allocationAnalysis')} (多账户)</span>}
      status={widgetStatus}
      onReload={handleReload}
      showReload={true}
      isReloading={isRefreshing}
    >
      {/* Synchronization alert banner */}
      {hasData && (syncError || syncStatus === 'error') && (
        <div className="absolute top-0 inset-x-0 py-1.5 min-h-[24px] bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-center -mx-6 sm:-mx-8 z-20 px-4">
          <span className="text-[9px] font-mono text-amber-400 font-medium tracking-wide text-center">
            {syncError || '部分证券账户同步异常 (Showing Cached State)'}
          </span>
        </div>
      )}

      {hasData && (syncStatus === 'loading' || isRefreshing) && (
        <div className="absolute top-0 inset-x-0 h-1 bg-[#121415] z-50">
           <div className="h-full bg-[#C9B284]/50 animate-pulse w-full origin-left" />
        </div>
      )}

      <div className="flex flex-col gap-8 divide-y divide-[#C9B284]/12 pt-2 pb-2">
        {accountPortfolios.map((account, accIdx) => {
          const positions = account.positions || [];
          const sortedArr = [...positions].sort((a, b) => getHoldingMarketValue(b) - getHoldingMarketValue(a));
          const totalVal = sortedArr.reduce((sum, h) => sum + getHoldingMarketValue(h), 0);
          const currSym = getCurrencySymbol(sortedArr[0]?.currency || 'CNY');
          const formattedTotal = currSym + ' ' + totalVal.toLocaleString('en-US', { maximumFractionDigits: 0 });

          const validPieData = sortedArr
            .filter(v => getHoldingMarketValue(v) > 0)
            .map(v => ({ name: v.name || v.symbol, value: getHoldingMarketValue(v) }));

          const pieOption = {
            backgroundColor: 'transparent',
            tooltip: {
              trigger: 'item',
              backgroundColor: 'rgba(26, 29, 31, 0.95)',
              borderColor: 'rgba(201, 178, 132, 0.28)',
              borderWidth: 1,
              textStyle: { color: '#E7D7B0', fontFamily: 'Inter', fontSize: 11 },
              formatter: (p: any) => {
                const item = sortedArr[p.dataIndex];
                const sym = getCurrencySymbol(item?.currency);
                return `${p.name}: ${sym}${(p.value || 0).toLocaleString()} (${p.percent}%)`;
              }
            },
            color: colors,
            series: [{
              type: 'pie',
              radius: ['55%', '78%'],
              center: ['50%', '50%'],
              avoidLabelOverlap: false,
              itemStyle: { borderRadius: 4, borderColor: '#121415', borderWidth: 2 },
              label: { show: false },
              emphasis: { 
                scale: true,
                scaleSize: 6,
                label: { show: false } 
              },
              data: validPieData.length > 0 ? validPieData : [{ name: t('charts.noData') || '无持仓', value: 0 }]
            }]
          };

          const chartEvents = {
            click: (params: any) => {
              if (params.name && setSelectedHolding) {
                const hit = sortedArr.find(h => h.name === params.name || h.symbol === params.name);
                if (hit) {
                  // Clicked position must retain accountId/accountName
                  setSelectedHolding({
                    ...hit,
                    accountId: account.accountId,
                    accountName: account.accountName
                  });
                }
              }
            }
          };

          return (
            <div key={account.accountId || accIdx} className={`${accIdx > 0 ? 'pt-6' : ''} flex flex-col gap-4`}>
              {/* Individual Account Header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-3 bg-[#C9B284] rounded-sm" />
                  <span className="text-[13px] font-bold text-[#E7D7B0] tracking-tight">{account.accountName || '证券账户'}</span>
                  <span className="text-[9px] font-mono text-zinc-500 font-semibold uppercase tracking-wider">({account.accountId || 'Unknown ID'})</span>
                </div>
                {account.meta?.error ? (
                  <span className="text-[9px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/12">
                    {account.meta.error}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-extrabold text-[#C9B284]">{formattedTotal}</span>
                )}
              </div>

              {positions.length === 0 ? (
                <div className="flex items-center justify-center p-6 bg-slate-900/10 border border-dashed border-white/[0.02] rounded-2xl">
                  <span className="text-[11px] font-mono text-zinc-500">{t('charts.noData') || '该账户暂无可用资产或同步数据'}</span>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row items-center gap-6 relative z-10">
                  {/* Left: Donut Chart */}
                  <div className="w-full lg:w-[42%] flex items-center justify-center relative min-h-[160px]">
                    <div className="w-[160px] h-[160px] relative shrink-0">
                      <ReactECharts option={pieOption} onEvents={chartEvents} className="w-full h-full" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[9px] font-mono text-[#8C8370] uppercase tracking-widest leading-none mb-1">Total</span>
                        <span className="text-[11px] font-extrabold text-[#E7D7B0] font-mono leading-none tracking-tight">
                          {formattedTotal}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Interactive Holdings List */}
                  <div className="w-full lg:w-[58%] flex flex-col justify-start custom-scroll pr-1 pb-1">
                    <div className="grid grid-cols-12 text-[9px] font-mono font-bold tracking-widest text-[#8C8370] uppercase pb-2 border-b border-[#C9B284]/12 mb-2 px-3">
                      <div className="col-span-6">{t('dashboard.instrument') || '标的'}</div>
                      <div className="col-span-4 text-right">{t('dashboard.estValue') || '预估市值'}</div>
                      <div className="col-span-2 text-right">{t('dashboard.ratio') || '占比'}</div>
                    </div>

                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto custom-scroll pr-1">
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
                            onClick={() => setSelectedHolding && setSelectedHolding({
                              ...item,
                              accountId: account.accountId,
                              accountName: account.accountName
                            })}
                            className={`grid grid-cols-12 items-center px-3 py-2 cursor-pointer rounded-xl transition-all border ${
                              isSelected 
                                ? 'bg-[#C9B284]/10 border-[#C9B284]/45 shadow-[0_2px_12px_rgba(201,178,132,0.12)] text-[#E7D7B0]' 
                                : 'border-white/[0.02] hover:bg-white/5 text-slate-300'
                            }`}
                          >
                            {/* Name with Dot */}
                            <div className="col-span-6 flex items-center gap-2 min-w-0">
                              <span className="w-2 rounded-full h-2 shrink-0 shadow-sm" style={{ backgroundColor: itemColor }} />
                              <span className={`text-[12px] truncate ${isSelected ? 'font-bold text-[#E7D7B0] tracking-tight' : 'font-medium'}`}>
                                {item.name || item.symbol}
                              </span>
                            </div>

                            {/* Value */}
                            <div className={`col-span-4 text-right font-mono ${val > 0 ? 'text-xs font-semibold text-slate-200' : 'text-[10px] text-rose-400 font-medium'}`}>
                              {val > 0 ? `${currSym}${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '估值缺失'}
                            </div>

                            {/* Percentage / Arrow */}
                            <div className={`col-span-2 flex items-center justify-end gap-1.5 text-right font-mono text-[11px] font-semibold ${val > 0 ? 'text-[#C9B284]/90' : 'text-slate-500'}`}>
                              <span>{val > 0 ? pct : '--'}</span>
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
              )}
            </div>
          );
        })}
      </div>
    </ChartWidget>
  );
};
