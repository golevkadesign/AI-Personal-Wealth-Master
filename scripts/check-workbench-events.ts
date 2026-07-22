import {
  appendWorkbenchEvent,
  appendWorkbenchEvents,
  createSessionOpenedEvents,
  createWorkbenchEvent,
  createWorkbenchEventDebugSnapshot,
  createWorkbenchRunCompletionEvents,
} from '../src/lib/workbench-events';
import { createPromptWorkbenchSession } from '../src/lib/workbench-session';
import type { WorkbenchSessionSpec } from '../src/types/workbench';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const session = createPromptWorkbenchSession('review the unified workbench event chain', {
  metrics: {},
  distributions: {
    publicHoldings: [{ id: 'voo', name: 'VOO', symbol: 'VOO.US', value: 1000, marketValue: 1000 }],
  },
} as any);

const opened = appendWorkbenchEvents(session, createSessionOpenedEvents(session));
assert(opened.events?.length === 3, 'session should start with three lifecycle events');
assert(opened.events?.[0]?.phase === 'session_opened', 'first event should mark session open');
assert(opened.events?.[2]?.status === 'running', 'run start event should be running');

const completedBase: WorkbenchSessionSpec = {
  ...opened,
  railRun: {
    id: 'rail-test',
    sessionId: opened.id,
    status: 'ready',
    startedAt: Date.now(),
    completedAt: Date.now(),
    railResults: [],
    sourceRefs: ['test.rail'],
    missingFacts: [],
    summary: {
      readyCount: 3,
      partialCount: 0,
      blockedCount: 0,
      railCount: 3,
    },
  },
  dashboardProjection: {
    id: 'projection-test',
    status: 'ready',
    generatedAt: Date.now(),
    sourceRefs: ['test.projection'],
    dynamicWidgets: [],
    memoryCandidateCount: 0,
    widgetCount: 0,
    trace: {
      candidateIds: [],
      generatedFrom: ['rails'],
      railRunId: 'rail-test',
      sessionId: opened.id,
      sourceRefs: ['test.projection'],
    },
  },
};

const completed = appendWorkbenchEvents(
  completedBase,
  createWorkbenchRunCompletionEvents({
    session: completedBase,
    status: 'ready',
    requestId: 7,
  }),
);

const completionDebug = createWorkbenchEventDebugSnapshot(completed);
assert(completionDebug.count > 3, 'completion should append lifecycle events');
assert(completionDebug.latestPhase === 'run_completed', 'latest phase should be run_completed');
assert(completionDebug.timeline.includes('rails_completed:ready'), 'timeline should include rail completion');

let capped = completed;
for (let index = 0; index < 90; index += 1) {
  capped = appendWorkbenchEvent(capped, createWorkbenchEvent({
    sessionId: capped.id,
    phase: 'chat_submitted',
    status: 'ready',
    requestId: index,
  }));
}

assert((capped.events || []).length === 80, 'event history should be capped at 80 entries');

const fallback = appendWorkbenchEvents(
  opened,
  createWorkbenchRunCompletionEvents({
    session: opened,
    status: 'fallback',
    error: 'local rail fallback',
  }),
);
const fallbackDebug = createWorkbenchEventDebugSnapshot(fallback);
assert(fallbackDebug.timeline.includes('fallback_started:fallback'), 'fallback should be recorded as an event');

console.log('Workbench event lifecycle check passed');
