import type {
  DashboardProjection,
  MemoryInboxSnapshot,
  WorkbenchAgentRunResult,
  WorkbenchRailRun,
  WorkbenchSessionSpec,
} from '../types/workbench';
import { getApiEndpoint } from './api-endpoints';

export interface WorkbenchRunResponse {
  session: WorkbenchSessionSpec;
  agentResult?: WorkbenchAgentRunResult;
  railRun?: WorkbenchRailRun;
  memoryInbox?: MemoryInboxSnapshot;
  dashboardProjection?: DashboardProjection;
}

export interface WorkbenchChatResponse extends WorkbenchRunResponse {
  assistantMessage: string;
  chatResult: any;
  legacyCompatibleChatResult?: any;
}

function normalizeWorkbenchRunPayload(payload: any): WorkbenchRunResponse {
  if (!payload?.success || !payload.session) {
    throw new Error(payload?.error || 'Workbench run returned an empty session');
  }

  return {
    session: payload.session as WorkbenchSessionSpec,
    agentResult: payload.agentResult as WorkbenchAgentRunResult | undefined,
    railRun: payload.railRun as WorkbenchRailRun | undefined,
    memoryInbox: payload.memoryInbox as MemoryInboxSnapshot | undefined,
    dashboardProjection: payload.dashboardProjection as DashboardProjection | undefined,
  };
}

export async function runWorkbenchSessionResult(
  session: WorkbenchSessionSpec,
  prompt?: string,
  chatResult?: any,
): Promise<WorkbenchRunResponse> {
  const response = await fetch(getApiEndpoint('/api/workbench/run'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, prompt, chatResult }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Workbench run failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  return normalizeWorkbenchRunPayload(payload);
}

export async function runWorkbenchSession(
  session: WorkbenchSessionSpec,
  prompt?: string,
  chatResult?: any,
): Promise<WorkbenchSessionSpec> {
  const result = await runWorkbenchSessionResult(session, prompt, chatResult);
  return result.session;
}

export async function runWorkbenchChatResult(
  session: WorkbenchSessionSpec,
  prompt?: string,
  chatResult?: any,
  options: { longbridgeAccounts?: unknown[]; language?: string } = {},
): Promise<WorkbenchChatResponse> {
  const response = await fetch(getApiEndpoint('/api/workbench/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session,
      prompt,
      chatResult,
      longbridgeAccounts: options.longbridgeAccounts,
      language: options.language,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Workbench chat failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  const normalized = normalizeWorkbenchRunPayload(payload);
  const assistantMessage = typeof payload.assistantMessage === 'string'
    ? payload.assistantMessage
    : '';
  const nextChatResult = payload.chatResult || payload.legacyCompatibleChatResult;

  if (!assistantMessage || !nextChatResult) {
    throw new Error(payload?.error || 'Workbench chat returned an empty assistant result');
  }

  return {
    ...normalized,
    assistantMessage,
    chatResult: nextChatResult,
    legacyCompatibleChatResult: payload.legacyCompatibleChatResult,
  };
}
