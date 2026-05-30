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

  const getSyncStatusText = () => {
    if (publicHoldingAccountsSyncStatus === 'loading') return '同步中';
    if (publicHoldingAccountsSyncStatus === 'success') return '已同步';
    if (publicHoldingAccountsSyncStatus === 'error') return '同步异常';
    return '等待数据';
  };

  const getAccountsCountText = () => {
    return publicHoldingAccounts.length > 0 ? `${publicHoldingAccounts.length} 个账户已连接` : '等待持仓账户';
  };

  const getAiAnalysisText = () => {
    return data.dynamicWidgets && data.dynamicWidgets.length > 0 ? '本轮已生成洞察' : '空闲中';
  };

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

        {/* 全局数据状态与操作条 */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2"
        >
          <div className="bg-[#111315]/80 backdrop-blur-sm border border-white/[0.04] rounded-xl px-4 py-3 md:min-h-[56px] md:py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 min-w-0">
              <div className="text-zinc-400 font-bold select-none text-[10px] md:text-xs tracking-wider uppercase flex items-center gap-1.5 shrink-0">
                <div className="w-1.5 h-1.5 bg-[#C9B284] rounded-full animate-pulse" />
                全局数据状态 / Operating Context
              </div>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] md:text-xs">
                {/* 状态 1：系统状态 */}
                <div className="flex items-center gap-1 text-zinc-500 shrink-0 select-none">
                  <span>系统状态:</span>
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-zinc-300 font-medium font-sans">正常运行</span>
                  </div>
                </div>

                {/* 状态 2：数据同步 */}
                <div className="flex items-center gap-1 text-zinc-500 shrink-0 select-none">
                  <span>数据同步:</span>
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      publicHoldingAccountsSyncStatus === 'loading' ? 'bg-amber-500 animate-spin' :
                      publicHoldingAccountsSyncStatus === 'success' ? 'bg-emerald-500' :
                      publicHoldingAccountsSyncStatus === 'error' ? 'bg-rose-500' : 'bg-zinc-500'
                    }`} />
                    <span className="text-zinc-300 font-medium font-sans">{getSyncStatusText()}</span>
                  </div>
                </div>

                {/* 状态 3：持仓账户 */}
                <div className="flex items-center gap-1 text-zinc-500 shrink-0 select-none">
                  <span>持仓账户:</span>
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${publicHoldingAccounts.length > 0 ? 'bg-amber-500' : 'bg-zinc-500'}`} />
                    <span className="text-zinc-300 font-medium font-sans">{getAccountsCountText()}</span>
                  </div>
                </div>

                {/* 状态 4：AI分析状态 */}
                <div className="flex items-center gap-1 text-zinc-500 shrink-0 select-none">
                  <span>AI 分析状态:</span>
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${data.dynamicWidgets?.length ? 'bg-[#C9B284]' : 'bg-zinc-500'}`} />
                    <span className="text-zinc-300 font-medium font-sans">{getAiAnalysisText()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
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
                className="px-3.5 py-1.5 md:py-2 bg-[#C9B284]/10 hover:bg-[#C9B284]/25 border border-[#C9B284]/30 text-[#C9B284] hover:text-white text-[11px] md:text-xs font-sans font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>生成本轮持仓复盘</span>
              </button>
            </div>
          </div>
          {ctaError && (
            <motion.p 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="text-xs text-rose-400 font-mono px-4 py-1.5 bg-rose-950/20 border border-rose-950/40 rounded-lg"
            >
              ⚠️ {ctaError}
            </motion.p>
          )}
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

