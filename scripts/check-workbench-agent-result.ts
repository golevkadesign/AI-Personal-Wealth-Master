import { createWorkbenchAgentRunResult } from '../src/lib/workbench-agent-result';
import { bridgeChatResultToWorkbenchSession } from '../src/lib/workbench-chat-bridge';
import { hydrateWorkbenchMemoryProjection } from '../src/lib/workbench-memory';
import { runWorkbenchRailOrchestration } from '../src/lib/workbench-rails';
import {
  createDashboardBriefWorkbenchSession,
  createHoldingWorkbenchSession,
} from '../src/lib/workbench-session';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const terminalState: any = {
  insights: {
    global: 'Current strategic brief is ready for CIO synthesis.',
  },
  distributions: {
    publicHoldings: [
      { id: 'VOO.US', symbol: 'VOO.US', name: 'Vanguard S&P 500 ETF', value: 6779, marketValue: 6779, percentage: 24.6 },
      { id: 'NVDA.US', symbol: 'NVDA.US', name: 'NVIDIA', value: 3996, marketValue: 3996, percentage: 14.5 },
    ],
  },
};

async function main() {
  const dashboardSession = createDashboardBriefWorkbenchSession({
    terminalState,
    insight: terminalState.insights.global,
  });
  const dashboardRailRun = await runWorkbenchRailOrchestration(dashboardSession);
  const dashboardHydrated = hydrateWorkbenchMemoryProjection({
    ...dashboardSession,
    railRun: dashboardRailRun,
  });
  const dashboardResult = createWorkbenchAgentRunResult(dashboardHydrated);

  assert(dashboardResult.protocolVersion === 'workbench-agent-result.v1', 'result should declare protocol version');
  assert(dashboardResult.runMode === 'rail_orchestration', 'dashboard result should default to rail orchestration');
  assert(dashboardResult.intentBias === 'global', 'dashboard result should preserve global intent bias');
  assert(dashboardResult.railRun?.summary.railCount === 3, 'result should include three rail outputs');
  assert(dashboardResult.cioBrief, 'result should expose CIO brief from dashboard projection');
  assert(dashboardResult.widgetManifest.some((widget) => widget.type === 'cio_brief'), 'result should expose CIO widget manifest');
  assert(dashboardResult.trace.generatedFrom.includes('rails'), 'result trace should include rails');

  const holdingSession = createHoldingWorkbenchSession({
    id: 'VOO.US',
    symbol: 'VOO.US',
    name: 'Vanguard S&P 500 ETF',
    value: 6779,
    marketValue: 6779,
    quantity: 10,
    currentPrice: 677.9,
  } as any, terminalState);
  const holdingRailRun = await runWorkbenchRailOrchestration(holdingSession);
  const bridgedSession = bridgeChatResultToWorkbenchSession({
    sessionSpec: holdingSession,
    railRun: holdingRailRun,
    chatResult: {
      expertAnalysis: {
        综合统筹结论: 'The holding requires equity rail review before making allocation changes.',
        持仓智能分析: 'VOO.US remains the anchor exposure; inspect concentration and market context.',
        技术风险: 'Risk is bounded but should be checked against market regime.',
      },
      updatedProfile: {
        holdingReviewPreference: 'prefers evidence-backed ETF reviews',
      },
    },
  });
  const bridgedResult = createWorkbenchAgentRunResult(bridgedSession, {
    runMode: 'chat_bridged',
    hasChatResult: true,
  });
  const bridgedIdentity = bridgedSession.facts?.sovereignProfile?.identity as any;

  assert(bridgedResult.runMode === 'chat_bridged', 'chat result should mark chat bridge run mode');
  assert(bridgedResult.trace.hasChatResult, 'chat result trace should mark chat presence');
  assert(bridgedResult.trace.bridgeMode === 'legacy_chat_result', 'chat bridge should be explicit');
  assert(bridgedResult.trace.generatedFrom.includes('chat'), 'chat result trace should include chat');
  assert(bridgedResult.widgetManifest.some((widget) => widget.sourceRefs?.some((ref) => ref.startsWith('chat.'))), 'chat widgets should keep chat source refs');
  assert(bridgedResult.memoryCandidates.some((candidate) => candidate.sourceRefs.includes('chat.updated_profile')), 'updated profile should become memory candidate');
  assert(!bridgedIdentity?.holdingReviewPreference, 'updated profile should not be applied to sovereign profile before memory decision');
  assert(bridgedResult.subjectSpec?.type === 'symbol', 'holding result should preserve structured subject');

  console.log(JSON.stringify({
    status: 'ok',
    checked: [
      'canonical-protocol-version',
      'three-rail-agent-result',
      'cio-brief-output',
      'widget-manifest-output',
      'chat-bridge-run-mode',
      'memory-candidate-output',
      'updated-profile-not-directly-applied',
      'structured-subject-preserved',
    ],
    dashboard: {
      runMode: dashboardResult.runMode,
      railCount: dashboardResult.railRun?.summary.railCount,
      widgetCount: dashboardResult.widgetManifest.length,
      generatedFrom: dashboardResult.trace.generatedFrom,
    },
    holding: {
      runMode: bridgedResult.runMode,
      widgetCount: bridgedResult.widgetManifest.length,
      memoryCandidateCount: bridgedResult.memoryCandidates.length,
      generatedFrom: bridgedResult.trace.generatedFrom,
    },
  }));
}

void main();
