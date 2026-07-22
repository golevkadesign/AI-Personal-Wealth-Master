import {
  applyMemoryInboxDecision,
  hydrateWorkbenchMemoryProjection,
} from '../src/lib/workbench-memory';
import type {
  MemoryCandidate,
  MemoryInboxDecisionType,
  SovereignProfile,
  WorkbenchSessionSpec,
} from '../src/types/workbench';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const now = Date.now();

function createCandidate(id: string): MemoryCandidate {
  return {
    id,
    type: 'risk_preference',
    title: `Candidate ${id}`,
    body: `Body ${id}`,
    confidence: 'high',
    sourceRefs: [`test.${id}`, 'rail.life'],
    structuredPatch: {
      riskPreferences: {
        [`risk_${id}`]: 'confirmed',
      },
    },
    status: 'pending',
    createdAt: now,
  };
}

function createSession(candidate: MemoryCandidate): WorkbenchSessionSpec {
  return hydrateWorkbenchMemoryProjection({
    id: `session-${candidate.id}`,
    entryType: 'profile_memory',
    titleKey: 'workbench.memoryProfileWorkbench',
    intentBias: 'memory',
    facts: {
      sovereignProfile: { version: 1, sourceRefs: ['test.profile'] },
      sourceRefs: ['test.profile', 'test.session'],
      confidence: 'high',
      missingFacts: [],
      summary: {
        hasTerminalState: false,
        hasSovereignProfile: true,
        hasSelectedHolding: false,
        hasUserPrompt: false,
        hasMarketContext: false,
        publicHoldingCount: 0,
        accountCount: 0,
        positionCount: 0,
        sourceCount: 2,
        missingFactCount: 0,
      },
    },
    railRun: {
      id: `rail-${candidate.id}`,
      sessionId: `session-${candidate.id}`,
      status: 'partial',
      startedAt: now,
      completedAt: now,
      sourceRefs: ['rail.life'],
      missingFacts: [],
      summary: {
        readyCount: 1,
        partialCount: 0,
        blockedCount: 0,
        railCount: 1,
      },
      railResults: [{
        railId: 'life',
        titleKey: 'workbench.railTitles.life',
        status: 'ready',
        summaryKey: 'workbench.railSummaries.life.ready',
        summary: 'workbench.railSummaries.life.ready',
        confidence: 'high',
        evidenceRefs: ['rail.life'],
        missingFacts: [],
        risks: [],
        actions: [],
        widgetManifest: [{
          id: 'life-memory-candidate',
          type: 'memory_candidate',
          titleKey: 'workbench.memoryCandidate',
          status: 'ready',
          railId: 'life',
          priority: 1,
          sourceRefs: ['rail.life'],
        }],
        memoryCandidates: [candidate],
      }],
    },
    initialWidgets: [{
      id: 'profile-memory-inbox',
      type: 'memory_candidate',
      titleKey: 'workbench.memoryCandidate',
      status: 'ready',
      priority: 1,
      sourceRefs: ['test.session'],
    }],
    allowedActions: ['propose_memory', 'write_memory', 'update_profile', 'project_dashboard'],
    createdAt: now,
  });
}

function runDecision(decision: MemoryInboxDecisionType) {
  const candidate = createCandidate(decision);
  const session = createSession(candidate);
  const item = session.memoryInbox?.items[0];
  assert(item, `${decision}: expected memory inbox item`);
  return applyMemoryInboxDecision({
    item,
    profile: session.facts?.sovereignProfile as SovereignProfile,
    decision,
    sessionSpec: session,
  });
}

const accept = runDecision('accept');
assert(accept.item.status === 'accepted', 'accept: item status should be accepted');
assert(accept.profile.version === 2, 'accept: profile version should advance');
assert(accept.event?.decision === 'accept', 'accept: should create decision event');
assert(accept.dashboardProjection?.profileVersion === 2, 'accept: dashboard projection should use new profile version');

const merge = runDecision('merge');
assert(merge.item.status === 'merged', 'merge: item status should be merged');
assert(merge.event?.decision === 'merge', 'merge: should create decision event');
assert(merge.dashboardProjection?.trace?.generatedFrom.includes('memory'), 'merge: projection should include memory trace');

const editCandidate = createCandidate('edit');
const editSession = createSession(editCandidate);
const editItem = editSession.memoryInbox?.items[0];
assert(editItem, 'edit: expected memory inbox item');
const editAndAccept = applyMemoryInboxDecision({
  item: editItem,
  profile: editSession.facts?.sovereignProfile as SovereignProfile,
  decision: 'edit_and_accept',
  editedTitle: 'Edited Candidate Title',
  editedBody: 'Edited Candidate Body',
  sessionSpec: editSession,
});
assert(editAndAccept.item.status === 'accepted', 'edit: item status should become accepted');
assert(editAndAccept.item.candidate.title === 'Edited Candidate Title', 'edit: title should be preserved');
assert(
  editAndAccept.profile.decisionLedger?.some((entry) => (entry as any).title === 'Edited Candidate Title'),
  'edit: edited title should be written into profile ledger',
);

const reject = runDecision('reject');
assert(reject.item.status === 'rejected', 'reject: item status should be rejected');
assert(!reject.event, 'reject: should not create profile event');
assert(!reject.dashboardProjection, 'reject: should not refresh dashboard projection');
assert(reject.profile.version === 1, 'reject: profile version should not advance');

const temporary = runDecision('mark_temporary');
assert(temporary.item.status === 'temporary', 'temporary: item status should be temporary');
assert(!temporary.event, 'temporary: should not create profile event');
assert(!temporary.dashboardProjection, 'temporary: should not refresh dashboard projection');
assert(temporary.profile.version === 1, 'temporary: profile version should not advance');

const revokeCandidate = createCandidate('revoke');
const revokeSession = createSession(revokeCandidate);
const revokeItem = revokeSession.memoryInbox?.items[0];
assert(revokeItem, 'revoke: expected memory inbox item');
const acceptedBeforeRevoke = applyMemoryInboxDecision({
  item: revokeItem,
  profile: revokeSession.facts?.sovereignProfile as SovereignProfile,
  decision: 'accept',
  sessionSpec: revokeSession,
});
const revoked = applyMemoryInboxDecision({
  item: acceptedBeforeRevoke.item,
  profile: acceptedBeforeRevoke.profile,
  decision: 'revoke',
  sessionSpec: {
    ...revokeSession,
    memoryInbox: {
      ...revokeSession.memoryInbox!,
      items: [acceptedBeforeRevoke.item],
    },
  },
});
assert(revoked.item.status === 'revoked', 'revoke: item status should be revoked');
assert(revoked.event?.decision === 'revoke', 'revoke: should create revoke event');
assert(revoked.dashboardProjection?.profileVersion === revoked.profile.version, 'revoke: projection should use revoked profile version');
assert(
  Array.isArray(revoked.profile.behavioralPatterns?.revokedMemoryCandidateIds),
  'revoke: profile should keep revoked candidate ids',
);

console.log(JSON.stringify({
  status: 'ok',
  checked: ['accept', 'merge', 'edit_and_accept', 'reject', 'mark_temporary', 'revoke'],
  projectionProfileVersion: revoked.dashboardProjection?.profileVersion,
}));
