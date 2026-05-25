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

