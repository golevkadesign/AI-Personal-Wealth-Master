import React from 'react';
import { motion } from 'motion/react';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { MaterialIcon } from './ui/MaterialIcon';
import { SDUIRenderer } from '../lib/sdui-registry';

interface GeneratedInsightsStripProps {
  widgets: any[];
  globalData: any;
  onClear: () => void;
}

export const GeneratedInsightsStrip: React.FC<GeneratedInsightsStripProps> = ({
  widgets,
  globalData,
  onClear,
}) => {
  const displayWidgets = React.useMemo(() => {
    if (!widgets || widgets.length === 0) return [];

    if (
      widgets.length === 1 &&
      widgets[0] &&
      !Array.isArray(widgets[0]) &&
      widgets[0].id === 'sdui-top-insights-grid' &&
      widgets[0].type === 'Grid' &&
      Array.isArray(widgets[0].children)
    ) {
      return widgets[0].children.slice(0, 3);
    }

    return widgets.slice(0, 3);
  }, [widgets]);

  if (displayWidgets.length === 0) return null;

  return (
    <div className="aw-module-insight mb-7 md:mb-8 flex flex-col min-w-0 aw-panel p-4 md:p-5">
      {/* Header section with low emphasis title & hover-red clear button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-1.5 aw-section-kicker">
            <MaterialIcon name="auto_awesome" size={16} /> Top Insights / AI 生成洞察
          </div>
          <div className="aw-caption mt-0.5">
            本轮仅保留最高优先级的临时建议，可随时清除。
          </div>
        </div>
        <button
          onClick={onClear}
          className="aw-button aw-button-ghost shrink-0 w-fit"
        >
          <MaterialIcon name="delete" size={16} /> 清除洞察
        </button>
      </div>

      {/* Grid container for 3 insights max */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 min-w-0">
        {displayWidgets.map((widget, i) => (
          <motion.div
            key={`insight-strip-${i}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="min-w-0 h-full overflow-hidden"
          >
            <ErrorBoundary>
              <SDUIRenderer
                schema={Array.isArray(widget) ? widget : [widget as any]}
                globalData={globalData}
              />
            </ErrorBoundary>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
