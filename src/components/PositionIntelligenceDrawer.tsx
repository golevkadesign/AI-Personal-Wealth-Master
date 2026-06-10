import React, { useEffect, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MaterialIcon } from './ui/MaterialIcon';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { useWealthStore } from '../hooks/useWealthStore';
import { WidgetCopilot } from './WidgetCopilot';
import { getCurrencySymbol, getHoldingMarketValue } from './chart-configs';
import { readCssToken } from '../lib/design-tokens';
import { useTranslation } from '../hooks/useTranslation';
import { PositionAnalysisResult, HoldingSnapshot, AgentAnalysisSnapshot } from '../types/portfolio';
import { saveAgentAnalysisSnapshot, getAgentAnalysisSnapshots, getLatestAgentAnalysisSnapshot, buildAnalysisDiff } from '../lib/agentMemorySnapshots';
import { createHoldingWorkbenchSession } from '../lib/workbench-session';

const ReactEChartsLazy = React.lazy(() => import('./ReactECharts').then(m => ({ default: m.ReactECharts })));

const ChartSkeleton = ({ label = 'Syncing Trendline...' }: { label?: string }) => (
  <div className="aw-panel-muted w-full h-full min-h-[140px] flex items-center justify-center animate-pulse">
    <div className="flex flex-col items-center gap-2">
      <div className="w-4 h-4 rounded-full border border-aw-border-strong border-t-aw-accent-mist animate-spin" />
      <span className="aw-caption aw-text-tertiary font-mono uppercase">{label}</span>
    </div>
  </div>
);

interface PositionIntelligenceDrawerProps {
  isOpen: boolean;
  holding: HoldingSnapshot | any | null; // Selected PublicHolding object
  onClose: () => void;
}

