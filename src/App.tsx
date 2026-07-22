import { getSettings, saveSettings, AppSettings } from './lib/settings';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getCurrencySymbol } from './components/chart-configs';
import { Card } from './components/Card';
import { loginWithGoogle, logout, db } from './lib/firebase';
import { motion } from 'motion/react';
import { useTerminalSync } from './hooks/useTerminalSync';
import { useWealthStore, EMPTY_STATE, EMPTY_STATE_TEXT } from './hooks/useWealthStore';
import { useStrategyStream } from './hooks/useStrategyStream';
import { useSentinel } from './hooks/useSentinel';
import { useInteractionStore } from './hooks/useInteractionStore';
import { useTranslation } from './hooks/useTranslation';


import { AuthTerminalLayout } from './layouts/AuthTerminalLayout';

import Markdown from 'react-markdown';
import { ChartWidget } from './components/ChartWidget';
import { TerminalHeader } from './components/TerminalHeader';
import { LifeStrategyTimeline } from './components/LifeStrategyTimeline';
import { GoalTracker } from './components/GoalTracker';
import { DashboardGrid } from './components/DashboardGrid';

import { ComponentRegistry, SDUIRenderer } from './lib/sdui-registry';
import {
  createDashboardBriefWorkbenchSession,
  createHoldingWorkbenchSession,
  createManualChatWorkbenchSession,
  createProfileMemoryWorkbenchSession,
  createPortfolioReviewWorkbenchSession,
} from './lib/workbench-session';

import { useSDUIEventStore } from './hooks/useSDUIEventStore';
import { MaterialIcon } from './components/ui/MaterialIcon';
import { isKnownI18nText } from './i18n/translations';

const SettingsModal = React.lazy(() => import('./components/SettingsModal').then((module) => ({ default: module.SettingsModal })));
const DeveloperView = React.lazy(() => import('./components/DeveloperView').then((module) => ({ default: module.DeveloperView })));
const ProfileReportView = React.lazy(() => import('./components/ProfileReportView').then((module) => ({ default: module.ProfileReportView })));
const AgentWorkbenchHost = React.lazy(() => import('./components/AgentWorkbenchHost').then((module) => ({ default: module.AgentWorkbenchHost })));

export interface Attachment {
  mimeType: string;
  data: string;
  name: string;
  url?: string;
  isTruncated?: boolean;
}

