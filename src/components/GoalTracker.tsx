import React from 'react';
import { motion } from 'motion/react';
import { Target, Trophy, Clock, ChevronRight } from 'lucide-react';

interface GoalTrackerProps {
  goal: any;
  globalCurSymbol: string;
}

export function GoalTracker({ goal, globalCurSymbol }: GoalTrackerProps) {
  const current = goal?.current || 0;
  const target = goal?.target || 0;
  const goalPercent = Math.min(Math.max((goal?.index || (target > 0 ? current / target : 0)) * 100, 0), 100);
  const remaining = Math.max(target - current, 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="bg-dash-surface border border-dash-subtle p-6 sm:p-8 rounded-2xl relative overflow-hidden group mb-10 w-full"
    >
      {/* Background radial soft light for high-end gold aura */}
      <div className="absolute right-0 top-0 w-80 h-80 bg-dash-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header Info */}
      <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6 pb-6 border-b border-dash-subtle/50">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 bg-[#202326] border border-dash-subtle rounded-lg text-dash-primary flex items-center justify-center">
              <Target className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-mono tracking-widest text-[#A39167] font-semibold uppercase">
              战略规划指标 Strategic Target Tracker
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words antialiased leading-snug">
            {goal?.name || "家庭信托与长期流动性目标"}
          </h3>
        </div>

        {/* Big Index Value */}
        <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-1 shrink-0 pt-1">
          <span className="text-[10px] font-mono font-medium text-dash-tertiary uppercase tracking-widest">
            Achievement Index
          </span>
          <span className={`text-4xl md:text-5xl font-mono font-bold tracking-tighter ${goal?.index >= 1 ? 'text-[#6B8E6B]' : 'text-dash-primary'}`}>
            {(goal?.index || (target > 0 ? current / target : 0)).toFixed(4)}
          </span>
        </div>
      </div>

      {/* Grid of Quantified Amounts */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        
        {/* Current State Column */}
        <div className="bg-dash-base/40 border border-dash-subtle/70 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-dash-tertiary mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest font-semibold">
              当前蓄水位 CURRENT
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-dash-primary animate-pulse" />
          </div>
          <p className="text-2xl font-mono text-white font-bold tracking-tight select-all">
            {globalCurSymbol}{current.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </p>
        </div>

        {/* Target Amount Column */}
        <div className="bg-dash-base/40 border border-dash-subtle/70 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-dash-tertiary mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest font-semibold">
              战略对标目标 TARGET
            </span>
            <Trophy className="w-3.5 h-3.5 text-[#C9B284]" />
          </div>
          <p className="text-2xl font-mono text-white font-bold tracking-tight select-all">
            {globalCurSymbol}{target.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </p>
        </div>

        {/* Gap Remaining Column */}
        <div className="bg-dash-base/40 border border-dash-subtle/70 rounded-xl p-4 flex flex-col justify-between border-dashed">
          <div className="flex items-center justify-between text-dash-tertiary mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest font-semibold">
              当前战略缺口 REMAINDING
            </span>
            <Clock className="w-3.5 h-3.5 text-dash-tertiary" />
          </div>
          <p className="text-2xl font-mono text-[#A39167] font-bold tracking-tight select-all">
            {remaining > 0 ? `${globalCurSymbol}${remaining.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : '🎯 COMPLETED'}
          </p>
        </div>

      </div>

      {/* Progress Bar with Percentage Tag */}
      <div className="relative z-10 rounded-xl bg-dash-base/60 border border-dash-subtle p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-mono font-semibold tracking-wider text-dash-tertiary uppercase flex items-center gap-1">
            战略推进进度 Progress Rate <ChevronRight className="w-3 h-3 text-dash-primary" />
          </span>
          <span className="text-sm font-mono font-bold text-dash-primary">
            {goalPercent.toFixed(1)}%
          </span>
        </div>

        {/* Multi-segmented or custom polished absolute bar */}
        <div className="relative w-full h-[10px] bg-[#121415] border border-dash-subtle/40 rounded-full overflow-hidden shadow-inner">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${goalPercent}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className={`h-full relative z-10 rounded-full transition-all duration-1000 ${
              goalPercent >= 100 
                ? 'bg-[#6B8E6B]' 
                : 'bg-gradient-to-r from-dash-primary/60 to-dash-primary'
            }`}
          />
        </div>
      </div>
    </motion.div>
  );
}
