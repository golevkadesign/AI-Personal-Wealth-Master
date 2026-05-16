import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldAlert, Database, Cpu, Sliders, FileCode, Save } from 'lucide-react';
import { getSettings, saveSettings, AppSettings } from '../lib/settings';

interface DeveloperViewProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
  onClearData?: () => void;
}

export function DeveloperView({ isOpen, onClose, user, onClearData }: DeveloperViewProps) {
  const [activeTab, setActiveTab] = useState<'memory' | 'routing' | 'moats' | 'prompts'>('memory');
  const [settings, setSettings] = useState<AppSettings>(getSettings());

  useEffect(() => {
    if (isOpen) {
      setSettings(getSettings());
    }
  }, [isOpen]);

  const handleSave = () => {
    saveSettings(settings);
    alert("智能体配置已成功注入运行时生态！");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[600px] max-w-full bg-dash-bg border-l border-dash-subtle z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
       {/* 顶部危险重置层 */}
       <div className="p-4 border-b border-dash-subtle bg-black/20 flex justify-between items-center">
         <button onClick={onClearData} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
           <ShieldAlert className="w-3.5 h-3.5" /> 彻底清空资料与状态记录
         </button>
         <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
       </div>

       {/* 主体双轴工作舱 */}
       <div className="flex-1 flex overflow-hidden">
         {/* 左侧垂直 Tab 导航轴 */}
         <div className="w-16 border-r border-dash-subtle flex flex-col gap-4 py-6 items-center bg-black/10">
           {[
             { id: 'memory', icon: Database, label: '记忆' },
             { id: 'routing', icon: Cpu, label: '分流' },
             { id: 'moats', icon: Sliders, label: '红线' },
             { id: 'prompts', icon: FileCode, label: '提示' }
           ].map(t => {
             const Icon = t.icon;
             const isSel = activeTab === t.id;
             return (
               <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`p-3 rounded-xl transition-colors relative group ${isSel ? 'bg-dash-primary/10 text-dash-primary' : 'text-slate-400 hover:text-white'}`}>
                 <Icon className="w-5 h-5" />
                 <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">{t.label}</span>
               </button>
             );
           })}
         </div>

         {/* 右侧动态配置流 */}
         <div className="flex-1 p-6 overflow-y-auto space-y-6 text-[13px]">
           {activeTab === 'memory' && (
             <div className="space-y-4">
               <h3 className="text-sm font-bold text-white uppercase tracking-wider">长线 RAG 记忆快照</h3>
               <pre className="bg-black/30 border border-dash-subtle rounded-xl p-4 font-mono text-xs text-slate-400 overflow-x-auto max-h-[400px]">
                 {JSON.stringify(user, null, 2)}
               </pre>
               <p className="text-xs text-slate-500 italic">💡 提示：此分类已预留，下一步我们将在此部署非离线式物理记忆动态表单卡片。</p>
             </div>
           )}

           {activeTab === 'routing' && (
             <div className="space-y-4">
               <h3 className="text-sm font-bold text-white uppercase tracking-wider">分布式模型分流网关</h3>
               <div className="space-y-3">
                 <div>
                   <label className="block text-slate-400 mb-1.5 font-medium">1. Intent Gateway (意图拦截节点)</label>
                   <input className="w-full bg-dash-surface border border-dash-subtle rounded-xl p-3 text-white focus:outline-none focus:border-dash-primary" value={settings.intentModel || ''} onChange={e => setSettings({...settings, intentModel: e.target.value})} />
                 </div>
                 <div>
                   <label className="block text-slate-400 mb-1.5 font-medium">2. Orchestrator CEO (核心决策节点)</label>
                   <input className="w-full bg-dash-surface border border-dash-subtle rounded-xl p-3 text-white focus:outline-none focus:border-dash-primary" value={settings.orchestratorModel || ''} onChange={e => setSettings({...settings, orchestratorModel: e.target.value})} />
                 </div>
                 <div>
                   <label className="block text-slate-400 mb-1.5 font-medium">3. Sentinel Daemon (后台被动巡检) </label>
                   <input className="w-full bg-dash-surface border border-dash-subtle rounded-xl p-3 text-white focus:outline-none focus:border-dash-primary" value={settings.sentinelModel || ''} onChange={e => setSettings({...settings, sentinelModel: e.target.value})} />
                 </div>
               </div>
             </div>
           )}

           {activeTab === 'moats' && (
             <div className="space-y-4">
               <h3 className="text-sm font-bold text-white uppercase tracking-wider">核心流控参数与量化红线约束</h3>
               <div className="space-y-4 bg-dash-surface border border-dash-subtle rounded-xl p-4">
                 <div>
                   <div className="flex justify-between text-slate-400 mb-1.5 font-medium">
                     <span>📡 前端数据脉冲上报频率 (Heartbeat)</span>
                     <span className="text-dash-primary font-mono">{settings.heartbeatInterval || 180} 秒</span>
                   </div>
                   <input type="range" min="60" max="600" step="10" className="w-full accent-dash-primary" value={settings.heartbeatInterval || 180} onChange={e => setSettings({...settings, heartbeatInterval: parseInt(e.target.value)})} />
                 </div>
                 <div>
                   <div className="flex justify-between text-slate-400 mb-1.5 font-medium">
                     <span>🛑 后端守护巡检触发冷却 (Cooldown)</span>
                     <span className="text-dash-primary font-mono">{settings.sentinelCooldown || 60} 分钟</span>
                   </div>
                   <input type="range" min="1" max="240" step="5" className="w-full accent-dash-primary" value={settings.sentinelCooldown || 60} onChange={e => setSettings({...settings, sentinelCooldown: parseInt(e.target.value)})} />
                 </div>
                 <div className="border-t border-dash-subtle pt-3">
                   <div className="flex justify-between text-slate-400 mb-1.5 font-medium">
                     <span>🍷 确定性财务安全垫垫高 (Liquidity Cushion)</span>
                     <span className="text-dash-primary font-mono">{settings.liquidityBufferMonths || 6} 个月开支</span>
                   </div>
                   <input type="range" min="1" max="24" className="w-full accent-dash-primary" value={settings.liquidityBufferMonths || 6} onChange={e => setSettings({...settings, liquidityBufferMonths: parseInt(e.target.value)})} />
                 </div>
                 <div>
                   <div className="flex justify-between text-slate-400 mb-1.5 font-medium">
                     <span>⚠️ 战略负债率熔断警戒线 (Strategic Debt Line)</span>
                     <span className="text-dash-primary font-mono">{settings.strategicDebtThreshold || 40}%</span>
                   </div>
                   <input type="range" min="10" max="90" className="w-full accent-dash-primary" value={settings.strategicDebtThreshold || 40} onChange={e => setSettings({...settings, strategicDebtThreshold: parseInt(e.target.value)})} />
                 </div>
               </div>
             </div>
           )}

           {activeTab === 'prompts' && (
             <div className="space-y-4 h-full flex flex-col">
               <h3 className="text-sm font-bold text-white uppercase tracking-wider">Orchestrator System Prompt 覆盖工坊</h3>
               <textarea className="w-full flex-1 min-h-[350px] bg-dash-surface border border-dash-subtle rounded-xl p-3 font-mono text-xs text-slate-300 focus:outline-none focus:border-dash-primary resize-none leading-relaxed" value={settings.agentPrompts?.orchestrator || ''} onChange={e => setSettings({ ...settings, agentPrompts: { ...settings.agentPrompts, orchestrator: e.target.value } })} placeholder="在这里覆盖默认的系统级全局 Synthesizer 编排指令..." />
             </div>
           )}
         </div>
       </div>

       {/* 底部保存执行闸 */}
       <div className="p-4 border-t border-dash-subtle bg-black/10 flex justify-end">
         <button onClick={handleSave} className="px-5 py-2.5 bg-dash-primary hover:bg-white text-black rounded-xl font-bold flex items-center gap-2 shadow-md tracking-wide cursor-pointer transition-colors">
           <Save className="w-4 h-4" /> 应用并写入智能体运行时
         </button>
       </div>
    </div>
  );
}

