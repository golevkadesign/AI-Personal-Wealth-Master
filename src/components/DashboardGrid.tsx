import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TerminalState } from '../types/terminal';
import { Card } from './Card';
import { ChartWidget } from './ChartWidget';
import { User, Sparkles, Droplets, Target, Shield, Briefcase, Activity, Hexagon, Bot } from 'lucide-react';
import { getDonutOption, getExpenseOption, getWaterfallOption, getHoldingsOption, getOptionsOption, getCurrencySymbol } from './chart-configs';
import { useInteractionStore } from '../hooks/useInteractionStore';

interface DashboardGridProps {
  data: TerminalState;
  renderSDUI: (schema: any, globalData: any, keyPrefix: string) => React.ReactNode;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({ data, renderSDUI }) => {
  const currency = data?.distributions?.liquidity?.[0]?.currency || 'CNY';
  const sym = getCurrencySymbol(currency);
  
  const metrics: any = data?.metrics || {};
  const nwParams = metrics.netWorth !== undefined ? `${sym}${Number(metrics.netWorth).toLocaleString()}` : 'N/A';
  const liqParams = metrics.liquidity !== undefined ? `${sym}${Number(metrics.liquidity).toLocaleString()}` : 'N/A';
  const srParams = metrics.safetyRatio !== undefined ? `${Number(metrics.safetyRatio).toFixed(0)} / 100` : 'N/A';
  const fcfParams = metrics.fcf !== undefined ? `${sym}${Number(metrics.fcf).toLocaleString()}` : 'N/A';

  const mockDataForConfig = { distributions: data?.distributions };
  const d_donut = getDonutOption(mockDataForConfig);
  const d_expense = getExpenseOption(mockDataForConfig);
  const d_waterfall = getWaterfallOption(mockDataForConfig);
  const d_holdings = getHoldingsOption(mockDataForConfig);
  const d_options = getOptionsOption(mockDataForConfig);
  const openCopilot = useInteractionStore(state => state.openCopilot);

  return (
    <div className="relative z-10 w-full mb-6 md:mb-10">
      <div className="mx-auto flex w-full flex-col min-w-0 gap-6 md:gap-10">
        
        {/* Wealth Snapshot Row (4 Metrics) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
           <Card 
             title="总净资产 Net Worth" 
             value={nwParams} 
             subValue={metrics.netWorthSummary || '较上月 +2.78%'} 
             trendGood={true} 
             isLongSubText={false} 
             badge={<div className="w-7 h-7 rounded-lg border border-dash-subtle flex items-center justify-center text-dash-primary"><Briefcase className="w-3.5 h-3.5"/></div>}
           />
           <Card 
             title="可用现金池 Liquidity" 
             value={liqParams} 
             subValue={metrics.liquiditySummary || '较上月 +6.42%'} 
             trendGood={true} 
             isLongSubText={false} 
             badge={<div className="w-7 h-7 rounded-lg border border-dash-subtle flex items-center justify-center text-dash-primary"><Droplets className="w-3.5 h-3.5"/></div>}
           />
           <Card 
             title="抗风险系数 Safety Ratio" 
             value={srParams} 
             subValue={metrics.safetyRatioSummary || '较上月 +4.6 pts'} 
             trendGood={true} 
             isLongSubText={false} 
             badge={<div className="w-7 h-7 rounded-lg border border-dash-subtle flex items-center justify-center text-dash-primary"><Shield className="w-3.5 h-3.5"/></div>}
           />
           <Card 
             title="月自由现金流 FCF (Monthly)" 
             value={fcfParams} 
             subValue={metrics.fcfSummary || '较上月 +9.13%'} 
             trendGood={true} 
             isLongSubText={false} 
             badge={<div className="w-7 h-7 rounded-lg border border-dash-subtle flex items-center justify-center text-dash-primary"><Activity className="w-3.5 h-3.5"/></div>}
           />
        </div>

        {/* AI Strategic Brief */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.1 }}
          className="arbitra-panel arbitra-panel-subtle rounded-2xl p-6 md:px-8 md:py-8 relative overflow-hidden group border-dash-subtle"
        >
          <div className="absolute left-0 top-0 bottom-0 w-[120px] md:w-[200px] flex items-center justify-center opacity-30 pointer-events-none">
            <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border border-dash-primary/30 flex items-center justify-center">
              <div className="absolute w-[120%] h-[1px] bg-dash-primary/30 transform rotate-45"></div>
              <div className="absolute h-[120%] w-[1px] bg-dash-primary/30 transform rotate-45"></div>
              <div className="absolute w-[120%] h-[1px] bg-dash-primary/30 transform -rotate-45"></div>
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-dash-primary/40 flex items-center justify-center relative">
                <div className="w-2 h-2 rounded-full bg-dash-primary/60"></div>
                <div className="absolute left-1/2 -top-2 w-[1px] h-4 bg-dash-primary/60 -mb-2"></div>
                <div className="absolute left-1/2 -bottom-2 w-[1px] h-4 bg-dash-primary/60 -mt-2"></div>
                <div className="absolute top-1/2 -left-2 h-[1px] w-4 bg-dash-primary/60 -mr-2"></div>
                <div className="absolute top-1/2 -right-2 h-[1px] w-4 bg-dash-primary/60 -ml-2"></div>
              </div>
            </div>
            {/* Linear fade to content */}
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-r from-transparent to-[#1a1d1f]"></div>
          </div>

          <div className="relative z-10 md:ml-[160px] flex flex-col h-full">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4 gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-wide text-dash-primary md:text-2xl font-serif">
                  战略简报 <span className="font-sans text-[12px] uppercase text-dash-tertiary ml-2 tracking-widest font-normal">Strategic Brief</span>
                </h2>
              </div>
              <button
                 className="opacity-100 arbitra-btn-base arbitra-btn-secondary z-20 arbitra-focus-ring mt-2 md:mt-0 self-start shrink-0 !px-4 !py-2 !border-dash-primary/30 text-dash-secondary hover:text-dash-primary hover:bg-dash-primary/10"
                 onClick={() => openCopilot('战略简报', data.insights?.global, '首席宏观策略师')}
              >
                 <Sparkles className="w-4 h-4 mr-2 text-dash-primary" /> 专家探讨 <span className="text-[10px] text-dash-tertiary ml-2 font-mono uppercase">Expert Discussion</span>
              </button>
            </div>
            
            <div className="flex flex-col xl:flex-row gap-6 xl:gap-12 mt-2">
              <div className="flex-1">
                <div className="text-[18px] md:text-[20px] leading-relaxed text-dash-primary mb-6 font-medium">
                   {data.insights?.global ? (
                     <p>{data.insights?.global}</p>
                   ) : (
                     <p>您的财富结构稳健，现金流充裕，当前重点在于<span className="text-dash-gold border-b border-dash-gold/30 pb-0.5">优化税务效率与长期全球配置。</span></p>
                   )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center rounded-lg border border-dash-subtle bg-dash-surface-hover px-3 py-1.5 gap-2">
                    <span className="text-[12px] text-dash-primary">核心结论</span>
                    <span className="text-[10px] text-dash-tertiary font-mono uppercase tracking-widest">Core View</span>
                  </div>
                  <div className="flex items-center rounded-lg border border-dash-subtle bg-dash-surface-hover px-3 py-1.5 gap-2">
                    <span className="text-[12px] text-dash-primary">风险水平</span>
                    <span className="text-[10px] text-dash-tertiary font-mono uppercase tracking-widest text-dash-warning">Moderate</span>
                  </div>
                  <div className="flex items-center rounded-lg border border-dash-subtle bg-dash-surface-hover px-3 py-1.5 gap-2">
                    <span className="text-[12px] text-dash-primary">机会窗口</span>
                    <span className="text-[10px] text-dash-tertiary font-mono uppercase tracking-widest text-dash-success">Global REITs</span>
                  </div>
                  <div className="flex items-center rounded-lg border border-dash-subtle bg-dash-surface-hover px-3 py-1.5 gap-2">
                    <span className="text-[12px] text-dash-primary">策略建议</span>
                    <span className="text-[10px] text-dash-tertiary font-mono uppercase tracking-widest text-dash-gold">优化税务结构</span>
                  </div>
                </div>
              </div>
              
              <div className="w-full xl:w-[320px] shrink-0 border-l border-dash-subtle pl-0 xl:pl-8 pt-4 xl:pt-0">
                <p className="text-[13px] text-dash-secondary leading-relaxed">
                  在维持流动性安全垫的前提下，建议逐步增加全球优质股权与另类资产配置，同时关注利率周期与地缘变化带来的机会。
                </p>
              </div>
            </div>

          </div>
        </motion.div>

        {/* 动态微件区域 (Dynamic Widgets) - Still preserved for AI popups */}
        <AnimatePresence>
          {data.dynamicWidgets && data.dynamicWidgets.length > 0 && (
            <div className="flex flex-col min-w-0 gap-5 md:gap-6">
              {data.dynamicWidgets.map((widget, i) => (
                <motion.div
                  key={`widget-wrapper-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="min-w-0"
                >
                  {renderSDUI(widget, data, `widget-${i}`)}
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Portfolio Intelligence */}
        <div>
           <div className="flex items-center gap-2 mb-4 xl:mb-6 px-1">
             <Hexagon className="w-4 h-4 text-dash-secondary" />
             <h3 className="text-sm font-semibold tracking-wide text-dash-primary flex items-center gap-2">
                投资组合洞察 <span className="font-mono text-[10px] tracking-widest text-dash-tertiary uppercase mt-0.5">Portfolio Intelligence</span>
             </h3>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
             <ChartWidget 
                title="公开市场持仓视图 Public Holdings" 
                chartHeight="240px" 
                option={d_holdings} 
                dataLength={(data?.distributions?.publicHoldings || []).length} 
                insight={data?.insights?.public || "权益敞口适中，建议关注高分红与质量因子提升组合韧性。"} 
                delay={0.1}
             />
             <ChartWidget 
                title="衍生品及期权 Options & Derivatives" 
                chartHeight="240px" 
                option={d_options} 
                dataLength={(data?.distributions?.options || []).length} 
                insight={data?.insights?.public || "期权策略以保护性为主，风险可控，可考虑波动率策略增强收益。"} 
                delay={0.2}
             />
             <ChartWidget 
                title="非公开资产估值 Private Assets" 
                chartHeight="240px" 
                option={d_waterfall} 
                dataLength={(data?.distributions?.privateAssets || []).length} 
                insight={data?.insights?.private || "非公开资产估值稳健，具备长期增值潜力，关注流动性安排。"} 
                delay={0.3}
             />
           </div>
        </div>

        {/* Cashflow Intelligence */}
        <div>
           <div className="flex items-center gap-2 mb-4 xl:mb-6 px-1">
             <Hexagon className="w-4 h-4 text-dash-secondary" />
             <h3 className="text-sm font-semibold tracking-wide text-dash-primary flex items-center gap-2">
                现金流洞察 <span className="font-mono text-[10px] tracking-widest text-dash-tertiary uppercase mt-0.5">Cashflow Intelligence</span>
             </h3>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
             <ChartWidget 
                title="流动资金池 Liquidity Allocation" 
                chartHeight="240px" 
                option={d_donut} 
                dataLength={(data?.distributions?.liquidity || []).length} 
                insight={"流动性充足，建议保留6-12个月的生活与投资备用金。"} 
                delay={0.4}
             />
             <ChartWidget 
                title="开支结构分析 Expense Analysis" 
                chartHeight="240px" 
                option={d_expense} 
                dataLength={(data?.distributions?.expenses || []).length} 
                insight={"投资相关支出占比较合理，建议持续优化税务与保险结构。"} 
                delay={0.5}
             />
             
             {/* User Persona placed as the 3rd card in this row */}
             <motion.div 
               initial={{ opacity: 0, y: 15 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.6 }}
               className="arbitra-panel arbitra-panel-subtle shadow-sm rounded-[16px] md:rounded-[20px] p-5 md:p-6 lg:p-8 flex flex-col h-full relative overflow-hidden group"
             >
               <h3 className="flex items-center gap-2 text-[14px] font-medium text-dash-primary font-sans tracking-wide mb-6">
                 <span className="flex items-center gap-2">用户画像</span>
                 <span className="text-[10px] sm:text-[11px] uppercase tracking-widest text-dash-secondary font-sans font-normal opacity-70 mt-0.5">User Persona</span>
               </h3>
               
               <div className="flex items-start gap-4 mb-8 mt-2 relative z-10">
                 <div className="w-14 h-14 rounded-full border border-dash-gold/30 bg-[radial-gradient(ellipse_at_center,rgba(201,178,132,0.1)_0%,transparent_70%)] flex items-center justify-center shrink-0">
                   <div className="w-12 h-12 rounded-full border-2 border-dash-primary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-dash-primary/80" />
                   </div>
                 </div>
                 <p className="text-[14px] text-dash-secondary leading-relaxed pt-1">
                   {data.userPersona?.description && !data.userPersona.description.includes("当前信息不足以") 
                     ? data.userPersona.description 
                     : "长期主义的价值投资者，注重资产安全与传承，追求全球配置与现金流自由。"}
                 </p>
               </div>
               
               <div className="flex flex-wrap gap-2.5 mt-auto relative z-10">
                 {(data.userPersona?.tags?.length ? data.userPersona.tags : ['稳健进取', '长期主义', '全球视野', '风险意识强', '家庭导向']).map((tag: string, idx: number) => (
                    <span key={idx} className="bg-dash-surface-hover/80 border-dash-subtle text-dash-primary border px-4 py-2 rounded-full text-[12px] tracking-wide transition-colors hover:bg-dash-surface-hover hover:border-dash-gold/40">
                      {tag}
                    </span>
                 ))}
               </div>
               
               {/* Background Glow */}
               <div className="absolute -top-10 -right-10 w-32 h-32 bg-dash-gold/5 blur-[60px] rounded-full pointer-events-none"></div>
             </motion.div>
           </div>
        </div>

      </div>
    </div>
  );
};
