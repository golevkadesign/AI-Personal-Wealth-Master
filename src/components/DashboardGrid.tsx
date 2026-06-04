import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useWealthStore } from '../hooks/useWealthStore';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { SDUIRenderer } from '../lib/sdui-registry';
import { GeneratedInsightsStrip } from './GeneratedInsightsStrip';

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
    <div className="relative z-10 w-full mb-6 md:mb-8">
      <div className="mx-auto flex w-full flex-col min-w-0 gap-5 md:gap-6">
        {/* 动态微件区域 (Dynamic Widgets) */}
        <AnimatePresence>
          {data.dynamicWidgets && data.dynamicWidgets.length > 0 && (
            <GeneratedInsightsStrip
              widgets={data.dynamicWidgets}
              globalData={enhancedGlobalData}
              onClear={clearDynamicWidgets}
            />
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

