import { MarketContext } from './market-context';
import { PortfolioIntelligenceMap } from './portfolio-intelligence';
import { AgentAnalysisSnapshot, PositionAnalysisResult } from './portfolio';
import { AccountPortfolio, DistributionItem, TerminalState } from './terminal';

export type WorkbenchEntryType =
  | 'manual_chat'
  | 'dashboard_brief'
  | 'widget'
  | 'holding'
  | 'portfolio_review'
  | 'life_strategy'
  | 'profile_memory'
  | 'portfolio_intelligence';

export type WorkbenchIntentBias =
  | 'global'
  | 'general'
  | 'equity'
  | 'allocation'
  | 'life'
  | 'risk'
  | 'memory'
  | 'projection'
  | 'simulation';

export type WorkbenchSubjectType =
  | 'symbol'
  | 'portfolio'
  | 'goal'
  | 'metric'
  | 'profile'
  | 'custom';

export interface WorkbenchSubjectSpec {
  type: WorkbenchSubjectType;
  id?: string;
  label?: string;
  payload?: Record<string, unknown>;
}

export type WorkbenchDefaultWidgetPreset =
  | 'manual-chat'
  | 'dashboard-brief'
  | 'widget-context'
  | 'holding-analysis'
  | 'portfolio-review'
  | 'portfolio-intelligence'
  | 'life-strategy'
  | 'profile-memory';

export type WorkbenchActionPermission =
  | 'chat'
  | 'run_rails'
  | 'render_widgets'
  | 'propose_memory'
  | 'write_memory'
  | 'update_profile'
  | 'project_dashboard'
  | 'run_simulation';

export type WorkbenchRailId = 'equity' | 'allocation' | 'life';

export type WorkbenchWidgetType =
  | 'shared_facts'
  | 'rail_card'
  | 'cio_brief'
  | 'evidence'
  | 'source'
  | 'confidence'
  | 'memory_candidate'
  | 'action_queue'
  | 'portfolio_map'
  | 'current_exposure'
  | 'intent_fingerprint'
  | 'missing_pieces'
  | 'suggested_tilt'
  | 'projected_exposure'
  | 'holding_quote_snapshot'
  | 'holding_value_summary'
  | 'holding_sync_status'
  | 'holding_trend_chart'
  | 'holding_quant_indicators'
  | 'holding_strategy_deductions'
  | 'holding_analysis_snapshot_diff';

export type WorkbenchWidgetStatus =
  | 'ready'
  | 'awaiting_context'
  | 'waiting_signals'
  | 'partial'
  | 'blocked'
  | 'error';

export type WorkbenchEventPhase =
  | 'session_opened'
  | 'facts_hydrated'
  | 'workbench_run_started'
  | 'chat_submitted'
  | 'chat_result_received'
  | 'rails_started'
  | 'rails_completed'
  | 'memory_candidate_queued'
  | 'memory_projection_hydrated'
  | 'dashboard_projection_committed'
  | 'fallback_started'
  | 'memory_decision'
  | 'run_completed'
  | 'run_failed';

export type WorkbenchEventStatus =
  | 'pending'
  | 'running'
  | 'ready'
  | 'fallback'
  | 'error'
  | 'skipped';

export interface WorkbenchEvent {
  id: string;
  sessionId: string;
  phase: WorkbenchEventPhase;
  status: WorkbenchEventStatus;
  titleKey: string;
  messageKey?: string;
  detail?: string;
  sourceRefs?: string[];
  requestId?: number;
  createdAt: number;
  completedAt?: number;
}

export interface WorkbenchWidgetManifest {
  id: string;
  type: WorkbenchWidgetType;
  titleKey: string;
  status?: WorkbenchWidgetStatus;
  railId?: WorkbenchRailId;
  priority?: number;
  sourceRefs?: string[];
  props?: Record<string, unknown>;
}

export interface WorkbenchSessionSpec {
  id: string;
  entryType: WorkbenchEntryType;
  titleKey: string;
  /**
   * Legacy display label retained for existing UI surfaces. New orchestration
   * should prefer subjectSpec so entry context can keep type/id/payload.
   */
  subject?: string;
  subjectSpec?: WorkbenchSubjectSpec;
  intentBias?: WorkbenchIntentBias;
  initialPrompt?: string;
  defaultWidgetPreset?: WorkbenchDefaultWidgetPreset | string;
  facts?: Partial<SharedFactBundle>;
  railRun?: WorkbenchRailRun;
  memoryInbox?: MemoryInboxSnapshot;
  dashboardProjection?: DashboardProjection;
  initialWidgets?: WorkbenchWidgetManifest[];
  events?: WorkbenchEvent[];
  allowedActions?: WorkbenchActionPermission[];
  legacy?: {
    surface?: 'drawer' | 'copilot' | 'position_drawer' | 'portfolio_review_drawer';
    drawerOpen?: boolean;
    copilotTitle?: string;
    copilotRole?: string;
    portfolioReviewSessionId?: string;
    positionSymbol?: string;
  };
  createdAt: number;
}

