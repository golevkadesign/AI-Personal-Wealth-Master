import React from 'react';
import { motion } from 'motion/react';
import { Target, Compass, Flag, Focus, Anchor } from 'lucide-react';
import Markdown from 'react-markdown';

interface LifeStrategyTimelineProps {
  lifeStrategiesShort?: any[];
  lifeStrategiesLong?: any[];
  nodePlans?: Record<string, any>;
  handleInlineNodePlan?: (typeStr: string, item: any, isLong: boolean, idx: number) => void;
}

const icons = [Target, Compass, Flag, Focus, Anchor];

export function LifeStrategyTimeline({
  lifeStrategiesShort = [],
  lifeStrategiesLong = []
} : LifeStrategyTimelineProps) {

  // Combine and take up to 4-5 nodes for horizontal display
  const combined = [...(lifeStrategiesShort || []), ...(lifeStrategiesLong || [])].slice(0, 5);

  if (combined.length === 0) {
    // Generate fallback data to match design presentation if empty
    combined.push({ timeNode: "2024 Q2", title: "财富保值阶段", description: "优化资产结构，建立安全垫与现金流体系" });
    combined.push({ timeNode: "2025 Q1", title: "全球配置深化", description: "增加全球优质资产配置，分散单一市场风险" });
    combined.push({ timeNode: "2026 H1", title: "家族保障强化", description: "完善保险与信托架构，保障家庭长期安全" });
    combined.push({ timeNode: "2027 H1", title: "财富传承规划", description: "启动家族治理与传承安排，实现财富有序传承" });
    combined.push({ timeNode: "2030+", title: "自由与影响力", description: "实现时间与财务自由，专注个人价值与影响力" });
  }

  return (
    <div className="mb-8 md:mb-10 w-full overflow-x-auto pb-4 hide-scrollbar">
      <div className="flex items-center gap-2 mb-6 px-1">
        <Target className="w-4 h-4 text-dash-secondary" />
        <h3 className="text-sm font-semibold tracking-wide text-dash-primary flex items-center gap-2">
           人生策略时间线 <span className="font-mono text-[10px] tracking-widest text-dash-tertiary uppercase mt-0.5">Life Strategy Timeline</span>
        </h3>
      </div>

      <div className="relative min-w-[800px] xl:min-w-full">
        {/* Horizontal Line connecting nodes */}
        <div className="absolute top-[28px] left-[50px] right-[50px] h-px border-t border-dashed border-dash-gold/30"></div>
        
        <div className="grid grid-cols-5 gap-4">
          {combined.map((item, idx) => {
            const IconComponent = icons[idx % icons.length];
            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25, delay: idx * 0.1 }}
                className="relative flex flex-col items-center text-center group"
              >
                {/* Node Point */}
                <div className="relative z-10 w-14 h-14 rounded-full border border-dash-gold bg-dash-bg flex items-center justify-center shrink-0 mb-4 shadow-sm group-hover:scale-110 transition-transform">
                   <div className="w-10 h-10 rounded-full bg-dash-gold/10 flex items-center justify-center border border-dash-gold/20">
                     <IconComponent className="w-4 h-4 text-dash-gold" />
                   </div>
                </div>

                {/* Content */}
                <div className="text-[11px] text-dash-secondary font-mono tracking-widest mb-1.5 opacity-80 uppercase">{item.timeNode}</div>
                <h4 className="text-[14px] md:text-[15px] font-medium text-dash-primary mb-2 mb-2 tracking-wide font-serif">{item.title}</h4>
                <p className="text-[12px] text-dash-secondary leading-relaxed md:px-2 opacity-80">
                  {item.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  );
}
