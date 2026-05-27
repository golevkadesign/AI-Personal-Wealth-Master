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
import { useTerminalSync } from './hooks/useTerminalSync';
import { useWealthStore, EMPTY_STATE } from './hooks/useWealthStore';
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
import { PortfolioReviewDrawer } from './components/PortfolioReviewDrawer';
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
  const { user, loadingAuth } = useTerminalSync();
  const globalCurrencyOption = useWealthStore(state => state.data.distributions?.liquidity?.[0]?.currency || 'CNY');
  const globalCurSymbol = getCurrencySymbol(globalCurrencyOption);
  const insights = useWealthStore(state => state.data.insights);
  const userPersona = useWealthStore(state => state.data.userPersona);
  const selectedHolding = useWealthStore(state => state.selectedHolding);
  const setSelectedHolding = useWealthStore(state => state.setSelectedHolding);
  const { nodePlans, executePlan, clearNodePlans } = useStrategyStream();
  const { isDrawerOpen, setDrawerOpen, copilotConfig, closeCopilot, openCopilot, openDrawerWithIntent } = useInteractionStore();

  useSentinel(); // Update useSentinel next.

  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [showDeveloperView, setShowDeveloperView] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileReport, setShowProfileReport] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showPortfolioReviewDrawer, setShowPortfolioReviewDrawer] = useState(false);

  const lastEvent = useSDUIEventStore(state => state.lastEvent);
  const clearEvent = useSDUIEventStore(state => state.clearEvent);

  useEffect(() => {
    const handleOpenReview = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.sessionId) {
        useWealthStore.getState().setActivePortfolioReviewSession(customEvent.detail.sessionId);
      }
      setShowPortfolioReviewDrawer(true);
    };
    window.addEventListener('open-portfolio-review', handleOpenReview);
    return () => {
      window.removeEventListener('open-portfolio-review', handleOpenReview);
    };
  }, []);

  useEffect(() => {
    if (lastEvent?.type === 'CHART_CLICK' && lastEvent.payload) {
      const params = lastEvent.payload;
      const holdings = useWealthStore.getState().data.distributions?.publicHoldings;
      if (holdings && params.name) {
        const hit = holdings.find((h: any) => h.name === params.name || h.symbol === params.name);
        if (hit) useWealthStore.getState().setSelectedHolding(hit);
      }
      clearEvent(); // 消费完必须清空
    }
  }, [lastEvent, clearEvent]);

  if (loadingAuth || !user) {
    return <AuthTerminalLayout loadingAuth={loadingAuth} />;
  }

  const handleInlineNodePlan = async (typeStr: string, item: any, isLong: boolean, idx: number) => { return executePlan(typeStr, item, isLong, idx); };

  const handleClearDataClick = () => {
    setShowClearConfirm(true);
  };

  const confirmClearData = async () => {
    if (user?.uid) {
      setIsClearing(true);
      
      try {
        // Await background deletion to ensure it's removed from Firebase before reload
        const { deleteDoc, doc } = await import('firebase/firestore');
        const { db, handleFirestoreError, OperationType } = await import('./lib/firebase');
        try {
          // Add a 3 second timeout in case of offline/network issues
          const deletePromise = deleteDoc(doc(db, "userProfiles", user.uid));
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
          await Promise.race([deletePromise, timeoutPromise]);
        } catch (e: any) {
          if (e.message !== 'timeout') {
            handleFirestoreError(e, OperationType.DELETE, `userProfiles/${user.uid}`);
          }
        }
      } catch (e) {
         console.error("Failed to delete user profile:", e);
      }

      // Synchronous local state wipe
      localStorage.removeItem(`ai_terminal_chat_${user.uid}`);
      
      useWealthStore.getState().clearData();
      
      // Give full feedback and a completely initialized state by reloading the app
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen text-dash-textMain font-sans bg-dash-bg pb-20">
      <DeveloperView 
        isOpen={showDeveloperView} 
        onClose={() => setShowDeveloperView(false)} 
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
                 onClick={() => openCopilot('战略简报', insights?.global, '首席宏观策略师')}
              >
                 <Bot className="w-3.5 h-3.5" /> 专家探讨
              </button>
            </div>
            
            <div className="relative z-10 text-[13px] sm:text-sm leading-relaxed text-dash-secondary max-w-none">
               {insights?.global ? (
                 <p className="whitespace-pre-wrap leading-relaxed">{insights?.global}</p>
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
                {userPersona?.description && !userPersona.description.includes("当前信息不足以") ? (
                  <p>{userPersona.description}</p>
                ) : (
                  <p className="text-dash-tertiary italic">正在动态量化对标持有持平期、资产变现阻尼、杠杆比例以及家族基金长期信托倾角...</p>
                )}
              </div>
            </div>

            <div className="relative z-10 flex flex-wrap gap-1.5 mt-auto">
              {userPersona?.tags && userPersona.tags.length > 0 ? (
                userPersona.tags.map((tag: string, idx: number) => (
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
        <DashboardGrid />

        {/* 阶段性人生策略建议 (Life Strategies Timeline) */}
        <LifeStrategyTimeline 
           nodePlans={nodePlans}
           handleInlineNodePlan={handleInlineNodePlan}
        />

        {/* 底部目标追踪卡片 (Goal Tracker) */}
        <GoalTracker globalCurSymbol={globalCurSymbol} />
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
                   此操作将永久擦除当前用户的资产状态、聊天历史、AI 分析缓存、画像数据和工作区产物，但会保留 AI API Key 与券商账户 API Key。如需删除 Key，请在设置表单中手动清空。此操作无法撤销。是否继续？
                </p>
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearing}
                    className="px-4 py-2 text-[12px] font-medium text-[#8C8370] hover:text-white transition-colors rounded-lg hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    取消
                  </button>
                  <button 
                    onClick={confirmClearData}
                    disabled={isClearing}
                    className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 text-[12px] font-bold rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClearing ? '正在重置...' : '确认重置'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} onClearData={handleClearDataClick} />
      <ProfileReportView isOpen={showProfileReport} onClose={() => setShowProfileReport(false)} />
      <WidgetCopilot 
        isOpen={copilotConfig.isOpen}
        onClose={closeCopilot}
        widgetTitle={copilotConfig.title}
        widgetData={copilotConfig.data}
        expertRole={copilotConfig.role}
        onPromoteIntent={openDrawerWithIntent}
      />

      <Drawer 
        isDrawerOpen={isDrawerOpen} 
        setIsDrawerOpen={setDrawerOpen} 
        user={user} 
        setIsSynthesizing={setIsSynthesizing}
      />

      <PositionIntelligenceDrawer 
        isOpen={!!selectedHolding} 
        holding={selectedHolding} 
        onClose={() => setSelectedHolding(null)} 
      />

      <PortfolioReviewDrawer 
        isOpen={showPortfolioReviewDrawer} 
        onClose={() => setShowPortfolioReviewDrawer(false)} 
      />
    </div>
  );
}
