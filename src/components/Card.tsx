import React from 'react';
import { motion } from 'motion/react';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { Sparkles } from 'lucide-react';

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

export const Card: React.FC<CardProps> = ({ title, value, subValue, trendGood = true, isLongSubText = false, children, delay, className = "", badge }) => {
  const titleParts = title.split(' ');
  const cnTitle = titleParts[0];
  const enTitle = titleParts.slice(1).join(' ');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25, delay: delay || 0 }}
      className={`arbitra-panel arbitra-panel-subtle rounded-2xl p-5 md:p-6 relative overflow-hidden flex flex-col justify-between group h-[160px] md:h-[180px] shadow-sm ${className}`}
    >
      <div className="relative z-10 flex flex-col h-full">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <h3 className="flex flex-col gap-1 text-[14px] font-medium text-dash-primary mb-0 font-sans tracking-wide">
            <span>{cnTitle}</span>
            <span className="text-[10px] sm:text-[11px] uppercase tracking-widest text-dash-secondary font-sans font-normal opacity-70 leading-none">{enTitle}</span>
          </h3>
          <div className="flex items-center gap-2">
            {badge}
          </div>
        </div>
        
        {/* Main Value */}
        {value !== undefined && (
          <div className="text-[28px] md:text-[34px] font-serif tracking-tight text-dash-primary mb-auto leading-none pt-2 font-medium">
            {value}
          </div>
        )}
        
        {children}
        
        {/* Footer / Trend */}
        <div className="flex items-center justify-between mt-auto">
           {subValue && (
             <div className="flex items-center gap-2 text-[12px]">
                <span className="text-dash-secondary">较上月</span>
                <span className="text-dash-tertiary opacity-50 font-mono text-[9px] uppercase">vs Last Month</span>
                <span className={trendGood ? 'text-dash-success font-mono font-medium ml-2' : 'text-dash-danger font-mono font-medium ml-2'}>
                  {subValue}
                </span>
                <span className={trendGood ? 'text-dash-success ml-1 text-[10px] flex items-center' : 'text-dash-danger ml-1 text-[10px] flex items-center'}>
                  {trendGood ? '▲' : '▼'}
                </span>
             </div>
           )}
           {/* Mini Sparkline Placeholder */}
           <div className="h-6 w-16 opacity-40">
             <svg viewBox="0 0 100 30" className="w-full h-full stroke-dash-primary fill-none" strokeWidth="1.5">
               <path d={trendGood ? "M0,25 L20,20 L40,25 L60,10 L80,15 L100,5" : "M0,5 L20,10 L40,5 L60,20 L80,15 L100,25"} />
             </svg>
           </div>
        </div>

      </div>
    </motion.div>
  );
};
