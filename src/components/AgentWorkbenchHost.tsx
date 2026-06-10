import React from 'react';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { useTranslation } from '../hooks/useTranslation';
import { WorkbenchSessionSpec, WorkbenchWidgetManifest, WorkbenchWidgetStatus } from '../types/workbench';
import { MaterialIcon } from './ui/MaterialIcon';
import { WorkbenchWidgetRenderer } from './WorkbenchWidgetRenderer';

function getRenderableWidgets(session: WorkbenchSessionSpec) {
  const widgets = [
    ...(session.initialWidgets || []),
    ...(session.railRun?.railResults.flatMap((rail) => rail.widgetManifest) || []),
  ];
  const seen = new Set<string>();
  return widgets
    .filter((widget) => {
      const id = `${widget.railId || 'session'}:${widget.id}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => {
      const railOrder = (value?: WorkbenchWidgetManifest['railId']) => {
        if (value === 'equity') return 1;
        if (value === 'allocation') return 2;
        if (value === 'life') return 3;
        return 0;
      };
      return railOrder(a.railId) - railOrder(b.railId) || (a.priority || 0) - (b.priority || 0);
    });
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

export function AgentWorkbenchHost() {
  const { t } = useTranslation();
  const activeWorkbenchSession = useInteractionStore(state => state.activeWorkbenchSession);
  const closeWorkbench = useInteractionStore(state => state.closeWorkbench);

  if (!activeWorkbenchSession || activeWorkbenchSession.legacy) {
    return null;
  }

  const widgets = getRenderableWidgets(activeWorkbenchSession);
  const signals = getWorkbenchSignals(activeWorkbenchSession);

  return (
    <>
      <div className="fixed inset-0 z-[90] aw-drawer-backdrop" onClick={closeWorkbench} />
      <aside className="aw-drawer-shell aw-workbench-shell fixed inset-y-0 right-0 z-[100] flex w-full max-w-[600px] flex-col overflow-hidden">
        <header className="aw-workbench-header flex items-center justify-between gap-4 border-b border-aw-border px-5 py-4">
          <div className="min-w-0">
            <p className="aw-caption aw-text-tertiary font-mono uppercase">{t('nav.brandName')}</p>
            <h2 className="aw-title aw-text-primary font-semibold tracking-normal">
              {t(activeWorkbenchSession.titleKey)}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeWorkbench}
            className="aw-icon-button"
            aria-label={t('workbench.close')}
            title={t('workbench.close')}
          >
            <MaterialIcon name="close" size={20} />
          </button>
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
                session={activeWorkbenchSession}
                widget={widget}
              />
            ))}
          </section>
        </main>
      </aside>
    </>
  );
}
