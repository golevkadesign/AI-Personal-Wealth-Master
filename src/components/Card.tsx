import React from 'react';
import { motion } from 'motion/react';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { MaterialIcon } from './ui/MaterialIcon';
import { useTranslation } from '../hooks/useTranslation';

interface CardProps {
  title: string;
  value?: React.ReactNode;
  subValue?: string;
  trendGood?: boolean;
  isLongSubText?: boolean;
  children?: React.ReactNode;
  delay?: number;
  className?: string;
  badge?: React.ReactNode;
}

const getCardIcon = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('net worth') || t.includes('净资产')) {
    return <MaterialIcon name="work" size={20} className="text-aw-accent-mist" />;
  }
  if (t.includes('liquidity') || t.includes('可用现金') || t.includes('现金池')) {
    return <MaterialIcon name="water_drop" size={20} className="text-aw-accent-mist" />;
  }
  if (t.includes('safety') || t.includes('抗风险') || t.includes('系数')) {
    return <MaterialIcon name="shield" size={20} className="text-aw-accent-mist" />;
  }
  if (t.includes('fcf') || t.includes('自由现金流') || t.includes('月自由')) {
    return <MaterialIcon name="trending_up" size={20} className="text-aw-accent-mist" />;
  }
  return null;
};

const getTrendSeed = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('net worth') || t.includes('净资产')) return 'netWorth';
  if (t.includes('liquidity') || t.includes('可用现金') || t.includes('现金池')) return 'liquidity';
  if (t.includes('safety') || t.includes('抗风险') || t.includes('系数')) return 'safetyRatio';
  if (t.includes('fcf') || t.includes('自由现金流') || t.includes('月自由')) return 'fcf';
  return '';
};

const MiniTrendLine: React.FC<{ seed: string }> = ({ seed }) => {
  const heights: Record<string, number[]> = {
    netWorth: [34, 40, 32, 48, 58, 52, 64],
    liquidity: [28, 36, 44, 34, 30, 46, 54],
    safetyRatio: [48, 42, 52, 38, 36, 58, 62],
    fcf: [26, 32, 40, 50, 46, 56, 66]
  };
  const bars = heights[seed] || [34, 40, 36, 48, 44, 54, 46];
  return (
    <div className="flex h-8 w-16 items-end justify-end gap-1" aria-hidden="true">
      {bars.map((height, index) => (
        <span
          key={`${seed}-${index}`}
          className="w-1 rounded-full bg-aw-accent-mist/60"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
};

export const Card: React.FC<CardProps> = ({ title, value, subValue, trendGood = true, isLongSubText = false, children, delay, className = "", badge }) => {
  const { t } = useTranslation();
  const isPositive = subValue ? (subValue.includes('+') || subValue.includes('▲') || subValue.includes('升')) : false;
  const isNegative = subValue ? (subValue.includes('-') || subValue.includes('▼') || subValue.includes('降')) : false;
  const statusColor = isPositive ? 'text-aw-success' : (isNegative ? 'text-aw-danger' : 'aw-text-tertiary');
  const cardIcon = getCardIcon(title);
  const trendSeed = getTrendSeed(title);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25, delay: delay || 0 }}
      className={`aw-panel aw-module-metric p-6 relative overflow-hidden flex flex-col justify-between group h-full transition-all duration-300 ${className}`}
    >
      <div className="relative z-10 flex flex-col h-full justify-between">
        
        {/* Card Header */}
        <div className="flex justify-between items-start mb-4 gap-2">
          <div>
            <h3 className="aw-section-kicker flex items-center gap-1.5">
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {badge && <div>{badge}</div>}
            
            <button
               className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity aw-button aw-button-ghost px-2.5 py-1"
               onClick={() => useInteractionStore.getState().openCopilot(title, { value, subValue }, t('dashboard.verticalExpert'))}
               title={t('dashboard.expertReview')}
               aria-label={t('dashboard.expertReview')}
            >
               <MaterialIcon name="auto_awesome" size={16} /> {t('dashboard.expertReview')}
            </button>
            
            {cardIcon && (
              <div className="w-8 h-8 rounded-md bg-aw-surface-2 border border-aw-border-subtle flex items-center justify-center">
                {cardIcon}
              </div>
            )}
          </div>
        </div>

        {/* Card Value Body */}
        {value !== undefined && (
          <div className="aw-metric mb-4 tabular-nums">
            {value}
          </div>
        )}

        {children}

        {/* Card Footer: trend and sparkline side by side */}
        {subValue && (
          <div className="mt-auto flex justify-between items-end pt-2 w-full">
            <div className={`aw-caption ${isLongSubText ? 'aw-text-tertiary leading-relaxed max-w-[70%]' : `${statusColor} font-semibold flex items-center gap-1`}`}>
              {!isLongSubText && (isPositive ? '▲' : isNegative ? '▼' : '')}
              {subValue}
            </div>
            {trendSeed && (
              <div className="shrink-0 aw-panel-muted px-1 py-0.5">
                <MiniTrendLine seed={trendSeed} />
              </div>
            )}
          </div>
        )}

      </div>
    </motion.div>
  );
};
