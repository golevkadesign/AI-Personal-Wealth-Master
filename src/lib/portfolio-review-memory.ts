import type { PortfolioReviewMemory, PortfolioReviewSession } from '../types/portfolio-review';
import type { MemoryCandidate, SovereignProfile, WorkbenchSessionSpec } from '../types/workbench';
import type { TerminalState } from '../types/terminal';
import { buildSharedFactBundle } from './workbench-facts';
import { hydrateWorkbenchMemoryProjection, applyMemoryInboxDecision } from './workbench-memory';
import { deriveTerminalPatchFromSovereignProfile } from './sovereign-profile-projection';

const unique = (items: Array<string | undefined | null>) =>
  Array.from(new Set(items.filter((item): item is string => Boolean(item))));

const compactList = <T>(items: T[] | undefined, limit = 8) =>
  Array.isArray(items) ? items.filter(Boolean).slice(0, limit) : [];

export function createPortfolioReviewMemoryFromSession(
  session: PortfolioReviewSession,
  riskPreferenceObserved?: string,
): PortfolioReviewMemory | null {
  if (!session.report) return null;

  const report = session.report;
  const recurringMistakes = compactList(report.portfolioDiagnosis?.avoidActions);
  const lastActionItems = [
    ...compactList(report.actionPlan?.shortTerm, 12),
    ...compactList(report.actionPlan?.midTerm, 12),
  ].filter((item) => item.priority === 'high' || item.priority === 'medium');
  const nextReviewFocus = compactList(report.nextReviewNeeds);
  const summarySentences = (report.summary || '')
    .split(/[。！？\.]/)
    .map((value) => value.trim())
    .filter((value) => value.length > 5)
    .slice(0, 2);

  return {
    lastReviewId: session.id,
    updatedAt: Date.now(),
    behavioralPatterns: [
      ...summarySentences,
      ...recurringMistakes.map((item) => `规避动作：${item}`),
    ],
    recurringMistakes,
    lastActionItems,
    nextReviewFocus,
    riskPreferenceObserved,
  };
}

export function createPortfolioReviewMemoryCandidate(input: {
  session: PortfolioReviewSession;
  memory: PortfolioReviewMemory;
  profileVersion?: number;
}): MemoryCandidate {
  const { session, memory, profileVersion = 1 } = input;
  const sourceRefs = unique([
    'portfolio_review.report',
    `portfolio_review.session.${session.id}`,
    session.marketContextSnapshot ? 'portfolio_review.market_context_snapshot' : undefined,
  ]);

  return {
    id: `memory-portfolio-review-${session.id}`,
    type: 'decision_rule',
    title: 'workbench.memory.portfolioReviewTitle',
    body: 'workbench.memory.portfolioReviewProjection',
    confidence: session.currentSnapshot?.dataConfidence === 'high' ? 'high' : 'medium',
    sourceRefs,
    structuredPatch: {
      version: profileVersion,
      behavioralPatterns: {
        portfolioReview: {
          lastReviewId: memory.lastReviewId,
          behavioralPatterns: memory.behavioralPatterns,
          recurringMistakes: memory.recurringMistakes,
          nextReviewFocus: memory.nextReviewFocus,
          riskPreferenceObserved: memory.riskPreferenceObserved,
        },
      },
      riskPreferences: memory.riskPreferenceObserved
        ? { portfolioReviewObservedRisk: memory.riskPreferenceObserved }
        : undefined,
      allocationPolicy: {
        lastPortfolioReviewActions: memory.lastActionItems,
        nextReviewFocus: memory.nextReviewFocus,
      },
      decisionLedger: [
        {
          id: `portfolio-review-ledger-${session.id}`,
          type: 'portfolio_review_memory',
          reviewId: session.id,
          summary: session.report?.summary,
          avoidActions: session.report?.portfolioDiagnosis?.avoidActions || [],
          nextReviewFocus: memory.nextReviewFocus,
          capturedAt: memory.updatedAt,
        },
      ],
      sourceRefs,
    },
    status: 'pending',
    createdAt: memory.updatedAt,
  };
}

