import type { TerminalState } from '../types/terminal';
import type { WorkbenchSessionSpec } from '../types/workbench';
import { buildSharedFactBundle } from './workbench-facts';
import { hydrateWorkbenchMemoryProjection } from './workbench-memory';
import { runWorkbenchRailOrchestration } from './workbench-rails';
import { deriveTerminalPatchFromDashboardProjection } from './sovereign-profile-projection';

export type DashboardProjectionRefreshTrigger =
  | 'manual'
  | 'live_holdings_sync'
  | 'account_holdings_sync'
  | 'market_context_refresh'
  | 'profile_update'
  | 'memory_decision'
  | 'portfolio_review_memory';

const triggerSourceRef: Record<DashboardProjectionRefreshTrigger, string> = {
  manual: 'projection.refresh.manual',
  live_holdings_sync: 'projection.trigger.live_holdings_sync',
  account_holdings_sync: 'projection.trigger.account_holdings_sync',
  market_context_refresh: 'projection.trigger.market_context_refresh',
  profile_update: 'projection.trigger.profile_update',
  memory_decision: 'projection.trigger.memory_decision',
  portfolio_review_memory: 'projection.trigger.portfolio_review_memory',
};

export async function createDashboardProjectionRefreshPatch(input: {
  terminalState?: TerminalState;
  trigger?: DashboardProjectionRefreshTrigger;
  subject?: string;
}) {
  const trigger = input.trigger || 'manual';
  const terminalState = input.terminalState;
  if (!terminalState) {
    return {
      session: null,
      terminalPatch: {},
    };
  }

  const session: WorkbenchSessionSpec = {
    id: `projection-refresh-${trigger}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    entryType: 'dashboard_brief',
    titleKey: 'workbench.dashboardProjection',
    subject: input.subject || trigger,
    subjectSpec: {
      type: 'custom',
      id: `projection-${trigger}`,
      label: input.subject || trigger,
      payload: { trigger },
    },
    intentBias: 'global',
    defaultWidgetPreset: 'dashboard-brief',
    facts: buildSharedFactBundle({
      terminalState,
      sourceRefs: [triggerSourceRef[trigger]],
      missingFacts: ['rail_outputs'],
    }),
    initialWidgets: [],
    allowedActions: ['run_rails', 'render_widgets', 'project_dashboard'],
    createdAt: Date.now(),
  };

  const railRun = await runWorkbenchRailOrchestration(session);
  const hydratedSession = hydrateWorkbenchMemoryProjection({
    ...session,
    facts: {
      ...(session.facts || {}),
      sourceRefs: Array.from(new Set([
        ...(session.facts?.sourceRefs || []),
        triggerSourceRef[trigger],
      ])),
    },
    railRun,
  });

  return {
    session: hydratedSession,
    terminalPatch: deriveTerminalPatchFromDashboardProjection({
      dashboardProjection: hydratedSession.dashboardProjection,
      profile: hydratedSession.facts?.sovereignProfile,
    }),
  };
}
