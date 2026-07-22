import {
  AgentRailResult,
  CIOBrief,
  DashboardProjection,
  MemoryCandidate,
  WorkbenchEntryType,
  WorkbenchRailId,
  WorkbenchRailRun,
  WorkbenchSessionSpec,
  WorkbenchWidgetManifest,
  WorkbenchWidgetStatus,
  WorkbenchWidgetType,
} from '../types/workbench';
import {
  createMemoryInboxSnapshot,
  hydrateWorkbenchMemoryProjection,
} from './workbench-memory';

type ChatBridgeInput = {
  sessionSpec: WorkbenchSessionSpec;
  railRun: WorkbenchRailRun;
  chatResult?: any;
};

const RAIL_SECTION_MATCHERS: Record<WorkbenchRailId, RegExp[]> = {
  equity: [/市场/, /标的/, /量化/, /股票/, /持仓/, /黑天鹅/, /压力测试/, /market/i, /ticker/i, /portfolio/i],
  allocation: [/资产配置/, /综合理财/, /家族财富/, /配置/, /财富/, /债务/, /现金流/, /allocation/i, /wealth/i],
  life: [/综合理财/, /现金流/, /债务/, /家族/, /画像/, /长期/, /人生/, /profile/i, /memory/i, /life/i],
};

const CHAT_SOURCE_REFS = ['chat.expert_analysis'];

type ChatSectionSnippet = {
  section: string;
  summary: string;
  sourceRef: string;
};

type EntryReplyWidgetRule = {
  id: string;
  type: WorkbenchWidgetType;
  titleKey: string;
  priority: number;
  matchers: RegExp[];
};

const ENTRY_REPLY_WIDGET_RULES: Partial<Record<WorkbenchEntryType, EntryReplyWidgetRule[]>> = {
  holding: [
    {
      id: 'chat-holding-strategy-deductions',
      type: 'holding_strategy_deductions',
      titleKey: 'workbench.holdingStrategyDeductions',
      priority: 1,
      matchers: [/持仓智能分析/, /财富策略/, /策略/, /建议/, /风险/, /机会/, /action/i, /risk/i, /opportun/i],
    },
    {
      id: 'chat-holding-quant-indicators',
      type: 'holding_quant_indicators',
      titleKey: 'workbench.holdingQuantIndicators',
      priority: 2,
      matchers: [/技术/, /量化/, /指标/, /RSI/i, /MACD/i, /ADX/i, /BB/i, /布林/, /均线/, /technical/i, /quant/i],
    },
    {
      id: 'chat-holding-trend-chart',
      type: 'holding_trend_chart',
      titleKey: 'workbench.holdingTrendChart',
      priority: 3,
      matchers: [/趋势/, /走势/, /价格/, /历史/, /trend/i, /price/i, /history/i],
    },
    {
      id: 'chat-holding-intent-fingerprint',
      type: 'intent_fingerprint',
      titleKey: 'workbench.intentFingerprint',
      priority: 4,
      matchers: [/意图/, /倾向/, /行业/, /赛道/, /上游/, /下游/, /intent/i, /sector/i],
    },
    {
      id: 'chat-holding-suggested-tilt',
      type: 'suggested_tilt',
      titleKey: 'workbench.suggestedTilt',
      priority: 5,
      matchers: [/调仓/, /补齐/, /扩充/, /配置/, /tilt/i, /rebalance/i, /missing/i],
    },
  ],
  portfolio_review: [
    {
      id: 'chat-portfolio-map',
      type: 'portfolio_map',
      titleKey: 'workbench.portfolioIntelligenceMap',
      priority: 1,
      matchers: [/组合/, /仓位/, /持仓/, /地图/, /版图/, /行业/, /赛道/, /portfolio/i, /exposure/i, /allocation/i],
    },
    {
      id: 'chat-portfolio-missing-pieces',
      type: 'missing_pieces',
      titleKey: 'workbench.missingPieces',
      priority: 2,
      matchers: [/缺失/, /补齐/, /缺口/, /上下游/, /missing/i, /gap/i, /supply/i],
    },
    {
      id: 'chat-portfolio-suggested-tilt',
      type: 'suggested_tilt',
      titleKey: 'workbench.suggestedTilt',
      priority: 3,
      matchers: [/调仓/, /倾斜/, /建议/, /再平衡/, /tilt/i, /rebalance/i, /action/i],
    },
    {
      id: 'chat-portfolio-projected-exposure',
      type: 'projected_exposure',
      titleKey: 'workbench.projectedExposure',
      priority: 4,
      matchers: [/预测/, /模拟/, /执行后/, /projection/i, /projected/i, /simulation/i],
    },
  ],
  portfolio_intelligence: [
    {
      id: 'chat-portfolio-intelligence-map',
      type: 'portfolio_map',
      titleKey: 'workbench.portfolioIntelligenceMap',
      priority: 1,
      matchers: [/组合/, /仓位/, /持仓/, /地图/, /版图/, /行业/, /赛道/, /portfolio/i, /exposure/i, /allocation/i],
    },
    {
      id: 'chat-portfolio-intent-fingerprint',
      type: 'intent_fingerprint',
      titleKey: 'workbench.intentFingerprint',
      priority: 2,
      matchers: [/意图/, /倾向/, /炒股/, /风格/, /intent/i, /fingerprint/i],
    },
    {
      id: 'chat-portfolio-missing-pieces',
      type: 'missing_pieces',
      titleKey: 'workbench.missingPieces',
      priority: 3,
      matchers: [/缺失/, /补齐/, /缺口/, /上下游/, /missing/i, /gap/i, /supply/i],
    },
    {
      id: 'chat-portfolio-suggested-tilt',
      type: 'suggested_tilt',
      titleKey: 'workbench.suggestedTilt',
      priority: 4,
      matchers: [/调仓/, /倾斜/, /建议/, /再平衡/, /tilt/i, /rebalance/i, /action/i],
    },
    {
      id: 'chat-portfolio-projected-exposure',
      type: 'projected_exposure',
      titleKey: 'workbench.projectedExposure',
      priority: 5,
      matchers: [/预测/, /模拟/, /执行后/, /projection/i, /projected/i, /simulation/i],
    },
  ],
  life_strategy: [
    {
      id: 'chat-life-action-queue',
      type: 'action_queue',
      titleKey: 'workbench.actionQueue',
      priority: 1,
      matchers: [/行动/, /路径/, /规划/, /约束/, /人生/, /action/i, /path/i, /plan/i],
    },
  ],
  profile_memory: [
    {
      id: 'chat-profile-memory-candidate',
      type: 'memory_candidate',
      titleKey: 'workbench.memoryCandidate',
      priority: 1,
      matchers: [/记忆/, /档案/, /画像/, /更新/, /memory/i, /profile/i],
    },
  ],
};

