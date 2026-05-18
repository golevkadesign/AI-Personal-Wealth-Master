import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TerminalState } from '../types/terminal';

interface DashboardGridProps {
  data: TerminalState;
  renderSDUI: (schema: any, globalData: any, keyPrefix: string, onChartClick?: (params: any) => void) => React.ReactNode;
  onChartClick: (params: any) => void;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({ data, renderSDUI, onChartClick }) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth z-10 custom-scrollbar relative">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 动态微件区域 (Dynamic Widgets) */}
        <AnimatePresence>
          {data.dynamicWidgets && data.dynamicWidgets.length > 0 && (
            <div className="space-y-6 mb-8">
              {data.dynamicWidgets.map((widget, i) => (
                <motion.div
                  key={`widget-wrapper-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  {renderSDUI(widget, data, `widget-${i}`, onChartClick)}
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
          >
            {renderSDUI(data.dashboardSchema, data, 'main-dashboard', onChartClick)}
          </motion.div>
        )}
      </div>
    </div>
  );
};
