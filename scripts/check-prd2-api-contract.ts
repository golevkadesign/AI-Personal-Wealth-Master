import express from 'express';
import type { AddressInfo } from 'node:net';
import memoryRouter from '../server/routes/memory';
import dashboardRouter from '../server/routes/dashboard';
import workbenchRouter from '../server/routes/workbench';
import { profileRouter } from '../server/routes/profile';
import { hydrateWorkbenchMemoryProjection } from '../src/lib/workbench-memory';
import { getWorkbenchResponseWidgets } from '../src/lib/workbench-widget-registry';
import type { MemoryCandidate, SovereignProfile, WorkbenchSessionSpec } from '../src/types/workbench';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function postJson(baseUrl: string, path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  assert(response.ok, `${path} should return 2xx: ${JSON.stringify(json)}`);
  assert(json.success === true, `${path} should return success true`);
  return json;
}

async function patchJson(baseUrl: string, path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  assert(response.ok, `${path} should return 2xx: ${JSON.stringify(json)}`);
  assert(json.success === true, `${path} should return success true`);
  return json;
}

function createContractSession() {
  const now = Date.now();
  const candidate: MemoryCandidate = {
    id: `api-contract-candidate-${now}`,
    type: 'risk_preference',
    title: 'API Contract Candidate',
    body: 'Candidate routed through PRD2 API contract.',
    confidence: 'high',
    sourceRefs: ['api_contract.test', 'rail.life'],
    structuredPatch: {
      riskPreferences: {
        apiContractRisk: 'confirmed',
      },
      sourceRefs: ['api_contract.test'],
    },
    status: 'pending',
    createdAt: now,
  };

  const profile: SovereignProfile = {
    version: 1,
    identity: { name: 'API Contract Client' },
    sourceRefs: ['api_contract.profile'],
  };

  const session: WorkbenchSessionSpec = hydrateWorkbenchMemoryProjection({
    id: `api-contract-session-${now}`,
    entryType: 'profile_memory',
    titleKey: 'workbench.memoryProfileWorkbench',
    intentBias: 'memory',
    facts: {
      sovereignProfile: profile,
      sourceRefs: ['api_contract.profile', 'api_contract.session'],
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
      id: `api-contract-rail-${now}`,
      sessionId: `api-contract-session-${now}`,
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
          id: 'api-contract-memory-widget',
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
    initialWidgets: [],
    allowedActions: ['run_rails', 'render_widgets', 'propose_memory', 'write_memory', 'update_profile', 'project_dashboard'],
    createdAt: now,
  });

  return { session, profile, candidate };
}

async function main() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/workbench', workbenchRouter);
  app.use('/api/memory', memoryRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/dashboard', dashboardRouter);

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const nextServer = app.listen(0, () => resolve(nextServer));
  });

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const { session, profile, candidate } = createContractSession();

    const workbench = await postJson(baseUrl, '/api/workbench/session', { sessionSpec: session });
    assert(workbench.session?.id === session.id, 'workbench session alias should preserve session id');
    assert(workbench.agentResult?.protocolVersion === 'workbench-agent-result.v1', 'workbench session should return agent result');

    const workbenchChat = await postJson(baseUrl, '/api/workbench/chat', {
      sessionSpec: session,
      prompt: 'Run a PRD2 native Workbench chat turn.',
      language: 'zh-CN',
    });
    assert(workbenchChat.assistantMessage?.length > 0, 'workbench native chat should return assistant text');
    assert(workbenchChat.assistantMessage.includes('Workbench 综合回合'), 'workbench native chat should honor zh-CN assistant template');
    assert(!workbenchChat.assistantMessage.includes('Workbench synthesis'), 'workbench native chat should not regress to the old English hardcoded template');
    assert(workbenchChat.chatResult?.workbenchNative === true, 'workbench native chat should return native-compatible chat result');
    assert(workbenchChat.chatResult?.workbenchSession?.id === session.id, 'workbench native chat should carry updated session');
    assert(workbenchChat.chatResult?.workbenchAgentResult?.railRun === undefined, 'native-compatible chat result should carry a compact agent result reference');
    assert(workbenchChat.agentResult?.railRun?.summary?.railCount === 3, 'top-level agent result should retain the full rail run for Workbench state');
    assert(workbenchChat.agentResult?.runMode === 'chat_bridged', 'workbench native chat should use the lightweight reply-widget bridge');
    assert(workbenchChat.agentResult?.trace?.bridgeMode === 'legacy_chat_result', 'workbench native chat trace should mark compatible chat bridge');
    assert(workbenchChat.agentResult?.railRun?.summary?.railCount === 3, 'workbench native chat should run three rails');
    assert(
      getWorkbenchResponseWidgets(workbenchChat.session, 8).length > 0,
      'workbench native chat should return response widgets in the updated session',
    );

    const candidates = await postJson(baseUrl, '/api/memory/candidates', { sessionSpec: session });
    assert(candidates.memoryInbox?.items?.length === 1, 'memory candidates endpoint should hydrate inbox');

    const item = candidates.memoryInbox.items[0];
    const accepted = await postJson(baseUrl, `/api/memory/candidates/${candidate.id}/accept`, {
      sessionSpec: candidates.session,
      item,
      profile,
    });
    assert(accepted.item.status === 'accepted', 'memory accept API should accept candidate');
    assert(accepted.profile.version === 2, 'memory accept API should advance profile');
    assert(accepted.dashboardProjection?.profileVersion === 2, 'memory accept API should recompute projection');

    const patched = await patchJson(baseUrl, '/api/profile', {
      profile: accepted.profile,
      patch: {
        identity: { location: 'Hong Kong' },
        sourceRefs: ['api_contract.patch'],
      },
    });
    assert(patched.profile.identity.location === 'Hong Kong', 'profile patch API should merge identity');
    assert(patched.profile.sourceRefs.includes('profile.patch'), 'profile patch API should preserve patch source');

    const profileProjection = await postJson(baseUrl, '/api/profile/recompute-projection', {
      sessionSpec: candidates.session,
      profile: patched.profile,
    });
    assert(profileProjection.dashboardProjection?.trace?.generatedFrom.includes('profile'), 'profile recompute API should include profile trace');
    assert(profileProjection.terminalPatch?.sovereignProfileProjection, 'profile recompute API should return terminal patch');

    const dashboardProjection = await postJson(baseUrl, '/api/dashboard/projection/recompute', {
      sessionSpec: candidates.session,
      profile: patched.profile,
      memoryInbox: candidates.memoryInbox,
    });
    assert(dashboardProjection.dashboardProjection?.sourceRefs?.length > 0, 'dashboard projection API should return source refs');

    console.log(JSON.stringify({
      status: 'ok',
      checked: [
        'workbench-session-alias',
        'workbench-native-chat',
        'memory-candidates-hydrate',
        'memory-candidate-accept',
        'profile-patch',
        'profile-recompute-projection',
        'dashboard-projection-recompute',
      ],
      memoryStatus: accepted.item.status,
      profileVersion: patched.profile.version,
      projectionStatus: dashboardProjection.dashboardProjection.status,
    }));
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
