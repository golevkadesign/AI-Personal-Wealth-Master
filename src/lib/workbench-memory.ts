import {
  DashboardProjection,
  MemoryCandidate,
  MemoryInboxDecisionResult,
  MemoryInboxDecisionType,
  MemoryInboxItem,
  MemoryInboxSnapshot,
  SovereignProfile,
  WorkbenchSessionSpec,
  WorkbenchWidgetManifest,
} from '../types/workbench';
import { createSovereignProfileFromTerminalState } from './workbench-facts';
import { buildPortfolioIntelligenceMap } from './portfolio-intelligence';

const unique = (items: Array<string | undefined | null>) =>
  Array.from(new Set(items.filter((item): item is string => Boolean(item))));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const countByStatus = (items: MemoryInboxItem[], status: MemoryCandidate['status']) =>
  items.filter((item) => item.status === status).length;

const affectsProfile = (candidate: MemoryCandidate) =>
  Boolean(candidate.structuredPatch) ||
  candidate.type === 'profile_fact' ||
  candidate.type === 'behavioral_pattern' ||
  candidate.type === 'decision_rule' ||
  candidate.type === 'life_constraint' ||
  candidate.type === 'risk_preference';

const mergeRecords = (
  base: Record<string, unknown> | undefined,
  patch: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  if (!patch) return { ...(base || {}) };
  return Object.entries(patch).reduce<Record<string, unknown>>((next, [key, value]) => {
    const current = next[key];
    if (Array.isArray(value)) {
      next[key] = Array.isArray(current) ? [...current, ...value] : [...value];
      return next;
    }
    if (isRecord(value)) {
      next[key] = mergeRecords(isRecord(current) ? current : undefined, value);
      return next;
    }
    next[key] = value;
    return next;
  }, { ...(base || {}) });
};

const mergeProfilePatch = (
  profile: SovereignProfile,
  patch?: Partial<SovereignProfile>,
): SovereignProfile => {
  if (!patch) return { ...profile };
  return {
    ...profile,
    ...patch,
    identity: mergeRecords(profile.identity, patch.identity),
    lifeConstraints: mergeRecords(profile.lifeConstraints, patch.lifeConstraints),
    riskPreferences: mergeRecords(profile.riskPreferences, patch.riskPreferences),
    allocationPolicy: mergeRecords(profile.allocationPolicy, patch.allocationPolicy),
    behavioralPatterns: mergeRecords(profile.behavioralPatterns, patch.behavioralPatterns),
    decisionLedger: [
      ...(profile.decisionLedger || []),
      ...(patch.decisionLedger || []),
    ],
    sourceRefs: unique([...(profile.sourceRefs || []), ...(patch.sourceRefs || [])]),
  };
};

const getCandidatePatch = (candidate: MemoryCandidate): SovereignProfile => {
  const ledgerEntry = {
    id: candidate.id,
    type: candidate.type,
    title: candidate.title,
    body: candidate.body,
    confidence: candidate.confidence,
    sourceRefs: candidate.sourceRefs,
    createdAt: candidate.createdAt,
  };

  return mergeProfilePatch(
    {
      version: 1,
      decisionLedger: [ledgerEntry],
      sourceRefs: candidate.sourceRefs,
    },
    candidate.structuredPatch,
  );
};