export interface SharedFactBundle {
  terminalState?: TerminalState;
  sovereignProfile?: SovereignProfile;
  selectedHolding?: DistributionItem | null;
  selectedHoldingAnalysis?: HoldingWorkbenchAnalysis | null;
  publicHoldingAccounts?: AccountPortfolio[];
  portfolioIntelligenceMap?: PortfolioIntelligenceMap;
  marketContext?: MarketContext;
  userPrompt?: string;
  sourceRefs: string[];
  freshness?: {
    holdings?: number;
    marketContext?: number;
    profile?: number;
  };
  missingFacts?: string[];
  confidence?: 'high' | 'medium' | 'low' | 'unknown';
  summary?: SharedFactSummary;
}

export type HoldingAnalysisStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'partial'
  | 'error';

export interface HoldingWorkbenchAnalysis extends Partial<PositionAnalysisResult> {
  analysisStatus: HoldingAnalysisStatus;
  sourceRefs: string[];
  snapshot?: AgentAnalysisSnapshot | null;
  previousSnapshot?: AgentAnalysisSnapshot | null;
  diffFromLastSnapshot?: Record<string, unknown> | null;
}

export interface SharedFactSummary {
  hasTerminalState: boolean;
  hasSovereignProfile: boolean;
  hasSelectedHolding: boolean;
  hasUserPrompt: boolean;
  hasMarketContext: boolean;
  publicHoldingCount: number;
  accountCount: number;
  positionCount: number;
  sourceCount: number;
  missingFactCount: number;
}

export interface AgentRailResult {
  railId: WorkbenchRailId;
  titleKey: string;
  status: WorkbenchWidgetStatus;
  summaryKey: string;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  evidenceRefs: string[];
  missingFacts: string[];
  risks: string[];
  actions: WorkbenchActionItem[];
  widgetManifest: WorkbenchWidgetManifest[];
  memoryCandidates: MemoryCandidate[];
}

export interface WorkbenchRailDefinition {
  railId: WorkbenchRailId;
  titleKey: string;
  intentBias: WorkbenchIntentBias;
  requiredFacts: string[];
  widgetTypes: WorkbenchWidgetType[];
}

export interface WorkbenchRailRun {
  id: string;
  sessionId: string;
  status: WorkbenchWidgetStatus;
  startedAt: number;
  completedAt?: number;
  railResults: AgentRailResult[];
  sourceRefs: string[];
  missingFacts: string[];
  summary: {
    readyCount: number;
    partialCount: number;
    blockedCount: number;
    railCount: number;
  };
}

export interface CIOBrief {
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  decisionState: 'ready' | 'needs_context' | 'conflicted' | 'blocked';
  conflicts: Array<{
    railIds: WorkbenchRailId[];
    description: string;
    resolution?: string;
  }>;
  actions: WorkbenchActionItem[];
  evidenceRefs: string[];
  widgetManifest: WorkbenchWidgetManifest[];
}

export type MemoryCandidateType =
  | 'profile_fact'
  | 'behavioral_pattern'
  | 'decision_rule'
  | 'life_constraint'
  | 'risk_preference'
  | 'watch_item';

export interface MemoryCandidate {
  id: string;
  type: MemoryCandidateType;
  title: string;
  body: string;
  confidence: 'high' | 'medium' | 'low';
  sourceRefs: string[];
  structuredPatch?: Partial<SovereignProfile>;
  status: MemoryCandidateStatus;
  createdAt: number;
}

export type MemoryCandidateStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'merged'
  | 'temporary'
  | 'revoked';

export type MemoryInboxDecisionType =
  | 'accept'
  | 'reject'
  | 'merge'
  | 'edit_and_accept'
  | 'mark_temporary'
  | 'revoke';

export interface MemoryInboxDecisionInput {
  decision: MemoryInboxDecisionType;
  editedPatch?: Partial<SovereignProfile>;
  editedTitle?: string;
  editedBody?: string;
}

