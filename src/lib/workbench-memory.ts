import {
  CIOBrief,
  DashboardProjection,
  MemoryCandidate,
  MemoryCandidateStatus,
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

const countByStatus = (items: MemoryInboxItem[], status: MemoryCandidateStatus) =>
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

const createCioBrief = (sessionSpec: WorkbenchSessionSpec): CIOBrief | undefined => {
  const railRun = sessionSpec.railRun;
  if (!railRun) return undefined;

  const rails = railRun.railResults;
  const actions = rails.flatMap((rail) => rail.actions);
  const riskRails = rails.filter((rail) => rail.risks.length > 0 && rail.status !== 'blocked');
  const evidenceRefs = unique([
    ...railRun.sourceRefs,
    ...rails.flatMap((rail) => rail.evidenceRefs),
  ]);
  const readyCount = railRun.summary.readyCount;
  const partialCount = railRun.summary.partialCount;
  const blockedCount = railRun.summary.blockedCount;
  const railCount = railRun.summary.railCount;
  const hasRailConflict = riskRails.length >= 2;
  const decisionState: CIOBrief['decisionState'] =
    railCount > 0 && readyCount === railCount
      ? (hasRailConflict ? 'conflicted' : 'ready')
      : blockedCount > 0
        ? 'blocked'
        : hasRailConflict
          ? 'conflicted'
        : readyCount > 0 || partialCount > 0
          ? 'needs_context'
          : 'needs_context';
  const summary = decisionState === 'ready'
    ? 'workbench.cioBrief.ready'
    : decisionState === 'conflicted'
      ? 'workbench.cioBrief.conflicted'
    : decisionState === 'blocked'
      ? 'workbench.cioBrief.blocked'
      : readyCount > 0 || partialCount > 0
        ? 'workbench.cioBrief.partial'
        : 'workbench.cioBrief.needsContext';
  const conflicts: CIOBrief['conflicts'] = [
    ...(blockedCount > 0
      ? [{
        railIds: rails.filter((rail) => rail.status === 'blocked').map((rail) => rail.railId),
        description: 'workbench.cioBrief.blockedConflict',
        resolution: 'workbench.cioBrief.completeContextResolution',
      }]
      : []),
    ...(hasRailConflict
      ? [{
        railIds: riskRails.map((rail) => rail.railId),
        description: riskRails.some((rail) => rail.railId === 'life')
          ? 'workbench.cioBrief.lifeRailConflict'
          : 'workbench.cioBrief.railRiskConflict',
        resolution: 'workbench.cioBrief.reviewRailRiskResolution',
      }]
      : []),
  ];

  return {
    summary,
    confidence: decisionState === 'ready'
      ? 'high'
      : readyCount > 0 || partialCount > 0
        ? 'medium'
        : 'low',
    decisionState,
    conflicts,
    actions,
    evidenceRefs,
    widgetManifest: [{
      id: 'cio-brief-projection',
      type: 'cio_brief',
      titleKey: 'workbench.cioSynthesis',
      status: railRun.status,
      priority: 1,
      sourceRefs: evidenceRefs,
    }],
  };
};

export function createMemoryInboxSnapshot(sessionSpec: WorkbenchSessionSpec): MemoryInboxSnapshot {
  const candidates = sessionSpec.railRun?.railResults.flatMap((rail) => rail.memoryCandidates) || [];
  const seen = new Set<string>();
  const generatedItems: MemoryInboxItem[] = candidates
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
  const itemSeen = new Set<string>();
  const items = [
    ...(sessionSpec.memoryInbox?.items || []),
    ...generatedItems,
  ].filter((item) => {
    const key = item.candidate.id;
    if (itemSeen.has(key)) return false;
    itemSeen.add(key);
    return true;
  });

  return {
    id: `memory-inbox-${sessionSpec.id}`,
    sessionId: sessionSpec.id,
    generatedAt: Date.now(),
    pendingCount: countByStatus(items, 'pending'),
    acceptedCount: countByStatus(items, 'accepted'),
    rejectedCount: countByStatus(items, 'rejected'),
    mergedCount: countByStatus(items, 'merged'),
    temporaryCount: countByStatus(items, 'temporary'),
    revokedCount: countByStatus(items, 'revoked'),
    items,
    sourceRefs: unique(items.flatMap((item) => item.candidate.sourceRefs)),
  };
}

export function addMemoryCandidateToSession(
  sessionSpec: WorkbenchSessionSpec,
  candidate: MemoryCandidate,
): WorkbenchSessionSpec {
  const baseInbox = sessionSpec.memoryInbox || createMemoryInboxSnapshot(sessionSpec);
  const willAffectProfile = affectsProfile(candidate);
  const nextItem: MemoryInboxItem = {
    id: `inbox-${candidate.id}`,
    candidate,
    sourceSessionId: sessionSpec.id,
    sourceEntryType: sessionSpec.entryType,
    status: candidate.status,
    willAffectProfile,
    willRefreshDashboard: willAffectProfile,
    createdAt: candidate.createdAt,
    updatedAt: Date.now(),
  };
  const nextItems = [
    ...baseInbox.items.filter((item) => item.candidate.id !== candidate.id),
    nextItem,
  ];
  const nextInbox = createMemoryInboxSnapshotFromItems(sessionSpec, nextItems);

  return hydrateWorkbenchMemoryProjection({
    ...sessionSpec,
    facts: {
      ...(sessionSpec.facts || {}),
      sourceRefs: unique([
        ...(sessionSpec.facts?.sourceRefs || []),
        ...candidate.sourceRefs,
      ]),
    },
    memoryInbox: nextInbox,
  });
}

function createMemoryInboxSnapshotFromItems(
  sessionSpec: WorkbenchSessionSpec,
  items: MemoryInboxItem[],
): MemoryInboxSnapshot {
  return {
    id: sessionSpec.memoryInbox?.id || `memory-inbox-${sessionSpec.id}`,
    sessionId: sessionSpec.id,
    generatedAt: Date.now(),
    pendingCount: countByStatus(items, 'pending'),
    acceptedCount: countByStatus(items, 'accepted'),
    rejectedCount: countByStatus(items, 'rejected'),
    mergedCount: countByStatus(items, 'merged'),
    temporaryCount: countByStatus(items, 'temporary'),
    revokedCount: countByStatus(items, 'revoked'),
    items,
    sourceRefs: unique(items.flatMap((memoryItem) => memoryItem.candidate.sourceRefs)),
  };
}

const decisionToStatus = (decision: MemoryInboxDecisionType): MemoryCandidateStatus => {
  if (decision === 'reject') return 'rejected';
  if (decision === 'merge') return 'merged';
  if (decision === 'mark_temporary') return 'temporary';
  if (decision === 'revoke') return 'revoked';
  return 'accepted';
};

const createsProfileWrite = (decision: MemoryInboxDecisionType) =>
  decision === 'accept' || decision === 'merge' || decision === 'edit_and_accept';

const createDecisionDashboardProjection = (
  sessionSpec: WorkbenchSessionSpec,
  item: MemoryInboxItem,
  profile: SovereignProfile,
  candidate: MemoryCandidate,
  decisionRef: string,
) => {
  const baseItems = sessionSpec.memoryInbox?.items || createMemoryInboxSnapshot(sessionSpec).items;
  const nextItems = baseItems.map((memoryItem) => (
    memoryItem.id === item.id ? item : memoryItem
  ));
  const nextInbox = createMemoryInboxSnapshotFromItems(sessionSpec, nextItems);
  const nextSessionSpec: WorkbenchSessionSpec = {
    ...sessionSpec,
    facts: {
      ...(sessionSpec.facts || {}),
      sovereignProfile: profile,
      sourceRefs: unique([
        ...(sessionSpec.facts?.sourceRefs || []),
        ...candidate.sourceRefs,
        decisionRef,
      ]),
    },
    memoryInbox: nextInbox,
  };

  return createDashboardProjection(nextSessionSpec, profile, nextInbox);
};

export function createDashboardProjection(
  sessionSpec: WorkbenchSessionSpec,
  profile?: SovereignProfile,
  memoryInbox: MemoryInboxSnapshot = createMemoryInboxSnapshot(sessionSpec),
): DashboardProjection {
  const dynamicWidgets = collectRenderableWidgets(sessionSpec);
  const cioBrief = createCioBrief(sessionSpec);
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
    cioBrief,
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
    status: decisionToStatus(input.decision),
  };
  const item: MemoryInboxItem = {
    ...input.item,
    candidate,
    status: candidate.status,
    willAffectProfile: createsProfileWrite(input.decision) && affectsProfile(candidate),
    willRefreshDashboard: createsProfileWrite(input.decision) || input.decision === 'revoke',
    updatedAt: now,
  };

  if (input.decision === 'reject' || input.decision === 'mark_temporary') {
    return { item, profile: input.profile };
  }

  const versionBefore = input.profile.version || 1;

  if (input.decision === 'revoke') {
    const event = {
      id: `profile-event-revoke-${candidate.id}-${now}`,
      candidateId: candidate.id,
      decision: input.decision,
      profileVersionBefore: versionBefore,
      profileVersionAfter: versionBefore + 1,
      sourceRefs: unique([...candidate.sourceRefs, 'memory_inbox.revoke']),
      createdAt: now,
    };
    const profile: SovereignProfile = {
      ...input.profile,
      version: versionBefore + 1,
      updatedAt: now,
      behavioralPatterns: mergeRecords(input.profile.behavioralPatterns, {
        revokedMemoryCandidateIds: [candidate.id],
      }),
      decisionLedger: [
        ...(input.profile.decisionLedger || []),
        event,
      ],
      sourceRefs: unique([
        ...(input.profile.sourceRefs || []),
        ...candidate.sourceRefs,
        'memory_inbox.revoke',
      ]),
    };

    return {
      item,
      profile,
      event,
      dashboardProjection: input.sessionSpec
        ? createDecisionDashboardProjection(input.sessionSpec, item, profile, candidate, 'memory_inbox.revoke')
        : undefined,
    };
  }

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
      ? createDecisionDashboardProjection(input.sessionSpec, item, profile, candidate, 'memory_inbox.decision')
      : undefined,
  };
}

export function createMemoryProjectionDebugSnapshot(sessionSpec: WorkbenchSessionSpec | null) {
  if (!sessionSpec) return null;
  const memoryItems = sessionSpec.memoryInbox?.items || [];
  return {
    profileVersion: sessionSpec.dashboardProjection?.profileVersion || sessionSpec.facts?.sovereignProfile?.version || 0,
    memoryPendingCount: sessionSpec.memoryInbox?.pendingCount || 0,
    memoryAcceptedCount: sessionSpec.memoryInbox?.acceptedCount || 0,
    memoryRejectedCount: sessionSpec.memoryInbox?.rejectedCount || 0,
    memoryMergedCount: sessionSpec.memoryInbox?.mergedCount || 0,
    memoryTemporaryCount: sessionSpec.memoryInbox?.temporaryCount || 0,
    memoryRevokedCount: sessionSpec.memoryInbox?.revokedCount || 0,
    memoryAffectProfileCount: memoryItems.filter((item) => item.willAffectProfile).length,
    memoryRefreshDashboardCount: memoryItems.filter((item) => item.willRefreshDashboard).length,
    memoryCandidateTypes: unique(memoryItems.map((item) => item.candidate.type)).join(','),
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
