import React from 'react';
import { motion } from 'motion/react';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { Briefcase, Droplet, Shield, TrendingUp } from 'lucide-react';

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
    return <Briefcase className="w-5 h-5 text-dash-primary/80" />;
  }
  if (t.includes('liquidity') || t.includes('可用现金') || t.includes('现金池')) {
    return <Droplet className="w-5 h-5 text-dash-primary/80" />;
  }
  if (t.includes('safety') || t.includes('抗风险') || t.includes('系数')) {
    return <Shield className="w-5 h-5 text-dash-primary/80" />;
  }
  if (t.includes('fcf') || t.includes('自由现金流') || t.includes('月自由')) {
    return <TrendingUp className="w-5 h-5 text-dash-primary/80" />;
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
  const paths: Record<string, string> = {
    netWorth: "M0,15 C10,12 20,18 30,10 C40,2 50,8 60,3 L65,2",
    liquidity: "M0,18 C10,15 20,12 30,18 C40,20 50,10 60,6 L65,5",
    safetyRatio: "M0,10 C10,12 20,8 30,15 C40,16 50,5 60,4 L65,3",
    fcf: "M0,20 C10,18 20,15 30,10 C40,12 50,6 60,2 L65,1"
  };
  const path = paths[seed] || "M0,15 Q30,5 60,15";
  return (
    <svg className="w-16 h-8 text-dash-primary/60" viewBox="0 0 70 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
};

export const Card: React.FC<CardProps> = ({ title, value, subValue, trendGood = true, isLongSubText = false, children, delay, className = "", badge }) => {
  const isPositive = subValue ? (subValue.includes('+') || subValue.includes('▲') || subValue.includes('升')) : false;
  const isNegative = subValue ? (subValue.includes('-') || subValue.includes('▼') || subValue.includes('降')) : false;
  const statusColor = isPositive ? 'text-dash-green' : (isNegative ? 'text-dash-red' : 'text-dash-tertiary');
  const cardIcon = getCardIcon(title);
  const trendSeed = getTrendSeed(title);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25, delay: delay || 0 }}
      className={`bg-dash-surface border border-dash-subtle rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between group h-full hover:border-[#C9B284]/30 hover:bg-dash-surface-hover/80 transition-all duration-300 ${className}`}
    >
      <div className="relative z-10 flex flex-col h-full justify-between">
        
        {/* Card Header */}
        <div className="flex justify-between items-start mb-4 gap-2">
          <div>
            <h3 className="text-dash-tertiary text-[11px] font-mono uppercase tracking-[0.15em] font-semibold flex items-center gap-1.5">
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {badge && <div>{badge}</div>}
            
            <button
               className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-[#202326] hover:bg-[#262A2E] text-dash-primary border border-dash-subtle px-2.5 py-1 font-semibold text-[10px] rounded-lg cursor-pointer"
               onClick={() => useInteractionStore.getState().openCopilot(title, { value, subValue }, '垂直领域专家')}
               title="专家探讨"
               aria-label="专家探讨"
            >
               ✨ 空中脑暴
            </button>
            
            {cardIcon && (
              <div className="w-8 h-8 rounded-lg bg-dash-base/60 border border-dash-subtle flex items-center justify-center shadow-inner">
                {cardIcon}
              </div>
            )}
          </div>
        </div>

        {/* Card Value Body */}
        {value !== undefined && (
          <div className="text-[28px] md:text-[32px] font-mono font-medium text-dash-primary tracking-tight leading-none mb-4 tabular-nums">
            {value}
          </div>
        )}

        {children}

        {/* Card Footer: trend and sparkline side by side */}
        {subValue && (
          <div className="mt-auto flex justify-between items-end pt-2 w-full">
            <div className={`text-xs ${isLongSubText ? 'text-dash-tertiary leading-relaxed max-w-[70%]' : `${statusColor} font-semibold flex items-center gap-1`}`}>
              {!isLongSubText && (isPositive ? '▲' : isNegative ? '▼' : '')}
              {subValue}
            </div>
            {trendSeed && (
              <div className="shrink-0 bg-dash-base/30 rounded px-1 py-0.5 border border-transparent">
                <MiniTrendLine seed={trendSeed} />
              </div>
            )}
          </div>
        )}

      </div>
    </motion.div>
  );
};
