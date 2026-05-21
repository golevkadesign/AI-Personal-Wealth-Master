import { getSettings, saveSettings, AppSettings } from './lib/settings';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getDonutOption, getExpenseOption, getWaterfallOption, getHoldingsOption, getOptionsOption, getCurrencySymbol } from './components/chart-configs';
import { Card } from './components/Card';
import { ReactECharts } from './components/ReactECharts';
import { SettingsModal } from './components/SettingsModal';
import { loginWithGoogle, logout, db } from './lib/firebase';
import { motion } from 'motion/react';
import { DeveloperView } from './components/DeveloperView';
import { Drawer } from './components/Drawer';
import { useTerminalSync, EMPTY_STATE } from './hooks/useTerminalSync';
import { useStrategyStream } from './hooks/useStrategyStream';
import { useSentinel } from './hooks/useSentinel';
import { useInteractionStore } from './hooks/useInteractionStore';


import { AuthTerminalLayout } from './layouts/AuthTerminalLayout';

import { Sparkles, LogOut, ChevronDown, User, Activity, Loader2, RefreshCw, Cpu, Settings, Bot, Database, AlertTriangle } from 'lucide-react';
import Markdown from 'react-markdown';
import { ChartWidget } from './components/ChartWidget';
import { ProfileReportView } from './components/ProfileReportView';
import { WidgetCopilot } from './components/WidgetCopilot';
import { TerminalHeader } from './components/TerminalHeader';
import { LifeStrategyTimeline } from './components/LifeStrategyTimeline';
import { GoalTracker } from './components/GoalTracker';
import { DashboardGrid } from './components/DashboardGrid';

import { PositionIntelligenceDrawer } from './components/PositionIntelligenceDrawer';
import { ComponentRegistry, SDUIRenderer } from './lib/sdui-registry';

import { useSDUIEventStore } from './hooks/useSDUIEventStore';

export interface Attachment {
  mimeType: string;
  data: string;
  name: string;
  url?: string;
  isTruncated?: boolean;
}

