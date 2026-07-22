import type { TerminalState } from '../types/terminal';
import type {
  MemoryInboxDecisionInput,
  MemoryInboxItem,
  SovereignProfilePatchEvent,
  WorkbenchAuditDecisionRecord,
  WorkbenchAuditSessionRecord,
  WorkbenchAuditSnapshot,
  WorkbenchSessionSpec,
} from '../types/workbench';
import { createWorkbenchAgentRunResult } from './workbench-agent-result';

const MAX_AUDIT_SESSIONS = 24;
const MAX_AUDIT_DECISIONS = 120;
const MAX_AUDIT_PROFILE_EVENTS = 120;

const unique = (items: Array<string | undefined | null>) =>
  Array.from(new Set(items.filter((item): item is string => Boolean(item))));

function upsertLatestById<T extends { id: string; updatedAt?: number; createdAt?: number }>(
  items: T[],
  nextItem: T,
  limit: number,
) {
  return [
    nextItem,
    ...items.filter((item) => item.id !== nextItem.id),
  ]
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, limit);
}

function getExistingAudit(terminalState?: TerminalState): WorkbenchAuditSnapshot {
  const existing = terminalState?.workbenchAudit as WorkbenchAuditSnapshot | undefined;
  return {
    version: 1,
    updatedAt: existing?.updatedAt || Date.now(),
    latestSessionId: existing?.latestSessionId,
    latestDecisionId: existing?.latestDecisionId,
    sessions: Array.isArray(existing?.sessions) ? existing.sessions : [],
    decisions: Array.isArray(existing?.decisions) ? existing.decisions : [],
    profileEvents: Array.isArray(existing?.profileEvents) ? existing.profileEvents : [],
    stats: {
      sessionCount: existing?.stats?.sessionCount || existing?.sessions?.length || 0,
      decisionCount: existing?.stats?.decisionCount || existing?.decisions?.length || 0,
      profileEventCount: existing?.stats?.profileEventCount || existing?.profileEvents?.length || 0,
      pendingMemoryCount: existing?.stats?.pendingMemoryCount || 0,
      acceptedMemoryCount: existing?.stats?.acceptedMemoryCount || 0,
      rejectedMemoryCount: existing?.stats?.rejectedMemoryCount || 0,
    },
    sourceRefs: Array.isArray(existing?.sourceRefs) ? existing.sourceRefs : [],
  };
}

function summarizeMemoryInbox(session: WorkbenchSessionSpec): WorkbenchAuditSessionRecord['memoryInboxSummary'] | undefined {
  if (!session.memoryInbox) return undefined;
  return {
    pendingCount: session.memoryInbox.pendingCount || 0,
    acceptedCount: session.memoryInbox.acceptedCount || 0,
    rejectedCount: session.memoryInbox.rejectedCount || 0,
    mergedCount: session.memoryInbox.mergedCount || 0,
    temporaryCount: session.memoryInbox.temporaryCount || 0,
    revokedCount: session.memoryInbox.revokedCount || 0,
  };
}

export function createWorkbenchAuditSessionRecord(session: WorkbenchSessionSpec): WorkbenchAuditSessionRecord {
  const latestEvent = session.events?.at(-1);
  const agentResult = createWorkbenchAgentRunResult(session);
  return {
    id: session.id,
    entryType: session.entryType,
    titleKey: session.titleKey,
    subject: session.subject,
    subjectSpec: session.subjectSpec,
    intentBias: session.intentBias,
    defaultWidgetPreset: session.defaultWidgetPreset,
    status: agentResult.status,
    createdAt: session.createdAt,
    updatedAt: Date.now(),
    railSummary: session.railRun?.summary,
    memoryInboxSummary: summarizeMemoryInbox(session),
    dashboardProjectionId: session.dashboardProjection?.id,
    widgetCount: agentResult.widgetManifest.length,
    eventCount: session.events?.length || 0,
    latestEventPhase: latestEvent?.phase,
    latestEventStatus: latestEvent?.status,
    sourceRefs: agentResult.sourceRefs.slice(0, 24),
  };
}

export function createWorkbenchAuditDecisionRecord(input: {
  item: MemoryInboxItem;
  decision: MemoryInboxDecisionInput;
  session: WorkbenchSessionSpec;
}): WorkbenchAuditDecisionRecord {
  const now = Date.now();
  return {
    id: `decision-${input.item.id}-${now}`,
    sessionId: input.session.id,
    sourceEntryType: input.item.sourceEntryType,
    itemId: input.item.id,
    candidateId: input.item.candidate.id,
    decision: input.decision.decision,
    status: input.item.status,
    title: input.item.candidate.title,
    willAffectProfile: input.item.willAffectProfile,
    willRefreshDashboard: input.item.willRefreshDashboard,
    sourceRefs: input.item.candidate.sourceRefs,
    createdAt: input.item.createdAt,
    updatedAt: now,
  };
}

function computeStats(audit: Omit<WorkbenchAuditSnapshot, 'stats'>): WorkbenchAuditSnapshot['stats'] {
  return {
    sessionCount: audit.sessions.length,
    decisionCount: audit.decisions.length,
    profileEventCount: audit.profileEvents.length,
    pendingMemoryCount: audit.sessions.reduce((sum, session) => sum + (session.memoryInboxSummary?.pendingCount || 0), 0),
    acceptedMemoryCount: audit.decisions.filter((decision) => decision.status === 'accepted' || decision.status === 'merged').length,
    rejectedMemoryCount: audit.decisions.filter((decision) => decision.status === 'rejected' || decision.status === 'revoked').length,
  };
}

export function createWorkbenchAuditPatch(input: {
  terminalState?: TerminalState;
  session?: WorkbenchSessionSpec | null;
  decisionRecord?: WorkbenchAuditDecisionRecord;
  profileEvent?: SovereignProfilePatchEvent;
}): Partial<TerminalState> {
  const existing = getExistingAudit(input.terminalState);
  const sessionRecord = input.session ? createWorkbenchAuditSessionRecord(input.session) : undefined;
  const profileEvents = input.profileEvent
    ? upsertLatestById(existing.profileEvents, input.profileEvent, MAX_AUDIT_PROFILE_EVENTS)
    : existing.profileEvents;
  const sessions = sessionRecord
    ? upsertLatestById(existing.sessions, sessionRecord, MAX_AUDIT_SESSIONS)
    : existing.sessions;
  const decisions = input.decisionRecord
    ? upsertLatestById(existing.decisions, input.decisionRecord, MAX_AUDIT_DECISIONS)
    : existing.decisions;
  const sourceRefs = unique([
    ...(existing.sourceRefs || []),
    ...(sessionRecord?.sourceRefs || []),
    ...(input.decisionRecord?.sourceRefs || []),
    ...(input.profileEvent?.sourceRefs || []),
  ]).slice(-80);
  const base = {
    version: 1 as const,
    updatedAt: Date.now(),
    latestSessionId: sessionRecord?.id || existing.latestSessionId,
    latestDecisionId: input.decisionRecord?.id || existing.latestDecisionId,
    sessions,
    decisions,
    profileEvents,
    sourceRefs,
  };

  return {
    workbenchAudit: {
      ...base,
      stats: computeStats(base),
    },
  };
}
