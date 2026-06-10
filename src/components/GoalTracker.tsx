import React from 'react';
import { motion } from 'motion/react';
import { useWealthStore } from '../hooks/useWealthStore';
import { MaterialIcon } from './ui/MaterialIcon';
import { useTranslation } from '../hooks/useTranslation';

interface GoalTrackerProps {
  globalCurSymbol: string;
}

export function GoalTracker({ globalCurSymbol }: GoalTrackerProps) {
  const { t } = useTranslation();
  const goal = useWealthStore(state => state.data.goal);

  if (!goal?.name || goal.name === '等待设定目标') {
    return null;
  }
  const current = goal?.current || 0;
  const target = goal?.target || 0;
  const goalIndex = goal?.index || (target > 0 ? current / target : 0);
  const goalPercent = Math.min(Math.max(goalIndex * 100, 0), 100);
  const remaining = Math.max(target - current, 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="aw-panel aw-module-goal p-6 sm:p-8 relative overflow-hidden group mb-10 w-full"
    >
      <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6 pb-6 border-b border-aw-border-subtle">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="aw-chart-state-icon size-8 text-aw-accent-mist">
              <MaterialIcon name="track_changes" size={20} />
            </span>
            <span className="aw-section-kicker">
              {t('dashboard.goalTrackerKicker')}
            </span>
          </div>
          <h3 className="aw-title aw-text-primary font-bold break-words antialiased">
            {goal?.name || t('dashboard.goalTrackerDefaultName')}
          </h3>
        </div>

        <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-1 shrink-0 pt-1">
          <span className="aw-caption aw-text-tertiary font-mono font-medium uppercase">
            {t('dashboard.achievementIndex')}
          </span>
          <span className={`aw-metric font-bold ${goalIndex >= 1 ? 'aw-goal-value-success' : 'text-aw-accent-mist'}`}>
            {goalIndex.toFixed(4)}
          </span>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <div className="aw-panel-muted aw-goal-stat">
          <div className="flex items-center justify-between aw-text-tertiary mb-2">
            <span className="aw-caption font-mono uppercase font-semibold">
              {t('dashboard.currentReservoir')}
            </span>
            <span className="aw-status-dot aw-status-info animate-pulse" />
          </div>
          <p className="aw-goal-value select-all">
            {globalCurSymbol}{current.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </p>
        </div>

        <div className="aw-panel-muted aw-goal-stat">
          <div className="flex items-center justify-between aw-text-tertiary mb-2">
            <span className="aw-caption font-mono uppercase font-semibold">
              {t('dashboard.strategicTarget')}
            </span>
            <MaterialIcon name="trophy" size={16} className="text-aw-warning" />
          </div>
          <p className="aw-goal-value select-all">
            {globalCurSymbol}{target.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </p>
        </div>

        <div className="aw-panel-muted aw-goal-stat border-dashed">
          <div className="flex items-center justify-between aw-text-tertiary mb-2">
            <span className="aw-caption font-mono uppercase font-semibold">
              {t('dashboard.strategicRemaining')}
            </span>
            <MaterialIcon name="schedule" size={16} className="aw-text-tertiary" />
          </div>
          <p className={`aw-goal-value select-all ${remaining > 0 ? 'aw-goal-value-accent' : 'aw-goal-value-success'}`}>
            {remaining > 0 ? `${globalCurSymbol}${remaining.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : t('dashboard.completed')}
          </p>
        </div>

      </div>

      <div className="aw-panel-muted relative z-10 p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="aw-caption aw-text-tertiary font-mono font-semibold uppercase flex items-center gap-1">
            {t('dashboard.progressRate')} <MaterialIcon name="chevron_right" size={16} className="text-aw-accent-mist" />
          </span>
          <span className="aw-body font-mono font-bold text-aw-accent-mist">
            {goalPercent.toFixed(1)}%
          </span>
        </div>

        <div className="aw-progress-track">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${goalPercent}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className={`aw-progress-fill ${goalPercent >= 100 ? 'aw-progress-fill-success' : ''}`}
          />
        </div>
      </div>
    </motion.div>
  );
}
