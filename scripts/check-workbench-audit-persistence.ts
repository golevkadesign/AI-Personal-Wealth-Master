import {
  applyMemoryInboxDecision,
  hydrateWorkbenchMemoryProjection,
} from '../src/lib/workbench-memory';
import { runWorkbenchRailOrchestration } from '../src/lib/workbench-rails';
import { createPromptWorkbenchSession } from '../src/lib/workbench-session';
import {
  createWorkbenchAuditDecisionRecord,
  createWorkbenchAuditPatch,
} from '../src/lib/workbench-audit';
import type {
  MemoryCandidate,
  SovereignProfile,
  WorkbenchSessionSpec,
} from '../src/types/workbench';
import type { TerminalState } from '../src/types/terminal';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const terminalState: any = {
  userPersona: {
    tags: ['audit-test'],
    description: 'Audit-ready profile',
  },
  userProfile: {
    planningHorizon: 'long',
  },
  insights: {
    global: 'Strategic context ready',
  },
  distributions: {
    publicHoldings: [
      { id: 'VOO.US', symbol: 'VOO.US', name: 'Vanguard S&P 500 ETF', value: 1000, marketValue: 1000 },
    ],
  },
};

function createCandidate(id: string): MemoryCandidate {
  return {
    id,
    type: 'risk_preference',
    title: `Audit Candidate ${id}`,
    body: `Audit Body ${id}`,
    confidence: 'high',
    sourceRefs: [`audit.${id}`, 'chat.updated_profile'],
    structuredPatch: {
      riskPreferences: {
        [`risk_${id}`]: 'confirmed',
      },
    },
    status: 'pending',
    createdAt: Date.now(),
  };
}

async function createSessionWithCandidate(candidate: MemoryCandidate): Promise<WorkbenchSessionSpec> {
  const baseSession = createPromptWorkbenchSession('Audit this Workbench run', terminalState);
  const railRun = await runWorkbenchRailOrchestration(baseSession);
  return hydrateWorkbenchMemoryProjection({
    ...baseSession,
    railRun: {
      ...railRun,
      railResults: railRun.railResults.map((rail) => (
        rail.railId === 'life'
          ? {
            ...rail,
            memoryCandidates: [candidate],
          }
          : rail
      )),
    },
  });
}

async function main() {
  const acceptedCandidate = createCandidate('accepted');
  const session = await createSessionWithCandidate(acceptedCandidate);
  const sessionPatch = createWorkbenchAuditPatch({
    terminalState,
    session,
  }) as Partial<TerminalState>;

  assert(sessionPatch.workbenchAudit?.latestSessionId === session.id, 'session audit should record latest session id');
  assert(sessionPatch.workbenchAudit?.sessions.length === 1, 'session audit should include one session record');
  assert(sessionPatch.workbenchAudit?.sessions[0].entryType === 'manual_chat', 'session record should preserve entry type');
  assert((sessionPatch.workbenchAudit?.sessions[0].widgetCount || 0) > 0, 'session record should summarize widget count');

  const acceptedItem = session.memoryInbox?.items.find((item) => item.candidate.id === acceptedCandidate.id);
  assert(acceptedItem, 'expected accepted candidate inbox item');
  const acceptedDecision = { decision: 'accept' as const };
  const acceptedResult = applyMemoryInboxDecision({
    item: acceptedItem,
    profile: session.facts?.sovereignProfile as SovereignProfile,
    decision: acceptedDecision.decision,
    sessionSpec: session,
  });
  const acceptedRecord = createWorkbenchAuditDecisionRecord({
    item: acceptedResult.item,
    decision: acceptedDecision,
    session,
  });
  const acceptedPatch = createWorkbenchAuditPatch({
    terminalState: {
      ...terminalState,
      workbenchAudit: sessionPatch.workbenchAudit,
    },
    session,
    decisionRecord: acceptedRecord,
    profileEvent: acceptedResult.event,
  }) as Partial<TerminalState>;

  assert(acceptedPatch.workbenchAudit?.decisions.length === 1, 'accepted decision should be persisted');
  assert(acceptedPatch.workbenchAudit?.decisions[0].status === 'accepted', 'accepted decision status should be audited');
  assert(acceptedPatch.workbenchAudit?.profileEvents.length === 1, 'accepted decision should persist profile event');
  assert(acceptedPatch.workbenchAudit?.stats.acceptedMemoryCount === 1, 'accepted memory count should update');

  const rejectedCandidate = createCandidate('rejected');
  const rejectSession = await createSessionWithCandidate(rejectedCandidate);
  const rejectedItem = rejectSession.memoryInbox?.items.find((item) => item.candidate.id === rejectedCandidate.id);
  assert(rejectedItem, 'expected rejected candidate inbox item');
  const rejectedDecision = { decision: 'reject' as const };
  const rejectedResult = applyMemoryInboxDecision({
    item: rejectedItem,
    profile: rejectSession.facts?.sovereignProfile as SovereignProfile,
    decision: rejectedDecision.decision,
    sessionSpec: rejectSession,
  });
  const rejectedRecord = createWorkbenchAuditDecisionRecord({
    item: rejectedResult.item,
    decision: rejectedDecision,
    session: rejectSession,
  });
  const rejectedPatch = createWorkbenchAuditPatch({
    terminalState: {
      ...terminalState,
      workbenchAudit: acceptedPatch.workbenchAudit,
    },
    session: rejectSession,
    decisionRecord: rejectedRecord,
    profileEvent: rejectedResult.event,
  }) as Partial<TerminalState>;

  assert(rejectedPatch.workbenchAudit?.decisions.some((decision) => decision.status === 'rejected'), 'rejected decision should be persisted');
  assert(rejectedPatch.workbenchAudit?.stats.rejectedMemoryCount === 1, 'rejected memory count should update');
  assert(rejectedPatch.workbenchAudit?.profileEvents.length === 1, 'reject should not create a new profile event');

  let rollingState: TerminalState = {
    ...terminalState,
    workbenchAudit: rejectedPatch.workbenchAudit,
  };
  for (let index = 0; index < 32; index += 1) {
    const extraSession = createPromptWorkbenchSession(`Audit session ${index}`, terminalState);
    rollingState = {
      ...rollingState,
      ...createWorkbenchAuditPatch({
        terminalState: rollingState,
        session: {
          ...extraSession,
          createdAt: Date.now() + index,
        },
      }),
    } as TerminalState;
  }

  assert((rollingState.workbenchAudit?.sessions.length || 0) <= 24, 'session audit should stay capped');

  console.log(JSON.stringify({
    status: 'ok',
    checked: [
      'session-audit-persisted',
      'accepted-memory-decision-audited',
      'profile-event-audited',
      'rejected-memory-decision-audited',
      'audit-session-cap-enforced',
    ],
    stats: rollingState.workbenchAudit?.stats,
    sessionCount: rollingState.workbenchAudit?.sessions.length,
    decisionStatuses: rollingState.workbenchAudit?.decisions.map((decision) => decision.status),
  }));
}

void main();