const formatMoney = (val: number | undefined | null, curr: string = '¥') =>
  val == null ? '-' : `${curr}${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const WORKBENCH_STATUS_LABEL_KEYS: Record<string, string> = {
  awaiting_context: 'workbench.awaitingContext',
  waiting_signals: 'workbench.waitingSignals',
  ready: 'workbench.ready',
  partial: 'workbench.partial',
  blocked: 'workbench.blocked',
  error: 'workbench.error',
};


export default function App() {
  const { user, loadingAuth } = useTerminalSync();
  const { t } = useTranslation();
  const globalCurrencyOption = useWealthStore(state => state.data.distributions?.liquidity?.[0]?.currency || 'CNY');
  const globalCurSymbol = getCurrencySymbol(globalCurrencyOption);
  const insights = useWealthStore(state => state.data.insights);
  const userPersona = useWealthStore(state => state.data.userPersona);
  const dashboardProjection = useWealthStore(state => state.data.dashboardProjection);
  const sovereignProfileProjection = useWealthStore(state => state.data.sovereignProfileProjection);
  const { nodePlans, executePlan, clearNodePlans } = useStrategyStream();
  const { openWidgetWorkbench, openWorkbench } = useInteractionStore();
  const activeDashboardProjection = useInteractionStore(state => state.activeWorkbenchSession?.dashboardProjection);
  const hasActiveWorkbenchSession = useInteractionStore(state => Boolean(state.activeWorkbenchSession));

  useSentinel(); // Update useSentinel next.

  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [showDeveloperView, setShowDeveloperView] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileReport, setShowProfileReport] = useState(false);
  const returnToWorkbenchAfterProfileRef = useRef(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const lastEvent = useSDUIEventStore(state => state.lastEvent);
  const clearEvent = useSDUIEventStore(state => state.clearEvent);

  useEffect(() => {
    const handleOpenReview = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.sessionId) {
        useWealthStore.getState().setActivePortfolioReviewSession(customEvent.detail.sessionId);
      }
      openWorkbench(createPortfolioReviewWorkbenchSession({
        sessionId: customEvent.detail?.sessionId,
        accountPortfolios: useWealthStore.getState().data.publicHoldingAccounts,
        terminalState: useWealthStore.getState().data,
      }));
    };
    window.addEventListener('open-portfolio-review', handleOpenReview);
    return () => {
      window.removeEventListener('open-portfolio-review', handleOpenReview);
    };
  }, [openWorkbench]);

  useEffect(() => {
    const handleOpenProfileReport = () => {
      const interactionState = useInteractionStore.getState();
      const activeSession = interactionState.activeWorkbenchSession;
      returnToWorkbenchAfterProfileRef.current = interactionState.isWorkbenchOpen;
      if (activeSession?.entryType !== 'profile_memory') {
        interactionState.openWorkbench(createProfileMemoryWorkbenchSession(useWealthStore.getState().data));
      }
      useInteractionStore.getState().closeWorkbench();
      setShowProfileReport(true);
    };
    window.addEventListener('open-profile-report', handleOpenProfileReport);
    return () => {
      window.removeEventListener('open-profile-report', handleOpenProfileReport);
    };
  }, [openWorkbench]);

  const handleCloseProfileReport = useCallback(() => {
    setShowProfileReport(false);
    if (returnToWorkbenchAfterProfileRef.current) {
      const interactionState = useInteractionStore.getState();
      if (interactionState.activeWorkbenchSession) {
        interactionState.openWorkbench(interactionState.activeWorkbenchSession);
      }
    }
    returnToWorkbenchAfterProfileRef.current = false;
  }, []);

  useEffect(() => {
    if (lastEvent?.type === 'CHART_CLICK' && lastEvent.payload) {
      const params = lastEvent.payload;
      const holdings = useWealthStore.getState().data.distributions?.publicHoldings;
      if (holdings && params.name) {
        const hit = holdings.find((h: any) => h.name === params.name || h.symbol === params.name);
        if (hit) {
          useWealthStore.getState().setSelectedHolding(hit);
          openWorkbench(createHoldingWorkbenchSession(hit, useWealthStore.getState().data));
        }
      }
      clearEvent(); // 消费完必须清空
    }
  }, [lastEvent, clearEvent, openWorkbench]);

  const handleAskArbitra = useCallback(() => {
    openWorkbench(createManualChatWorkbenchSession(useWealthStore.getState().data));
  }, [openWorkbench]);

  const handleOpenMemoryWorkbench = useCallback(() => {
    openWorkbench(createProfileMemoryWorkbenchSession(useWealthStore.getState().data));
  }, [openWorkbench]);

  const translateProjectionText = useCallback((value?: string) => {
    if (!value) return '';
    return value.startsWith('workbench.') ? t(value) : value;
  }, [t]);

  const effectiveDashboardProjection = activeDashboardProjection || dashboardProjection;
  const projectionStatus = effectiveDashboardProjection?.status || sovereignProfileProjection?.status;
  const projectionStatusLabel = projectionStatus
    ? t(WORKBENCH_STATUS_LABEL_KEYS[String(projectionStatus)] || String(projectionStatus))
    : '';
  const projectionSourceCount =
    effectiveDashboardProjection?.sourceRefs?.length ||
    (Array.isArray(sovereignProfileProjection?.sourceRefs) ? sovereignProfileProjection.sourceRefs.length : 0);
  const projectionProfileVersion =
    effectiveDashboardProjection?.profileVersion ||
    sovereignProfileProjection?.profileVersion;
  const projectionMemoryCount =
    effectiveDashboardProjection?.memoryCandidateCount ??
    sovereignProfileProjection?.memoryCandidateCount;
  const projectionWidgetCount =
    effectiveDashboardProjection?.widgetCount ??
    sovereignProfileProjection?.widgetCount;
  const projectionDecisionEvent = sovereignProfileProjection?.lastDecisionEvent;
  const cioSummary = translateProjectionText(effectiveDashboardProjection?.cioBrief?.summary);
  const legacyStrategicBrief =
    insights?.global &&
    insights.global !== EMPTY_STATE.insights.global &&
    !isKnownI18nText(insights.global, 'dashboard.strategicFallback')
      ? insights.global
      : '';
  const strategicBriefText = cioSummary || legacyStrategicBrief;

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
    <div className="aw-app-shell min-h-screen font-sans pb-20">
      <React.Suspense fallback={null}>
        {showDeveloperView && (
          <DeveloperView
            isOpen
            onClose={() => setShowDeveloperView(false)}
          />
        )}
      </React.Suspense>

      {/* Top Header */}

      <TerminalHeader 
        user={user}
          setShowDeveloperView={setShowDeveloperView}
          onAskArbitra={handleAskArbitra}
          onOpenMemoryWorkbench={handleOpenMemoryWorkbench}
          setShowSettingsModal={setShowSettingsModal}
        />
      
      <main className="aw-dashboard-main max-w-[1600px] mx-auto px-4 md:px-6">
        {/* Side-by-Side Corporate Brief & Sovereign Persona Grid */}
        <div className="aw-dashboard-hero grid grid-cols-1 lg:grid-cols-12 gap-2 mb-2 mt-0">
          
          {/* AI Strategic Overview (2/3 width) */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="aw-dashboard-module aw-module-primary lg:col-span-8 aw-panel aw-stage-shadow p-4 md:p-5 relative overflow-hidden group flex flex-col"
          >
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
              <div>
                <p className="aw-caption font-mono aw-text-tertiary font-semibold uppercase">
                  {t('dashboard.heroKicker')}
                </p>
                <h2 className="mt-1 aw-title font-semibold aw-text-primary tracking-normal antialiased">
                  {t('dashboard.heroTitle')}
                </h2>
              </div>
              
              <button
                 className="aw-button aw-button-ghost z-20 cursor-pointer self-start sm:self-auto"
                 onClick={() => openWidgetWorkbench(
                   t('dashboard.strategicBrief'),
                   strategicBriefText || insights?.global,
                   t('dashboard.chiefMacroStrategist'),
                   createDashboardBriefWorkbenchSession({
                     insight: strategicBriefText || insights?.global,
                     role: t('dashboard.chiefMacroStrategist'),
                     terminalState: useWealthStore.getState().data,
                   })
                 )}
              >
                 <MaterialIcon name="support_agent" size={16} /> {t('dashboard.expertReview')}
              </button>
            </div>
            
            <div className="relative z-10 aw-body aw-text-secondary max-w-none">
               {strategicBriefText ? (
                 <p className="whitespace-pre-wrap leading-relaxed">{strategicBriefText}</p>
               ) : (
                 <p className="aw-text-tertiary italic">{t('dashboard.strategicFallback')}</p>
               )}
            </div>

            <div className="relative z-10 mt-auto grid gap-3 pt-5 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.6fr)] md:items-end">
              <div className="aw-projection-ledger" aria-label={t('dashboard.projectionReadiness')}>
                <div className="aw-projection-ledger-item">
                  <MaterialIcon name="database" size={20} />
                  <span>{t('dashboard.projectionSources')}</span>
                  <strong>{projectionSourceCount > 0 ? projectionSourceCount : '—'}</strong>
                </div>
                <div className="aw-projection-ledger-item">
                  <MaterialIcon name="person_book" size={20} />
                  <span>{t('dashboard.projectionProfile')}</span>
                  <strong>{projectionProfileVersion ? `v${String(projectionProfileVersion)}` : '—'}</strong>
                </div>
                <div className="aw-projection-ledger-item">
                  <MaterialIcon name="inbox" size={20} />
                  <span>{t('dashboard.projectionMemory')}</span>
                  <strong>{typeof projectionMemoryCount === 'number' ? projectionMemoryCount : '—'}</strong>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {projectionStatusLabel && (
                  <span className="aw-status-pill font-mono uppercase">
                    <MaterialIcon name="auto_graph" size={16} />
                    {t('dashboard.projectionStatus')}: {projectionStatusLabel}
                  </span>
                )}
                {projectionSourceCount > 0 && (
                  <span className="aw-status-pill font-mono uppercase">
                    <MaterialIcon name="database" size={16} />
                    {projectionSourceCount} {t('dashboard.projectionSources')}
                  </span>
                )}
                {projectionDecisionEvent && (
                  <span className="aw-status-pill font-mono uppercase">
                    <MaterialIcon name="published_with_changes" size={16} />
                    {t('dashboard.profileVersionChange')} v{projectionDecisionEvent.profileVersionBefore} → v{projectionDecisionEvent.profileVersionAfter}
                  </span>
                )}
                <span className="aw-status-pill font-mono uppercase">{t('dashboard.aiSynthesized')}</span>
                <span className="aw-status-pill font-mono uppercase">{t('dashboard.multimodalContext')}</span>
                <span className="aw-status-pill font-mono uppercase">{t('dashboard.sovereignLayer')}</span>
              </div>
            </div>
          </motion.div>

          {/* User Sovereign Persona (1/3 width) */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.1 }}
            className="aw-dashboard-module aw-module-status lg:col-span-4 aw-panel aw-stage-shadow p-4 md:p-5 relative overflow-hidden group flex flex-col justify-between"
          >
            <div>
              <div className="relative z-10 flex items-center gap-3 mb-4">
                <div className="aw-panel-muted w-10 h-10 flex items-center justify-center select-none">
                  <MaterialIcon name="psychology" size={20} className="aw-text-secondary" />
                </div>
                <div>
                  <span className="aw-caption font-mono aw-text-tertiary font-semibold uppercase block leading-none">
                    {t('dashboard.sovereignRecord')}
                  </span>
                  <span className="aw-body font-semibold aw-text-primary tracking-normal">
                    {t('dashboard.persona')}
                  </span>
                </div>
              </div>

              <div className="relative z-10 aw-body aw-text-secondary mb-4 max-h-[96px] overflow-y-auto custom-scroll">
                {userPersona?.description &&
                userPersona.description !== EMPTY_STATE_TEXT.userPersonaDescription &&
                !isKnownI18nText(userPersona.description, 'dashboard.personaFallback') ? (
                  <p>{userPersona.description}</p>
                ) : (
                  <p className="aw-text-tertiary italic">{t('dashboard.personaFallback')}</p>
                )}
              </div>

              <div className="relative z-10 mb-4 aw-persona-facts" aria-label={t('dashboard.profileSignals')}>
                <div>
                  <span>{t('dashboard.profileSignals')}</span>
                  <strong>{userPersona?.tags?.length || '—'}</strong>
                </div>
                <div>
                  <span>{t('dashboard.projectionMemory')}</span>
                  <strong>{typeof projectionMemoryCount === 'number' ? projectionMemoryCount : '—'}</strong>
                </div>
                <div>
                  <span>{t('dashboard.projectionProfile')}</span>
                  <strong>{projectionProfileVersion ? `v${String(projectionProfileVersion)}` : '—'}</strong>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex flex-wrap gap-1.5 mt-auto">
              {userPersona?.tags && userPersona.tags.length > 0 ? (
                userPersona.tags.map((tag: string, idx: number) => (
                   <span key={idx} className="aw-status-pill font-mono font-semibold">
                     {tag}
                   </span>
                ))
              ) : (
                <>
                  <span className="aw-status-pill font-mono opacity-60">{t('dashboard.lackingContext')}</span>
                  <span className="aw-status-pill font-mono opacity-60">{t('dashboard.awaitingSignals')}</span>
                </>
              )}
              {projectionProfileVersion && (
                <span className="aw-status-pill font-mono">
                  {t('dashboard.projectionProfile')} v{String(projectionProfileVersion)}
                </span>
              )}
              {typeof projectionMemoryCount === 'number' && projectionMemoryCount > 0 && (
                <span className="aw-status-pill font-mono">
                  {projectionMemoryCount} {t('dashboard.projectionMemory')}
                </span>
              )}
              {typeof projectionWidgetCount === 'number' && projectionWidgetCount > 0 && (
                <span className="aw-status-pill font-mono">
                  {projectionWidgetCount} {t('dashboard.projectionWidgets')}
                </span>
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
        <span className="aw-caption font-mono aw-text-tertiary uppercase opacity-50">
          {t('dashboard.buildLabel')} v1.0.3
        </span>
      </footer>

      {/* Confirm Clear Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[998] flex justify-center items-center p-4 lg:justify-end lg:items-end lg:p-8">
          {/* Subtle backdrop just for this modal on top of anything else */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-none pointer-events-none"></div>
          
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="aw-panel w-full max-w-[380px] overflow-hidden relative p-6 z-[999] ring-1 ring-white/5">
            <div className="flex items-start gap-4">
              <div className="aw-chart-state-icon shrink-0">
                 <MaterialIcon name="warning" size={20} filled className="text-aw-danger" />
              </div>
              <div className="flex-1">
                <h3 className="aw-label font-semibold aw-text-primary mb-2 tracking-normal">
                   {t('settings.resetWorkspaceTitle')}
                </h3>
                <p className="aw-body aw-text-secondary mb-6">
                   {t('settings.resetWorkspaceConfirmDesc')}
                </p>
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearing}
                    className="aw-button aw-button-ghost disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('settings.cancel')}
                  </button>
                  <button 
                    onClick={confirmClearData}
                    disabled={isClearing}
                    className="aw-button border border-aw-border-subtle bg-aw-surface-3 text-aw-danger disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClearing ? t('settings.resetting') : t('settings.confirmReset')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <React.Suspense fallback={null}>
        {showSettingsModal && (
          <SettingsModal isOpen onClose={() => setShowSettingsModal(false)} onClearData={handleClearDataClick} />
        )}
        {showProfileReport && (
          <ProfileReportView isOpen onClose={handleCloseProfileReport} />
        )}
        {hasActiveWorkbenchSession && <AgentWorkbenchHost />}
      </React.Suspense>
    </div>
  );
}
