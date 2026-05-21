import React from 'react';
import { motion } from 'motion/react';
import { Loader2, RefreshCw, Activity, Cpu } from 'lucide-react';
import Markdown from 'react-markdown';
import { useWealthStore } from '../hooks/useWealthStore';

interface LifeStrategyTimelineProps {
  nodePlans: Record<string, any>;
  handleInlineNodePlan: (typeStr: string, item: any, isLong: boolean, idx: number) => void;
}

export function LifeStrategyTimeline({
  nodePlans,
  handleInlineNodePlan
} : LifeStrategyTimelineProps) {
  
  const lifeStrategiesShort = useWealthStore(state => state.data.lifeStrategiesShort);
  const lifeStrategiesLong = useWealthStore(state => state.data.lifeStrategiesLong);
  
  const renderTrack = (items: any[] | undefined, isLong: boolean) => {
    if (!items || items.length === 0) {
      return (
        <div className="font-mono text-xs text-dash-tertiary flex items-center justify-center h-28 border border-dash-subtle border-dashed rounded-xl bg-dash-base/30">
          等待足够背景数据以汇聚路径建议
        </div>
      );
    }

    return (
      <div className="relative w-full overflow-hidden mt-2">
        {/* Horizontal timeline train */}
        <div className="flex flex-col lg:flex-row gap-6 relative overflow-x-auto pb-4 custom-scroll lg:items-stretch">
          
          {/* Connecting line on desktop */}
          <div className="hidden lg:block absolute left-14 right-14 top-9 h-[1px] bg-dash-subtle z-0" />

          {items.map((item: any, idx: number) => {
            const contentStr = encodeURIComponent(item.description || item.title || '');
            const contentHash = btoa(contentStr).slice(0, 15);
            const planKey = `${isLong ? 'long' : 'short'}-${idx}-${contentHash}`;
            const plan = nodePlans[planKey];

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25, delay: idx * 0.08 }}
                key={idx}
                className="flex-1 min-w-[280px] bg-dash-base/50 border border-dash-subtle rounded-xl p-5 relative z-10 flex flex-col justify-between hover:border-dash-primary/30 transition-all duration-300"
              >
                {/* Node Top Row: index, timeline marker & action button */}
                <div className="flex justify-between items-center mb-4 z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-dash-surface border border-dash-primary flex items-center justify-center shadow-md text-dash-primary font-mono font-semibold text-xs leading-none">
                      {idx + 1}
                    </div>
                    <span className="bg-[#202326] text-dash-primary border border-dash-subtle text-[11px] font-mono px-2.5 py-0.5 rounded-lg tracking-wide font-semibold tabular-nums">
                      {item.timeNode}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => plan?.status === 'thinking' ? null : handleInlineNodePlan(isLong ? '长线策略' : '短线策略', item, isLong, idx)}
                    disabled={plan?.status === 'thinking'}
                    className="bg-[#1A1D1F] hover:bg-[#202326] text-dash-primary border border-dash-subtle px-2.5 py-1 text-[10px] font-semibold rounded-lg cursor-pointer flex items-center gap-1 transition-colors duration-200"
                  >
                    {plan?.status === 'thinking' ? (
                      <Loader2 className="w-3 h-3 animate-spin text-dash-primary" />
                    ) : (
                      plan?.status === 'done' ? <RefreshCw className="w-3 h-3" /> : <Activity className="w-3 h-3" />
                    )}
                    {plan?.status === 'thinking' ? '分析中' : (plan?.status === 'done' ? '重试' : '洞察')}
                  </button>
                </div>

                {/* Node Meta: title and text */}
                <div className="mb-4">
                  <h4 className="text-[14px] md:text-[15px] font-semibold text-white tracking-tight mb-2 leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-[12px] text-dash-tertiary leading-relaxed bg-[#1A1D1F]/50 p-3 rounded-lg border border-dash-subtle/40">
                    {item.description}
                  </p>
                </div>

                {/* AI Plan Streaming Details */}
                {plan && (
                  <div className="mt-2 bg-[#121415] border border-dash-subtle rounded-lg overflow-hidden text-[12px] shadow-inner">
                    {plan.status === 'thinking' && (
                      <div className="flex items-center gap-1.5 px-3 py-2 text-dash-primary font-mono font-medium text-[10px] bg-dash-surface-hover/50">
                        <Cpu className="w-3.5 h-3.5 animate-pulse shrink-0" />
                        <span className="truncate">{plan.thinking || '正在执行深度量化解析...'}</span>
                      </div>
                    )}
                    {plan.result && (
                      <div className="p-3 text-dash-primary max-h-[160px] overflow-y-auto custom-scroll leading-relaxed">
                        <Markdown>{plan.result}</Markdown>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}

        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 mb-10 w-full animate-fade-in">
      
      {/* Short Term Timeline Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="bg-dash-surface border border-dash-subtle p-6 sm:p-8 rounded-2xl relative overflow-hidden group"
      >
        <div className="flex justify-between items-center mb-6 border-b border-dash-subtle/50 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-mono tracking-widest text-dash-primary font-semibold uppercase">
              短线策略 Life Strategy Pathway
            </span>
          </div>
          <span className="text-[10px] font-mono text-dash-tertiary uppercase tracking-widest font-semibold">
            12 Months Horizon
          </span>
        </div>
        {renderTrack(lifeStrategiesShort, false)}
      </motion.div>

      {/* Long Term Timeline Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.15 }}
        className="bg-dash-surface border border-dash-subtle p-6 sm:p-8 rounded-2xl relative overflow-hidden group"
      >
        <div className="flex justify-between items-center mb-6 border-b border-dash-subtle/50 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-mono tracking-widest text-dash-primary font-semibold uppercase">
              长线战略 Sovereign Horizon
            </span>
          </div>
          <span className="text-[10px] font-mono text-dash-tertiary uppercase tracking-widest font-semibold">
            10+ Years Pathway
          </span>
        </div>
        {renderTrack(lifeStrategiesLong, true)}
      </motion.div>

    </div>
  );
}