function createPortfolioReviewMemoryWorkbenchSession(input: {
  reviewSession: PortfolioReviewSession;
  terminalState: TerminalState;
  candidate: MemoryCandidate;
}): WorkbenchSessionSpec {
  const now = Date.now();
  return {
    id: `workbench-portfolio-review-memory-${input.reviewSession.id}`,
    entryType: 'profile_memory',
    titleKey: 'workbench.memoryProfileWorkbench',
    subject: input.reviewSession.id,
    subjectSpec: {
      type: 'profile',
      id: `portfolio-review-memory-${input.reviewSession.id}`,
      label: input.reviewSession.id,
      payload: {
        reviewSessionId: input.reviewSession.id,
      },
    },
    intentBias: 'memory',
    initialPrompt: input.reviewSession.report?.summary,
    defaultWidgetPreset: 'profile-memory',
    facts: buildSharedFactBundle({
      terminalState: input.terminalState,
      userPrompt: input.reviewSession.report?.summary,
      sourceRefs: ['portfolio_review.memory_candidate'],
      missingFacts: ['rail_outputs'],
    }),
    railRun: {
      id: `rail-run-portfolio-review-memory-${input.reviewSession.id}`,
      sessionId: `workbench-portfolio-review-memory-${input.reviewSession.id}`,
      status: 'partial',
      startedAt: now,
      completedAt: now,
      sourceRefs: input.candidate.sourceRefs,
      missingFacts: [],
      summary: {
        readyCount: 1,
        partialCount: 0,
        blockedCount: 0,
        railCount: 1,
      },
      railResults: [
        {
          railId: 'life',
          titleKey: 'workbench.railTitles.life',
          status: 'ready',
          summaryKey: 'workbench.railSummaries.life.ready',
          summary: 'workbench.memory.portfolioReviewProjection',
          confidence: input.candidate.confidence,
          evidenceRefs: input.candidate.sourceRefs,
          missingFacts: [],
          risks: [],
          actions: [
            {
              id: `portfolio-review-memory-action-${input.reviewSession.id}`,
              labelKey: 'workbench.actions.updateProfile',
              intentBias: 'memory',
              priority: 'high',
              status: 'ready',
            },
          ],
          widgetManifest: [
            {
              id: `portfolio-review-memory-widget-${input.reviewSession.id}`,
              type: 'memory_candidate',
              titleKey: 'workbench.memoryCandidate',
              railId: 'life',
              status: 'ready',
              priority: 1,
              sourceRefs: input.candidate.sourceRefs,
            },
          ],
          memoryCandidates: [input.candidate],
        },
      ],
    },
    initialWidgets: [
      {
        id: 'memory-candidate',
        type: 'memory_candidate',
        titleKey: 'workbench.memoryCandidate',
        status: 'waiting_signals',
        priority: 1,
      },
      {
        id: 'shared-facts',
        type: 'shared_facts',
        titleKey: 'workbench.sharedFacts',
        status: 'partial',
        priority: 2,
      },
      {
        id: 'confidence',
        type: 'confidence',
        titleKey: 'workbench.confidence',
        status: 'partial',
        priority: 3,
      },
    ],
    allowedActions: ['chat', 'render_widgets', 'propose_memory', 'write_memory', 'update_profile', 'project_dashboard'],
    createdAt: now,
  };
}

export function acceptPortfolioReviewMemoryCandidate(input: {
  reviewSession: PortfolioReviewSession;
  terminalState: TerminalState;
  candidate: MemoryCandidate;
  baseProfile: SovereignProfile;
}) {
  const workbenchSession = hydrateWorkbenchMemoryProjection(createPortfolioReviewMemoryWorkbenchSession({
    reviewSession: input.reviewSession,
    terminalState: input.terminalState,
    candidate: input.candidate,
  }));
  const inboxItem = workbenchSession.memoryInbox?.items.find((item) => item.candidate.id === input.candidate.id);
  if (!inboxItem) return null;

  const result = applyMemoryInboxDecision({
    item: inboxItem,
    profile: input.baseProfile,
    decision: 'accept',
    sessionSpec: workbenchSession,
  });

  return {
    result,
    terminalPatch: deriveTerminalPatchFromSovereignProfile({
      profile: result.profile,
      dashboardProjection: result.dashboardProjection,
      event: result.event,
    }),
    workbenchSession,
  };
}
