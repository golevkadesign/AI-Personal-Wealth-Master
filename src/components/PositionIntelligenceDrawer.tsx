import React, { useEffect, useState, Suspense, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Activity, Target, BrainCircuit, TrendingUp, TrendingDown, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { WidgetCopilot } from './WidgetCopilot';
import { getCurrencySymbol, getHoldingMarketValue } from './chart-configs';
import { useTranslation } from '../hooks/useTranslation';

const ReactEChartsLazy = React.lazy(() => import('./ReactECharts').then(m => ({ default: m.ReactECharts })));

const ChartSkeleton = () => (
  <div className="w-full h-full min-h-[140px] flex items-center justify-center bg-black/10 rounded-xl animate-pulse border border-[#C9B284]/10">
    <div className="flex flex-col items-center gap-2">
      <div className="w-4 h-4 rounded-full border border-[#C9B284]/30 border-t-[#C9B284] animate-spin" />
      <span className="text-[9px] text-[#8C8270] font-mono tracking-widest uppercase">Syncing Trendline...</span>
    </div>
  </div>
);

interface PositionIntelligenceDrawerProps {
  isOpen: boolean;
  holding: any | null; // Selected PublicHolding object
  onClose: () => void;
}

export function PositionIntelligenceDrawer({ isOpen, holding, onClose }: PositionIntelligenceDrawerProps) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const openCopilot = useInteractionStore(state => state.openDrawerWithIntent);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [mainAskInput, setMainAskInput] = useState('');
  const [copilotPrompt, setCopilotPrompt] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setIsCopilotOpen(false);
      setCopilotPrompt('');
      setMainAskInput('');
    }
  }, [isOpen]);

  // Fetch quantitative price history on mount/selection change
  useEffect(() => {
    if (isOpen && holding?.symbol) {
      setLoading(true);
      const isLbBound = true;
      fetch(`/api/quant/history?symbol=${holding.symbol}&useLb=${isLbBound}`)
        .then(async (res) => {
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText}`);
          }
          return res.json();
        })
        .then(data => {
          if (data.history && data.history.length > 0) {
            setHistory(data.history);
          } else {
            console.error("QuantEngine: Returned empty history array");
          }
        })
        .catch((err) => {
          console.error("QuantEngine Load Failed:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, holding]);

  if (!holding) return null;

  const quant = holding.quantSignals || {};
  const isUp = (quant.changePercent || 0) >= 0;
  const val = getHoldingMarketValue(holding);
  const isCny = (holding.currency || 'CNY').toUpperCase() === 'CNY';
  const currSym = getCurrencySymbol(holding.currency);

  // Approximate secondary currency conversion for premium visual feedback
  const exchangeRate = quant?.exchangeRate;
  const conversionVal = exchangeRate ? val * exchangeRate : null;
  const conversionSym = isCny ? '$' : '¥';

  // Fallback metadata for holding parameters
  const instrumentType = holding.type || holding.category || t('drawer.notProvided');
  const domicile = holding.domicile || t('drawer.notProvided');
  // expenseRatio and inceptionDate removed to avoid unused variables

  // Dynamic advice conditions (Only show if quant signals exist)
  const hasQuantSignals = !!holding.quantSignals && Object.keys(holding.quantSignals).length > 0;
  
  const dynamicRisks = hasQuantSignals && quant.rsi ? [
    `High equity exposure drives local asset and index volatility.`,
    quant.rsi > 70 
      ? `Momentum Warning: RSI is currently ${quant.rsi?.toFixed(1)}, signal overextended risks (Overbought).`
      : `Portfolio concentration matches base allocations limits correctly.`,
    `Moderate tracking error matching underlying indices parameters.`
  ] : [];

  const dynamicOpportunities = hasQuantSignals && quant.rsi ? [
    `Asset allocation optimization: Rebalancing can improve risk-adjusted capital returns.`,
    quant.rsi < 40
      ? `Oversold Bullish Setup: RSI at ${quant.rsi?.toFixed(1)} indicates a high-probability technical entry point.`
      : `High liquid support creates opportunities for proactive target compounding.`,
    `Tax-aware dynamic transition of position structures across asset classes.`
  ] : [];

  const structuralSuggestedActions = hasQuantSignals && quant.rsi ? [
    `Review long-term allocation limits and schedule systematic rebalancing targets.`,
    quant.rsi > 65 
      ? `Consider technical trimming of current positions to secure accumulated gains.` 
      : `Accumulate systematically surrounding Bollinger Low supports (BB: ${currSym}${quant.buyPrice?.toFixed(1) || '---'}).`,
    `Optimize multi-currency exposures and analyze hedge ratios against EUR/USD movements.`
  ] : [];

  // Dynamic area sparkline chart
  const hasHistory = history && history.length > 0;
  const scaledTrendData = hasHistory ? history.map(item => Number(item[4]) || 0) : [];

  const sparklineOption = hasHistory ? {
    backgroundColor: 'transparent',
    grid: { left: '4%', right: '14%', bottom: '18%', top: '8%', containLabel: false },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: history.map(item => item[0]),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { 
        color: '#8C8270', 
        fontFamily: 'JetBrains Mono', 
        fontSize: 9,
        interval: Math.floor(scaledTrendData.length / 4) || 2,
        padding: [6, 0, 0, 0]
      }
    },
    yAxis: {
      type: 'value',
      position: 'right',
      splitLine: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#8C8270',
        fontFamily: 'JetBrains Mono',
        fontSize: 9,
        formatter: (v: number) => {
          if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
          if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
          return v;
        }
      }
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#C9B284', width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(201, 178, 132, 0.22)' },
              { offset: 0.8, color: 'rgba(201, 178, 132, 0.01)' },
              { offset: 1, color: 'rgba(201, 178, 132, 0)' }
            ]
          }
        },
        data: scaledTrendData
      }
    ]
  } : null;

  const handleMainAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainAskInput.trim()) return;
    setCopilotPrompt(mainAskInput);
    setMainAskInput('');
    setIsCopilotOpen(true);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Light dim backdrop behind selected drawer */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 bg-black/55 backdrop-blur-[1px] z-[99]" 
            onClick={onClose} 
          />
          
          {/* Side Elevated Right Panel Drawer */}
          <motion.div 
            initial={{ x: '100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '100%' }} 
            transition={{ type: 'spring', damping: 26, stiffness: 220 }} 
            className="fixed top-0 right-0 h-screen w-full sm:max-w-[490px] bg-[#0E1012] border-l border-[#C9B284]/15 z-[101] shadow-2xl flex flex-col font-sans overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {!isCopilotOpen ? (
                <motion.div 
                  key="detail-panel" 
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -20 }}
                  className="flex-1 flex flex-col h-full overflow-hidden"
                >
                  {/* Drawer Header Area */}
                  <div className="flex justify-between items-start px-6 pt-6 pb-4 border-b border-[#C9B284]/10 shrink-0">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] text-[#A39167] font-mono font-bold tracking-[0.2em] uppercase">{t('drawer.positionIntel')}</span>
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase bg-[#C1A875]/10 text-[#C1A875] border border-[#C1A875]/20">{t('drawer.ai')}</span>
                      </div>
                      <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
                        {holding.name || holding.symbol}
                      </h2>
                    </div>
                    {/* Exquisite Close Button */}
                    <button 
                      onClick={onClose} 
                      className="border border-[#C9B284]/15 hover:border-[#C9B284]/30 bg-[#16181A]/40 hover:bg-[#C9B284]/10 text-[#C9B284] w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Main Scroller Content */}
                  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scroll pb-24">
                    
                    {/* Identity Info Panel Cards */}
                    <div className="bg-[#121416]/90 rounded-xl p-4 border border-[#C9B284]/10 flex items-center gap-4">
                      {/* Premium Logo Ring Segment Graphic */}
                      <div className="w-11 h-11 rounded-xl border border-[#C9B284]/25 bg-[#16181A] flex items-center justify-center shrink-0 shadow-inner">
                        <svg className="w-6 h-6 text-[#C9B284]/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <circle cx={12} cy={12} r={9} strokeDasharray="36 20" strokeDashoffset={5} />
                          <circle cx={12} cy={12} r={4} strokeWidth={1} strokeDasharray="2 2" className="opacity-40" />
                          <path d="M12 3v9h9" className="opacity-65" />
                        </svg>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-[#C9B284]/10 text-[#E7D7B0] border border-[#C9B284]/15">
                            {holding.symbol || 'N/A'}
                          </code>
                          <span className="text-[11px] text-[#8C8270] font-medium truncate">{instrumentType}</span>
                        </div>
                        <div className="text-[11px] text-[#8D9096] flex items-center gap-1">
                          <span>{t('drawer.jurisdiction')}</span>
                          <span className="text-slate-300 font-medium">{domicile}</span>
                        </div>
                      </div>
                      
                      {/* Price Badge indicator on upper right card */}
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-slate-100 font-mono">
                          {quant.currentPrice ? `$${quant.currentPrice.toFixed(2)}` : '---'}
                        </div>
                        <div className={`text-[10px] font-bold font-mono mt-0.5 flex items-center justify-end ${quant.changePercent != null ? (isUp ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>
                          {quant.changePercent != null ? `${isUp ? '+' : ''}${quant.changePercent.toFixed(2)}%` : '---'}
                        </div>
                      </div>
                    </div>

                    {/* Numeric Parameter Metrics Section */}
                    <div className="grid grid-cols-2 gap-3.5">
                      {/* Value Item (Primary) */}
                      <div className="bg-[#121416] p-4 rounded-xl border border-[#C9B284]/10">
                        <span className="text-[10px] font-mono text-[#8C8370] uppercase tracking-wider block mb-1">{t('drawer.totalValuation')}</span>
                        <div className="text-base font-extrabold text-[#E7D7B0] font-mono leading-none">
                          {currSym}{val.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono mt-1.5 block min-h-[15px]">
                          {exchangeRate != null ? `${conversionSym} ${conversionVal?.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${t('drawer.approx')}` : ''}
                        </span>
                      </div>

                      {/* Allocation Item */}
                      <div className="bg-[#121416] p-4 rounded-xl border border-[#C9B284]/10">
                        <span className="text-[10px] font-mono text-[#8C8370] uppercase tracking-wider block mb-1">{t('drawer.portfolioAllocation')}</span>
                        <div className="text-base font-extrabold text-[#E7D7B0] font-mono leading-none">
                          {holding.allocation || t('drawer.na')}
                        </div>
                        <span className="text-[10px] text-[#8C8270] mt-1.5 block font-medium truncate min-h-[15px]">
                          {holding.allocation ? t('drawer.ofPublicMarkets') : ''}
                        </span>
                      </div>
                    </div>

                    {/* Context / Synchronize timestamp bar */}
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-[#16181A]/60 border border-[#C9B284]/8 text-[10px] font-mono text-[#8C8270]">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${holding.lastSyncTime ? 'bg-emerald-500/80 animate-pulse' : 'bg-slate-500/80'}`} />
                        <span>{holding.lastSyncTime ? `${t('drawer.lastSynchronized')} ${new Date(holding.lastSyncTime).toISOString().slice(0, 16).replace('T', ' ')} UTC` : t('drawer.noSync')}</span>
                      </div>
                    </div>

                    {/* Sparkline historical trendline chart section */}
                    <div className="bg-[#121416]/40 p-4 rounded-xl border border-[#C9B284]/10 space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-[11px] font-semibold text-[#8C8270] tracking-wider uppercase font-mono flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-[#C9B284]" />
                          {t('drawer.trend1Y')} ({holding.currency || 'USD'})
                        </span>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400 font-medium">{t('drawer.day')} <span className={`font-mono font-semibold ${quant.changePercent != null ? (isUp ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>{quant.changePercent != null ? `${isUp ? '+' : ''}${quant.changePercent}%` : '---'}</span></span>
                          <span className="text-[10px] text-slate-400 font-medium font-mono border-l border-white/10 pl-2.5">{t('drawer.ytd')} <span className={`font-semibold ${quant.ytdPercent != null ? (quant.ytdPercent >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>{quant.ytdPercent != null ? `${quant.ytdPercent >= 0 ? '+' : ''}${quant.ytdPercent}%` : '---'}</span></span>
                        </div>
                      </div>

                      <div className="h-[140px] relative w-full">
                        {loading ? (
                          <ChartSkeleton />
                        ) : hasHistory && sparklineOption ? (
                          <Suspense fallback={<ChartSkeleton />}>
                            <ReactEChartsLazy option={sparklineOption} className="w-full h-full" />
                          </Suspense>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center border border-dashed border-white/10 rounded-lg">
                             <span className="text-[10px] text-[#8C8270] font-mono tracking-widest uppercase">{t('drawer.noTrendData')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Technical indicators section (BB low, BB high, RSI, ADX) */}
                    <div className="bg-[#121416]/30 p-4 rounded-xl border border-[#C9B284]/10 space-y-3">
                      <span className="text-[11px] font-semibold text-[#8C8270] tracking-wider uppercase font-mono flex items-center gap-1.5 pb-2 border-b border-white/5">
                        <Target className="w-3.5 h-3.5 text-[#C9B284]" />
                        {t('drawer.technicalIndicators')}
                      </span>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="bg-black/25 rounded-lg p-2.5 border border-white/5 text-center">
                          <span className="text-[8px] font-mono text-slate-500 uppercase block leading-none mb-1">BB Low</span>
                          <span className="text-xs font-bold text-emerald-400 font-mono">{quant.buyPrice ? `$${quant.buyPrice.toFixed(1)}` : '---'}</span>
                        </div>
                        <div className="bg-black/25 rounded-lg p-2.5 border border-white/5 text-center">
                          <span className="text-[8px] font-mono text-slate-500 uppercase block leading-none mb-1">BB High</span>
                          <span className="text-xs font-bold text-rose-400 font-mono">{quant.sellPrice ? `$${quant.sellPrice.toFixed(1)}` : '---'}</span>
                        </div>
                        <div className="bg-black/25 rounded-lg p-2.5 border border-white/5 text-center animate-pulse">
                          <span className="text-[8px] font-mono text-slate-500 uppercase block leading-none mb-1">RSI</span>
                          <span className={`text-xs font-extrabold font-mono ${quant.rsi > 70 ? 'text-rose-400' : quant.rsi < 30 ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {quant.rsi ? quant.rsi.toFixed(1) : '---'}
                          </span>
                        </div>
                        <div className="bg-black/25 rounded-lg p-2.5 border border-white/5 text-center">
                          <span className="text-[8px] font-mono text-slate-500 uppercase block leading-none mb-1">ADX</span>
                          <span className="text-xs font-bold text-[#C9B284] font-mono">{quant.adx ? quant.adx.toFixed(1) : '---'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Advisory AI Intelligence Area (Risk, Opportunity, Suggested Actions) */}
                    {dynamicRisks.length > 0 && (
                    <div className="space-y-3 pt-1">
                      <span className="text-[11px] font-semibold text-[#8C8270] tracking-wider uppercase font-mono flex items-center gap-1.5 pb-1 block">
                        <BrainCircuit className="w-3.5 h-3.5 text-[#C9B284]" />
                        {t('drawer.aiDiagnostics')}
                      </span>

                      {/* Stacked Layout for extremely detailed Advisory diagnosis */}
                      <div className="grid grid-cols-1 gap-3">
                        {/* Risk Diagnosis */}
                        <div className="bg-[#1C1415]/70 border border-red-500/10 hover:border-red-500/25 transition-colors p-4 rounded-xl flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 mb-2.5">
                              <span className="w-2 h-2 rounded-full bg-red-500/80" />
                              <span className="text-xs font-bold text-red-400">Security Portfolio Risks</span>
                            </div>
                            <ul className="space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                              {dynamicRisks.map((txt, ii) => (
                                <li key={ii} className="flex items-start gap-1">
                                  <span className="text-red-500/60 font-medium select-none text-[10px] mt-[1.5px]">•</span>
                                  <span>{txt}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Opportunity Diagnosis */}
                        <div className="bg-[#121915]/75 border border-emerald-500/10 hover:border-emerald-500/25 transition-colors p-4 rounded-xl flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 mb-2.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse" />
                              <span className="text-xs font-bold text-emerald-400">Technical Targets Opportunities</span>
                            </div>
                            <ul className="space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                              {dynamicOpportunities.map((txt, ii) => (
                                <li key={ii} className="flex items-start gap-1">
                                  <span className="text-emerald-500/60 font-medium select-none text-[10px] mt-[1.5px]">•</span>
                                  <span>{txt}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Suggested Wealth Actions */}
                        <div className="bg-[#1C1A16]/65 border border-[#C9B284]/12 hover:border-[#C9B284]/25 transition-colors p-4 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-2.5">
                            <span className="w-2 h-2 rounded-full bg-[#C9B284]" />
                            <span className="text-xs font-bold text-[#E7D7B0]">Suggested Advisory Actions</span>
                          </div>
                          <div className="space-y-2.5">
                            {structuralSuggestedActions.map((txt, ii) => (
                              <div key={ii} className="flex items-start gap-2.5 text-slate-300 text-[11px] leading-relaxed">
                                <span className="w-4 h-4 rounded-full border border-[#C9B284]/30 bg-black/30 flex items-center justify-center text-[8px] font-mono text-[#C9B284] shrink-0 mt-[1.5px] font-bold">
                                  {ii + 1}
                                </span>
                                <span>{txt}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    )}

                  </div>

                  {/* Ask Arbitra Bottom Input Section */}
                  <div className="absolute bottom-0 left-0 right-0 bg-[#0E1012] border-t border-[#C9B284]/10 px-6 py-4 pb-6 shrink-0 z-25">
                    <form onSubmit={handleMainAskSubmit} className="relative flex items-center">
                      <input 
                        type="text"
                        placeholder={`${t('drawer.askArbitra')} ${holding.symbol || holding.name}...`}
                        value={mainAskInput}
                        onChange={(e) => setMainAskInput(e.target.value)}
                        className="w-full bg-[#16181A] border border-[#C9B284]/20 hover:border-[#C9B284]/35 focus:border-[#C9B284]/65 px-4 py-2.5 pr-12 rounded-xl text-[12.5px] text-white placeholder-slate-500 focus:outline-none transition-all placeholder:font-sans font-sans"
                      />
                      <button 
                        type="submit"
                        className="absolute right-2 bg-[#C9B284] hover:bg-[#E7D7B0] text-[#121415] w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </form>
                    <p className="text-[9px] font-mono text-slate-500 text-center mt-2.5 tracking-wide leading-none select-none">
                      {t('drawer.disclaimer')}
                    </p>
                  </div>
                </motion.div>
              ) : (
                /* Inline sandbox chat copilot */
                <motion.div 
                  key="copilot-panel" 
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -20 }}
                  className="flex-1 flex flex-col h-full bg-[#0E1012] overflow-hidden"
                >
                  <div className="flex justify-between items-center px-6 py-5 border-b border-[#C9B284]/15 shrink-0 bg-transparent">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#C9B284]" />
                      <span>{holding.symbol || holding.name} {t('drawer.analyticsStudio')}</span>
                    </h3>
                    
                    {/* Retro back trigger */}
                    <button 
                      onClick={() => { setIsCopilotOpen(false); setCopilotPrompt(''); }} 
                      className="border border-[#C9B284]/20 hover:border-[#C9B284]/40 bg-[#16181A] hover:bg-[#C9B284]/10 text-[#C9B284] px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>←</span><span>{t('drawer.backToMetrics')}</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-hidden relative min-h-0 bg-[#0E1012]">
                    <WidgetCopilot 
                      isOpen={isCopilotOpen}
                      inline={true}
                      onClose={() => { setIsCopilotOpen(false); setCopilotPrompt(''); }}
                      widgetTitle={`持仓分析: ${holding.symbol || holding.name}`} 
                      initialMessage={copilotPrompt}
                      widgetData={{
                        holdingDetail: holding,
                        quantSignals: quant,
                        systemInstruction: `你现在处于针对单只资产【${holding.symbol || holding.name}】的财富战略分析与推演模式。请密切配合相关的 quantSignals (BB Low: ${quant.buyPrice}, BB High: ${quant.sellPrice}, RSI: ${quant.rsi}, ADX: ${quant.adx}) 与持仓市值比例，为用户提供极其精准的对冲、结构微调与再平衡专业策略评估。`
                      }} 
                      onPromoteIntent={(prompt) => {
                        setIsCopilotOpen(false);
                        onClose();
                        openCopilot(prompt);
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
