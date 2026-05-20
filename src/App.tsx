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


// Replaced by getUniversalAiClient

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
  }, [lastEvent, data.distributions?.publicHoldings, clearEvent]);

  const donutOption = useMemo(() => getDonutOption(data), [data?.distributions?.liquidity]);

  const expenseOption = useMemo(() => getExpenseOption(data), [data?.distributions?.expenses]);

  const waterfallOption = useMemo(() => getWaterfallOption(data), [data?.distributions?.privateAssets]);

  const holdingsOption = useMemo(() => getHoldingsOption(data), [data?.distributions?.publicHoldings]);

  const optionsOption = useMemo(() => getOptionsOption(data), [data?.distributions?.options]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="arbitra-panel border-dash-subtle rounded-2xl p-8 max-w-sm w-full flex flex-col items-center justify-center text-center shadow-2xl backdrop-blur-md">
          <div className="w-12 h-12 rounded-[12px] bg-surface flex items-center justify-center mb-6 border border-dash-subtle shadow-inner">
            <div className="w-5 h-5 rounded-full border-2 border-dash-primary/30 border-t-dash-primary animate-spin" />
          </div>
          <p className="arbitra-text-mono text-[10px] tracking-[0.2em] arbitra-text-tertiary uppercase mb-2">系统状态</p>
          <h2 className="text-sm font-medium arbitra-text-primary mb-2">正在初始化安全财富上下文...</h2>
          <p className="text-xs arbitra-text-secondary">正在同步加密画像与工作区</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dash-bg relative overflow-hidden px-4">
         <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ type: "spring", stiffness: 400, damping: 25 }}
           className="bg-dash-surface border border-dash-subtle rounded-[32px] p-8 sm:p-12 max-w-md w-full text-center shadow-lg backdrop-blur-xl"
         >
            <div className="bg-dash-base w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-dash-subtle shadow-inner">
              <div className="w-10 h-10 rounded-full bg-dash-primary shadow-[0_0_20px_rgba(255,255,255,0.4)]" />
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-sans tracking-tight font-medium text-dash-primary mb-3">Arbitra <span className="text-dash-tertiary">Terminal</span></h1>
            <p className="text-dash-secondary mb-10 text-[11px] leading-relaxed uppercase tracking-widest font-semibold">Secure Authentication Required</p>
            
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={loginWithGoogle}
              className="w-full py-4 px-6 bg-dash-primary text-dash-base rounded-[20px] font-bold flex items-center justify-center gap-3 transition-colors hover:bg-white border border-transparent shadow-sm"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 bg-white rounded-full p-0.5" />
              Continue with Google
            </motion.button>
         </motion.div>
      </div>
    )
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
    <SDUIRenderer key={keyPrefix} schema={schema} globalData={globalData} />
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
      {/* 核心数据网格视图 */}
      <DashboardGrid 
        data={data}
        renderSDUI={renderSDUI}
      />

      {/* Bottom Planning Section */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-10 mb-10">
        <div className="xl:col-span-7 2xl:col-span-8 flex">
          {/* 阶段性人生策略建议 (Life Strategies Timeline) */}
          <LifeStrategyTimeline 
             lifeStrategiesShort={data.lifeStrategiesShort}
             lifeStrategiesLong={data.lifeStrategiesLong}
             nodePlans={nodePlans}
             handleInlineNodePlan={handleInlineNodePlan}
          />
        </div>
        <div className="xl:col-span-5 2xl:col-span-4 flex">
          {/* 底部目标追踪卡片 (Goal Tracker) */}
          <GoalTracker goal={data.goal} globalCurSymbol={globalCurSymbol} />
        </div>
      </div>
      </main>

      {/* Footer Version */}
      <footer className="text-center pb-8 pt-4">
        <span className="text-[10px] font-mono text-dash-tertiary uppercase tracking-widest opacity-50">
          Terminal Build v1.0.3
        </span>
      </footer>

      {/* Confirm Clear Modal */}
      {showClearConfirm && (
        <div className="arbitra-overlay-backdrop z-[998] flex justify-center items-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="arbitra-modal-panel border border-dash-red/30 shadow-[0_24px_80px_-40px_rgba(211,76,76,0.3)] rounded-[20px] w-full max-w-md overflow-hidden relative p-6 sm:p-8 z-[999]">
            <div className="w-12 h-12 rounded-[12px] bg-rose-500/10 flex items-center justify-center mb-5 border border-rose-500/20 shadow-inner">
               <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>
            <h3 className="text-lg font-medium arbitra-text-primary mb-2 flex items-center gap-2">
               重置工作区
            </h3>
            <p className="arbitra-text-secondary mb-8 text-sm leading-relaxed">
               此操作将永久擦除当前用户的所有 AI 分析历史和工作区产物。此操作无法撤销。是否继续？
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 arbitra-btn-base arbitra-btn-ghost arbitra-focus-ring text-sm"
              >
                取消
              </button>
              <button 
                onClick={confirmClearData}
                className="flex-1 arbitra-btn-base arbitra-btn-primary !bg-rose-500/20 !text-rose-500 !border-rose-500/30 hover:!bg-rose-600 hover:!text-white arbitra-focus-ring text-sm transition-all"
              >
                确认重置
              </button>
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