const unique = (items: Array<string | undefined | null>) =>
  Array.from(new Set(items.filter((item): item is string => Boolean(item))));

const uniqueTraceSources = (
  items: Array<NonNullable<DashboardProjection['trace']>['generatedFrom'][number] | undefined | null>,
) => Array.from(new Set(items.filter((item): item is NonNullable<DashboardProjection['trace']>['generatedFrom'][number] => Boolean(item))));

const compactText = (value: unknown, limit = 360) => {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
};

function getExpertAnalysis(chatResult: any): Record<string, string> {
  if (!chatResult?.expertAnalysis || typeof chatResult.expertAnalysis !== 'object') {
    return {};
  }
  return Object.entries(chatResult.expertAnalysis).reduce<Record<string, string>>((next, [key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      next[key] = value;
    }
    return next;
  }, {});
}

function getChatSectionSnippets(expertAnalysis: Record<string, string>): ChatSectionSnippet[] {
  return Object.entries(expertAnalysis)
    .filter(([section]) => section !== '综合统筹结论' && section !== '快速回应')
    .map(([section, text]) => ({
      section,
      summary: compactText(text, 260),
      sourceRef: `chat.expert_analysis.${section}`,
    }));
}

function getSynthesisSummary(expertAnalysis: Record<string, string>) {
  return (
    expertAnalysis['综合统筹结论'] ||
    expertAnalysis['快速回应'] ||
    Object.values(expertAnalysis).find(Boolean) ||
    ''
  );
}

function pickRailSections(railId: WorkbenchRailId, expertAnalysis: Record<string, string>) {
  const matchers = RAIL_SECTION_MATCHERS[railId];
  return Object.entries(expertAnalysis).filter(([section]) =>
    matchers.some((matcher) => matcher.test(section)),
  );
}