export interface MemoryInboxItem {
  id: string;
  candidate: MemoryCandidate;
  sourceSessionId: string;
  sourceEntryType: WorkbenchEntryType;
  status: MemoryCandidate['status'];
  willAffectProfile: boolean;
  willRefreshDashboard: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface MemoryInboxSnapshot {
  id: string;
  sessionId: string;
  generatedAt: number;
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
  mergedCount: number;
  temporaryCount?: number;
  revokedCount?: number;
  items: MemoryInboxItem[];
  sourceRefs: string[];
}

export interface SovereignProfilePatchEvent {
  id: string;
  candidateId: string;
  decision: MemoryInboxDecisionType;
  profileVersionBefore: number;
  profileVersionAfter: number;
  sourceRefs: string[];
  createdAt: number;
}

export interface MemoryInboxDecisionResult {
  item: MemoryInboxItem;
  profile: SovereignProfile;
  event?: SovereignProfilePatchEvent;
  dashboardProjection?: DashboardProjection;
}

export interface SovereignProfile {
  id?: string;
  version: number;
  identity?: Record<string, unknown>;
  lifeConstraints?: Record<string, unknown>;
  riskPreferences?: Record<string, unknown>;
  allocationPolicy?: Record<string, unknown>;
  behavioralPatterns?: Record<string, unknown>;
  decisionLedger?: Array<Record<string, unknown>>;
  updatedAt?: number;
  sourceRefs?: string[];
}

export interface DashboardProjection {
  id: string;
  profileVersion?: number;
  generatedAt: number;
  status?: WorkbenchWidgetStatus;
  cioBrief?: CIOBrief;
  portfolioIntelligenceMap?: PortfolioIntelligenceMap;
  dynamicWidgets: WorkbenchWidgetManifest[];
  memoryCandidateCount?: number;
  widgetCount?: number;
  sourceRefs: string[];
  trace?: {
    sessionId?: string;
    railRunId?: string;
    candidateIds: string[];
    generatedFrom: Array<'facts' | 'rails' | 'profile' | 'memory' | 'chat'>;
    sourceRefs: string[];
  };
}

export type WorkbenchAgentRunMode =
  | 'rail_orchestration'
  | 'chat_bridged'
  | 'local_fallback';

export interface WorkbenchAgentRunResult {
  protocolVersion: 'workbench-agent-result.v1';
  sessionId: string;
  entryType: WorkbenchEntryType;
  titleKey: string;
  subject?: string;
  subjectSpec?: WorkbenchSubjectSpec;
  intentBias?: WorkbenchIntentBias;
  status: WorkbenchWidgetStatus;
  runMode: WorkbenchAgentRunMode;
  generatedAt: number;
  railRun?: WorkbenchRailRun;
  cioBrief?: CIOBrief;
  widgetManifest: WorkbenchWidgetManifest[];
  memoryCandidates: MemoryCandidate[];
  memoryInbox?: MemoryInboxSnapshot;
  dashboardProjection?: DashboardProjection;
  sourceRefs: string[];
  trace: {
    generatedFrom: Array<'facts' | 'rails' | 'profile' | 'memory' | 'chat'>;
    hasChatResult: boolean;
    bridgeMode?: 'none' | 'legacy_chat_result';
    railCount: number;
    widgetCount: number;
    memoryCandidateCount: number;
    missingFacts: string[];
  };
}

export interface WorkbenchAuditSessionRecord {
  id: string;
  entryType: WorkbenchEntryType;
  titleKey: string;
  subject?: string;
  subjectSpec?: WorkbenchSubjectSpec;
  intentBias?: WorkbenchIntentBias;
  defaultWidgetPreset?: string;
  status: WorkbenchWidgetStatus;
  createdAt: number;
  updatedAt: number;
  railSummary?: WorkbenchRailRun['summary'];
  memoryInboxSummary?: {
    pendingCount: number;
    acceptedCount: number;
    rejectedCount: number;
    mergedCount: number;
    temporaryCount: number;
    revokedCount: number;
  };
  dashboardProjectionId?: string;
  widgetCount: number;
  eventCount: number;
  latestEventPhase?: WorkbenchEventPhase;
  latestEventStatus?: WorkbenchEventStatus;
  sourceRefs: string[];
}

export interface WorkbenchAuditDecisionRecord {
  id: string;
  sessionId: string;
  sourceEntryType: WorkbenchEntryType;
  itemId: string;
  candidateId: string;
  decision: MemoryInboxDecisionType;
  status: MemoryCandidateStatus;
  title: string;
  willAffectProfile: boolean;
  willRefreshDashboard: boolean;
  sourceRefs: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkbenchAuditSnapshot {
  version: 1;
  updatedAt: number;
  latestSessionId?: string;
  latestDecisionId?: string;
  sessions: WorkbenchAuditSessionRecord[];
  decisions: WorkbenchAuditDecisionRecord[];
  profileEvents: SovereignProfilePatchEvent[];
  stats: {
    sessionCount: number;
    decisionCount: number;
    profileEventCount: number;
    pendingMemoryCount: number;
    acceptedMemoryCount: number;
    rejectedMemoryCount: number;
  };
  sourceRefs: string[];
}

export interface WorkbenchActionItem {
  id: string;
  labelKey: string;
  intentBias?: WorkbenchIntentBias;
  priority?: 'high' | 'medium' | 'low';
  status?: 'pending' | 'ready' | 'blocked';
  payload?: Record<string, unknown>;
}
