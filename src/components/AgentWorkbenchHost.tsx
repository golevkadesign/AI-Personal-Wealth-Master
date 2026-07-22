import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Attachment } from '../App';
import { useAiAgent } from '../hooks/useAiAgent';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { useTranslation } from '../hooks/useTranslation';
import { useWealthStore } from '../hooks/useWealthStore';
import {
  WorkbenchEvent,
  WorkbenchEntryType,
  WorkbenchRailId,
  WorkbenchSessionSpec,
  WorkbenchWidgetStatus,
} from '../types/workbench';
import {
  getRenderableWorkbenchWidgetSelection,
} from '../lib/workbench-widget-registry';
import {
  attachWorkbenchSessionToLatestAssistantTurn,
  resolveWorkbenchSessionForChatTurn,
} from '../lib/workbench-chat-session';
import { MaterialIcon } from './ui/MaterialIcon';
import { ChatInput, ChatList } from './ui/chat-ui';
import { WorkbenchWidgetRenderer } from './WorkbenchWidgetRenderer';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

type WorkbenchRunStatus = 'idle' | 'running' | 'ready' | 'fallback' | 'error';
type WorkbenchViewScope = 'overview' | WorkbenchRailId;
type WorkbenchConversationSeed = {
  titleKey: string;
  descKey: string;
  contextKey: string;
  promptKeys: string[];
};

const ENTRY_CONVERSATION_SEEDS: Record<WorkbenchEntryType, WorkbenchConversationSeed> = {
  manual_chat: {
    titleKey: 'workbench.conversationSeeds.manual_chat.title',
    descKey: 'workbench.conversationSeeds.manual_chat.desc',
    contextKey: 'workbench.conversationSeeds.manual_chat.context',
    promptKeys: [
      'workbench.conversationSeeds.manual_chat.prompts.threeRails',
      'workbench.conversationSeeds.manual_chat.prompts.missingContext',
      'workbench.conversationSeeds.manual_chat.prompts.memory',
    ],
  },
  dashboard_brief: {
    titleKey: 'workbench.conversationSeeds.dashboard_brief.title',
    descKey: 'workbench.conversationSeeds.dashboard_brief.desc',
    contextKey: 'workbench.conversationSeeds.dashboard_brief.context',
    promptKeys: [
      'workbench.conversationSeeds.dashboard_brief.prompts.decompose',
      'workbench.conversationSeeds.dashboard_brief.prompts.action',
      'workbench.conversationSeeds.dashboard_brief.prompts.evidence',
    ],
  },
  widget: {
    titleKey: 'workbench.conversationSeeds.widget.title',
    descKey: 'workbench.conversationSeeds.widget.desc',
    contextKey: 'workbench.conversationSeeds.widget.context',
    promptKeys: [
      'workbench.conversationSeeds.widget.prompts.explain',
      'workbench.conversationSeeds.widget.prompts.risk',
      'workbench.conversationSeeds.widget.prompts.next',
    ],
  },
  holding: {
    titleKey: 'workbench.conversationSeeds.holding.title',
    descKey: 'workbench.conversationSeeds.holding.desc',
    contextKey: 'workbench.conversationSeeds.holding.context',
    promptKeys: [
      'workbench.conversationSeeds.holding.prompts.intent',
      'workbench.conversationSeeds.holding.prompts.supplyChain',
      'workbench.conversationSeeds.holding.prompts.tilt',
    ],
  },
  portfolio_review: {
    titleKey: 'workbench.conversationSeeds.portfolio_review.title',
    descKey: 'workbench.conversationSeeds.portfolio_review.desc',
    contextKey: 'workbench.conversationSeeds.portfolio_review.context',
    promptKeys: [
      'workbench.conversationSeeds.portfolio_review.prompts.lessons',
      'workbench.conversationSeeds.portfolio_review.prompts.actions',
      'workbench.conversationSeeds.portfolio_review.prompts.memory',
    ],
  },
  life_strategy: {
    titleKey: 'workbench.conversationSeeds.life_strategy.title',
    descKey: 'workbench.conversationSeeds.life_strategy.desc',
    contextKey: 'workbench.conversationSeeds.life_strategy.context',
    promptKeys: [
      'workbench.conversationSeeds.life_strategy.prompts.constraints',
      'workbench.conversationSeeds.life_strategy.prompts.pathway',
      'workbench.conversationSeeds.life_strategy.prompts.profile',
    ],
  },
  profile_memory: {
    titleKey: 'workbench.conversationSeeds.profile_memory.title',
    descKey: 'workbench.conversationSeeds.profile_memory.desc',
    contextKey: 'workbench.conversationSeeds.profile_memory.context',
    promptKeys: [
      'workbench.conversationSeeds.profile_memory.prompts.review',
      'workbench.conversationSeeds.profile_memory.prompts.merge',
      'workbench.conversationSeeds.profile_memory.prompts.refresh',
    ],
  },
  portfolio_intelligence: {
    titleKey: 'workbench.conversationSeeds.portfolio_intelligence.title',
    descKey: 'workbench.conversationSeeds.portfolio_intelligence.desc',
    contextKey: 'workbench.conversationSeeds.portfolio_intelligence.context',
    promptKeys: [
      'workbench.conversationSeeds.portfolio_intelligence.prompts.exposure',
      'workbench.conversationSeeds.portfolio_intelligence.prompts.gaps',
      'workbench.conversationSeeds.portfolio_intelligence.prompts.simulation',
    ],
  },
};

