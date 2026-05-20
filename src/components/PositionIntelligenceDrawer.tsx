import React, { useEffect, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Activity, Target, BrainCircuit, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { WidgetCopilot } from './WidgetCopilot';

const ReactEChartsLazy = React.lazy(() => import('./ReactECharts').then(m => ({ default: m.ReactECharts })));

const ChartSkeleton = () => (
  <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-black/10 rounded-xl animate-pulse">
    <div className="flex flex-col items-center gap-3">
      <Activity className="w-5 h-5 text-dash-primary/40 animate-bounce" />
      <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Loading Market Data...</span>
    </div>
  </div>
);

interface PositionIntelligenceDrawerProps {
  isOpen: boolean;
  holding: any | null; // 包含 symbol 和 quantSignals 的 PublicHolding 对象
  onClose: () => void;
}

export function PositionIntelligenceDrawer({ isOpen, holding, onClose }: PositionIntelligenceDrawerProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const openCopilot = useInteractionStore(state => state.openDrawerWithIntent);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) setIsCopilotOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && holding?.symbol) {
      setLoading(true);
      const isLbBound = true; // 未来可替换为 settings.hasLongbridge
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
            console.error("QuantEngine: 返回了空的历史数据数组");
          }
        })
        .catch((err) => {
          console.error("QuantEngine 拉取失败:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, holding]);

  const quant = holding?.quantSignals || {};
  const isUp = (quant.changePercent || 0) >= 0;

  // ECharts K线配置 (极简老钱风)
  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, backgroundColor: '#111315', borderColor: '#2A2E33', textStyle: { color: '#E5E0D8' } },
    grid: { left: '3%', right: '3%', bottom: '5%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: history.map(item => item[0]), scale: true, axisLine: { lineStyle: { color: '#2A2E33' } }, axisLabel: { color: '#888' } },
    yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: '#1A1D21', type: 'dashed' } }, axisLabel: { color: '#888' } },
    series: [
      {
        name: holding?.symbol, type: 'candlestick', data: history.map(item => [item[1], item[2], item[3], item[4]]),
        itemStyle: { color: '#10B981', color0: '#EF4444', borderColor: '#10B981', borderColor0: '#EF4444' }
      }
    ]
  };

  const handleAskAI = () => {
    setIsCopilotOpen(true);
  };

  return (
    <AnimatePresence>
      {isOpen && holding && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="arbitra-overlay-backdrop z-[100]" onClick={onClose} />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
            className="fixed bottom-0 left-0 right-0 h-[85vh] sm:h-[600px] arbitra-drawer-panel border-b-0 border-x-0 z-[101] rounded-t-[20px] sm:rounded-t-[24px] shadow-[0_-20px_80px_rgba(0,0,0,0.8)] flex flex-col font-sans">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-dash-subtle bg-transparent">
          <div>
            <p className="arbitra-text-mono text-[10px] uppercase tracking-[0.2em] arbitra-text-tertiary mb-1">
              POSITION INTELLIGENCE
            </p>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-medium arbitra-text-primary tracking-tight">{holding.symbol || holding.name}</h2>
              {quant.signal === 'buy' && <span className="arbitra-data-badge !bg-emerald-500/10 !text-emerald-400 !border-emerald-500/20">Quant: Strong Buy</span>}
              {quant.signal === 'sell' && <span className="arbitra-data-badge !bg-rose-500/10 !text-rose-400 !border-rose-500/20">Quant: Overheated</span>}
            </div>
            <div className="text-sm arbitra-text-secondary mt-1">System Valuation: <span className="arbitra-text-primary font-mono">${holding.value?.toLocaleString()}</span></div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:block text-right">
              <div className="text-2xl font-medium arbitra-text-primary font-mono">${quant.currentPrice?.toFixed(2) || '---'}</div>
              <div className={`text-sm font-medium flex items-center justify-end ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isUp ? <TrendingUp className="w-4 h-4 mr-1"/> : <TrendingDown className="w-4 h-4 mr-1"/>}
                {isUp ? '+' : ''}{quant.changePercent?.toFixed(2) || 0}%
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="arbitra-btn-base arbitra-btn-ghost w-10 h-10 p-0 rounded-[10px] arbitra-focus-ring ml-2 shrink-0"
              aria-label="关闭"
            >
              <X className="w-5 h-5"/>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 bg-transparent">
          {/* Left: Chart */}
          <div className="flex-1 md:border-r border-dash-subtle p-6 flex flex-col min-h-[300px] md:min-h-0">
            <h3 className="text-xs font-medium arbitra-text-tertiary uppercase tracking-widest mb-4 flex items-center gap-2"><Activity className="w-4 h-4"/> 150-Day Price Actions</h3>
            <div className="flex-1 arbitra-panel border-dash-subtle rounded-[16px] p-2 min-h-0 relative">
              {loading ? (
                 <div className="w-full h-full flex items-center justify-center arbitra-text-tertiary text-xs">Loading market data...</div> 
              ) : history.length > 0 ? (
                 <Suspense fallback={<ChartSkeleton />}>
                   <ReactEChartsLazy option={chartOption} /> 
                 </Suspense>
              ) : (
                 <div className="w-full h-full flex items-center justify-center arbitra-text-tertiary text-xs">暂无历史数据</div>
              )}
            </div>
          </div>

          {/* Right: Quant Signals & AI Brain */}
          <div className="w-full md:w-[400px] bg-transparent relative flex flex-col shrink-0 min-h-[400px] md:min-h-0">
            <AnimatePresence mode="wait">
              {!isCopilotOpen ? (
                <motion.div key="signals" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 overflow-y-auto space-y-6 flex-1 custom-scroll min-h-0">
                  <div>
                     <h3 className="text-xs font-medium arbitra-text-gold uppercase tracking-widest mb-4 flex items-center gap-2"><Target className="w-4 h-4"/> Deterministic Quant Defense</h3>
                     <div className="grid grid-cols-2 gap-3">
                       <div className="arbitra-panel border-dash-subtle p-3 rounded-[12px]"><div className="text-[10px] arbitra-text-tertiary uppercase tracking-wider mb-1">Buy Support (BB Low)</div><div className="text-emerald-400 font-mono text-base font-medium">${quant.buyPrice?.toFixed(2) || '---'}</div></div>
                       <div className="arbitra-panel border-dash-subtle p-3 rounded-[12px]"><div className="text-[10px] arbitra-text-tertiary uppercase tracking-wider mb-1">Sell Target (BB High)</div><div className="text-rose-400 font-mono text-base font-medium">${quant.sellPrice?.toFixed(2) || '---'}</div></div>
                       <div className="arbitra-panel border-dash-subtle p-3 rounded-[12px]"><div className="text-[10px] arbitra-text-tertiary uppercase tracking-wider mb-1">RSI (Momentum)</div><div className={`font-mono text-base font-medium ${quant.rsi>70?'text-rose-400':quant.rsi<30?'text-emerald-400':'arbitra-text-primary'}`}>{quant.rsi?.toFixed(1) || '---'}</div></div>
                       <div className="arbitra-panel border-dash-subtle p-3 rounded-[12px]"><div className="text-[10px] arbitra-text-tertiary uppercase tracking-wider mb-1">ADX (Trend Strength)</div><div className="arbitra-text-primary font-mono text-base font-medium">{quant.adx?.toFixed(1) || '---'}</div></div>
                     </div>
                  </div>

                  <div className="bg-dash-primary/5 border border-dash-primary/20 p-5 rounded-[16px]">
                     <h3 className="text-xs font-medium arbitra-text-primary uppercase tracking-widest mb-3 flex items-center gap-2"><BrainCircuit className="w-4 h-4"/> Dimensional Synthesizer</h3>
                     <p className="text-[13px] arbitra-text-secondary leading-relaxed mb-4">
                       Underlying quant data only represents historical price action. To build secure wealth strategies, we must synthesize macro contexts with your cash flow resilience.
                     </p>
                     <button onClick={handleAskAI} className="w-full py-2.5 bg-dash-primary text-background rounded-[10px] font-medium text-sm flex items-center justify-center gap-2 hover:bg-dash-primary/90 transition-colors shadow-sm arbitra-focus-ring">
                       Deep Synthesis <ArrowRight className="w-4 h-4" />
                     </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="copilot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col p-4 bg-transparent h-full min-h-0">
                  <div className="flex justify-between items-center mb-4 shrink-0 px-2">
                    <h3 className="text-sm font-medium arbitra-text-primary flex items-center gap-2"><BrainCircuit className="w-4 h-4"/> {holding.symbol} Sandbox</h3>
                    <button onClick={() => setIsCopilotOpen(false)} className="text-dash-secondary hover:text-dash-primary text-xs underline arbitra-focus-ring rounded-sm">Back to Metrics</button>
                  </div>
                  <div className="flex-1 overflow-hidden rounded-[16px] border border-dash-subtle arbitra-panel relative min-h-0">
                    <WidgetCopilot 
                       isOpen={isCopilotOpen}
                       inline={true}
                       onClose={() => setIsCopilotOpen(false)}
                       widgetTitle={`持仓分析: ${holding.symbol || holding.name}`} 
                       widgetData={{
                         holdingDetail: holding,
                         quantSignals: quant,
                         systemInstruction: `你现在处于针对单只资产【${holding.symbol}】的沙盘推演模式。请紧密结合传给你的 quantSignals (如 RSI: ${quant.rsi}, ADX: ${quant.adx})，给出精确到美元的操盘建议。`
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
          </div>
        </div>
      </motion.div>
      </>
      )}
    </AnimatePresence>
  );
}