function deriveRailStatus(
  rail: AgentRailResult,
  matchedSections: Array<[string, string]>,
): WorkbenchWidgetStatus {
  if (matchedSections.length === 0) return rail.status;
  const hardMissingFacts = rail.missingFacts.filter((fact) => fact !== 'rail_outputs');
  return hardMissingFacts.length === 0 ? 'ready' : 'partial';
}

function createProfileMemoryCandidate(
  sessionSpec: WorkbenchSessionSpec,
  chatResult: any,
): MemoryCandidate | null {
  const updatedProfile = chatResult?.updatedProfile;
  if (!updatedProfile || typeof updatedProfile !== 'object' || Object.keys(updatedProfile).length === 0) {
    return null;
  }

  return {
    id: `memory-chat-profile-${sessionSpec.id}`,
    type: 'profile_fact',
    title: 'workbench.memory.chatProfileTitle',
    body: 'workbench.memory.chatProfileProjection',
    confidence: 'medium',
    sourceRefs: unique([...(sessionSpec.facts?.sourceRefs || []), 'chat.updated_profile']),
    structuredPatch: {
      version: sessionSpec.facts?.sovereignProfile?.version || 1,
      identity: updatedProfile,
      sourceRefs: ['chat.updated_profile'],
    },
    status: 'pending',
    createdAt: Date.now(),
  };
}

function recomputeRunStatus(railResults: AgentRailResult[]): WorkbenchWidgetStatus {
  const readyCount = railResults.filter((rail) => rail.status === 'ready').length;
  const partialCount = railResults.filter((rail) => rail.status === 'partial').length;
  const blockedCount = railResults.filter((rail) => rail.status === 'blocked').length;
  if (readyCount === railResults.length) return 'ready';
  if (readyCount > 0 || partialCount > 0) return 'partial';
  if (blockedCount === railResults.length) return 'blocked';
  return 'awaiting_context';
}

function createChatCioBrief(input: {
  sessionSpec: WorkbenchSessionSpec;
  railRun: WorkbenchRailRun;
  expertAnalysis: Record<string, string>;
}): CIOBrief | undefined {
  const summary = compactText(getSynthesisSummary(input.expertAnalysis), 900);
  if (!summary) return undefined;

  const readyCount = input.railRun.summary.readyCount;
  const partialCount = input.railRun.summary.partialCount;
  const riskRails = input.railRun.railResults.filter((rail) => rail.risks.length > 0 && rail.status !== 'blocked');
  const hasRailConflict = riskRails.length >= 2;
  const confidence: CIOBrief['confidence'] = readyCount > 0
    ? 'high'
    : partialCount > 0
      ? 'medium'
      : 'low';

  return {
    summary,
    confidence,
    decisionState: hasRailConflict
      ? 'conflicted'
      : readyCount > 0 || partialCount > 0
        ? 'ready'
        : 'needs_context',
    conflicts: hasRailConflict
      ? [{
        railIds: riskRails.map((rail) => rail.railId),
        description: riskRails.some((rail) => rail.railId === 'life')
          ? 'workbench.cioBrief.lifeRailConflict'
          : 'workbench.cioBrief.railRiskConflict',
        resolution: 'workbench.cioBrief.reviewRailRiskResolution',
      }]
      : [],
    actions: input.railRun.railResults.flatMap((rail) => rail.actions),
    evidenceRefs: unique([
      ...(input.sessionSpec.facts?.sourceRefs || []),
      ...CHAT_SOURCE_REFS,
      ...Object.keys(input.expertAnalysis).map((section) => `chat.expert_analysis.${section}`),
    ]),
    widgetManifest: [{
      id: 'cio-brief-chat-result',
      type: 'cio_brief',
      titleKey: 'workbench.cioSynthesis',
      status: input.railRun.status,
      priority: 1,
      sourceRefs: CHAT_SOURCE_REFS,
    }],
  };
}