const collectRenderableWidgets = (sessionSpec: WorkbenchSessionSpec): WorkbenchWidgetManifest[] => {
  const widgets = [
    ...(sessionSpec.initialWidgets || []),
    ...(sessionSpec.railRun?.railResults.flatMap((rail) => rail.widgetManifest) || []),
    ...(sessionSpec.dashboardProjection?.cioBrief?.widgetManifest || []),
  ];
  const seen = new Set<string>();
  return widgets.filter((widget) => {
    const key = `${widget.railId || 'session'}:${widget.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function createMemoryInboxSnapshot(sessionSpec: WorkbenchSessionSpec): MemoryInboxSnapshot {
  const candidates = sessionSpec.railRun?.railResults.flatMap((rail) => rail.memoryCandidates) || [];
  const seen = new Set<string>();
  const items: MemoryInboxItem[] = candidates
    .filter((candidate) => {
      if (seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    })
    .map((candidate) => {
      const willAffectProfile = affectsProfile(candidate);
      return {
        id: `inbox-${candidate.id}`,
        candidate,
        sourceSessionId: sessionSpec.id,
        sourceEntryType: sessionSpec.entryType,
        status: candidate.status,
        willAffectProfile,
        willRefreshDashboard: willAffectProfile || candidate.status === 'accepted' || candidate.status === 'merged',
        createdAt: candidate.createdAt,
        updatedAt: Date.now(),
      };
    });

  return {
    id: `memory-inbox-${sessionSpec.id}`,
    sessionId: sessionSpec.id,
    generatedAt: Date.now(),
    pendingCount: countByStatus(items, 'pending'),
    acceptedCount: countByStatus(items, 'accepted'),
    rejectedCount: countByStatus(items, 'rejected'),
    mergedCount: countByStatus(items, 'merged'),
    items,
    sourceRefs: unique(items.flatMap((item) => item.candidate.sourceRefs)),
  };
}

export function createDashboardProjection(
  sessionSpec: WorkbenchSessionSpec,
  profile?: SovereignProfile,
  memoryInbox: MemoryInboxSnapshot = createMemoryInboxSnapshot(sessionSpec),
): DashboardProjection {
  const dynamicWidgets = collectRenderableWidgets(sessionSpec);
  const portfolioIntelligenceMap = buildPortfolioIntelligenceMap({
    accountPortfolios: sessionSpec.facts?.publicHoldingAccounts,
    terminalState: sessionSpec.facts?.terminalState,
  });
  const sourceRefs = unique([
    ...(sessionSpec.facts?.sourceRefs || []),
    ...(sessionSpec.railRun?.sourceRefs || []),
    ...(profile?.sourceRefs || []),
    ...memoryInbox.sourceRefs,
    ...portfolioIntelligenceMap.sourceRefs,
  ]);
  const generatedFrom = unique([
    sessionSpec.facts ? 'facts' : undefined,
    sessionSpec.railRun ? 'rails' : undefined,
    profile ? 'profile' : undefined,
    memoryInbox.items.length > 0 ? 'memory' : undefined,
  ]) as Array<'facts' | 'rails' | 'profile' | 'memory'>;

  return {
    id: `dashboard-projection-${sessionSpec.id}`,
    profileVersion: profile?.version,
    generatedAt: Date.now(),
    status: sessionSpec.railRun?.status || 'awaiting_context',
    portfolioIntelligenceMap,
    dynamicWidgets,
    memoryCandidateCount: memoryInbox.items.length,
    widgetCount: dynamicWidgets.length,
    sourceRefs,
    trace: {
      sessionId: sessionSpec.id,
      railRunId: sessionSpec.railRun?.id,
      candidateIds: memoryInbox.items.map((item) => item.candidate.id),
      generatedFrom,
      sourceRefs: unique([...sourceRefs, ...portfolioIntelligenceMap.sourceRefs]),
    },
  };
}

export function hydrateWorkbenchMemoryProjection(sessionSpec: WorkbenchSessionSpec): WorkbenchSessionSpec {
  const profile =
    sessionSpec.facts?.sovereignProfile ||
    createSovereignProfileFromTerminalState(sessionSpec.facts?.terminalState);
  const memoryInbox = createMemoryInboxSnapshot(sessionSpec);
  const dashboardProjection = createDashboardProjection(sessionSpec, profile, memoryInbox);

  return {
    ...sessionSpec,
    facts: {
      ...(sessionSpec.facts || {}),
      sovereignProfile: profile,
    },
    memoryInbox,
    dashboardProjection,
  };
}

export function applyMemoryInboxDecision(input: {
  item: MemoryInboxItem;
  profile: SovereignProfile;
  decision: MemoryInboxDecisionType;
  editedPatch?: Partial<SovereignProfile>;
  editedTitle?: string;
  editedBody?: string;
  sessionSpec?: WorkbenchSessionSpec;
}): MemoryInboxDecisionResult {
  const now = Date.now();
  const candidate: MemoryCandidate = {
    ...input.item.candidate,
    title: input.editedTitle || input.item.candidate.title,
    body: input.editedBody || input.item.candidate.body,
    structuredPatch: input.editedPatch || input.item.candidate.structuredPatch,
    status:
      input.decision === 'reject'
        ? 'rejected'
        : input.decision === 'merge'
          ? 'merged'
          : 'accepted',
  };
  const item: MemoryInboxItem = {
    ...input.item,
    candidate,
    status: candidate.status,
    willAffectProfile: affectsProfile(candidate),
    willRefreshDashboard: input.decision !== 'reject',
    updatedAt: now,
  };

  if (input.decision === 'reject') {
    return { item, profile: input.profile };
  }

  const versionBefore = input.profile.version || 1;
  const patch = mergeProfilePatch(getCandidatePatch(candidate), input.editedPatch);
  const profile: SovereignProfile = {
    ...mergeProfilePatch(input.profile, patch),
    version: versionBefore + 1,
    updatedAt: now,
    sourceRefs: unique([
      ...(input.profile.sourceRefs || []),
      ...candidate.sourceRefs,
      ...(patch.sourceRefs || []),
    ]),
  };
  const event = {
    id: `profile-event-${candidate.id}-${now}`,
    candidateId: candidate.id,
    decision: input.decision,
    profileVersionBefore: versionBefore,
    profileVersionAfter: profile.version,
    sourceRefs: candidate.sourceRefs,
    createdAt: now,
  };

  return {
    item,
    profile,
    event,
    dashboardProjection: input.sessionSpec
      ? createDashboardProjection(input.sessionSpec, profile, {
        ...createMemoryInboxSnapshot(input.sessionSpec),
        items: [item],
      })
      : undefined,
  };
}

export function createMemoryProjectionDebugSnapshot(sessionSpec: WorkbenchSessionSpec | null) {
  if (!sessionSpec) return null;
  return {
    profileVersion: sessionSpec.dashboardProjection?.profileVersion || sessionSpec.facts?.sovereignProfile?.version || 0,
    memoryPendingCount: sessionSpec.memoryInbox?.pendingCount || 0,
    memoryAcceptedCount: sessionSpec.memoryInbox?.acceptedCount || 0,
    memoryRejectedCount: sessionSpec.memoryInbox?.rejectedCount || 0,
    memoryMergedCount: sessionSpec.memoryInbox?.mergedCount || 0,
    projectionStatus: sessionSpec.dashboardProjection?.status || 'awaiting_context',
    projectionWidgetCount: sessionSpec.dashboardProjection?.widgetCount || 0,
    projectionSourceCount: sessionSpec.dashboardProjection?.sourceRefs.length || 0,
    projectionTrace:
      sessionSpec.dashboardProjection?.trace?.generatedFrom.join(',') || '',
    portfolioMapPositionCount: sessionSpec.dashboardProjection?.portfolioIntelligenceMap?.positions.length || 0,
    portfolioMapMissingCount: sessionSpec.dashboardProjection?.portfolioIntelligenceMap?.missingPieces.length || 0,
    portfolioMapTiltCount: sessionSpec.dashboardProjection?.portfolioIntelligenceMap?.suggestedTilts.length || 0,
  };
}
