import React, { useCallback, useEffect, useMemo } from 'react';
import type { Attachment } from '../App';
import { useAiAgent } from '../hooks/useAiAgent';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { useTranslation } from '../hooks/useTranslation';
import { useWealthStore } from '../hooks/useWealthStore';
import {
  WorkbenchEntryType,
  WorkbenchSessionSpec,
  WorkbenchWidgetManifest,
  WorkbenchWidgetStatus,
  WorkbenchWidgetType,
} from '../types/workbench';
import { MaterialIcon } from './ui/MaterialIcon';
import { ChatInput, ChatList } from './ui/chat-ui';
import { WorkbenchWidgetRenderer } from './WorkbenchWidgetRenderer';

type WorkbenchWidgetPhase = 'initial' | 'reply';

const ENTRY_WIDGET_PRESETS: Record<WorkbenchEntryType, Record<WorkbenchWidgetPhase, WorkbenchWidgetType[]>> = {
  manual_chat: {
    initial: ['shared_facts', 'rail_card', 'cio_brief'],
    reply: ['cio_brief', 'rail_card', 'action_queue', 'memory_candidate'],
  },
  dashboard_brief: {
    initial: ['cio_brief', 'evidence', 'confidence'],
    reply: ['cio_brief', 'rail_card', 'evidence', 'confidence'],
  },
  widget: {
    initial: ['source', 'evidence', 'confidence'],
    reply: ['cio_brief', 'evidence', 'confidence', 'action_queue'],
  },
  holding: {
    initial: ['current_exposure', 'intent_fingerprint', 'confidence'],
    reply: ['current_exposure', 'intent_fingerprint', 'suggested_tilt', 'confidence'],
  },
  portfolio_review: {
    initial: ['portfolio_map', 'current_exposure', 'missing_pieces'],
    reply: ['portfolio_map', 'missing_pieces', 'suggested_tilt', 'projected_exposure'],
  },
  life_strategy: {
    initial: ['shared_facts', 'rail_card', 'action_queue'],
    reply: ['cio_brief', 'action_queue', 'memory_candidate', 'confidence'],
  },
  profile_memory: {
    initial: ['shared_facts', 'memory_candidate', 'confidence'],
    reply: ['memory_candidate', 'rail_card', 'action_queue', 'cio_brief'],
  },
  portfolio_intelligence: {
    initial: ['portfolio_map', 'current_exposure', 'intent_fingerprint'],
    reply: ['portfolio_map', 'intent_fingerprint', 'missing_pieces', 'suggested_tilt', 'projected_exposure'],
  },
};

const SESSION_FIRST_WIDGETS = new Set<WorkbenchWidgetType>([
  'shared_facts',
  'rail_card',
  'cio_brief',
  'memory_candidate',
  'portfolio_map',
]);

const STICKY_GLASS_STYLE: React.CSSProperties = {
  backdropFilter: 'blur(var(--aw-card-header-blur))',
};

function getWidgetPhase(session: WorkbenchSessionSpec): WorkbenchWidgetPhase {
  return session.facts?.userPrompt || session.facts?.summary?.hasUserPrompt ? 'reply' : 'initial';
}

