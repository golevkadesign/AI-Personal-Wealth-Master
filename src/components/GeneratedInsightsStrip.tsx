import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Trash2 } from 'lucide-react';
import { ErrorBoundary } from './ui/ErrorBoundary';
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
  if (!widgets || widgets.length === 0) return null;

  return (
    <div className="mb-7 md:mb-8 flex flex-col min-w-0 bg-[#111315]/40 backdrop-blur-sm border border-white/[0.04] rounded-xl p-4 md:p-5">
      {/* Header section with low emphasis title & hover-red clear button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-white/[0.04] pb-3">
        <div>
          <div className="flex items-center gap-1.5 text-dash-primary font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Top Insights / AI 生成洞察
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            本轮仅保留最高优先级的临时建议，可随时清除。
          </div>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0B0D10]/40 border border-white/[0.06] text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition-colors cursor-pointer shrink-0 w-fit"
        >
          <Trash2 className="w-3.5 h-3.5" /> 清除洞察
        </button>
      </div>

      {/* Grid container for 3 insights max */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 min-w-0">
        {widgets.map((widget, i) => (
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