export function PositionIntelligenceDrawer({ isOpen, holding, onClose }: PositionIntelligenceDrawerProps) {
  const { t } = useTranslation();
  const uid = useWealthStore(state => state.user?.uid);
  const [history, setHistory] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<PositionAnalysisResult | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'success' | 'partial' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  const openCopilot = useInteractionStore(state => state.openDrawerWithIntent);
  const openWorkbench = useInteractionStore(state => state.openWorkbench);
  const closeWorkbenchForEntry = useInteractionStore(state => state.closeWorkbenchForEntry);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [mainAskInput, setMainAskInput] = useState('');
  const [copilotPrompt, setCopilotPrompt] = useState('');

  useEffect(() => {
    if (isOpen && holding) {
      openWorkbench(createHoldingWorkbenchSession(holding, useWealthStore.getState().data));
      return;
    }
    closeWorkbenchForEntry('holding');
  }, [closeWorkbenchForEntry, holding, isOpen, openWorkbench]);

  useEffect(() => {
    if (!isOpen) {
      setIsCopilotOpen(false);
      setCopilotPrompt('');
      setMainAskInput('');
      setAnalysis(null);
      setAnalysisStatus('idle');
      setHistory([]);
    }
  }, [isOpen]);

  // Fetch quantitative analysis
  useEffect(() => {
    if (isOpen && holding?.symbol) {
      setLoading(true);
      setAnalysisStatus('loading');
      const isLbBound = true;
      const qty = holding.quantity || 0;
      const cp = holding.currentPrice || holding.costPrice || 0;
      fetch(`/api/quant/analysis?symbol=${holding.symbol}&useLb=${isLbBound}&quantity=${qty}&currentPrice=${cp}`)
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
          if (data.quantSignals && data.deterministicAdvice) {
             setAnalysis(data);
             // check if signals have nulls due to lack of samples
             const lacksSamples = data.quantSignals.missingIndicators && data.quantSignals.missingIndicators.length > 0;
             const finalStatus = lacksSamples ? 'partial' : 'success';
             setAnalysisStatus(finalStatus);
             
             if (uid && holding) {
                const snapshot: AgentAnalysisSnapshot = {
                   id: `${holding.symbol}-${Date.now()}`,
                   timestamp: Date.now(),
                   holdingSnapshot: {
                      symbol: holding.symbol,
                      name: holding.name,
                      quantity: holding.quantity || 0,
                      marketValue: (holding.quantity || 0) * (holding.currentPrice || holding.costPrice || 0),
                      currency: holding.currency || 'USD',
                      currentPrice: holding.currentPrice || holding.costPrice || 0,
                      costPrice: holding.costPrice,
                   },
                   quantSignals: data.quantSignals,
                   deterministicAdvice: data.deterministicAdvice,
                   historySummary: data.historySummary,
                   marketDataSource: data.source,
                   fallbackUsed: data.fallbackUsed,
                   analysisStatus: finalStatus,
                };
                saveAgentAnalysisSnapshot(uid, snapshot);
             }
          } else {
             setAnalysisStatus('error');
          }
        })
        .catch((err) => {
          console.error("QuantEngine Load Failed:", err);
          setAnalysisStatus('error');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, holding]);

  if (!holding) return null;

  const quant = analysis?.quantSignals || holding.quantSignals || {};
  const isUp = (quant.changePercent || 0) >= 0;
  const val = getHoldingMarketValue(holding);
  const isCny = (holding.currency || 'CNY').toUpperCase() === 'CNY';
  const currSym = getCurrencySymbol(holding.currency);

  const exchangeRate = quant?.exchangeRate;
  const conversionVal = exchangeRate ? val * exchangeRate : null;
  const conversionSym = isCny ? '$' : '¥';

  const instrumentType = holding.type || holding.category || t('drawer.notProvided');
  const domicile = holding.domicile || t('drawer.notProvided');

  const hasQuantSignals = !!analysis?.quantSignals || (!!holding.quantSignals && Object.keys(holding.quantSignals).length > 0);
  
  const dynamicRisks = analysis?.deterministicAdvice?.risks || [];
  const dynamicOpportunities = analysis?.deterministicAdvice?.opportunities || [];
  const structuralSuggestedActions = analysis?.deterministicAdvice?.suggestedActions || [];

  const KLINE_CLOSE_INDEX = 2; // [date, open, close, low, high]
  const hasHistory = history && history.length > 0;
  const scaledTrendData = hasHistory ? history.map(item => Number(item[KLINE_CLOSE_INDEX]) || 0) : [];

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
        color: readCssToken('--aw-text-tertiary', 'rgb(238 243 234 / 0.42)'), 
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
        color: readCssToken('--aw-text-tertiary', 'rgb(238 243 234 / 0.42)'),
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
        lineStyle: { color: readCssToken('--aw-accent-mist', '#DDE8D8'), width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgb(221 232 216 / 0.20)' },
              { offset: 0.8, color: 'rgb(221 232 216 / 0.01)' },
              { offset: 1, color: 'rgb(221 232 216 / 0)' }
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
            className="fixed inset-0 aw-drawer-backdrop z-[99]" 
            onClick={onClose} 
          />
          
          {/* Side Elevated Right Panel Drawer */}
          <motion.div 
            initial={{ x: '100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '100%' }} 
            transition={{ type: 'spring', damping: 26, stiffness: 220 }} 
	            className="aw-drawer-shell aw-workbench-shell fixed top-0 right-0 h-screen w-full sm:max-w-[490px] z-[101] flex flex-col font-sans overflow-hidden"
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
	                  <div className="aw-drawer-header aw-workbench-header flex justify-between items-start px-6 pt-6 pb-4 border-b shrink-0">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="aw-section-kicker">{t('drawer.positionIntel')}</span>
                        <span className="aw-state-chip aw-state-chip-info">{t('drawer.ai')}</span>
                      </div>
                      <h2 className="aw-title font-bold aw-text-primary tracking-normal flex items-center gap-2.5">
                        {holding.name || holding.symbol}
                      </h2>
                    </div>
                    {/* Exquisite Close Button */}
                    <button 
                      onClick={onClose} 
                      className="aw-icon-button cursor-pointer"
                    >
                      <MaterialIcon name="close" size={20} />
                    </button>
                  </div>

                  {/* Main Scroller Content */}
	                  <div className="aw-workbench-scroll flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scroll pb-24">
                    
                    {/* Identity Info Panel Cards */}
                    <div className="aw-panel p-4 flex items-center gap-4">
                      {/* Premium Logo Ring Segment Graphic */}
                      <div className="aw-chart-state-icon w-11 h-11 shrink-0">
                        <MaterialIcon name="donut_large" size={24} className="text-aw-accent-mist" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="aw-state-chip">
                            {holding.symbol || 'N/A'}
                          </code>
                          <span className="aw-caption aw-text-tertiary font-medium truncate">{instrumentType}</span>
                        </div>
                        <div className="aw-caption aw-text-tertiary flex items-center gap-1">
                          <span>{t('drawer.jurisdiction')}</span>
                          <span className="aw-text-secondary font-medium">{domicile}</span>
                        </div>
                      </div>
                      
                      {/* Price Badge indicator on upper right card */}
                      <div className="text-right shrink-0">
                        <div className="aw-body font-bold aw-text-primary font-mono">
                          {quant.currentPrice ? `$${quant.currentPrice.toFixed(2)}` : '---'}
                        </div>
                        <div className={`aw-caption font-bold font-mono mt-0.5 flex items-center justify-end ${quant.changePercent != null ? (isUp ? 'text-aw-success' : 'text-aw-danger') : 'aw-text-tertiary'}`}>
                          {quant.changePercent != null ? `${isUp ? '+' : ''}${quant.changePercent.toFixed(2)}%` : '---'}
                        </div>
                      </div>
                    </div>

                    {/* Numeric Parameter Metrics Section */}
                    <div className="grid grid-cols-2 gap-3.5">
                      {/* Value Item (Primary) */}
                      <div className="aw-panel-muted p-4">
                        <span className="aw-caption font-mono aw-text-tertiary uppercase block mb-1">{t('drawer.totalValuation')}</span>
                        <div className="aw-label font-extrabold aw-text-primary font-mono leading-none">
                          {currSym}{val.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                        <span className="aw-caption aw-text-tertiary font-mono mt-1.5 block min-h-[15px]">
                          {exchangeRate != null ? `${conversionSym} ${conversionVal?.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${t('drawer.approx')}` : ''}
                        </span>
                      </div>

                      {/* Allocation Item */}
                      <div className="aw-panel-muted p-4">
                        <span className="aw-caption font-mono aw-text-tertiary uppercase block mb-1">{t('drawer.portfolioAllocation')}</span>
                        <div className="aw-label font-extrabold aw-text-primary font-mono leading-none">
                          {holding.allocation || t('drawer.na')}
                        </div>
                        <span className="aw-caption aw-text-tertiary mt-1.5 block font-medium truncate min-h-[15px]">
                          {holding.allocation ? t('drawer.ofPublicMarkets') : ''}
                        </span>
                      </div>
                    </div>

                    {/* Context / Synchronize timestamp bar */}
                    <div className="aw-status-pill flex items-center justify-between py-1.5 px-3 w-full">
                      <div className="flex items-center gap-1.5">
                        <span className={`aw-status-dot ${holding.lastSyncTime ? 'aw-status-success animate-pulse' : ''}`} />
                        <span>{holding.lastSyncTime ? `${t('drawer.lastSynchronized')} ${new Date(holding.lastSyncTime).toISOString().slice(0, 16).replace('T', ' ')} UTC` : t('drawer.noSync')}</span>
                      </div>
                    </div>

                    {/* Sparkline historical trendline chart section */}
                    <div className="aw-panel p-4 space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-aw-border-subtle">
                        <span className="aw-section-kicker flex items-center gap-1.5">
                          <MaterialIcon name="monitoring" size={16} className="text-aw-accent-mist" />
                          {t('drawer.trend1Y')} ({holding.currency || 'USD'})
                        </span>
                        
                        <div className="flex items-center gap-3">
                          <span className="aw-caption aw-text-secondary font-medium">{t('drawer.day')} <span className={`font-mono font-semibold ${quant.changePercent != null ? (isUp ? 'text-aw-success' : 'text-aw-danger') : 'aw-text-tertiary'}`}>{quant.changePercent != null ? `${isUp ? '+' : ''}${quant.changePercent}%` : '---'}</span></span>
                          <span className="aw-caption aw-text-secondary font-medium font-mono border-l border-aw-border-subtle pl-2.5">{t('drawer.ytd')} <span className={`font-semibold ${quant.ytdPercent != null ? (quant.ytdPercent >= 0 ? 'text-aw-success' : 'text-aw-danger') : 'aw-text-tertiary'}`}>{quant.ytdPercent != null ? `${quant.ytdPercent >= 0 ? '+' : ''}${quant.ytdPercent}%` : '---'}</span></span>
                        </div>
                      </div>

                      <div className="h-[140px] relative w-full">
                        {loading ? (
                          <ChartSkeleton label={t('drawer.syncingTrendline')} />
                        ) : hasHistory && sparklineOption ? (
                          <Suspense fallback={<ChartSkeleton label={t('drawer.syncingTrendline')} />}>
                            <ReactEChartsLazy option={sparklineOption} className="w-full h-full" />
                          </Suspense>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center border border-dashed border-aw-border-subtle rounded-lg">
                             <span className="aw-caption aw-text-tertiary font-mono uppercase">{t('drawer.noTrendData')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Technical indicators section (BB low, BB high, RSI, ADX) */}
                    <div className="aw-panel p-4 space-y-3">
                      <span className="aw-section-kicker flex items-center gap-1.5 pb-2 border-b border-aw-border-subtle">
                        <MaterialIcon name="track_changes" size={16} className="text-aw-accent-mist" />
                        {t('drawer.technicalIndicators')}
                      </span>
                      
                      {analysisStatus === 'loading' || loading ? (
                        <div className="p-4 flex items-center justify-center">
                           <span className="aw-caption aw-text-tertiary font-mono uppercase">{t('drawer.calculatingIndicators')}</span>
                        </div>
                      ) : analysisStatus === 'error' ? (
                        <div className="p-4 flex items-center justify-center border border-dashed border-aw-border-subtle rounded-lg">
                           <span className="aw-caption text-aw-danger font-mono uppercase">{t('drawer.analysisUnavailable')}</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          <div className="aw-structured-card-muted p-2.5 text-center">
                            <span className="aw-caption font-mono aw-text-tertiary uppercase block leading-none mb-1">BB Low</span>
                            <span className="aw-caption font-bold text-aw-success font-mono">{quant.buyPrice ? `$${parseFloat(quant.buyPrice).toFixed(1)}` : '---'}</span>
                          </div>
                          <div className="aw-structured-card-muted p-2.5 text-center">
                            <span className="aw-caption font-mono aw-text-tertiary uppercase block leading-none mb-1">BB High</span>
                            <span className="aw-caption font-bold text-aw-danger font-mono">{quant.sellPrice ? `$${parseFloat(quant.sellPrice).toFixed(1)}` : '---'}</span>
                          </div>
                          <div className="aw-structured-card-muted p-2.5 text-center relative overflow-hidden">
                            <span className="aw-caption font-mono aw-text-tertiary uppercase block leading-none mb-1">RSI</span>
                            {quant.rsi != null ? (
                              <span className={`aw-caption font-extrabold font-mono ${quant.rsi > 70 ? 'text-aw-danger' : quant.rsi < 30 ? 'text-aw-success' : 'aw-text-primary'}`}>
                                {parseFloat(quant.rsi).toFixed(1)}
                              </span>
                            ) : (
                              <span className="aw-caption font-mono aw-text-tertiary opacity-70">{t('drawer.sampleInsufficient')}</span>
                            )}
                          </div>
                          <div className="aw-structured-card-muted p-2.5 text-center relative overflow-hidden">
                            <span className="aw-caption font-mono aw-text-tertiary uppercase block leading-none mb-1">ADX</span>
                            {quant.adx != null ? (
                              <span className="aw-caption font-bold text-aw-accent-mist font-mono">{parseFloat(quant.adx).toFixed(1)}</span>
                            ) : (
                              <span className="aw-caption font-mono aw-text-tertiary opacity-70">{t('drawer.sampleInsufficient')}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Advisory AI Intelligence Area (Risk, Opportunity, Suggested Actions) */}
                    {analysisStatus === 'loading' || loading ? (
                       <div className="aw-panel-muted p-6 flex flex-col items-center justify-center gap-2 border-dashed">
                         <div className="w-4 h-4 rounded-full border border-aw-border-strong border-t-aw-accent-mist animate-spin" />
                         <span className="aw-caption aw-text-tertiary font-mono uppercase mt-2">{t('drawer.calculatingStrategy')}</span>
                       </div>
                    ) : analysisStatus === 'error' ? (
                       <div className="aw-danger-panel p-6 flex items-center justify-center border-dashed">
                          <span className="aw-caption text-aw-danger font-mono uppercase">{t('drawer.historyInsufficient')}</span>
                       </div>
                    ) : analysisStatus === 'partial' || dynamicRisks.length > 0 ? (
                    <div className="space-y-3 pt-1">
                      <span className="aw-section-kicker flex items-center gap-1.5 pb-1 block">
                        <MaterialIcon name="psychology" size={16} className="text-aw-accent-mist" />
                        {t('drawer.aiDiagnostics')}
                      </span>

                      {analysisStatus === 'partial' && (
                        <div className="aw-warning-panel aw-caption text-aw-warning p-2">
                          {t('drawer.partialAnalysis')} {quant.missingIndicators?.length ? `(${quant.missingIndicators.join(', ')})` : ''}
                        </div>
                      )}

                      {/* Stacked Layout for extremely detailed Advisory diagnosis */}
                      <div className="grid grid-cols-1 gap-3">
                        {/* Risk Diagnosis */}
                        <div className="aw-danger-panel p-4 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 mb-2.5">
                              <span className="aw-status-dot aw-status-danger" />
                              <span className="aw-body font-bold text-aw-danger">{t('drawer.securityRisks')}</span>
                            </div>
                            <ul className="space-y-1.5 aw-body aw-text-secondary leading-relaxed">
                              {dynamicRisks.map((txt, ii) => (
                                <li key={ii} className="flex items-start gap-1">
                                  <span className="text-aw-danger font-medium select-none aw-caption mt-[1.5px]">•</span>
                                  <span>{txt}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Opportunity Diagnosis */}
                        <div className="aw-success-panel p-4 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 mb-2.5">
                              <span className="aw-status-dot aw-status-success animate-pulse" />
                              <span className="aw-body font-bold text-aw-success">{t('drawer.technicalOpportunities')}</span>
                            </div>
                            <ul className="space-y-1.5 aw-body aw-text-secondary leading-relaxed">
                              {dynamicOpportunities.map((txt, ii) => (
                                <li key={ii} className="flex items-start gap-1">
                                  <span className="text-aw-success font-medium select-none aw-caption mt-[1.5px]">•</span>
                                  <span>{txt}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Suggested Wealth Actions */}
                        <div className="aw-panel p-4">
                          <div className="flex items-center gap-1.5 mb-2.5">
                            <span className="aw-status-dot aw-status-success" />
                            <span className="aw-body font-bold aw-text-primary">{t('drawer.suggestedActions')}</span>
                          </div>
                          <div className="space-y-2.5">
                            {structuralSuggestedActions.map((txt, ii) => (
                              <div key={ii} className="flex items-start gap-2.5 aw-body aw-text-secondary leading-relaxed">
                                <span className="aw-timeline-index !h-5 !w-5 shrink-0 mt-[1.5px]">
                                  {ii + 1}
                                </span>
                                <span>{txt}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    ) : null}

                  </div>

                  {/* Ask Arbitra Bottom Input Section */}
	                  <div className="aw-drawer-footer aw-workbench-footer absolute bottom-0 left-0 right-0 border-t px-6 py-4 pb-6 shrink-0 z-25">
                    <form onSubmit={handleMainAskSubmit} className="relative flex items-center">
                      <input 
                        type="text"
                        placeholder={`${t('drawer.askArbitra')} ${holding.symbol || holding.name}...`}
                        value={mainAskInput}
                        onChange={(e) => setMainAskInput(e.target.value)}
                        className="aw-form-input pr-12"
                      />
                      <button 
                        type="submit"
                        className="aw-button aw-button-primary !min-h-8 !px-2 absolute right-2 cursor-pointer"
                      >
                        <MaterialIcon name="arrow_forward" size={16} />
                      </button>
                    </form>
                    <p className="aw-caption font-mono aw-text-tertiary text-center mt-2.5 leading-none select-none">
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
	                  className="aw-workbench-scroll flex-1 flex flex-col h-full overflow-hidden"
                >
	                  <div className="aw-drawer-header aw-workbench-header flex justify-between items-center px-6 py-5 border-b shrink-0">
                    <h3 className="aw-body font-bold aw-text-primary flex items-center gap-2">
                      <MaterialIcon name="auto_awesome" size={16} className="text-aw-accent-mist" />
                      <span>{holding.symbol || holding.name} {t('drawer.analyticsStudio')}</span>
                    </h3>
                    
                    {/* Retro back trigger */}
                    <button 
                      onClick={() => { setIsCopilotOpen(false); setCopilotPrompt(''); }} 
                      className="aw-button aw-button-ghost !min-h-8 !px-3 cursor-pointer"
                    >
                      <span>←</span><span>{t('drawer.backToMetrics')}</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-hidden relative min-h-0 bg-aw-bg">
                    {(() => {
                      const allSnapshots = uid ? getAgentAnalysisSnapshots(uid) : [];
                      const symbolSnapshots = allSnapshots.filter(s => s.holdingSnapshot.symbol === holding.symbol);
                      
                      // Using the current analysis data to form a 'virtual' current snapshot
                      // Even if not yet fully saved to local storage, we can mock it based on state
                      const currentAnalysisSnapshot = {
                         id: 'current',
                         timestamp: Date.now(),
                         holdingSnapshot: {
                            symbol: holding.symbol,
                            name: holding.name,
                            quantity: holding.quantity || 0,
                            marketValue: (holding.quantity || 0) * (holding.currentPrice || holding.costPrice || 0),
                            currency: holding.currency || 'USD',
                            currentPrice: holding.currentPrice || holding.costPrice || 0,
                         },
                         quantSignals: quant,
                         deterministicAdvice: analysis?.deterministicAdvice || { risks: [], opportunities: [], suggestedActions: [] },
                         historySummary: analysis?.historySummary || { sampleCount: 0, startDate: '', endDate: '', interval: '' },
                         marketDataSource: analysis?.source || 'unknown',
                         fallbackUsed: analysis?.fallbackUsed || false,
                         analysisStatus: analysisStatus
                      };
                      
                      let previousSnapshots = [...symbolSnapshots];
                      // If the top one is very very recent (like just saved), it might be the current one.
                      // Let's just treat everything in the storage as previous for simplicity, or we can use the top one as the last previous if their time diff is > a few seconds.
                      let latestPreviousSnapshot = previousSnapshots.length > 0 ? previousSnapshots[0] : null;

                      // Prevent comparing to the exact same snapshot we just saved
                      if (latestPreviousSnapshot && (Date.now() - latestPreviousSnapshot.timestamp < 5000)) {
                         previousSnapshots = previousSnapshots.slice(1);
                         latestPreviousSnapshot = previousSnapshots.length > 0 ? previousSnapshots[0] : null;
                      }

                      const diffFromLastSnapshot = latestPreviousSnapshot ? buildAnalysisDiff(currentAnalysisSnapshot, latestPreviousSnapshot) : null;

                      return (
                        <WidgetCopilot 
                          isOpen={isCopilotOpen}
                          inline={true}
                          onClose={() => { setIsCopilotOpen(false); setCopilotPrompt(''); }}
                          widgetTitle={`${t('drawer.positionAnalysisTitle')}: ${holding.symbol || holding.name}`} 
                          initialMessage={copilotPrompt}
                          widgetData={{
                            holdingDetail: holding,
                            quantSignals: quant,
                            deterministicAdvice: analysis?.deterministicAdvice || {},
                            historySummary: analysis?.historySummary || null,
                            marketDataSource: analysis?.source || 'unknown',
                            fallbackUsed: analysis?.fallbackUsed || false,
                            analysisStatus,
                            currentAnalysisSnapshot,
                            previousAnalysisSnapshots: previousSnapshots,
                            latestPreviousSnapshot,
                            diffFromLastSnapshot,
                            systemInstruction: hasQuantSignals ? `你现在处于针对单只资产【${holding.symbol || holding.name}】的财富战略分析与推演模式。请注意，行情数据源为 ${analysis?.source} ${analysis?.fallbackUsed ? '(存在降级)' : ''}。当前分析状态为: ${analysisStatus}。如果状态为 partial，说明部分技术指标（如 ${quant.missingIndicators?.join(', ') || 'RSI, ADX 等'}）因为样本不足无法计算。请密切配合相关的 quantSignals 与持仓市值比例，结合系统提供的 deterministicAdvice 制定策略，绝对不要凭空伪造缺失的指标数值，为用户提供极其精准的对冲、结构微调与再平衡专业策略评估。此外，系统还提供了本地的 previousAnalysisSnapshots 和 latestPreviousSnapshot 以供参考对比，如果暂无上次分析记录请如实告知。` : `你现在处于针对单只资产【${holding.symbol || holding.name}】的分析模式，注意：由于历史行情数据不足，当前无法计算技术指标，请仅根据持有市值和基础信息答复。`
                          }} 
                          onPromoteIntent={(prompt) => {
                            setIsCopilotOpen(false);
                            onClose();
                            openCopilot(prompt);
                          }}
                        />
                      );
                    })()}
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
