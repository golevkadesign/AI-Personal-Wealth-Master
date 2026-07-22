import type {
  WorkbenchEntryType,
  WorkbenchSessionSpec,
  WorkbenchWidgetManifest,
  WorkbenchWidgetType,
} from '../types/workbench';

export type WorkbenchWidgetPhase = 'initial' | 'reply';
export type WorkbenchWidgetSelectionReason =
  | 'entry_initial'
  | 'prompt_rail_reply'
  | 'chat_reply'
  | 'memory_reply'
  | 'dashboard_projection_reply';

export interface WorkbenchWidgetSelection {
  phase: WorkbenchWidgetPhase;
  reason: WorkbenchWidgetSelectionReason;
  widgets: WorkbenchWidgetManifest[];
  selectedTypes: WorkbenchWidgetType[];
  candidateCount: number;
}

const ENTRY_WIDGET_PRESETS: Record<WorkbenchEntryType, Record<WorkbenchWidgetPhase, WorkbenchWidgetType[]>> = {
  manual_chat: {
    initial: ['shared_facts', 'rail_card', 'cio_brief'],
    reply: ['cio_brief', 'rail_card', 'action_queue'],
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
    initial: [
      'holding_quote_snapshot',
      'holding_value_summary',
      'holding_trend_chart',
      'holding_quant_indicators',
      'holding_strategy_deductions',
      'confidence',
    ],
    reply: [
      'holding_strategy_deductions',
      'holding_quant_indicators',
      'holding_trend_chart',
      'intent_fingerprint',
      'suggested_tilt',
      'confidence',
    ],
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
    initial: ['memory_candidate', 'shared_facts', 'action_queue'],
    reply: ['memory_candidate', 'cio_brief', 'action_queue', 'confidence'],
  },
  portfolio_intelligence: {
    initial: ['portfolio_map', 'current_exposure', 'intent_fingerprint'],
    reply: ['portfolio_map', 'intent_fingerprint', 'missing_pieces', 'suggested_tilt', 'projected_exposure'],
  },
};

const ENTRY_WIDGET_LIMITS: Record<WorkbenchEntryType, Record<WorkbenchWidgetPhase, number>> = {
  manual_chat: { initial: 3, reply: 4 },
  dashboard_brief: { initial: 3, reply: 4 },
  widget: { initial: 3, reply: 4 },
  holding: { initial: 6, reply: 6 },
  portfolio_review: { initial: 3, reply: 5 },
  life_strategy: { initial: 3, reply: 4 },
  profile_memory: { initial: 3, reply: 4 },
  portfolio_intelligence: { initial: 3, reply: 5 },
};

const SESSION_FIRST_WIDGETS = new Set<WorkbenchWidgetType>([
  'shared_facts',
  'rail_card',
  'cio_brief',
  'memory_candidate',
  'portfolio_map',
]);

const RESPONSE_WIDGET_TYPES = new Set<WorkbenchWidgetType>([
  'cio_brief',
  'rail_card',
  'evidence',
  'source',
  'confidence',
  'memory_candidate',
  'action_queue',
  'portfolio_map',
  'current_exposure',
  'intent_fingerprint',
  'missing_pieces',
  'suggested_tilt',
  'projected_exposure',
  'holding_quote_snapshot',
  'holding_value_summary',
  'holding_sync_status',
  'holding_trend_chart',
  'holding_quant_indicators',
  'holding_strategy_deductions',
  'holding_analysis_snapshot_diff',
]);

function isWorkbenchChatSourceRef(ref: string | undefined | null) {
  if (!ref) return false;
  return ref.startsWith('chat.') || ref === 'workbench.native_chat' || ref.startsWith('workbench.native_chat.');
}

function hasChatDerivedWidgets(session: WorkbenchSessionSpec) {
  const widgets = [
    ...(session.dashboardProjection?.dynamicWidgets || []),
    ...(session.dashboardProjection?.cioBrief?.widgetManifest || []),
    ...(session.railRun?.railResults.flatMap((rail) => rail.widgetManifest) || []),
  ];
  return widgets.some((widget) => (
    widget.id.includes('chat') ||
    widget.sourceRefs?.some(isWorkbenchChatSourceRef)
  ));
}

