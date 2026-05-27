import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trash2 } from 'lucide-react';
import { useWealthStore } from '../hooks/useWealthStore';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { SDUIRenderer } from '../lib/sdui-registry';

export const DashboardGrid: React.FC = () => {
  const { 
    data, 
    selectedHolding, 
    setSelectedHolding, 
    publicHoldingsSyncStatus, 
    publicHoldingsError, 
    publicHoldingsLastSyncAt, 
    publicHoldingAccountsSyncStatus,
    publicHoldingAccountsError,
    publicHoldingAccountsLastSyncAt,
    clearDynamicWidgets 
  } = useWealthStore();

  const createPortfolioReviewSession = useWealthStore(state => state.createPortfolioReviewSession);
  const [ctaError, setCtaError] = React.useState<string | null>(null);
  
  const enhancedGlobalData = { 
    ...data, 
    selectedHolding, 
    setSelectedHolding, 
    publicHoldingsSyncStatus, 
    publicHoldingsError, 
    publicHoldingsLastSyncAt,
    publicHoldingAccountsSyncStatus,
    publicHoldingAccountsError,
    publicHoldingAccountsLastSyncAt
  };

  const publicHoldingAccounts = data.publicHoldingAccounts || (data.distributions as any)?.publicHoldingAccounts || [];
  const publicHoldings = data.distributions?.publicHoldings || [];

  const hasPublicHoldingAccounts = publicHoldingAccounts.length > 0;
  const hasPublicHoldings = publicHoldings.length > 0;

  let badgeText = "等待持仓数据";
  let badgeColorClass = "bg-[#1A1D20] text-[#8C8370] border-zinc-800";
  if (hasPublicHoldingAccounts) {
    badgeText = "多账户实盘";
    badgeColorClass = "bg-[#C9B284]/15 text-[#C9B284] border-[#C9B284]/20";
  } else if (hasPublicHoldings) {
    badgeText = "旧持仓兼容模式";
    badgeColorClass = "bg-teal-950/20 text-teal-400 border-teal-900/30";
  }

  return (
    <div className="relative z-10 w-full mb-6 md:mb-10">
      <div className="mx-auto flex w-full flex-col min-w-0 gap-6 md:gap-7">
        {/* 动态微件区域 (Dynamic Widgets) */}
        <AnimatePresence>
          {data.dynamicWidgets && data.dynamicWidgets.length > 0 && (
            <div className="mb-7 flex flex-col min-w-0 gap-5 md:mb-8 md:gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-dash-primary/5 border border-dash-primary/20"
              >
                <div>
                  <div className="flex items-center gap-2 text-dash-primary font-bold text-sm mb-1 uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" /> AI 生成洞察层
                  </div>
                  <div className="text-xs text-dash-secondary">
                    以下内容由本轮分析生成，可作为临时策略参考；固定资产大盘保留在下方。
                  </div>
                </div>
                <button
                  onClick={clearDynamicWidgets}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dash-surface border border-dash-subtle text-dash-secondary hover:text-dash-red hover:bg-dash-red/10 hover:border-dash-red/30 transition-colors text-xs font-medium shrink-0 w-fit"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 清除洞察
                </button>
              </motion.div>
              {data.dynamicWidgets.map((widget, i) => (
                <motion.div
                   key={`widget-wrapper-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="min-w-0"
                >
                  <ErrorBoundary>
                    <SDUIRenderer key={`widget-${i}`} schema={Array.isArray(widget) ? widget : [widget as any]} globalData={enhancedGlobalData} />
                  </ErrorBoundary>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Portfolio Review CTA */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#10141D] border border-[#C9B284]/15 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 transition-all"
        >
          <div className="flex items-start gap-4 w-full md:w-auto">
            <div className="bg-[#1C1F22] border border-[#C9B284]/20 shadow-inner w-12 h-12 rounded-xl flex items-center justify-center relative shrink-0 overflow-hidden group">
              <div className="absolute inset-0 bg-[#C9B284]/5 opacity-40"></div>
              <Sparkles className="w-5 h-5 text-[#C9B284]" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-[#E7D7B0] tracking-wide font-sans">
                  本轮持仓复盘 / Portfolio Review
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badgeColorClass} select-none`}>
                  {badgeText}
                </span>
              </div>
              <p className="text-xs text-[#8C8370] leading-relaxed max-w-2xl">
                基于当前多账户持仓或公开市场持仓创建复盘快照，对比上次记录，并生成结构化行动计划。
              </p>
              {ctaError && (
                <p className="text-xs text-rose-400 font-mono mt-1 animate-pulse">
                  ⚠️ {ctaError}
                </p>
              )}
            </div>
          </div>
          
          <div className="w-full md:w-auto shrink-0 flex justify-end">
            <button
              onClick={() => {
                setCtaError(null);
                const session = createPortfolioReviewSession();
                if (session) {
                  window.dispatchEvent(new CustomEvent('open-portfolio-review', { detail: { sessionId: session.id } }));
                } else {
                  setCtaError("当前没有可复盘的持仓数据，请先同步券商账户或录入公开市场持仓。");
                }
              }}
              className="w-full md:w-auto px-5 py-2.5 bg-[#C9B284]/10 hover:bg-[#C9B284]/25 border border-[#C9B284]/30 text-[#C9B284] hover:text-white text-xs font-mono tracking-wider font-semibold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              生成本轮持仓复盘
            </button>
          </div>
        </motion.div>

        {/* 核心仪表盘骨架 (Dashboard Schema) */}
        {data.dashboardSchema && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="min-w-0"
          >
            <ErrorBoundary>
              <SDUIRenderer key="main-dashboard" schema={data.dashboardSchema} globalData={enhancedGlobalData} />
            </ErrorBoundary>
          </motion.div>
        )}
      </div>
    </div>
  );
};