const formatMoney = (val: number | undefined | null, curr: string = '¥') =>
  val == null ? '-' : `${curr}${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;


export default function App() {
  const { user, data, loadingAuth, commitData } = useTerminalSync();
  const globalCurrencyOption = data?.distributions?.liquidity?.[0]?.currency || 'CNY';
  const globalCurSymbol = getCurrencySymbol(globalCurrencyOption);
  const { nodePlans, executePlan, clearNodePlans } = useStrategyStream();
  const { isDrawerOpen, setDrawerOpen, copilotConfig, closeCopilot, openCopilot, openDrawerWithIntent } = useInteractionStore();

  useSentinel(data, commitData);

  const [sduiState, setSduiState] = useState<any[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [showDeveloperView, setShowDeveloperView] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileReport, setShowProfileReport] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<any | null>(null);

  const lastEvent = useSDUIEventStore(state => state.lastEvent);
  const clearEvent = useSDUIEventStore(state => state.clearEvent);

  useEffect(() => {
    if (lastEvent?.type === 'CHART_CLICK' && lastEvent.payload) {
      const params = lastEvent.payload;
      if (data.distributions?.publicHoldings && params.name) {
        const hit = data.distributions.publicHoldings.find((h: any) => h.name === params.name || h.symbol === params.name);
        if (hit) setSelectedHolding(hit);
      }
      clearEvent(); // 消费完必须清空
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent, clearEvent]);

  const donutOption = useMemo(() => getDonutOption(data), [data?.distributions?.liquidity]);

  const expenseOption = useMemo(() => getExpenseOption(data), [data?.distributions?.expenses]);

  const waterfallOption = useMemo(() => getWaterfallOption(data), [data?.distributions?.privateAssets]);

  const holdingsOption = useMemo(() => getHoldingsOption(data), [data?.distributions?.publicHoldings]);

  const optionsOption = useMemo(() => getOptionsOption(data), [data?.distributions?.options]);

  if (loadingAuth || !user) {
    return <AuthTerminalLayout loadingAuth={loadingAuth} />;
  }

  const hasPublicInsights = Array.isArray(data.insights?.public) && data.insights.public.length > 0;

  const handleInlineNodePlan = async (typeStr: string, item: any, isLong: boolean, idx: number) => { return executePlan(typeStr, item, isLong, idx); };

  const handleClearDataClick = () => {
    setShowClearConfirm(true);
  };

  const confirmClearData = async () => {
    if (user?.uid) {
      try {
        const { deleteDoc, doc } = await import('firebase/firestore');
        const { db, handleFirestoreError, OperationType } = await import('./lib/firebase');
        try {
          await deleteDoc(doc(db, "userProfiles", user.uid));
        } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, `userProfiles/${user.uid}`);
        }
      } catch (e) {
        console.error("Failed to delete user profile:", e);
      }
      localStorage.removeItem(`ai_terminal_data_${user.uid}`);
      localStorage.removeItem(`ai_terminal_chat_${user.uid}`);
      
      commitData(EMPTY_STATE);
      setSduiState([]);
      clearNodePlans();
      setShowClearConfirm(false);
      window.dispatchEvent(new Event('clear-chat-history'));
    }
  };

  const renderSDUI = (schema: any, globalData: any, keyPrefix: string) => (
    <SDUIRenderer key={keyPrefix} schema={schema} globalData={{ ...globalData, selectedHolding, setSelectedHolding }} />
  );

  return (
    <div className="min-h-screen text-dash-textMain font-sans bg-dash-bg pb-20">
      <DeveloperView 
        isOpen={showDeveloperView} 
        onClose={() => setShowDeveloperView(false)} 
        user={data?.userProfile || {}}
        onClearData={handleClearDataClick}
        onUpdateProfile={(newProfile) => {
          commitData((prev: any) => ({
            ...prev,
            userProfile: newProfile
          }));
        }}
        state={data}
      />

      {/* Top Header */}

      <TerminalHeader 
        user={user}
        setShowProfileReport={setShowProfileReport}
        setShowDeveloperView={setShowDeveloperView}
        setDrawerOpen={setDrawerOpen}
        setShowSettingsModal={setShowSettingsModal}
      />
      
      <main className="max-w-[1600px] mx-auto px-4 md:px-6">
        {/* Side-by-Side Corporate Brief & Sovereign Persona Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 mt-4">
          
          {/* AI Strategic Overview (2/3 width) */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="lg:col-span-2 bg-dash-surface border border-dash-subtle rounded-2xl p-6 relative overflow-hidden group hover:border-[#C9B284]/20 transition-all duration-300"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-dash-primary/5 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4 pb-4 border-b border-dash-subtle/50">
              <div>
                <p className="text-[10px] sm:text-[11px] font-mono tracking-widest text-[#A39167] font-semibold uppercase">
                  ARBITRA 智能战略引擎 AT SYSTEM
                </p>
                <h2 className="mt-1 text-lg sm:text-xl font-bold text-white tracking-tight antialiased">
                  资产时局与全局资产配置战略简报 Strategic Brief
                </h2>
              </div>
              
              <button
                 className="bg-[#202326] hover:bg-[#2B2F33] text-[#C9B284] border border-[#3A3324] rounded-xl px-4 py-1.5 text-xs font-semibold z-20 cursor-pointer flex items-center gap-1.5 transition-colors duration-200"
                 onClick={() => openCopilot('战略简报', data.insights?.global, '首席宏观策略师')}
              >
                 <Bot className="w-3.5 h-3.5" /> 专家探讨
              </button>
            </div>
            
            <div className="relative z-10 text-[13px] sm:text-sm leading-relaxed text-dash-secondary max-w-none">
               {data.insights?.global ? (
                 <p className="whitespace-pre-wrap leading-relaxed">{data.insights?.global}</p>
               ) : (
                 <p className="text-dash-tertiary italic">Arbitra 智能引擎正在动态沉淀高净值画像、多维持有期倾斜以及家庭家族信托长期资产备忘录...</p>
               )}
            </div>

            <div className="relative z-10 mt-6 flex flex-wrap gap-2">
              <span className="bg-[#121415] border border-dash-subtle/40 rounded px-2.5 py-1 text-[10px] font-mono font-semibold text-[#A39167] uppercase">AI-Synthesized</span>
              <span className="bg-[#121415] border border-dash-subtle/40 rounded px-2.5 py-1 text-[10px] font-mono font-semibold text-[#A39167] uppercase">Multimodal Context</span>
              <span className="bg-[#121415] border border-dash-subtle/40 rounded px-2.5 py-1 text-[10px] font-mono font-semibold text-[#A39167] uppercase">Sovereign Layer</span>
            </div>
          </motion.div>

          {/* User Sovereign Persona (1/3 width) */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.1 }}
            className="lg:col-span-1 bg-dash-surface border border-dash-subtle rounded-2xl p-6 relative overflow-hidden group hover:border-[#C9B284]/20 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="relative z-10 flex items-center gap-3 mb-4 pb-4 border-b border-dash-subtle/50">
                <div className="w-10 h-10 rounded-xl bg-[#202326] border border-[#C9B284]/20 text-dash-primary flex items-center justify-center font-mono font-bold text-lg select-none">
                  Ψ
                </div>
                <div>
                  <span className="text-[10px] font-mono tracking-widest text-[#A39167] font-semibold uppercase block leading-none">
                    SOVEREIGN RECORD
                  </span>
                  <span className="text-sm font-bold text-white tracking-tight">
                    专属主权财富画像 Persona
                  </span>
                </div>
              </div>

              <div className="relative z-10 text-[13px] leading-relaxed text-dash-secondary mb-5 max-h-[140px] overflow-y-auto custom-scroll">
                {data.userPersona?.description && !data.userPersona.description.includes("当前信息不足以") ? (
                  <p>{data.userPersona.description}</p>
                ) : (
                  <p className="text-dash-tertiary italic">正在动态量化对标持有持平期、资产变现阻尼、杠杆比例以及家族基金长期信托倾角...</p>
                )}
              </div>
            </div>

            <div className="relative z-10 flex flex-wrap gap-1.5 mt-auto">
              {data.userPersona?.tags && data.userPersona.tags.length > 0 ? (
                data.userPersona.tags.map((tag: string, idx: number) => (
                   <span key={idx} className="bg-[#121415] border border-dash-subtle/50 text-[10px] font-mono font-semibold text-dash-primary px-2.5 py-1 rounded">
                     {tag}
                   </span>
                ))
              ) : (
                <>
                  <span className="bg-[#121415] border border-dash-subtle/30 text-[10px] font-mono text-dash-tertiary px-2 py-0.5 rounded opacity-50">Lacking Context</span>
                  <span className="bg-[#121415] border border-dash-subtle/30 text-[10px] font-mono text-dash-tertiary px-2 py-0.5 rounded opacity-50">Awaiting Signals</span>
                </>
              )}
            </div>
          </motion.div>

        </div>

        {/* 核心数据网格视图 */}
        <DashboardGrid 
          data={data}
          renderSDUI={renderSDUI}
        />

        {/* 阶段性人生策略建议 (Life Strategies Timeline) */}
        <LifeStrategyTimeline 
           lifeStrategiesShort={data.lifeStrategiesShort}
           lifeStrategiesLong={data.lifeStrategiesLong}
           nodePlans={nodePlans}
           handleInlineNodePlan={handleInlineNodePlan}
        />

        {/* 底部目标追踪卡片 (Goal Tracker) */}
        {data.goal?.name && data.goal.name !== '等待设定目标' && (
           <GoalTracker goal={data.goal} globalCurSymbol={globalCurSymbol} />
        )}
      </main>

      {/* Footer Version */}
      <footer className="text-center pb-8 pt-4">
        <span className="text-[10px] font-mono text-dash-tertiary uppercase tracking-widest opacity-50">
          Terminal Build v1.0.3
        </span>
      </footer>

      {/* Confirm Clear Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[998] flex justify-center items-center p-4 lg:justify-end lg:items-end lg:p-8">
          {/* Subtle backdrop just for this modal on top of anything else */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-none pointer-events-none"></div>
          
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="bg-[#120B0B] border border-rose-900/50 shadow-[0_24px_80px_-20px_rgba(159,18,57,0.4)] rounded-2xl w-full max-w-[380px] overflow-hidden relative p-6 z-[999] ring-1 ring-white/5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
                 <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-white mb-2 tracking-wide">
                   重置工作区
                </h3>
                <p className="text-[#8C8370] text-[13px] leading-relaxed mb-6 font-light">
                   此操作将永久擦除当前用户的所有 AI 分析历史和工作区产物。此操作无法撤销。是否继续？
                </p>
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setShowClearConfirm(false)}
                    className="px-4 py-2 text-[12px] font-medium text-[#8C8370] hover:text-white transition-colors rounded-lg hover:bg-white/5"
                  >
                    取消
                  </button>
                  <button 
                    onClick={confirmClearData}
                    className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 text-[12px] font-bold rounded-lg transition-all flex items-center gap-1.5"
                  >
                    确认重置
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
      <ProfileReportView isOpen={showProfileReport} onClose={() => setShowProfileReport(false)} data={data} commitData={commitData} />
      <WidgetCopilot 
        isOpen={copilotConfig.isOpen}
        onClose={closeCopilot}
        widgetTitle={copilotConfig.title}
        widgetData={copilotConfig.data}
        expertRole={copilotConfig.role}
        globalData={data}
        onPromoteIntent={openDrawerWithIntent}
      />

      <Drawer 
        isDrawerOpen={isDrawerOpen} 
        setIsDrawerOpen={setDrawerOpen} 
        user={user} 
        data={data} 
        setSduiState={setSduiState} 
        setIsSynthesizing={setIsSynthesizing}
        commitData={commitData}
      />

      <PositionIntelligenceDrawer 
        isOpen={!!selectedHolding} 
        holding={selectedHolding} 
        onClose={() => setSelectedHolding(null)} 
      />
    </div>
  );
}