function hasPromptRailReply(session: WorkbenchSessionSpec) {
  return Boolean(
    (session.facts?.userPrompt || session.facts?.summary?.hasUserPrompt) &&
    session.railRun?.completedAt,
  );
}

function hasProjectionUpdateSource(session: WorkbenchSessionSpec) {
  const sourceRefs = [
    ...(session.facts?.sourceRefs || []),
    ...(session.dashboardProjection?.sourceRefs || []),
    ...(session.dashboardProjection?.trace?.sourceRefs || []),
  ];
  return sourceRefs.some((ref) => (
    ref.startsWith('memory_inbox.') ||
    ref === 'profile_report.manual_edit' ||
    ref === 'portfolio_review.memory_candidate' ||
    ref === 'projection.trigger.profile_update' ||
    ref === 'projection.trigger.memory_decision' ||
    ref === 'projection.trigger.portfolio_review_memory'
  ));
}

function getWorkbenchWidgetSelectionReason(session: WorkbenchSessionSpec): WorkbenchWidgetSelectionReason {
  const sourceRefs = [
    ...(session.facts?.sourceRefs || []),
    ...(session.dashboardProjection?.sourceRefs || []),
    ...(session.dashboardProjection?.trace?.sourceRefs || []),
  ];
  if (
    sourceRefs.some(isWorkbenchChatSourceRef) ||
    session.dashboardProjection?.trace?.generatedFrom.includes('chat') ||
    hasChatDerivedWidgets(session)
  ) {
    return 'chat_reply';
  }
  if (hasPromptRailReply(session)) {
    return 'prompt_rail_reply';
  }
  if (session.entryType === 'profile_memory' && session.memoryInbox?.items.some((item) => item.status !== 'pending')) {
    return 'memory_reply';
  }
  if (
    hasProjectionUpdateSource(session) &&
    (
      session.dashboardProjection?.trace?.generatedFrom.includes('profile') ||
      session.dashboardProjection?.trace?.generatedFrom.includes('memory')
    )
  ) {
    return 'dashboard_projection_reply';
  }
  return 'entry_initial';
}

export function getWorkbenchWidgetPhase(session: WorkbenchSessionSpec): WorkbenchWidgetPhase {
  return getWorkbenchWidgetSelectionReason(session) === 'entry_initial' ? 'initial' : 'reply';
}

