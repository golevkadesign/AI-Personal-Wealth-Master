import {
  addMemoryCandidateToSession,
  applyMemoryInboxDecision,
} from '../src/lib/workbench-memory';
import { createProfileMemoryWorkbenchSession } from '../src/lib/workbench-session';
import { deriveTerminalPatchFromSovereignProfile } from '../src/lib/sovereign-profile-projection';
import type { MemoryCandidate, SovereignProfile } from '../src/types/workbench';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const now = Date.now();
const baseTerminalState: any = {
  metrics: {},
  distributions: {},
  userProfile: {
    sovereignProfile: {
      version: 2,
      identity: {
        name: 'Existing Client',
      },
      sourceRefs: ['test.existing_profile'],
    },
  },
  userPersona: {
    tags: ['existing'],
    description: 'Existing profile',
  },
  goal: {
    name: 'Old Goal',
    current: 1,
    target: 10,
    index: 0.1,
  },
  insights: {
    global: 'Old long context',
  },
};

const session = createProfileMemoryWorkbenchSession(baseTerminalState);
const candidate: MemoryCandidate = {
  id: `profile-center-memory-${now}`,
  type: 'profile_fact',
  title: 'workbench.memory.profileCenterDraftTitle',
  body: 'workbench.memory.profileCenterDraftProjection',
  confidence: 'high',
  sourceRefs: ['profile_center.manual_edit'],
  structuredPatch: {
    version: 2,
    identity: {
      name: 'Updated Client',
      longContext: 'Updated long-term context from Profile Center.',
      goal: {
        name: 'Updated Goal',
        current: 4,
        target: 12,
        index: 0.33,
      },
    },
    behavioralPatterns: {
      tags: ['patient', 'income-led'],
      description: 'Patient income-led allocator',
    },
    sourceRefs: ['profile_center.manual_edit'],
  },
  status: 'pending',
  createdAt: now,
};

const queued = addMemoryCandidateToSession(session, candidate);
const queuedItem = queued.memoryInbox?.items.find((item) => item.candidate.id === candidate.id);
assert(queuedItem, 'profile center candidate should be queued in Memory Inbox');
assert(queuedItem?.status === 'pending', 'profile center candidate should start pending');
assert(queued.dashboardProjection?.memoryCandidateCount === queued.memoryInbox?.items.length, 'projection should reflect queued memory count');
assert(queued.dashboardProjection?.trace?.generatedFrom.includes('memory'), 'projection should trace memory source');

const accepted = applyMemoryInboxDecision({
  item: queuedItem!,
  profile: queued.facts?.sovereignProfile as SovereignProfile,
  decision: 'accept',
  sessionSpec: queued,
});
assert(accepted.item.status === 'accepted', 'accepted profile center item should be accepted');
assert(accepted.profile.version === 3, 'accepted profile center memory should advance profile version');
assert(accepted.profile.sourceRefs?.includes('profile_center.manual_edit'), 'accepted profile should preserve profile center source ref');
assert(accepted.dashboardProjection?.profileVersion === 3, 'dashboard projection should use accepted profile version');

const terminalPatch = deriveTerminalPatchFromSovereignProfile({
  profile: accepted.profile,
  dashboardProjection: accepted.dashboardProjection,
  event: accepted.event,
});
assert((terminalPatch.userProfile as any)?.name === 'Updated Client', 'terminal patch should carry profile identity');
assert((terminalPatch.userPersona as any)?.tags?.includes('patient'), 'terminal patch should carry profile tags');
assert((terminalPatch.goal as any)?.name === 'Updated Goal', 'terminal patch should carry accepted goal');
assert(terminalPatch.insights?.global === 'Updated long-term context from Profile Center.', 'terminal patch should carry accepted long-term context');
assert((terminalPatch.sovereignProfileProjection?.lastDecisionEvent as any)?.candidateId === candidate.id, 'projection should keep last decision trace');

console.log(JSON.stringify({
  status: 'ok',
  checked: ['queue-profile-center-candidate', 'accept-profile-center-candidate', 'derive-terminal-patch'],
  profileVersion: accepted.profile.version,
}));