function createChatDerivedWidgets(input: {
  sessionSpec: WorkbenchSessionSpec;
  expertAnalysis: Record<string, string>;
  chatResult?: any;
  railRun: WorkbenchRailRun;
}): WorkbenchWidgetManifest[] {
  const sections = Object.entries(input.expertAnalysis)
    .filter(([section]) => section !== '综合统筹结论' && section !== '快速回应')
    .map(([section, text]) => ({
      section,
      summary: compactText(text, 260),
      sourceRef: `chat.expert_analysis.${section}`,
    }));
  const sourceRefs = unique([
    ...CHAT_SOURCE_REFS,
    ...sections.map((section) => section.sourceRef),
    input.chatResult?.externalData ? 'chat.external_data' : undefined,
    input.chatResult?.suggestedStatePatch ? 'chat.suggested_state_patch' : undefined,
  ]);
  const status: WorkbenchWidgetStatus = sections.length > 0 ? 'ready' : input.railRun.status;
  const widgets: WorkbenchWidgetManifest[] = [];

  if (sections.length > 0) {
    widgets.push({
      id: 'chat-evidence-sections',
      type: 'evidence',
      titleKey: 'workbench.evidence',
      status,
      priority: 1,
      sourceRefs,
      props: {
        sections,
      },
    });
  }

  widgets.push({
    id: 'chat-source-refs',
    type: 'source',
    titleKey: 'workbench.source',
    status: sourceRefs.length > CHAT_SOURCE_REFS.length ? 'ready' : 'partial',
    priority: 2,
    sourceRefs,
    props: {
      sourceRefs,
      sectionCount: sections.length,
    },
  });

  widgets.push({
    id: 'chat-confidence',
    type: 'confidence',
    titleKey: 'workbench.confidence',
    status,
    priority: 3,
    sourceRefs,
    props: {
      readyRails: input.railRun.summary.readyCount,
      partialRails: input.railRun.summary.partialCount,
      sectionCount: sections.length,
    },
  });

  return widgets;
}

function createEntryReplyWidgets(input: {
  sessionSpec: WorkbenchSessionSpec;
  expertAnalysis: Record<string, string>;
  railRun: WorkbenchRailRun;
}): WorkbenchWidgetManifest[] {
  const rules = ENTRY_REPLY_WIDGET_RULES[input.sessionSpec.entryType] || [];
  if (rules.length === 0) return [];

  const sections = getChatSectionSnippets(input.expertAnalysis);
  if (sections.length === 0) return [];

  return rules.flatMap((rule) => {
    const matchedSections = sections.filter((section) => (
      rule.matchers.some((matcher) => matcher.test(`${section.section} ${section.summary}`))
    ));
    if (matchedSections.length === 0) return [];

    const sourceRefs = unique([
      ...CHAT_SOURCE_REFS,
      ...matchedSections.map((section) => section.sourceRef),
    ]);

    return [{
      id: rule.id,
      type: rule.type,
      titleKey: rule.titleKey,
      status: 'ready' as WorkbenchWidgetStatus,
      priority: rule.priority,
      sourceRefs,
      props: {
        entryType: input.sessionSpec.entryType,
        sections: matchedSections,
        sectionCount: matchedSections.length,
        railStatus: input.railRun.status,
      },
    }];
  });
}