function getStatusLabel(status: WorkbenchWidgetStatus, t: (key: string) => string) {
  if (status === 'ready') return t('workbench.ready');
  if (status === 'partial') return t('workbench.partial');
  if (status === 'blocked') return t('workbench.blocked');
  if (status === 'error') return t('workbench.error');
  if (status === 'waiting_signals') return t('workbench.waitingSignals');
  return t('workbench.awaitingContext');
}

function getSignalTone(status: WorkbenchWidgetStatus) {
  if (status === 'ready') return 'aw-workbench-signal-ready';
  if (status === 'partial') return 'aw-workbench-signal-partial';
  if (status === 'blocked' || status === 'error') return 'aw-workbench-signal-blocked';
  if (status === 'waiting_signals') return 'aw-workbench-signal-waiting';
  return 'aw-workbench-signal-context';
}

function getRunStatusLabel(status: WorkbenchRunStatus, t: (key: string) => string) {
  return t(`workbench.runStatus.${status}`);
}

function getRunStatusTone(status: WorkbenchRunStatus) {
  if (status === 'ready') return 'text-aw-success';
  if (status === 'fallback') return 'text-aw-warning';
  if (status === 'error') return 'text-aw-danger';
  if (status === 'running') return 'text-aw-info';
  return 'aw-text-tertiary';
}

function getEventStatusTone(status: WorkbenchEvent['status']) {
  if (status === 'ready') return 'text-aw-success';
  if (status === 'fallback') return 'text-aw-warning';
  if (status === 'error') return 'text-aw-danger';
  if (status === 'running') return 'text-aw-info';
  if (status === 'pending') return 'aw-text-tertiary';
  return 'aw-text-muted';
}

function getEventStatusIcon(status: WorkbenchEvent['status']) {
  if (status === 'ready') return 'check_circle';
  if (status === 'fallback') return 'offline_bolt';
  if (status === 'error') return 'error';
  if (status === 'running') return 'progress_activity';
  if (status === 'pending') return 'radio_button_unchecked';
  return 'remove_circle_outline';
}

function getConversationSeed(
  session: WorkbenchSessionSpec,
  t: (key: string) => string,
) {
  const seed = ENTRY_CONVERSATION_SEEDS[session.entryType] || ENTRY_CONVERSATION_SEEDS.manual_chat;
  const contextValue = session.subjectSpec?.label || session.subject || t(seed.contextKey);
  return {
    title: t(seed.titleKey),
    description: t(seed.descKey),
    contextLabel: t('workbench.seedContext'),
    contextValue,
    quickPrompts: seed.promptKeys.map((key) => t(key)),
  };
}

