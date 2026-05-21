import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TerminalState } from '../types/terminal';
import { useWealthStore } from '../hooks/useWealthStore';
import { ErrorBoundary } from './ui/ErrorBoundary';

interface DashboardGridProps {
  renderSDUI: (schema: any, globalData: any, keyPrefix: string) => React.ReactNode;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({ renderSDUI }) => {
  const { data } = useWealthStore();
  
  return (
    <div className="relative z-10 w-full mb-6 md:mb-10">
      <div className="mx-auto flex w-full flex-col min-w-0 gap-6 md:gap-7">
        {/* 动态微件区域 (Dynamic Widgets) */}
        <AnimatePresence>
          {data.dynamicWidgets && data.dynamicWidgets.length > 0 && (
            <div className="mb-7 flex flex-col min-w-0 gap-5 md:mb-8 md:gap-6">
              {data.dynamicWidgets.map((widget, i) => (
                <motion.div
                  key={`widget-wrapper-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="min-w-0"
                >
                  <ErrorBoundary>
                    {renderSDUI(widget, data, `widget-${i}`)}
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
              {renderSDUI(data.dashboardSchema, data, 'main-dashboard')}
            </ErrorBoundary>
          </motion.div>
        )}
      </div>
    </div>
  );
};