function mergeWidgetManifests(widgets: WorkbenchWidgetManifest[]) {
  const seen = new Set<string>();
  return widgets.filter((widget) => {
    const key = `${widget.railId || 'session'}:${widget.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function bridgeChatResultToWorkbenchSession({
  sessionSpec,
  railRun,
  chatResult,
}: ChatBridgeInput): WorkbenchSessionSpec {
  const expertAnalysis = getExpertAnalysis(chatResult);
  const hasExpertAnalysis = Object.keys(expertAnalysis).length > 0;
  if (!hasExpertAnalysis && !chatResult?.updatedProfile) {
    return hydrateWorkbenchMemoryProjection({
      ...sessionSpec,
      railRun,
    });
  }

  const profileMemoryCandidate = createProfileMemoryCandidate(sessionSpec, chatResult);
  const railResults = railRun.railResults.map((rail) => {
    const matchedSections = pickRailSections(rail.railId, expertAnalysis);
    const bridgedStatus = deriveRailStatus(rail, matchedSections);
    const sectionRefs = matchedSections.map(([section]) => `chat.expert_analysis.${section}`);
    const sectionSummary = compactText(matchedSections.map(([section, text]) => `${section}: ${text}`).join(' '));

    return {
      ...rail,
      status: bridgedStatus,
      summaryKey: matchedSections.length > 0
        ? `workbench.railSummaries.${rail.railId}.${bridgedStatus === 'ready' ? 'chatReady' : 'chatPartial'}`
        : rail.summaryKey,
      summary: sectionSummary || rail.summary,
      confidence: matchedSections.length > 0
        ? (bridgedStatus === 'ready' ? 'high' : 'medium')
        : rail.confidence,
      evidenceRefs: unique([...rail.evidenceRefs, ...CHAT_SOURCE_REFS, ...sectionRefs]),
      missingFacts: matchedSections.length > 0
        ? rail.missingFacts.filter((fact) => fact !== 'rail_outputs')
        : rail.missingFacts,
      risks: unique([
        ...rail.risks,
        ...matchedSections
          .filter(([section]) => /风险|压力|黑天鹅|risk|stress/i.test(section))
          .map(([section]) => `chat-risk:${section}`),
      ]),
      widgetManifest: rail.widgetManifest.map((widget) => ({
        ...widget,
        status: bridgedStatus,
        sourceRefs: unique([...(widget.sourceRefs || []), ...sectionRefs]),
      })),
      memoryCandidates: [
        ...rail.memoryCandidates,
        ...(rail.railId === 'life' && profileMemoryCandidate ? [profileMemoryCandidate] : []),
      ],
    } satisfies AgentRailResult;
  });

  const readyCount = railResults.filter((rail) => rail.status === 'ready').length;
  const partialCount = railResults.filter((rail) => rail.status === 'partial').length;
  const blockedCount = railResults.filter((rail) => rail.status === 'blocked').length;
  const bridgedRailRun: WorkbenchRailRun = {
    ...railRun,
    completedAt: Date.now(),
    status: recomputeRunStatus(railResults),
    railResults,
    sourceRefs: unique([
      ...railRun.sourceRefs,
      ...CHAT_SOURCE_REFS,
      ...Object.keys(expertAnalysis).map((section) => `chat.expert_analysis.${section}`),
    ]),
    missingFacts: unique(railResults.flatMap((rail) => rail.missingFacts)),
    summary: {
      railCount: railResults.length,
      readyCount,
      partialCount,
      blockedCount,
    },
  };

  const hydratedSession = hydrateWorkbenchMemoryProjection({
    ...sessionSpec,
    facts: {
      ...(sessionSpec.facts || {}),
      sourceRefs: unique([...(sessionSpec.facts?.sourceRefs || []), ...bridgedRailRun.sourceRefs]),
    },
    railRun: bridgedRailRun,
  });
  const memoryInbox = createMemoryInboxSnapshot(hydratedSession);
  const chatCioBrief = createChatCioBrief({
    sessionSpec: hydratedSession,
    railRun: bridgedRailRun,
    expertAnalysis,
  });
  const chatDerivedWidgets = createChatDerivedWidgets({
    sessionSpec: hydratedSession,
    expertAnalysis,
    chatResult,
    railRun: bridgedRailRun,
  });
  const entryReplyWidgets = createEntryReplyWidgets({
    sessionSpec: hydratedSession,
    expertAnalysis,
    railRun: bridgedRailRun,
  });
  const dynamicWidgets = mergeWidgetManifests([
    ...entryReplyWidgets,
    ...chatDerivedWidgets,
    ...(hydratedSession.dashboardProjection?.dynamicWidgets || []),
  ]);

  return {
    ...hydratedSession,
    memoryInbox,
    dashboardProjection: {
      ...hydratedSession.dashboardProjection!,
      cioBrief: chatCioBrief || hydratedSession.dashboardProjection?.cioBrief,
      dynamicWidgets,
      memoryCandidateCount: memoryInbox.items.length,
      widgetCount: dynamicWidgets.length,
      trace: {
        candidateIds: memoryInbox.items.map((item) => item.candidate.id),
        generatedFrom: uniqueTraceSources([
          ...(hydratedSession.dashboardProjection?.trace?.generatedFrom || []),
          hasExpertAnalysis ? 'chat' : undefined,
        ]),
        railRunId: bridgedRailRun.id,
        sessionId: hydratedSession.id,
        sourceRefs: unique([
          ...(hydratedSession.dashboardProjection?.trace?.sourceRefs || []),
          ...bridgedRailRun.sourceRefs,
        ]),
      },
    },
  };
}
