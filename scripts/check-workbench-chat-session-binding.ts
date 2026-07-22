import {
  attachWorkbenchSessionToLatestAssistantTurn,
  resolveWorkbenchSessionForChatTurn,
} from '../src/lib/workbench-chat-session';
import type { WorkbenchSessionSpec } from '../src/types/workbench';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function createSession(id: string, entryType: WorkbenchSessionSpec['entryType']): WorkbenchSessionSpec {
  return {
    id,
    entryType,
    titleKey: `workbench.${entryType}`,
    intentBias: entryType === 'holding' ? 'equity' : 'global',
    facts: {
      sourceRefs: [`test.${id}`],
      confidence: 'medium',
      missingFacts: [],
    },
    initialWidgets: [],
    allowedActions: ['chat', 'run_rails', 'render_widgets'],
    createdAt: Date.now(),
  };
}

const activeSession = createSession('active-session', 'manual_chat');
const firstReplySession = createSession('first-reply-session', 'holding');
const finalReplySession = createSession('final-reply-session', 'portfolio_intelligence');

const history = [
  {
    user: 'Open holding analysis',
    ai: 'Holding reply',
    attachments: [],
    debugData: {
      workbenchNative: true,
      workbenchSession: firstReplySession,
    },
  },
  {
    user: 'Run projected exposure',
    ai: 'Portfolio reply',
    attachments: [],
    debugData: {
      workbenchNative: true,
      workbenchSession: activeSession,
    },
  },
];

const firstResolved = resolveWorkbenchSessionForChatTurn(history[0], {
  isLatestTurn: false,
  activeSession,
});
assert(firstResolved?.id === firstReplySession.id, 'historical reply should keep its own workbench session');
assert(firstResolved?.entryType === 'holding', 'historical reply should preserve entry-specific widget context');

const latestResolved = resolveWorkbenchSessionForChatTurn({ user: 'loading', ai: '', attachments: [] }, {
  isLatestTurn: true,
  activeSession,
});
assert(latestResolved?.id === activeSession.id, 'latest reply can fall back to active workbench session');

const attached = attachWorkbenchSessionToLatestAssistantTurn(history, finalReplySession);
assert(attached !== history, 'session attachment should return a new history array');
assert(attached[0].debugData.workbenchSession.id === firstReplySession.id, 'session attachment should not rewrite older turns');
assert(attached[1].debugData.workbenchSession.id === finalReplySession.id, 'session attachment should update latest assistant turn');
assert(attached[1].debugData.workbenchNative === true, 'session attachment should keep native marker');

console.log(JSON.stringify({
  status: 'ok',
  checked: [
    'historical-reply-keeps-own-session',
    'latest-reply-falls-back-to-active-session',
    'final-session-attaches-to-latest-turn',
  ],
  historicalEntryType: firstResolved?.entryType,
  finalEntryType: attached[1].debugData.workbenchSession.entryType,
}));