function buildWorkbenchAgentContext(session: WorkbenchSessionSpec) {
  const facts = session.facts || {};
  const analysis = facts.selectedHoldingAnalysis;
  const selectedHolding = facts.selectedHolding;
  const widgetSelection = getRenderableWorkbenchWidgetSelection(session);
  const visibleWidgets = widgetSelection.widgets.map((widget) => ({
    id: widget.id,
    type: widget.type,
    status: widget.status,
    railId: widget.railId,
    sourceRefs: widget.sourceRefs,
  }));

  return {
    sessionId: session.id,
    entryType: session.entryType,
    subject: session.subject,
    subjectSpec: session.subjectSpec,
    intentBias: session.intentBias,
    initialPrompt: session.initialPrompt,
    defaultWidgetPreset: session.defaultWidgetPreset,
    legacySurface: session.legacy?.surface,
    allowedActions: session.allowedActions,
    selectedHolding,
    selectedHoldingAnalysis: analysis
      ? {
          symbol: analysis.symbol,
          source: analysis.source,
          fallbackUsed: analysis.fallbackUsed,
          analysisStatus: analysis.analysisStatus,
          historySummary: analysis.historySummary,
          quantSignals: analysis.quantSignals,
          deterministicAdvice: analysis.deterministicAdvice,
          sourceRefs: analysis.sourceRefs,
          diffFromLastSnapshot: analysis.diffFromLastSnapshot,
        }
      : undefined,
    railRun: session.railRun
      ? {
          id: session.railRun.id,
          status: session.railRun.status,
          summary: session.railRun.summary,
          missingFacts: session.railRun.missingFacts,
          rails: session.railRun.railResults.map((rail) => ({
            railId: rail.railId,
            status: rail.status,
            confidence: rail.confidence,
            missingFacts: rail.missingFacts,
            evidenceRefs: rail.evidenceRefs,
          })),
        }
      : undefined,
    facts: {
      confidence: facts.confidence,
      missingFacts: facts.missingFacts,
      sourceRefs: facts.sourceRefs,
      summary: facts.summary,
    },
    widgets: visibleWidgets,
    widgetSelection: {
      phase: widgetSelection.phase,
      reason: widgetSelection.reason,
      selectedTypes: widgetSelection.selectedTypes,
      candidateCount: widgetSelection.candidateCount,
    },
    systemInstruction: session.entryType === 'holding'
      ? 'You are analyzing one selected holding inside Arbitra Workbench. Use selectedHoldingAnalysis.quantSignals, deterministicAdvice, historySummary, sourceRefs, and snapshot diff when available. Do not invent missing indicator values. If analysisStatus is partial or error, explicitly state which evidence is unavailable and keep the answer bounded to available facts.'
      : 'You are answering inside Arbitra Agent Workbench. Preserve the current entry intent, cite available sourceRefs, and structure conclusions so they can map back to Workbench widgets.',
  };
}

function getWorkbenchSignals(session: WorkbenchSessionSpec) {
  const factsSummary = session.facts?.summary;
  const hasSubstantiveFacts = Boolean(
    factsSummary?.hasUserPrompt ||
    factsSummary?.hasMarketContext ||
    factsSummary?.hasSovereignProfile ||
    factsSummary?.hasSelectedHolding ||
    factsSummary?.accountCount ||
    factsSummary?.positionCount ||
    factsSummary?.publicHoldingCount,
  );
  const missingFactCount = factsSummary?.missingFactCount || session.facts?.missingFacts?.length || 0;
  const factStatus: WorkbenchWidgetStatus = !hasSubstantiveFacts
    ? 'awaiting_context'
    : missingFactCount > 0
      ? 'partial'
      : 'ready';
  const railStatus = session.railRun?.status || 'waiting_signals';
  const readyRails = session.railRun?.summary.readyCount || 0;
  const partialRails = session.railRun?.summary.partialCount || 0;
  const blockedRails = session.railRun?.summary.blockedCount || 0;
  const totalRails = session.railRun?.summary.railCount || 0;
  const cioStatus: WorkbenchWidgetStatus = !session.railRun
    ? 'waiting_signals'
    : totalRails > 0 && readyRails === totalRails
      ? 'ready'
      : blockedRails > 0 || partialRails > 0 || readyRails > 0
        ? 'partial'
        : railStatus === 'blocked'
          ? 'blocked'
          : 'waiting_signals';

  return [
    {
      id: 'shared_facts',
      icon: 'group',
      titleKey: 'workbench.sharedFacts',
      status: factStatus,
    },
    {
      id: 'three_rails',
      icon: 'account_tree',
      titleKey: 'workbench.threeRails',
      status: railStatus,
    },
    {
      id: 'cio_synthesis',
      icon: 'psychology',
      titleKey: 'workbench.cioSynthesis',
      status: cioStatus,
    },
  ];
}

