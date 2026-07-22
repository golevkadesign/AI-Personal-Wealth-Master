import type {
  WorkbenchEvent,
  WorkbenchEventPhase,
  WorkbenchEventStatus,
  WorkbenchSessionSpec,
} from '../types/workbench';

const MAX_WORKBENCH_EVENTS = 80;

const PHASE_TITLE_KEYS: Record<WorkbenchEventPhase, string> = {
  session_opened: 'workbench.events.phases.session_opened',
  facts_hydrated: 'workbench.events.phases.facts_hydrated',
  workbench_run_started: 'workbench.events.phases.workbench_run_started',
  chat_submitted: 'workbench.events.phases.chat_submitted',
  chat_result_received: 'workbench.events.phases.chat_result_received',
  rails_started: 'workbench.events.phases.rails_started',
  rails_completed: 'workbench.events.phases.rails_completed',
  memory_candidate_queued: 'workbench.events.phases.memory_candidate_queued',
  memory_projection_hydrated: 'workbench.events.phases.memory_projection_hydrated',
  dashboard_projection_committed: 'workbench.events.phases.dashboard_projection_committed',
  fallback_started: 'workbench.events.phases.fallback_started',
  memory_decision: 'workbench.events.phases.memory_decision',
  run_completed: 'workbench.events.phases.run_completed',
  run_failed: 'workbench.events.phases.run_failed',
};

const createEventId = (
  sessionId: string,
  phase: WorkbenchEventPhase,
  createdAt: number,
) => `${sessionId}:${phase}:${createdAt}:${Math.random().toString(36).slice(2, 7)}`;

export function createWorkbenchEvent(input: {
  sessionId: string;
  phase: WorkbenchEventPhase;
  status: WorkbenchEventStatus;
  titleKey?: string;
  messageKey?: string;
  detail?: string;
  sourceRefs?: string[];
  requestId?: number;
  createdAt?: number;
  completedAt?: number;
}): WorkbenchEvent {
  const createdAt = input.createdAt || Date.now();
  return {
    id: createEventId(input.sessionId, input.phase, createdAt),
    sessionId: input.sessionId,
    phase: input.phase,
    status: input.status,
    titleKey: input.titleKey || PHASE_TITLE_KEYS[input.phase],
    messageKey: input.messageKey,
    detail: input.detail,
    sourceRefs: input.sourceRefs,
    requestId: input.requestId,
    createdAt,
    completedAt: input.completedAt,
  };
}

export function appendWorkbenchEvent(
  session: WorkbenchSessionSpec,
  event: WorkbenchEvent,
  maxEvents = MAX_WORKBENCH_EVENTS,
): WorkbenchSessionSpec {
  const events = [...(session.events || []), event].slice(-maxEvents);
  return {
    ...session,
    events,
  };
}

export function appendWorkbenchEvents(
  session: WorkbenchSessionSpec,
  events: WorkbenchEvent[],
  maxEvents = MAX_WORKBENCH_EVENTS,
): WorkbenchSessionSpec {
  if (events.length === 0) return session;
  return {
    ...session,
    events: [...(session.events || []), ...events].slice(-maxEvents),
  };
}

export function createSessionOpenedEvents(session: WorkbenchSessionSpec) {
  const sourceRefs = session.facts?.sourceRefs || [];
  return [
    createWorkbenchEvent({
      sessionId: session.id,
      phase: 'session_opened',
      status: 'ready',
      sourceRefs,
    }),
    createWorkbenchEvent({
      sessionId: session.id,
      phase: 'facts_hydrated',
      status: sourceRefs.length > 0 ? 'ready' : 'pending',
      sourceRefs,
    }),
    createWorkbenchEvent({
      sessionId: session.id,
      phase: 'workbench_run_started',
      status: 'running',
      sourceRefs,
    }),
  ];
}

export function createWorkbenchRunCompletionEvents(input: {
  session: WorkbenchSessionSpec;
  status: Exclude<WorkbenchEventStatus, 'pending' | 'running'>;
  error?: string | null;
  requestId?: number;
}) {
  const sourceRefs = input.session.facts?.sourceRefs || [];
  const hasRails = Boolean(input.session.railRun);
  const hasProjection = Boolean(input.session.dashboardProjection);
  const events: WorkbenchEvent[] = [];

  if (input.status === 'fallback') {
    events.push(createWorkbenchEvent({
      sessionId: input.session.id,
      phase: 'fallback_started',
      status: 'fallback',
      detail: input.error || undefined,
      requestId: input.requestId,
      sourceRefs,
    }));
  }

  if (input.status === 'error') {
    events.push(createWorkbenchEvent({
      sessionId: input.session.id,
      phase: 'run_failed',
      status: 'error',
      detail: input.error || undefined,
      requestId: input.requestId,
      sourceRefs,
      completedAt: Date.now(),
    }));
    return events;
  }

  events.push(createWorkbenchEvent({
    sessionId: input.session.id,
    phase: 'rails_completed',
    status: hasRails ? (input.status === 'fallback' ? 'fallback' : 'ready') : 'skipped',
    requestId: input.requestId,
    sourceRefs: input.session.railRun?.sourceRefs || sourceRefs,
    completedAt: Date.now(),
  }));
  events.push(createWorkbenchEvent({
    sessionId: input.session.id,
    phase: 'memory_projection_hydrated',
    status: input.session.memoryInbox ? 'ready' : 'skipped',
    requestId: input.requestId,
    sourceRefs,
    completedAt: Date.now(),
  }));
  events.push(createWorkbenchEvent({
    sessionId: input.session.id,
    phase: 'dashboard_projection_committed',
    status: hasProjection ? (input.status === 'fallback' ? 'fallback' : 'ready') : 'skipped',
    requestId: input.requestId,
    sourceRefs: input.session.dashboardProjection?.trace?.sourceRefs || sourceRefs,
    completedAt: Date.now(),
  }));
  events.push(createWorkbenchEvent({
    sessionId: input.session.id,
    phase: 'run_completed',
    status: input.status,
    detail: input.error || undefined,
    requestId: input.requestId,
    sourceRefs,
    completedAt: Date.now(),
  }));
  return events;
}

export function createWorkbenchEventDebugSnapshot(session: WorkbenchSessionSpec | null) {
  const events = session?.events || [];
  const latest = events.at(-1);
  const runningCount = latest?.status === 'running' || latest?.status === 'pending' ? 1 : 0;
  const errorCount = events.filter((event) => event.status === 'error').length;

  return {
    count: events.length,
    runningCount,
    errorCount,
    latestPhase: latest?.phase || '',
    latestStatus: latest?.status || '',
    latestTitleKey: latest?.titleKey || '',
    timeline: events.map((event) => `${event.phase}:${event.status}`).join('|'),
  };
}
