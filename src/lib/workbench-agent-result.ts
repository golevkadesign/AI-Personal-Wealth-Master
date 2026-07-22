import type {
  DashboardProjection,
  MemoryCandidate,
  WorkbenchAgentRunMode,
  WorkbenchAgentRunResult,
  WorkbenchSessionSpec,
  WorkbenchWidgetManifest,
} from '../types/workbench';

const unique = (items: Array<string | undefined | null>) =>
  Array.from(new Set(items.filter((item): item is string => Boolean(item))));

const uniqueGeneratedFrom = (
  items: Array<NonNullable<DashboardProjection['trace']>['generatedFrom'][number] | undefined | null>,
) => Array.from(new Set(items.filter((item): item is NonNullable<DashboardProjection['trace']>['generatedFrom'][number] => Boolean(item))));

function mergeWidgetManifests(widgets: WorkbenchWidgetManifest[]) {
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

function collectWidgetManifest(session: WorkbenchSessionSpec) {
  return mergeWidgetManifests([
    ...(session.initialWidgets || []),
    ...(session.dashboardProjection?.cioBrief?.widgetManifest || []),
    ...(session.dashboardProjection?.dynamicWidgets || []),
    ...(session.railRun?.railResults.flatMap((rail) => rail.widgetManifest) || []),
  ]);
}

function collectMemoryCandidates(session: WorkbenchSessionSpec): MemoryCandidate[] {
  const candidates = [
    ...(session.railRun?.railResults.flatMap((rail) => rail.memoryCandidates) || []),
    ...(session.memoryInbox?.items.map((item) => item.candidate) || []),
  ];
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  });
}

export function createWorkbenchAgentRunResult(
  session: WorkbenchSessionSpec,
  input: {
    runMode?: WorkbenchAgentRunMode;
    hasChatResult?: boolean;
  } = {},
): WorkbenchAgentRunResult {
  const widgetManifest = collectWidgetManifest(session);
  const memoryCandidates = collectMemoryCandidates(session);
  const railRun = session.railRun;
  const dashboardProjection = session.dashboardProjection;
  const sourceRefs = unique([
    ...(session.facts?.sourceRefs || []),
    ...(railRun?.sourceRefs || []),
    ...(dashboardProjection?.sourceRefs || []),
    ...(dashboardProjection?.trace?.sourceRefs || []),
    ...(session.memoryInbox?.sourceRefs || []),
    ...widgetManifest.flatMap((widget) => widget.sourceRefs || []),
  ]);
  const generatedFrom = uniqueGeneratedFrom([
    ...(dashboardProjection?.trace?.generatedFrom || []),
    session.facts ? 'facts' : undefined,
    railRun ? 'rails' : undefined,
    session.memoryInbox ? 'memory' : undefined,
    input.hasChatResult ? 'chat' : undefined,
  ]);
  const status = dashboardProjection?.status || railRun?.status || 'awaiting_context';

  return {
    protocolVersion: 'workbench-agent-result.v1',
    sessionId: session.id,
    entryType: session.entryType,
    titleKey: session.titleKey,
    subject: session.subject,
    subjectSpec: session.subjectSpec,
    intentBias: session.intentBias,
    status,
    runMode: input.runMode || (input.hasChatResult ? 'chat_bridged' : 'rail_orchestration'),
    generatedAt: Date.now(),
    railRun,
    cioBrief: dashboardProjection?.cioBrief,
    widgetManifest,
    memoryCandidates,
    memoryInbox: session.memoryInbox,
    dashboardProjection,
    sourceRefs,
    trace: {
      generatedFrom,
      hasChatResult: Boolean(input.hasChatResult),
      bridgeMode: input.hasChatResult ? 'legacy_chat_result' : 'none',
      railCount: railRun?.summary.railCount || 0,
      widgetCount: widgetManifest.length,
      memoryCandidateCount: memoryCandidates.length,
      missingFacts: unique([
        ...(session.facts?.missingFacts || []),
        ...(railRun?.missingFacts || []),
      ]),
    },
  };
}