export function mergeWorkbenchWidgetManifests(widgets: WorkbenchWidgetManifest[]) {
  const seen = new Set<string>();
  return widgets
    .filter((widget) => {
      const key = `${widget.railId || 'session'}:${widget.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));
}

function dedupeWorkbenchWidgetManifestsPreserveOrder(widgets: WorkbenchWidgetManifest[]) {
  const seen = new Set<string>();
  return widgets.filter((widget) => {
    const key = `${widget.railId || 'session'}:${widget.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getWidgetCandidates(session: WorkbenchSessionSpec) {
  const railWidgets = session.railRun?.railResults.flatMap((rail) => rail.widgetManifest) || [];
  const dynamicWidgets = session.dashboardProjection?.dynamicWidgets || [];
  const cioWidgets = session.dashboardProjection?.cioBrief?.widgetManifest || [];
  return mergeWorkbenchWidgetManifests([
    ...(session.initialWidgets || []),
    ...cioWidgets,
    ...dynamicWidgets,
    ...railWidgets,
  ]);
}

function scoreWidget(widget: WorkbenchWidgetManifest, phase: WorkbenchWidgetPhase) {
  let score = widget.priority || 50;
  if (widget.status === 'ready') score -= 12;
  if (widget.status === 'partial') score -= 6;
  if (widget.status === 'blocked' || widget.status === 'error') score += 8;
  if (phase === 'initial' && SESSION_FIRST_WIDGETS.has(widget.type)) score -= 4;
  if (phase === 'reply' && widget.sourceRefs?.some(isWorkbenchChatSourceRef)) score -= 10;
  return score;
}

function pickWidgetForType(
  type: WorkbenchWidgetType,
  phase: WorkbenchWidgetPhase,
  candidates: WorkbenchWidgetManifest[],
) {
  return candidates
    .filter((widget) => widget.type === type)
    .sort((a, b) => {
      const scoreDelta = scoreWidget(a, phase) - scoreWidget(b, phase);
      if (scoreDelta !== 0) return scoreDelta;
      return (a.priority || 99) - (b.priority || 99);
    })[0];
}

function getDesiredTypes(session: WorkbenchSessionSpec, phase: WorkbenchWidgetPhase) {
  const preset = ENTRY_WIDGET_PRESETS[session.entryType] || ENTRY_WIDGET_PRESETS.manual_chat;
  const desiredTypes = [...preset[phase]];
  const hasMemoryCandidates = Boolean(session.memoryInbox?.items.length);
  if (phase === 'reply' && hasMemoryCandidates && !desiredTypes.includes('memory_candidate')) {
    desiredTypes.push('memory_candidate');
  }
  return desiredTypes;
}

function getWidgetLimit(session: WorkbenchSessionSpec, phase: WorkbenchWidgetPhase) {
  return ENTRY_WIDGET_LIMITS[session.entryType]?.[phase] || (phase === 'reply' ? 4 : 3);
}

export function getRenderableWorkbenchWidgetSelection(session: WorkbenchSessionSpec): WorkbenchWidgetSelection {
  const reason = getWorkbenchWidgetSelectionReason(session);
  const phase: WorkbenchWidgetPhase = reason === 'entry_initial' ? 'initial' : 'reply';
  const candidates = getWidgetCandidates(session);
  const desiredTypes = getDesiredTypes(session, phase);
  const limit = getWidgetLimit(session, phase);

  const selected = desiredTypes
    .map((type) => pickWidgetForType(type, phase, candidates))
    .filter((widget): widget is WorkbenchWidgetManifest => Boolean(widget))
    .slice(0, limit);

  if (selected.length > 0) {
    return {
      phase,
      reason,
    widgets: selected,
      selectedTypes: selected.map((widget) => widget.type),
      candidateCount: candidates.length,
    };
  }

  const fallbackWidgets = candidates
    .slice()
    .sort((a, b) => (a.priority || 99) - (b.priority || 99))
    .slice(0, 4);

  return {
    phase,
    reason,
    widgets: fallbackWidgets,
    selectedTypes: fallbackWidgets.map((widget) => widget.type),
    candidateCount: candidates.length,
  };
}

export function getRenderableWorkbenchWidgets(session: WorkbenchSessionSpec) {
  return getRenderableWorkbenchWidgetSelection(session).widgets;
}

function isResponseRelevantWidget(widget: WorkbenchWidgetManifest, session: WorkbenchSessionSpec) {
  return Boolean(
    widget.sourceRefs?.some(isWorkbenchChatSourceRef) ||
    widget.id.includes('chat') ||
    widget.id.includes('cio-brief-chat') ||
    (widget.type === 'memory_candidate' && Boolean(session.memoryInbox?.items.length)),
  );
}

export function getWorkbenchResponseWidgets(session: WorkbenchSessionSpec, maxWidgets = 4) {
  const candidates = getWidgetCandidates(session)
    .filter((widget) => RESPONSE_WIDGET_TYPES.has(widget.type))
    .filter((widget) => isResponseRelevantWidget(widget, session));
  const desiredTypes = getDesiredTypes(session, 'reply');
  const selected = desiredTypes
    .map((type) => pickWidgetForType(type, 'reply', candidates))
    .filter((widget): widget is WorkbenchWidgetManifest => Boolean(widget));

  if (selected.length > 0) {
    return dedupeWorkbenchWidgetManifestsPreserveOrder(selected).slice(0, maxWidgets);
  }

  return mergeWorkbenchWidgetManifests(candidates)
    .sort((a, b) => scoreWidget(a, 'reply') - scoreWidget(b, 'reply'))
    .slice(0, maxWidgets);
}
