import {
  SharedFactBundle,
  SharedFactSummary,
  SovereignProfile,
  WorkbenchSessionSpec,
} from '../types/workbench';
import { AccountPortfolio, DistributionItem, TerminalState } from '../types/terminal';

const DEFAULT_PERSONA_DESCRIPTION = '唤起总监生成您的个人资产画像模型';
const DEFAULT_GLOBAL_INSIGHT = '等待数据注入...';

const unique = (items: Array<string | undefined | null>) =>
  Array.from(new Set(items.filter((item): item is string => Boolean(item))));

const hasMeaningfulText = (value: unknown, excluded: string[] = []) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && !excluded.includes(trimmed);
};

const getAccountPortfolios = (terminalState?: TerminalState, accountPortfolios?: AccountPortfolio[]) => {
  if (accountPortfolios) return accountPortfolios;
  return terminalState?.publicHoldingAccounts || (terminalState?.distributions as any)?.publicHoldingAccounts || [];
};

const getPublicHoldings = (terminalState?: TerminalState) =>
  terminalState?.distributions?.publicHoldings || [];

const countPositions = (accountPortfolios: AccountPortfolio[]) =>
  accountPortfolios.reduce((sum, account) => sum + (account.positions?.length || 0), 0);

export const createSovereignProfileFromTerminalState = (terminalState?: TerminalState): SovereignProfile | undefined => {
  if (!terminalState) return undefined;
  const hasPersona =
    hasMeaningfulText(terminalState.userPersona?.description, [DEFAULT_PERSONA_DESCRIPTION]) ||
    Boolean(terminalState.userPersona?.tags?.length);
  const profileKeys = Object.keys(terminalState.userProfile || {});

  if (!hasPersona && profileKeys.length === 0) {
    return undefined;
  }

  return {
    version: 1,
    identity: terminalState.userProfile || {},
    behavioralPatterns: {
      tags: terminalState.userPersona?.tags || [],
      description: terminalState.userPersona?.description,
    },
    sourceRefs: ['terminal.userProfile', 'terminal.userPersona'],
  };
};

const deriveMissingFacts = (input: {
  terminalState?: TerminalState;
  selectedHolding?: DistributionItem | null;
  userPrompt?: string;
  accountPortfolios: AccountPortfolio[];
  sourceRefs: string[];
  extraMissingFacts?: string[];
}) => {
  const missing: string[] = [];
  const publicHoldings = getPublicHoldings(input.terminalState);
  const hasHoldings = publicHoldings.length > 0 || countPositions(input.accountPortfolios) > 0;
  const hasProfile = Boolean(createSovereignProfileFromTerminalState(input.terminalState));
  const hasStrategicBrief = hasMeaningfulText(input.terminalState?.insights?.global, [DEFAULT_GLOBAL_INSIGHT]);

  if (!input.terminalState) missing.push('terminal_state');
  if (!hasProfile) missing.push('sovereign_profile');
  if (!hasHoldings) missing.push('public_holdings');
  if (!input.terminalState?.marketContext) missing.push('market_context');
  if (!hasStrategicBrief) missing.push('strategic_brief');
  if (input.selectedHolding && !input.selectedHolding.symbol && !input.selectedHolding.name) {
    missing.push('selected_holding_identity');
  }

  return unique([...missing, ...(input.extraMissingFacts || [])]);
};

const deriveConfidence = (summary: SharedFactSummary): SharedFactBundle['confidence'] => {
  if (!summary.hasTerminalState) return 'unknown';
  if (summary.missingFactCount <= 1 && summary.sourceCount >= 4) return 'high';
  if (summary.missingFactCount <= 3 && summary.sourceCount >= 2) return 'medium';
  return 'low';
};

export function buildSharedFactBundle(input: {
  terminalState?: TerminalState;
  selectedHolding?: DistributionItem | null;
  accountPortfolios?: AccountPortfolio[];
  userPrompt?: string;
  sourceRefs?: string[];
  missingFacts?: string[];
  confidence?: SharedFactBundle['confidence'];
}): SharedFactBundle {
  const accountPortfolios = getAccountPortfolios(input.terminalState, input.accountPortfolios);
  const publicHoldings = getPublicHoldings(input.terminalState);
  const sovereignProfile = createSovereignProfileFromTerminalState(input.terminalState);
  const sourceRefs = unique([
    input.terminalState ? 'terminal_state' : undefined,
    sovereignProfile ? 'terminal.sovereign_profile' : undefined,
    input.terminalState?.marketContext ? 'market_context' : undefined,
    publicHoldings.length > 0 ? 'terminal.distributions.publicHoldings' : undefined,
    accountPortfolios.length > 0 ? 'longbridge.account_portfolios' : undefined,
    input.selectedHolding ? 'public_holding.selection' : undefined,
    input.userPrompt ? 'manual_prompt' : undefined,
    ...(input.sourceRefs || []),
  ]);

  const missingFacts = deriveMissingFacts({
    terminalState: input.terminalState,
    selectedHolding: input.selectedHolding,
    userPrompt: input.userPrompt,
    accountPortfolios,
    sourceRefs,
    extraMissingFacts: input.missingFacts,
  });

  const summary: SharedFactSummary = {
    hasTerminalState: Boolean(input.terminalState),
    hasSovereignProfile: Boolean(sovereignProfile),
    hasSelectedHolding: Boolean(input.selectedHolding),
    hasUserPrompt: hasMeaningfulText(input.userPrompt),
    hasMarketContext: Boolean(input.terminalState?.marketContext),
    publicHoldingCount: publicHoldings.length,
    accountCount: accountPortfolios.length,
    positionCount: countPositions(accountPortfolios),
    sourceCount: sourceRefs.length,
    missingFactCount: missingFacts.length,
  };

  return {
    terminalState: input.terminalState,
    sovereignProfile,
    selectedHolding: input.selectedHolding,
    publicHoldingAccounts: accountPortfolios,
    marketContext: input.terminalState?.marketContext,
    userPrompt: input.userPrompt,
    sourceRefs,
    freshness: {
      holdings: input.terminalState?.publicHoldingAccountsLastSyncAt || input.terminalState?._liveFetchedAt,
      marketContext: input.terminalState?.marketContextLastFetchedAt || input.terminalState?.marketContext?.generatedAt,
      profile: sovereignProfile?.updatedAt,
    },
    missingFacts,
    confidence: input.confidence || deriveConfidence(summary),
    summary,
  };
}

export function createWorkbenchFactsDebugSnapshot(sessionSpec: WorkbenchSessionSpec | null) {
  const facts = sessionSpec?.facts;
  if (!sessionSpec || !facts) return null;
  return {
    confidence: facts.confidence || 'unknown',
    sourceCount: facts.summary?.sourceCount || facts.sourceRefs?.length || 0,
    missingFactCount: facts.summary?.missingFactCount || facts.missingFacts?.length || 0,
    accountCount: facts.summary?.accountCount || 0,
    positionCount: facts.summary?.positionCount || 0,
    publicHoldingCount: facts.summary?.publicHoldingCount || 0,
    hasMarketContext: Boolean(facts.summary?.hasMarketContext),
    hasSovereignProfile: Boolean(facts.summary?.hasSovereignProfile),
    hasSelectedHolding: Boolean(facts.summary?.hasSelectedHolding),
    hasUserPrompt: Boolean(facts.summary?.hasUserPrompt),
  };
}
