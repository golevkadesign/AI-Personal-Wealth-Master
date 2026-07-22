import express from 'express';
import type {
  AgentRailResult,
  WorkbenchAgentRunResult,
  WorkbenchSessionSpec,
} from '../../src/types/workbench';
import { buildSharedFactBundle } from '../../src/lib/workbench-facts';
import { runWorkbenchRailOrchestration } from '../../src/lib/workbench-rails';
import { bridgeChatResultToWorkbenchSession } from '../../src/lib/workbench-chat-bridge';
import { createWorkbenchAgentRunResult } from '../../src/lib/workbench-agent-result';
import { translateI18n, type AppLanguage } from '../../src/i18n/translations';
import { hydrateWorkbenchToolFacts } from '../services/workbenchTools';

const router = express.Router();

const unique = (items: Array<string | undefined | null>) =>
  Array.from(new Set(items.filter((item): item is string => Boolean(item))));

const PROMPT_ONLY_MISSING_FACTS = new Set(['user_prompt', 'shared_facts']);

const normalizeLanguage = (value: unknown): AppLanguage => (
  value === 'en-US' || value === 'zh-CN' ? value : 'zh-CN'
);

const t = (language: AppLanguage, key: string, params?: Record<string, string | number | boolean | null | undefined>) =>
  translateI18n(language, key, params);

