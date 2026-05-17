import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Activity, Target, BrainCircuit, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { ReactECharts } from './ReactECharts';
import { useInteractionStore } from '../hooks/useInteractionStore';

interface PositionIntelligenceDrawerProps {
  isOpen: boolean;
  holding: any | null; // 包含 symbol 和 quantSignals 的 PublicHolding 对象
  onClose: () => void;
}

export function PositionIntelligenceDrawer({ isOpen, holding, onClose }: PositionIntelligenceDrawerProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const openCopilot = useInteractionStore(state => state.openDrawerWithIntent);

  useEffect(() => {
    if (isOpen && holding?.symbol) {
      setLoading(true);
      fetch(`/api/quant/history?symbol=${holding.symbol}`)
        .then(res => res.json())
        .then(data => {
          if (data.history) setHistory(data.history);
          setLoading(false);
        }).catch(() => setLoading(false));
    }
  }, [isOpen, holding]);

  if (!isOpen || !holding) return null;

  const quant = holding.quantSignals || {};
  const isUp = quant.changePercent >= 0;

  // ECharts K线配置 (极简老钱风)
  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, backgroundColor: '#111315', borderColor: '#2A2E33', textStyle: { color: '#E5E0D8' } },
    grid: { left: '3%', right: '3%', bottom: '5%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: history.map(item => item[0]), scale: true, axisLine: { lineStyle: { color: '#2A2E33' } }, axisLabel: { color: '#888' } },
    yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: '#1A1D21', type: 'dashed' } }, axisLabel: { color: '#888' } },
    series: [
      {
        name: holding.symbol, type: 'candlestick', data: history.map(item => [item[1], item[2], item[3], item[4]]),
        itemStyle: { color: '#10B981', color0: '#EF4444', borderColor: '#10B981', borderColor0: '#EF4444' }
      }
    ]
  };

  const handleAskAI = () => {
    onClose();
    openCopilot(`我当前持有 ${holding.name} (${holding.symbol})，总价值 $${holding.value}。它的当前量化指标为 RSI: ${quant.rsi}, ADX: ${quant.adx}, 信号: ${quant.signal}。请结合我目前的整体财务状况和防守策略，为我进行深度的持仓推演和决策建议。`);
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
        className="fixed bottom-0 left-0 right-0 h-[85vh] sm:h-[600px] bg-dash-bg border-t border-dash-subtle z-[101] rounded-t-3xl shadow-2xl flex flex-col font-sans">
        
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-dash-subtle bg-black/20">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">{holding.symbol || holding.name}</h2>
              {quant.signal === 'buy' && <span className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs font-bold uppercase tracking-wider">Quant: Strong Buy</span>}
              {quant.signal === 'sell' && <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-bold uppercase tracking-wider">Quant: Overheated</span>}
            </div>
            <div className="text-sm text-slate-400 mt-1">系统内持仓估值: <span className="text-white font-mono">${holding.value?.toLocaleString()}</span></div>
          </div>
          <div className="text-right mr-6">
            <div className="text-2xl font-bold text-white font-mono">${quant.currentPrice?.toFixed(2) || '---'}</div>
            <div className={`text-sm font-medium flex items-center justify-end ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              {isUp ? <TrendingUp className="w-4 h-4 mr-1"/> : <TrendingDown className="w-4 h-4 mr-1"/>}
              {isUp ? '+' : ''}{quant.changePercent?.toFixed(2) || 0}%
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 transition-colors"><X className="w-5 h-5"/></button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Chart */}
          <div className="flex-1 border-r border-dash-subtle p-6 flex flex-col">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Activity className="w-4 h-4"/> 150天 K线微观博弈图</h3>
            <div className="flex-1 min-h-[300px] bg-black/20 rounded-xl border border-dash-subtle p-2">
              {loading ? <div className="w-full h-full flex items-center justify-center text-slate-500">拉取底层量化数据中...</div> 
                       : history.length > 0 ? <ReactECharts option={chartOption} /> 
                       : <div className="w-full h-full flex items-center justify-center text-slate-500">暂无该资产的高频行情数据</div>}
            </div>
          </div>

          {/* Right: Quant Signals & AI Brain */}
          <div className="w-full md:w-[400px] bg-dash-surface-hover/30 p-6 overflow-y-auto space-y-6">
            <div>
               <h3 className="text-xs font-bold text-dash-gold uppercase tracking-widest mb-4 flex items-center gap-2"><Target className="w-4 h-4"/> 确定性量化防线</h3>
               <div className="grid grid-cols-2 gap-3">
                 <div className="bg-black/30 border border-dash-subtle p-3 rounded-lg"><div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">建议买入位 (BB下轨)</div><div className="text-green-400 font-mono text-base font-bold">${quant.buyPrice?.toFixed(2) || '---'}</div></div>
                 <div className="bg-black/30 border border-dash-subtle p-3 rounded-lg"><div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">建议卖出位 (BB上轨)</div><div className="text-red-400 font-mono text-base font-bold">${quant.sellPrice?.toFixed(2) || '---'}</div></div>
                 <div className="bg-black/30 border border-dash-subtle p-3 rounded-lg"><div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">RSI (强弱指标)</div><div className={`font-mono text-base font-bold ${quant.rsi>70?'text-red-400':quant.rsi<30?'text-green-400':'text-white'}`}>{quant.rsi?.toFixed(1) || '---'}</div></div>
                 <div className="bg-black/30 border border-dash-subtle p-3 rounded-lg"><div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">ADX (趋势强度)</div><div className="text-white font-mono text-base font-bold">{quant.adx?.toFixed(1) || '---'}</div></div>
               </div>
            </div>

            <div className="bg-dash-primary/10 border border-dash-primary/30 p-5 rounded-xl">
               <h3 className="text-xs font-bold text-dash-primary uppercase tracking-widest mb-3 flex items-center gap-2"><BrainCircuit className="w-4 h-4"/> 升维智能体决策</h3>
               <p className="text-[13px] text-slate-300 leading-relaxed mb-4">
                 底层量化数据仅代表单一资产的历史博弈。作为您的家族资产管家，我需要结合您当前的全局现金流与抗风险系数进行综合战略推演。
               </p>
               <button onClick={handleAskAI} className="w-full py-3 bg-dash-primary text-black rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-white transition-colors shadow-lg">
                 唤醒专家大脑深度推演 <ArrowRight className="w-4 h-4" />
               </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
