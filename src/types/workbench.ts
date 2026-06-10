import { MarketContext } from './market-context';
import { PortfolioIntelligenceMap } from './portfolio-intelligence';
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
  | 'general'
  | 'equity'
  | 'allocation'
  | 'life'
  | 'memory'
  | 'projection'
  | 'simulation';

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
  | 'legacy_chat';

export type WorkbenchWidgetStatus =
  | 'ready'
  | 'awaiting_context'
  | 'waiting_signals'
  | 'partial'
  | 'blocked'
  | 'error';

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
  subject?: string;
  intentBias?: WorkbenchIntentBias;
  facts?: Partial<SharedFactBundle>;
  railRun?: WorkbenchRailRun;
  memoryInbox?: MemoryInboxSnapshot;
  dashboardProjection?: DashboardProjection;
  initialWidgets?: WorkbenchWidgetManifest[];
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
  publicHoldingAccounts?: AccountPortfolio[];
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
  status: 'pending' | 'accepted' | 'rejected' | 'merged';
  createdAt: number;
}

export type MemoryInboxDecisionType =
  | 'accept'
  | 'reject'
  | 'merge'
  | 'edit_and_accept';

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
    generatedFrom: Array<'facts' | 'rails' | 'profile' | 'memory'>;
    sourceRefs: string[];
  };
}

export interface WorkbenchActionItem {
  id: string;
  labelKey: string;
  intentBias?: WorkbenchIntentBias;
  priority?: 'high' | 'medium' | 'low';
  status?: 'pending' | 'ready' | 'blocked';
  payload?: Record<string, unknown>;
}