const humanizeProtocolId = (value: string) => value
  .replace(/^missing:/, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

function getMissingFactDisplayName(fact: string, language: AppLanguage) {
  const key = `workbench.missingFactLabels.${fact}`;
  const translated = t(language, key);
  return translated === key ? humanizeProtocolId(fact) : translated;
}

function getRiskDisplayName(risk: string, language: AppLanguage) {
  if (risk.startsWith('missing:')) return getMissingFactDisplayName(risk, language);
  if (risk.startsWith('workbench.')) {
    const translated = t(language, risk);
    if (translated !== risk) return translated;
  }
  return humanizeProtocolId(risk);
}

const formatMissingFacts = (facts: string[], language: AppLanguage) =>
  facts.map((fact) => getMissingFactDisplayName(fact, language)).join(', ');

const getLiveSources = (terminalState: any) =>
  Array.isArray(terminalState?._liveSources) ? terminalState._liveSources : [];

function parseLongbridgeAccounts(req: express.Request, body: any) {
  const bodyAccounts = body?.longbridgeAccounts || body?.settings?.longbridgeAccounts;
  if (Array.isArray(bodyAccounts)) return bodyAccounts;

  const accountsHeader = req.headers['x-longbridge-accounts'];
  if (accountsHeader && typeof accountsHeader === 'string') {
    try {
      const decodedStr = decodeURIComponent(Buffer.from(accountsHeader, 'base64').toString('utf-8'));
      const parsed = JSON.parse(decodedStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeWorkbenchSession(input: {
  session: WorkbenchSessionSpec;
  prompt?: string;
  chatResult?: any;
}): WorkbenchSessionSpec {
  const prompt = input.prompt?.trim() || input.session.facts?.userPrompt;
  const hasChatResult = Boolean(input.chatResult && typeof input.chatResult === 'object');
  if (!prompt && !hasChatResult) return input.session;

  const facts = input.session.facts || {};
  const terminalState = mergeTerminalStateWithChatResult(facts.terminalState, input.chatResult);
  const chatSourceRefs = hasChatResult ? [
    input.chatResult?.expertAnalysis ? 'chat.expert_analysis' : undefined,
    input.chatResult?.externalData ? 'chat.external_data' : undefined,
    input.chatResult?.updatedProfile ? 'chat.updated_profile' : undefined,
  ] : [];
  const missingFacts = (facts.missingFacts || [])
    .filter((fact) => !PROMPT_ONLY_MISSING_FACTS.has(fact));

  return {
    ...input.session,
    subject: input.session.subject || prompt?.slice(0, 80),
    subjectSpec: input.session.subjectSpec || (prompt ? {
      type: 'custom',
      id: `prompt-${Date.now()}`,
      label: prompt.slice(0, 80),
      payload: { prompt },
    } : undefined),
    initialPrompt: input.session.initialPrompt || prompt,
    facts: buildSharedFactBundle({
      terminalState,
      selectedHolding: facts.selectedHolding,
      selectedHoldingAnalysis: facts.selectedHoldingAnalysis,
      accountPortfolios: terminalState?.publicHoldingAccounts || facts.publicHoldingAccounts,
      userPrompt: prompt,
      sourceRefs: unique([
        ...(facts.sourceRefs || []),
        prompt ? 'workbench.chat' : undefined,
        ...chatSourceRefs,
      ]),
      missingFacts,
      confidence: facts.confidence,
    }),
  };
}

function mergeTerminalStateWithChatResult(terminalState: any, chatResult: any) {
  if (!chatResult || typeof chatResult !== 'object') return terminalState;

  const externalData = chatResult.externalData || {};
  const next = { ...(terminalState || {}) };
  let updated = false;

  if (Array.isArray(externalData.livePortfolioAccounts) && externalData.livePortfolioAccounts.length > 0) {
    next.publicHoldingAccounts = externalData.livePortfolioAccounts;
    next._liveSources = unique([...getLiveSources(next), 'longbridge']);
    next._liveFetchedAt = Date.now();
    updated = true;
  }

  if (Array.isArray(externalData.livePortfolio) && externalData.livePortfolio.length > 0) {
    next.distributions = {
      ...(next.distributions || {}),
      publicHoldings: externalData.livePortfolio,
    };
    next._liveSources = unique([...getLiveSources(next), 'longbridge']);
    updated = true;
  }

  if (externalData.marketContext && typeof externalData.marketContext === 'object') {
    next.marketContext = externalData.marketContext;
    next.marketContextLastFetchedAt = Date.now();
    updated = true;
  }

  return updated ? next : terminalState;
}

async function runWorkbenchPipeline(input: {
  session: WorkbenchSessionSpec;
  prompt?: string;
  chatResult?: any;
  longbridgeAccounts?: any[];
}) {
  const runnableSession = normalizeWorkbenchSession({
    session: input.session,
    prompt: input.prompt,
    chatResult: input.chatResult,
  });
  const toolHydratedSession = await hydrateWorkbenchToolFacts(runnableSession, {
    longbridgeAccounts: input.longbridgeAccounts,
  });
  const railRun = await runWorkbenchRailOrchestration(toolHydratedSession);
  const hydratedSession = bridgeChatResultToWorkbenchSession({
    sessionSpec: toolHydratedSession,
    railRun,
    chatResult: input.chatResult,
  });
  const agentResult = createWorkbenchAgentRunResult(hydratedSession, {
    runMode: input.chatResult ? 'chat_bridged' : 'rail_orchestration',
    hasChatResult: Boolean(input.chatResult),
  });

  return {
    session: hydratedSession,
    agentResult,
  };
}

const getRailDisplayName = (rail: AgentRailResult, language: AppLanguage) => {
  const translated = t(language, rail.titleKey);
  if (translated && translated !== rail.titleKey) return translated;
  if (rail.railId === 'equity') return language === 'en-US' ? 'Equity' : '股票战术';
  if (rail.railId === 'allocation') return language === 'en-US' ? 'Allocation' : '资产配置';
  return language === 'en-US' ? 'Life' : '人生规划';
};

const getStatusDisplayName = (status: string | undefined, language: AppLanguage) => {
  const keyByStatus: Record<string, string> = {
    ready: 'workbench.nativeChat.status.ready',
    partial: 'workbench.nativeChat.status.partial',
    blocked: 'workbench.nativeChat.status.blocked',
    error: 'workbench.nativeChat.status.error',
    waiting_signals: 'workbench.nativeChat.status.waitingSignals',
    awaiting_context: 'workbench.nativeChat.status.awaitingContext',
  };
  return t(language, keyByStatus[status || 'awaiting_context'] || keyByStatus.awaiting_context);
};

function createNativeAssistantMessage(agentResult: WorkbenchAgentRunResult, language: AppLanguage) {
  const railRun = agentResult.railRun;
  const readyCount = railRun?.summary.readyCount || 0;
  const partialCount = railRun?.summary.partialCount || 0;
  const blockedCount = railRun?.summary.blockedCount || 0;
  const missingFacts = agentResult.trace.missingFacts || [];
  const memoryCount = agentResult.memoryCandidates.length;
  const widgetCount = agentResult.widgetManifest.length;
  const lines = [
    `### ${t(language, 'workbench.nativeChat.summaryTitle')}`,
    t(language, 'workbench.nativeChat.railPassSummary', {
      readyCount,
      partialCount,
      blockedCount,
    }),
  ];

  if (agentResult.cioBrief?.summary) {
    lines.push(t(language, 'workbench.nativeChat.cioState', {
      state: t(language, `workbench.nativeChat.cioStates.${agentResult.cioBrief.decisionState}`),
    }));
  }

  if (railRun?.railResults.length) {
    lines.push('');
    lines.push(`**${t(language, 'workbench.nativeChat.railStatusTitle')}**`);
    railRun.railResults.forEach((rail) => {
      const missing = rail.missingFacts.length
        ? t(language, 'workbench.nativeChat.missingFactsInline', {
          facts: formatMissingFacts(rail.missingFacts, language),
        })
        : '';
      lines.push(`- ${getRailDisplayName(rail, language)}: ${getStatusDisplayName(rail.status, language)}${missing}`);
    });
  }

  if (memoryCount > 0) {
    lines.push('');
    lines.push(t(language, 'workbench.nativeChat.memoryInboxSummary', { count: memoryCount }));
  }

  if (widgetCount > 0) {
    lines.push(t(language, 'workbench.nativeChat.widgetRefreshSummary', { count: widgetCount }));
  }

  if (missingFacts.length > 0) {
    lines.push(t(language, 'workbench.nativeChat.contextNeeded', {
      facts: formatMissingFacts(missingFacts.slice(0, 6), language),
    }));
  }

  return lines.join('\n');
}

function createCompactAgentResultRef(agentResult: WorkbenchAgentRunResult) {
  return {
    protocolVersion: agentResult.protocolVersion,
    sessionId: agentResult.sessionId,
    entryType: agentResult.entryType,
    intentBias: agentResult.intentBias,
    status: agentResult.status,
    runMode: agentResult.runMode,
    generatedAt: agentResult.generatedAt,
    sourceRefs: agentResult.sourceRefs,
    trace: agentResult.trace,
  };
}

function createNativeCompatibleChatResult(input: {
  session: WorkbenchSessionSpec;
  agentResult: WorkbenchAgentRunResult;
  assistantMessage: string;
  language: AppLanguage;
}) {
  const railAnalysis = Object.fromEntries(
    (input.agentResult.railRun?.railResults || []).map((rail) => [
      `${getRailDisplayName(rail, input.language)} Rail`,
      [
        t(input.language, 'workbench.nativeChat.compatRailResult', {
          status: getStatusDisplayName(rail.status, input.language),
        }),
        rail.missingFacts.length ? t(input.language, 'workbench.nativeChat.compatMissingFacts', { facts: formatMissingFacts(rail.missingFacts, input.language) }) : '',
        rail.risks.length ? t(input.language, 'workbench.nativeChat.compatRisks', { risks: rail.risks.map((risk) => getRiskDisplayName(risk, input.language)).join(', ') }) : '',
      ].filter(Boolean).join(' '),
    ]),
  );

  return {
    aiResponse: input.assistantMessage,
    expertAnalysis: {
      [t(input.language, 'workbench.cioSynthesis')]: input.agentResult.cioBrief?.summary || input.assistantMessage,
      ...railAnalysis,
    },
    externalData: {
      workbenchDashboardProjectionId: input.agentResult.dashboardProjection?.id,
      workbenchMemoryInboxId: input.agentResult.memoryInbox?.id,
      workbenchMemoryPendingCount: input.agentResult.memoryInbox?.pendingCount || 0,
    },
    workbenchNative: true,
    workbenchSession: input.session,
    workbenchAgentResult: createCompactAgentResultRef(input.agentResult),
  };
}

async function handleWorkbenchRun(req: express.Request, res: express.Response) {
  try {
    const body = req.body || {};
    const session = body.session || body.sessionSpec;
    const { prompt, chatResult } = body;
    const longbridgeAccounts = parseLongbridgeAccounts(req, body);
    if (!session || typeof session !== 'object') {
      res.status(400).json({ success: false, error: 'Missing workbench session' });
      return;
    }

    const { session: hydratedSession, agentResult } = await runWorkbenchPipeline({
      session: session as WorkbenchSessionSpec,
      prompt: typeof prompt === 'string' ? prompt : undefined,
      chatResult,
      longbridgeAccounts,
    });

    res.json({
      success: true,
      session: hydratedSession,
      agentResult,
      railRun: agentResult.railRun,
      memoryInbox: agentResult.memoryInbox,
      dashboardProjection: agentResult.dashboardProjection,
    });
  } catch (error: any) {
    console.error('[Workbench Route] Failed to run workbench session:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to run workbench session',
    });
  }
}

async function handleWorkbenchChat(req: express.Request, res: express.Response) {
  try {
    const body = req.body || {};
    const session = body.session || body.sessionSpec;
    const { prompt, chatResult } = body;
    const language = normalizeLanguage(body.language || req.headers['x-arbitra-language']);
    const longbridgeAccounts = parseLongbridgeAccounts(req, body);
    if (!session || typeof session !== 'object') {
      res.status(400).json({ success: false, error: 'Missing workbench session' });
      return;
    }

    const { session: railSession, agentResult: railAgentResult } = await runWorkbenchPipeline({
      session: session as WorkbenchSessionSpec,
      prompt: typeof prompt === 'string' ? prompt : undefined,
      chatResult,
      longbridgeAccounts,
    });
    if (!railAgentResult.railRun) {
      throw new Error('Workbench native chat could not produce rail results');
    }

    const railAssistantMessage = createNativeAssistantMessage(railAgentResult, language);
    const railCompatibleChatResult = createNativeCompatibleChatResult({
      session: railSession,
      agentResult: railAgentResult,
      assistantMessage: railAssistantMessage,
      language,
    });
    const hydratedSession = bridgeChatResultToWorkbenchSession({
      sessionSpec: railSession,
      railRun: railAgentResult.railRun,
      chatResult: railCompatibleChatResult,
    });
    const agentResult = createWorkbenchAgentRunResult(hydratedSession, {
      runMode: 'chat_bridged',
      hasChatResult: true,
    });
    const assistantMessage = createNativeAssistantMessage(agentResult, language);
    const compatibleChatResult = createNativeCompatibleChatResult({
      session: hydratedSession,
      agentResult,
      assistantMessage,
      language,
    });

    res.json({
      success: true,
      session: hydratedSession,
      agentResult,
      railRun: agentResult.railRun,
      memoryInbox: agentResult.memoryInbox,
      dashboardProjection: agentResult.dashboardProjection,
      assistantMessage,
      chatResult: compatibleChatResult,
      legacyCompatibleChatResult: compatibleChatResult,
    });
  } catch (error: any) {
    console.error('[Workbench Route] Failed to run workbench native chat:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to run workbench native chat',
    });
  }
}

router.post('/run', handleWorkbenchRun);
router.post('/session', handleWorkbenchRun);
router.post('/chat', handleWorkbenchChat);

export default router;
