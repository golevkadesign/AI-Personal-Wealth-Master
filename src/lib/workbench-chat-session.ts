import type { WorkbenchSessionSpec } from '../types/workbench';

type WorkbenchChatTurnLike = {
  ai?: string;
  thinking?: string;
  debugData?: any;
  aiSuggestedState?: unknown;
  [key: string]: unknown;
};

const isWorkbenchSessionSpec = (value: unknown): value is WorkbenchSessionSpec => (
  Boolean(value) &&
  typeof value === 'object' &&
  typeof (value as WorkbenchSessionSpec).id === 'string' &&
  typeof (value as WorkbenchSessionSpec).entryType === 'string'
);

export function resolveWorkbenchSessionForChatTurn(
  turn: WorkbenchChatTurnLike,
  options: {
    isLatestTurn?: boolean;
    activeSession?: WorkbenchSessionSpec | null;
  } = {},
): WorkbenchSessionSpec | undefined {
  const debugSession = turn.debugData?.workbenchSession;
  if (isWorkbenchSessionSpec(debugSession)) return debugSession;
  if (options.isLatestTurn && options.activeSession) return options.activeSession;
  return undefined;
}

export function attachWorkbenchSessionToLatestAssistantTurn<T extends WorkbenchChatTurnLike>(
  history: T[],
  session: WorkbenchSessionSpec,
): T[] {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    if (!item || (!item.ai && !item.thinking && !item.debugData && !item.aiSuggestedState)) continue;
    const next = history.slice();
    next[index] = {
      ...item,
      debugData: {
        ...(item.debugData || {}),
        workbenchNative: item.debugData?.workbenchNative ?? true,
        workbenchSession: session,
      },
    };
    return next;
  }

  return history;
}
