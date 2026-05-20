import React from 'react';
import { motion } from 'motion/react';
import { LayoutGrid, GraduationCap, Home, Sailboat } from 'lucide-react';

interface GoalTrackerProps {
  goal: any;
  globalCurSymbol: string;
}

export function GoalTracker({ goal, globalCurSymbol }: GoalTrackerProps) {
  
  // We can fallback to 3 goals if we only have 1 or 0 to match the design (or construct an array from the data)
  const goals = [];
  
  if (goal?.name && goal.name !== '等待设定目标') {
    goals.push({
      name: goal.name,
      icon: GraduationCap,
      target: goal.target || 3000000,
      current: goal.current || 2340000,
      index: goal.index || 0.78
    });
  } else {
    goals.push({
      name: "子女教育基金",
      icon: GraduationCap,
      target: 3000000,
      current: 2340000,
      index: 0.78
    });
  }
  
  if (goals.length < 3) {
    goals.push({
      name: "家庭资产保障",
      icon: Home,
      target: 5000000,
      current: 3250000,
      index: 0.65
    });
    goals.push({
      name: "退休生活储备",
      icon: Sailboat,
      target: 10000000,
      current: 4200000,
      index: 0.42
    });
  }

  return (
    <div className="mb-10 w-full">
      <div className="flex items-center gap-2 mb-6 px-1">
        <LayoutGrid className="w-4 h-4 text-dash-secondary" />
        <h3 className="text-sm font-semibold tracking-wide text-dash-primary flex items-center gap-2">
           目标追踪 <span className="font-mono text-[10px] tracking-widest text-dash-tertiary uppercase mt-0.5">Goal Tracker</span>
        </h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {goals.map((g, idx) => {
          const Icon = g.icon;
          const pct = Math.min(Math.round((g.index || 0) * 100), 100);
          return (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25, delay: idx * 0.1 }}
              className="arbitra-panel arbitra-panel-subtle p-4 relative overflow-hidden group shadow-sm rounded-xl border-dash-subtle flex flex-col"
            >
              <div className="flex flex-col mb-3">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-8 h-8 rounded-lg border border-dash-primary/20 bg-dash-surface flex items-center justify-center shrink-0">
                     <Icon className="w-4 h-4 text-dash-secondary" />
                   </div>
                </div>
                <h4 className="text-[13px] font-medium text-dash-primary leading-tight">{g.name}</h4>
              </div>
              
              <div className="mb-4">
                <div className="text-[18px] font-mono font-medium text-dash-success mb-1 tracking-tight">
                  {pct}%
                </div>
                <div className="w-full h-1 bg-dash-surface-hover rounded-full overflow-hidden border border-dash-subtle/50">
                   <div className="h-full bg-dash-success rounded-full" style={{ width: `${pct}%` }}></div>
                </div>
              </div>

              <div className="flex flex-col gap-1 text-[11px] font-mono mt-auto">
                 <div className="flex justify-between items-center text-dash-tertiary">
                   <span>目标</span>
                   <span className="text-dash-secondary tracking-normal ml-1">{globalCurSymbol}{g.target.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center text-dash-tertiary">
                   <span>已存</span>
                   <span className="text-dash-secondary tracking-normal ml-1">{globalCurSymbol}{g.current.toLocaleString()}</span>
                 </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  );
}