function WorkbenchEventTimeline({
  events,
  hasUserPrompt,
}: {
  events?: WorkbenchEvent[];
  hasUserPrompt: boolean;
}) {
  const { t } = useTranslation();
  const visibleEvents = useMemo(() => {
    const allEvents = events || [];
    if (!hasUserPrompt) {
      return allEvents
        .filter((event) => event.phase === 'session_opened' || event.phase === 'facts_hydrated')
        .slice(-2);
    }
    const latestRunStart = allEvents.map((event) => event.phase).lastIndexOf('workbench_run_started');
    const currentRun = latestRunStart >= 0 ? allEvents.slice(latestRunStart) : allEvents;
    const hasTerminalEvent = currentRun.some((event) => event.phase === 'run_completed' || event.phase === 'run_failed');
    const displayEvents = hasTerminalEvent
      ? currentRun.filter((event) => event.phase !== 'workbench_run_started')
      : currentRun;
    return displayEvents.slice(-4);
  }, [events, hasUserPrompt]);

  if (visibleEvents.length === 0) {
    return null;
  }

  return (
    <section className="aw-workbench-event-strip" aria-label={t('workbench.events.title')}>
      <div className="flex min-w-0 items-center gap-2">
        <MaterialIcon name="timeline" size={20} className="text-aw-success" />
        <span className="aw-caption aw-text-tertiary font-mono uppercase">{t('workbench.events.title')}</span>
      </div>
      <div className="aw-workbench-event-list">
        {visibleEvents.map((event) => (
          <div key={event.id} className="aw-workbench-event-chip">
            <MaterialIcon
              name={getEventStatusIcon(event.status)}
              size={16}
              className={`${getEventStatusTone(event.status)} ${event.status === 'running' ? 'animate-spin' : ''}`}
            />
            <span className="truncate">{t(event.titleKey)}</span>
            <em className={getEventStatusTone(event.status)}>{t(`workbench.events.status.${event.status}`)}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function translateWorkbenchText(value: string | undefined, t: (key: string) => string) {
  if (!value) return '';
  return value.startsWith('workbench.') || value.startsWith('portfolioIntelligence.')
    ? t(value)
    : value;
}

function RailDetailPanel({
  railId,
  session,
}: {
  railId: WorkbenchRailId;
  session: WorkbenchSessionSpec;
}) {
  const { t } = useTranslation();
  const rail = session.railRun?.railResults.find((item) => item.railId === railId);
  if (!rail) {
    return (
      <section className="aw-reference-card aw-workbench-rail-detail p-4" role="tabpanel">
        <p className="aw-body aw-text-secondary">{t('workbench.waitingSignals')}</p>
      </section>
    );
  }

  return (
    <section className="aw-reference-card aw-workbench-rail-detail p-4" role="tabpanel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="aw-caption aw-text-tertiary font-mono uppercase">{t('workbench.railEvidence')}</p>
          <h3 className="aw-label aw-text-primary mt-1 font-semibold">{t(rail.titleKey)}</h3>
        </div>
        <span className={`aw-status-pill shrink-0 font-mono ${getRunStatusTone(rail.status === 'ready' ? 'ready' : rail.status === 'error' ? 'error' : 'idle')}`}>
          {getStatusLabel(rail.status, t)}
        </span>
      </div>
      <p className="aw-body aw-text-secondary mt-3 leading-relaxed">
        {translateWorkbenchText(rail.summary || rail.summaryKey, t)}
      </p>
      <div className="aw-workbench-rail-metrics mt-3">
        <span>{t('portfolioIntelligence.confidence')} <strong>{t(`workbench.confidenceLevels.${rail.confidence}`)}</strong></span>
        <span>{t('workbench.evidence')} <strong>{rail.evidenceRefs.length}</strong></span>
        <span>{t('workbench.metrics.missing')} <strong>{rail.missingFacts.length || '—'}</strong></span>
      </div>
      {rail.risks.length > 0 && (
        <div className="mt-4">
          <p className="aw-caption aw-text-tertiary font-mono uppercase">{t('workbench.railRiskHeading')}</p>
          <div className="mt-2 space-y-2">
            {rail.risks.slice(0, 3).map((risk, index) => (
              <p key={`${risk}-${index}`} className="aw-body aw-text-secondary">{translateWorkbenchText(risk, t)}</p>
            ))}
          </div>
        </div>
      )}
      {rail.actions.length > 0 && (
        <div className="mt-4">
          <p className="aw-caption aw-text-tertiary font-mono uppercase">{t('workbench.railActionHeading')}</p>
          <div className="mt-2 space-y-2">
            {rail.actions.slice(0, 3).map((action) => (
              <div key={action.id} className="aw-panel-muted flex items-center justify-between gap-3 px-3 py-2">
                <span className="aw-body aw-text-primary">{translateWorkbenchText(action.labelKey, t)}</span>
                <span className="aw-caption aw-text-tertiary font-mono uppercase">{action.status ? t(`workbench.${action.status === 'pending' ? 'awaitingContext' : action.status}`) : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function readClipboardFile(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve({
        mimeType: file.type || 'application/octet-stream',
        data: result.includes(',') ? result.split(',')[1] : result,
        name: file.name || 'pasted-file',
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function AgentWorkbenchContent({
  session,
  isOpen,
  closeWorkbench,
}: {
  session: WorkbenchSessionSpec;
  isOpen: boolean;
  closeWorkbench: () => void;
}) {
  const { t, language } = useTranslation();
  const submitWorkbenchPrompt = useInteractionStore(state => state.submitWorkbenchPrompt);
  const restartWorkbench = useInteractionStore(state => state.restartWorkbench);
  const workbenchRunStatus = useInteractionStore(state => state.workbenchRunStatus);
  const workbenchRunError = useInteractionStore(state => state.workbenchRunError);
  const commitData = useWealthStore(state => state.commitData);
  const historyScope = useMemo(() => `workbench:${session.id}`, [session.id]);
  const workbenchAgentContext = useMemo(() => buildWorkbenchAgentContext(session), [session]);
  const {
    inputMsg,
    setInputMsg,
    isLoading,
    attachments,
    setAttachments,
    chatHistory,
    setChatHistory,
    handleStop,
    handleRegenerate,
    handleAiSubmit,
  } = useAiAgent({
    setIsSynthesizing: undefined,
    historyScope,
    persistHistory: false,
    contextAugment: workbenchAgentContext,
    profileWriteMode: 'memory_candidate',
    workbenchNativeSession: session,
  });

  const widgetSelection = useMemo(() => getRenderableWorkbenchWidgetSelection(session), [session]);
  const widgets = widgetSelection.widgets;
  const widgetPhase = widgetSelection.phase;
  const signals = useMemo(() => getWorkbenchSignals(session), [session]);
  const conversationSeed = useMemo(() => getConversationSeed(session, t), [session, t]);
  const canChat = session.allowedActions?.includes('chat') ?? true;
  const canOpenProfileEditor = session.entryType === 'profile_memory';
  const workbenchScrollRef = useRef<HTMLElement | null>(null);
  const [activeView, setActiveView] = useState<WorkbenchViewScope>('overview');
  const dialogRef = useModalFocusTrap<HTMLElement>({ active: isOpen, onEscape: closeWorkbench });
  const factStatus = signals[0]?.status || 'awaiting_context';
  const latestFactAt = Math.max(0, ...Object.values(session.facts?.freshness || {}).filter((value): value is number => typeof value === 'number' && Number.isFinite(value)));
  const factsAsOf = latestFactAt > 0
    ? new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(latestFactAt)
    : t('workbench.unknownTime');
  const cioWidgets = widgets.filter((widget) => widget.type === 'cio_brief');
  const supportWidgets = widgets.filter((widget) => widget.type !== 'cio_brief' && widget.type !== 'rail_card');
  const visibleSupportWidgets = activeView === 'overview'
    ? supportWidgets
    : supportWidgets.filter((widget) => widget.railId === activeView);
  const railTabs = useMemo(() => (['equity', 'allocation', 'life'] as WorkbenchRailId[])
    .filter((railId) => session.railRun?.railResults.some((rail) => rail.railId === railId)), [session.railRun]);

  useEffect(() => {
    setActiveView('overview');
  }, [session.id]);

  useEffect(() => {
    if (!isOpen || chatHistory.length > 0 || typeof window === 'undefined') return;
    const frame = window.requestAnimationFrame(() => {
      if (workbenchScrollRef.current) workbenchScrollRef.current.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chatHistory.length, isOpen, session.id]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.arbitraWorkbenchOpen = String(isOpen);
    document.documentElement.dataset.arbitraWorkbenchVisibleWidgetCount = String(widgets.length);
    document.documentElement.dataset.arbitraWorkbenchPhase = widgetPhase;
    document.documentElement.dataset.arbitraWorkbenchWidgetReason = widgetSelection.reason;
    document.documentElement.dataset.arbitraWorkbenchVisibleWidgetTypes = widgetSelection.selectedTypes.join(',');
    document.documentElement.dataset.arbitraWorkbenchWidgetCandidateCount = String(widgetSelection.candidateCount);
    document.documentElement.dataset.arbitraWorkbenchChatScope = 'session';
    document.documentElement.dataset.arbitraWorkbenchProfileWriteMode = 'memory_candidate';
    document.documentElement.dataset.arbitraWorkbenchChatHistoryCount = String(chatHistory.length);
    document.documentElement.dataset.arbitraWorkbenchSeedEntry = session.entryType;
    document.documentElement.dataset.arbitraWorkbenchQuickPromptCount = String(conversationSeed.quickPrompts.length);
    return () => {
      delete document.documentElement.dataset.arbitraWorkbenchOpen;
      delete document.documentElement.dataset.arbitraWorkbenchVisibleWidgetCount;
      delete document.documentElement.dataset.arbitraWorkbenchPhase;
      delete document.documentElement.dataset.arbitraWorkbenchWidgetReason;
      delete document.documentElement.dataset.arbitraWorkbenchVisibleWidgetTypes;
      delete document.documentElement.dataset.arbitraWorkbenchWidgetCandidateCount;
      delete document.documentElement.dataset.arbitraWorkbenchChatScope;
      delete document.documentElement.dataset.arbitraWorkbenchProfileWriteMode;
      delete document.documentElement.dataset.arbitraWorkbenchChatHistoryCount;
      delete document.documentElement.dataset.arbitraWorkbenchSeedEntry;
      delete document.documentElement.dataset.arbitraWorkbenchQuickPromptCount;
    };
  }, [
    chatHistory.length,
    conversationSeed.quickPrompts.length,
    isOpen,
    session.entryType,
    widgetPhase,
    widgetSelection.candidateCount,
    widgetSelection.reason,
    widgetSelection.selectedTypes,
    widgets.length,
  ]);

  const messages = useMemo(() => chatHistory.flatMap((item, index) => {
    const nextMessages: any[] = [];
    const itemWorkbenchSession = resolveWorkbenchSessionForChatTurn(item, {
      isLatestTurn: index === chatHistory.length - 1,
      activeSession: session,
    });
    if (item.user || item.attachments?.length) {
      nextMessages.push({
        role: 'user',
        content: item.user || '',
        attachments: item.attachments || [],
      });
    }
    const isLastLoadingMessage = isLoading && index === chatHistory.length - 1;
    if (item.ai || item.thinking || item.debugData || item.aiSuggestedState || isLastLoadingMessage) {
      nextMessages.push({
        role: 'assistant',
        content: item.ai || '',
        thinking: item.thinking,
        hasMemoryUpdate: item.hasMemoryUpdate,
        _liveSources: item._liveSources,
        timeTaken: item.timeTaken,
        debugData: item.debugData,
        aiSuggestedState: item.aiSuggestedState,
        suggestedStateApplied: item.suggestedStateApplied,
        sourceChatIndex: index,
        workbenchSession: itemWorkbenchSession,
      });
    }
    return nextMessages;
  }), [chatHistory, isLoading, session]);

  const attachFinalSessionToLastMessage = useCallback((nextSession: WorkbenchSessionSpec | null) => {
    if (!nextSession) return;
    setChatHistory((prev) => attachWorkbenchSessionToLatestAssistantTurn(prev, nextSession));
  }, [setChatHistory]);

  const handleSubmit = useCallback((event?: React.FormEvent) => {
    event?.preventDefault();
    if (!canChat || isLoading) return;
    const prompt = inputMsg.trim();
    void handleAiSubmit().then(async (chatResult) => {
      if (!prompt) return;
      const nextSession = await submitWorkbenchPrompt(prompt, chatResult || undefined);
      attachFinalSessionToLastMessage(nextSession);
    });
  }, [attachFinalSessionToLastMessage, canChat, handleAiSubmit, inputMsg, isLoading, submitWorkbenchPrompt]);

  const handleQuickPrompt = useCallback((prompt: string) => {
    if (!canChat || isLoading) return;
    void handleAiSubmit(prompt).then(async (chatResult) => {
      if (!prompt.trim()) return;
      const nextSession = await submitWorkbenchPrompt(prompt, chatResult || undefined);
      attachFinalSessionToLastMessage(nextSession);
    });
  }, [attachFinalSessionToLastMessage, canChat, handleAiSubmit, isLoading, submitWorkbenchPrompt]);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData?.files || []);
    if (files.length === 0) return;
    event.preventDefault();
    void Promise.all(files.map(readClipboardFile))
      .then((nextAttachments) => setAttachments((prev) => [...prev, ...nextAttachments]))
      .catch((error) => console.error('Failed to read pasted attachments:', error));
  }, [setAttachments]);

  const handleRemoveAttachment = useCallback((indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  }, [setAttachments]);

  const handleApplySuggestedState = useCallback((patch: any, sourceChatIndex?: number) => {
    if (!patch) return;
    commitData((prevData: any) => ({
      ...prevData,
      ...patch,
      metrics: { ...prevData.metrics, ...(patch.metrics || {}) },
      distributions: {
        ...prevData.distributions,
        ...(patch.distributions || {}),
      },
      insights: { ...prevData.insights, ...(patch.insights || {}) },
      goal: patch.goal || prevData.goal,
    }));
    if (typeof sourceChatIndex === 'number') {
      setChatHistory((prev) => prev.map((item, index) => (
        index === sourceChatIndex ? { ...item, suggestedStateApplied: true } : item
      )));
    }
  }, [commitData, setChatHistory]);

  const handleOpenProfileEditor = useCallback(() => {
    if (typeof window === 'undefined') return;
    closeWorkbench();
    window.dispatchEvent(new CustomEvent('open-profile-report'));
  }, [closeWorkbench]);

  return (
    <div className={isOpen ? undefined : 'hidden'} aria-hidden={!isOpen}>
      <div className="fixed inset-0 z-[90] aw-drawer-backdrop" onClick={closeWorkbench} aria-hidden="true" />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="aw-workbench-title"
        tabIndex={-1}
        className="aw-drawer-shell aw-workbench-shell fixed inset-y-0 right-0 z-[100] flex w-full max-w-[1080px] flex-col overflow-hidden xl:max-w-[1180px]"
        data-aw-workbench="true"
        data-aw-workbench-phase={widgetPhase}
        data-aw-visible-widget-count={widgets.length}
      >
        <header
          className="aw-workbench-header flex items-center justify-between gap-4 px-5 py-4"
        >
          <div className="min-w-0">
            <p className="aw-caption aw-text-tertiary font-mono uppercase">{t('nav.brandName')}</p>
            <h2 id="aw-workbench-title" className="aw-title aw-text-primary font-semibold tracking-normal">
              {t(session.titleKey)}
            </h2>
            <div className="aw-workbench-header-meta mt-1" aria-label={t('workbench.dataStatus')}>
              {session.subjectSpec?.label || session.subject ? <span>{session.subjectSpec?.label || session.subject}</span> : null}
              <span>{t('workbench.dataStatus')}: {getStatusLabel(factStatus, t)}</span>
              <span>{t('workbench.factsAsOf')}: {factsAsOf}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canOpenProfileEditor && (
              <button
                type="button"
                onClick={handleOpenProfileEditor}
                className="aw-button aw-button-ghost !min-h-9 !px-3"
              >
                <MaterialIcon name="manage_accounts" size={16} />
                <span className="hidden sm:inline">{t('workbench.openProfileEditor')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={restartWorkbench}
              className="aw-icon-button"
              aria-label={t('workbench.newSession')}
              title={t('workbench.newSession')}
            >
              <MaterialIcon name="restart_alt" size={20} />
            </button>
            <span className="aw-status-pill shrink-0 font-mono">
              {t(widgetPhase === 'reply' ? 'workbench.phaseReply' : 'workbench.phaseInitial')}
            </span>
            <button
              type="button"
              onClick={closeWorkbench}
              className="aw-icon-button"
              aria-label={t('workbench.close')}
              title={t('workbench.close')}
            >
              <MaterialIcon name="close" size={20} />
            </button>
          </div>
        </header>

        <main ref={workbenchScrollRef} className="aw-workbench-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
          <section className="aw-workbench-signal-grid">
            {signals.map((signal) => (
              <div key={signal.id} className={`aw-workbench-signal-card ${getSignalTone(signal.status)}`}>
                <MaterialIcon name={signal.icon} size={24} />
                <span>
                  <strong>{t(signal.titleKey)}</strong>
                  <em>{getStatusLabel(signal.status, t)}</em>
                </span>
              </div>
            ))}
          </section>

          <WorkbenchEventTimeline events={session.events} hasUserPrompt={Boolean(session.facts?.userPrompt)} />

          <section className="aw-workbench-body-grid min-h-0 flex-1">
            <section className="aw-reference-card aw-workbench-conversation-panel flex min-h-0 flex-col overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="aw-chart-state-icon shrink-0">
                  <MaterialIcon name="forum" size={20} className="text-aw-success" />
                </div>
                <h3 className="aw-label aw-text-primary truncate font-semibold">{t('workbench.conversation')}</h3>
              </div>
              {!canChat && (
                <span className="aw-status-pill shrink-0 font-mono text-aw-warning">
                  {t('workbench.waitingSignals')}
                </span>
              )}
              {workbenchRunStatus !== 'idle' && (
                <span
                  className={`aw-status-pill shrink-0 font-mono ${getRunStatusTone(workbenchRunStatus)}`}
                  title={workbenchRunError || undefined}
                >
                  {workbenchRunStatus === 'running' && <MaterialIcon name="progress_activity" size={16} className="animate-spin" />}
                  {getRunStatusLabel(workbenchRunStatus, t)}
                </span>
              )}
              <span className="aw-status-pill shrink-0 font-mono">
                <MaterialIcon name="account_tree" size={16} />
                {t('workbench.sessionScoped')}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <ChatList
                messages={messages}
                isTyping={isLoading}
                onRegenerate={handleRegenerate}
                onQuickPrompt={handleQuickPrompt}
                onApplySuggestedState={handleApplySuggestedState}
                bottomPaddingClass="pb-5"
                className="min-h-0"
                emptyTitle={conversationSeed.title}
                emptyDescription={conversationSeed.description}
                emptyContextLabel={conversationSeed.contextLabel}
                emptyContextValue={conversationSeed.contextValue}
                quickPrompts={conversationSeed.quickPrompts}
              />
            </div>
            </section>

            <aside className="aw-workbench-widget-rail custom-scroll min-h-0 overflow-y-auto" aria-label={t('workbench.widgets')}>
              {cioWidgets.length > 0 && (
                <section className="grid grid-cols-1 gap-3 mb-3" aria-label={t('workbench.cioSynthesis')}>
                  {cioWidgets.map((widget) => (
                    <WorkbenchWidgetRenderer
                      key={`${widget.railId || 'session'}:${widget.id}`}
                      session={session}
                      widget={widget}
                    />
                  ))}
                </section>
              )}
              {railTabs.length > 0 && (
                <div className="aw-workbench-rail-tabs" role="tablist" aria-label={t('workbench.threeRails')}>
                  {(['overview', ...railTabs] as WorkbenchViewScope[]).map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      role="tab"
                      aria-selected={activeView === scope}
                      className={activeView === scope ? 'is-active' : undefined}
                      onClick={() => setActiveView(scope)}
                    >
                      {t(`workbench.railTabs.${scope}`)}
                    </button>
                  ))}
                </div>
              )}
              {activeView !== 'overview' && <RailDetailPanel railId={activeView} session={session} />}
              <section className="grid grid-cols-1 gap-3 mt-3">
                {visibleSupportWidgets.map(widget => (
                  <WorkbenchWidgetRenderer
                    key={`${widget.railId || 'session'}:${widget.id}`}
                    session={session}
                    widget={widget}
                  />
                ))}
              </section>
            </aside>
          </section>
        </main>

        <footer
          className="aw-workbench-footer space-y-3 border-t border-aw-border px-4 py-4"
        >
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment, index) => (
                <span key={`${attachment.name}-${index}`} className="aw-status-pill max-w-full font-mono">
                  <MaterialIcon name={attachment.mimeType.startsWith('image/') ? 'image' : 'description'} size={16} />
                  <span className="max-w-[180px] truncate">{attachment.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(index)}
                    className="ml-1 inline-flex"
                    aria-label={t('chat.removeAttachment')}
                    title={t('chat.removeAttachment')}
                  >
                    <MaterialIcon name="close" size={16} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <ChatInput
            input={inputMsg}
            handleInputChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setInputMsg(event.target.value)}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            onStop={handleStop}
            onPaste={handlePaste}
            hasAttachments={attachments.length > 0}
          />
        </footer>
      </aside>
    </div>
  );
}

export function AgentWorkbenchHost() {
  const activeWorkbenchSession = useInteractionStore(state => state.activeWorkbenchSession);
  const isWorkbenchOpen = useInteractionStore(state => state.isWorkbenchOpen);
  const closeWorkbench = useInteractionStore(state => state.closeWorkbench);

  if (!activeWorkbenchSession) {
    return null;
  }

  return (
      <AgentWorkbenchContent
      key={activeWorkbenchSession.id}
      session={activeWorkbenchSession}
      isOpen={isWorkbenchOpen}
      closeWorkbench={closeWorkbench}
    />
  );
}