function getWidgetCandidates(session: WorkbenchSessionSpec) {
  const widgets = [
    ...(session.initialWidgets || []),
    ...(session.dashboardProjection?.cioBrief?.widgetManifest || []),
    ...(session.dashboardProjection?.dynamicWidgets || []),
    ...(session.railRun?.railResults.flatMap((rail) => rail.widgetManifest) || []),
  ];
  const seen = new Set<string>();
  return widgets.filter((widget) => {
    const id = `${widget.railId || 'session'}:${widget.id}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function pickWidgetForType(
  type: WorkbenchWidgetType,
  phase: WorkbenchWidgetPhase,
  candidates: WorkbenchWidgetManifest[],
) {
  const matches = candidates.filter((widget) => widget.type === type);
  if (matches.length === 0) return null;

  const scoreWidget = (widget: WorkbenchWidgetManifest) => {
    if (type === 'portfolio_map' && !widget.railId) return 0;
    if (SESSION_FIRST_WIDGETS.has(type) && !widget.railId) return 1;
    if (phase === 'reply' && widget.railId) return 1;
    if (!widget.railId) return 2;
    return 3;
  };

  return [...matches].sort((a, b) => {
    const scoreDelta = scoreWidget(a) - scoreWidget(b);
    if (scoreDelta !== 0) return scoreDelta;
    return (a.priority || 99) - (b.priority || 99);
  })[0];
}

function getRenderableWidgets(session: WorkbenchSessionSpec) {
  const phase = getWidgetPhase(session);
  const preset = ENTRY_WIDGET_PRESETS[session.entryType] || ENTRY_WIDGET_PRESETS.manual_chat;
  const candidates = getWidgetCandidates(session);
  const selected = preset[phase]
    .map((type) => pickWidgetForType(type, phase, candidates))
    .filter((widget): widget is WorkbenchWidgetManifest => Boolean(widget));

  if (selected.length > 0) return selected;

  return candidates
    .filter((widget) => !widget.railId)
    .sort((a, b) => (a.priority || 99) - (b.priority || 99))
    .slice(0, 3);
}

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

function getWorkbenchSignals(session: WorkbenchSessionSpec) {
  const factsSummary = session.facts?.summary;
  const hasFacts = Boolean(
    factsSummary?.sourceCount ||
    factsSummary?.accountCount ||
    factsSummary?.positionCount ||
    factsSummary?.hasUserPrompt ||
    session.facts?.sourceRefs?.length,
  );
  const railStatus = session.railRun?.status || 'waiting_signals';
  const readyRails = session.railRun?.summary.readyCount || 0;
  const blockedRails = session.railRun?.summary.blockedCount || 0;
  const cioStatus: WorkbenchWidgetStatus = blockedRails > 0
    ? 'partial'
    : readyRails > 0
      ? 'awaiting_context'
      : 'waiting_signals';

  return [
    {
      id: 'shared_facts',
      icon: 'group',
      titleKey: 'workbench.sharedFacts',
      status: hasFacts ? 'ready' as WorkbenchWidgetStatus : 'awaiting_context' as WorkbenchWidgetStatus,
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
  closeWorkbench,
}: {
  session: WorkbenchSessionSpec;
  closeWorkbench: () => void;
}) {
  const { t } = useTranslation();
  const submitWorkbenchPrompt = useInteractionStore(state => state.submitWorkbenchPrompt);
  const commitData = useWealthStore(state => state.commitData);
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
  } = useAiAgent({ setIsSynthesizing: undefined });

  const widgets = useMemo(() => getRenderableWidgets(session), [session]);
  const widgetPhase = useMemo(() => getWidgetPhase(session), [session]);
  const signals = useMemo(() => getWorkbenchSignals(session), [session]);
  const canChat = session.allowedActions?.includes('chat') ?? true;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.arbitraWorkbenchVisibleWidgetCount = String(widgets.length);
    document.documentElement.dataset.arbitraWorkbenchPhase = widgetPhase;
    return () => {
      delete document.documentElement.dataset.arbitraWorkbenchVisibleWidgetCount;
      delete document.documentElement.dataset.arbitraWorkbenchPhase;
    };
  }, [widgetPhase, widgets.length]);

  const messages = useMemo(() => chatHistory.flatMap((item, index) => {
    const nextMessages: any[] = [];
    if (item.user || item.attachments?.length) {
      nextMessages.push({
        role: 'user',
        content: item.user || '',
        attachments: item.attachments || [],
      });
    }
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
    });
    return nextMessages;
  }), [chatHistory]);

  const handleSubmit = useCallback((event?: React.FormEvent) => {
    event?.preventDefault();
    if (!canChat || isLoading) return;
    const prompt = inputMsg.trim();
    if (prompt) submitWorkbenchPrompt(prompt);
    void handleAiSubmit();
  }, [canChat, handleAiSubmit, inputMsg, isLoading, submitWorkbenchPrompt]);

  const handleQuickPrompt = useCallback((prompt: string) => {
    if (!canChat || isLoading) return;
    submitWorkbenchPrompt(prompt);
    void handleAiSubmit(prompt);
  }, [canChat, handleAiSubmit, isLoading, submitWorkbenchPrompt]);

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

  return (
    <>
      <div className="fixed inset-0 z-[90] aw-drawer-backdrop" onClick={closeWorkbench} />
      <aside
        className="aw-drawer-shell aw-workbench-shell fixed inset-y-0 right-0 z-[100] flex w-full max-w-[720px] flex-col overflow-hidden xl:max-w-[760px]"
        data-aw-workbench="true"
        data-aw-workbench-phase={widgetPhase}
        data-aw-visible-widget-count={widgets.length}
      >
        <header
          className="aw-workbench-header flex items-center justify-between gap-4 px-5 py-4"
          style={STICKY_GLASS_STYLE}
        >
          <div className="min-w-0">
            <p className="aw-caption aw-text-tertiary font-mono uppercase">{t('nav.brandName')}</p>
            <h2 className="aw-title aw-text-primary font-semibold tracking-normal">
              {t(session.titleKey)}
            </h2>
          </div>
          <div className="flex items-center gap-2">
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

        <main className="aw-workbench-scroll flex-1 overflow-y-auto p-4">
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

          <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {widgets.map(widget => (
              <WorkbenchWidgetRenderer
                key={`${widget.railId || 'session'}:${widget.id}`}
                session={session}
                widget={widget}
              />
            ))}
          </section>

          <section className="aw-reference-card mt-4 flex min-h-[420px] flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
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
            </div>
            <div className="flex min-h-[340px] flex-1 flex-col">
              <ChatList
                messages={messages}
                isTyping={isLoading}
                onRegenerate={handleRegenerate}
                onQuickPrompt={handleQuickPrompt}
                onApplySuggestedState={handleApplySuggestedState}
                bottomPaddingClass="pb-5"
                className="min-h-[340px]"
              />
            </div>
          </section>
        </main>

        <footer
          className="aw-workbench-footer space-y-3 border-t border-aw-border px-4 py-4"
          style={STICKY_GLASS_STYLE}
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
    </>
  );
}

export function AgentWorkbenchHost() {
  const activeWorkbenchSession = useInteractionStore(state => state.activeWorkbenchSession);
  const closeWorkbench = useInteractionStore(state => state.closeWorkbench);

  if (!activeWorkbenchSession) {
    return null;
  }

  return (
    <AgentWorkbenchContent
      session={activeWorkbenchSession}
      closeWorkbench={closeWorkbench}
    />
  );
}
