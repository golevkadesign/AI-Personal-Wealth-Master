import {
  SharedFactBundle,
  SharedFactSummary,
  SovereignProfile,
  WorkbenchSessionSpec,
} from '../types/workbench';
import { AccountPortfolio, DistributionItem, TerminalState } from '../types/terminal';
import { buildPortfolioIntelligenceMap } from './portfolio-intelligence';
import { isKnownI18nText } from '../i18n/translations';

const unique = (items: Array<string | undefined | null>) =>
  Array.from(new Set(items.filter((item): item is string => Boolean(item))));

const hasMeaningfulText = (value: unknown, excluded: string[] = []) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && !excluded.includes(trimmed);
};

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getAccountPortfolios = (terminalState?: TerminalState, accountPortfolios?: AccountPortfolio[]) => {
  if (accountPortfolios) return accountPortfolios;
  return terminalState?.publicHoldingAccounts || (terminalState?.distributions as any)?.publicHoldingAccounts || [];
};

const getPublicHoldings = (terminalState?: TerminalState) =>
  terminalState?.distributions?.publicHoldings || [];

const countPositions = (accountPortfolios: AccountPortfolio[]) =>
  accountPortfolios.reduce((sum, account) => sum + (account.positions?.length || 0), 0);

const hasUsableMarketContext = (terminalState?: TerminalState) => {
  const marketContext = terminalState?.marketContext;
  if (!marketContext) return false;
  const qualityStatus = marketContext.qualitySummary?.status;
  const instrumentCoverage = marketContext.qualitySummary?.instrumentCoverageRatio || 0;
  const hasInstruments = (marketContext.instruments?.length || 0) > 0;
  return qualityStatus !== 'failed' && (qualityStatus !== 'stale' || (hasInstruments && instrumentCoverage > 0));
};

export const createSovereignProfileFromTerminalState = (terminalState?: TerminalState): SovereignProfile | undefined => {
  if (!terminalState) return undefined;
  const userProfile = terminalState.userProfile || {};
  const existingProfile = isRecord(userProfile.sovereignProfile)
    ? userProfile.sovereignProfile as SovereignProfile
    : undefined;
  const hasPersona = (
    hasMeaningfulText(terminalState.userPersona?.description) &&
    !isKnownI18nText(terminalState.userPersona?.description, 'dashboard.personaFallback')
  ) ||
    Boolean(terminalState.userPersona?.tags?.length);
  const profileKeys = Object.keys(userProfile || {});

  if (existingProfile) {
    const {
      sovereignProfile,
      sovereignProfileVersion,
      sovereignProfileUpdatedAt,
      ...legacyIdentity
    } = userProfile;
    const personaTags = terminalState.userPersona?.tags || [];
    const existingTags = Array.isArray(existingProfile.behavioralPatterns?.tags)
      ? existingProfile.behavioralPatterns?.tags
      : [];

    return {
      ...existingProfile,
      version: Number(existingProfile.version || sovereignProfileVersion || 1),
      identity: {
        ...legacyIdentity,
        ...(existingProfile.identity || {}),
      },
      behavioralPatterns: {
        ...(existingProfile.behavioralPatterns || {}),
        tags: existingTags.length > 0 ? existingTags : personaTags,
        description:
          existingProfile.behavioralPatterns?.description ||
          terminalState.userPersona?.description,
      },
      updatedAt: existingProfile.updatedAt || sovereignProfileUpdatedAt,
      sourceRefs: unique([
        ...(existingProfile.sourceRefs || []),
        'terminal.userProfile.sovereignProfile',
        hasPersona ? 'terminal.userPersona' : undefined,
      ]),
    };
  }

  if (!hasPersona && profileKeys.length === 0) {
    return undefined;
  }

  return {
    version: 1,
    identity: userProfile || {},
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
  selectedHoldingAnalysis?: SharedFactBundle['selectedHoldingAnalysis'];
  userPrompt?: string;
  accountPortfolios: AccountPortfolio[];
  sourceRefs: string[];
  extraMissingFacts?: string[];
}) => {
  const missing: string[] = [];
  const publicHoldings = getPublicHoldings(input.terminalState);
  const hasHoldings = publicHoldings.length > 0 || countPositions(input.accountPortfolios) > 0;
  const hasProfile = Boolean(createSovereignProfileFromTerminalState(input.terminalState));
  const hasStrategicBrief =
    hasMeaningfulText(input.terminalState?.insights?.global) &&
    !isKnownI18nText(input.terminalState?.insights?.global, 'dashboard.strategicFallback');
  const hasMarket = hasUsableMarketContext(input.terminalState);

  if (!input.terminalState) missing.push('terminal_state');
  if (!hasProfile) missing.push('sovereign_profile');
  if (!hasHoldings) missing.push('public_holdings');
  if (!hasMarket) missing.push('market_context');
  if (!hasStrategicBrief) missing.push('strategic_brief');
  if (input.selectedHolding && !input.selectedHolding.symbol && !input.selectedHolding.name) {
    missing.push('selected_holding_identity');
  }
  if (input.selectedHolding && !input.selectedHoldingAnalysis) {
    missing.push('holding_quant_analysis');
  }

  const combined = unique([...missing, ...(input.extraMissingFacts || [])]);
  return input.selectedHoldingAnalysis
    ? combined.filter((fact) => fact !== 'holding_quant_analysis')
    : combined;
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
  selectedHoldingAnalysis?: SharedFactBundle['selectedHoldingAnalysis'];
  accountPortfolios?: AccountPortfolio[];
  portfolioIntelligenceMap?: SharedFactBundle['portfolioIntelligenceMap'];
  userPrompt?: string;
  sourceRefs?: string[];
  missingFacts?: string[];
  confidence?: SharedFactBundle['confidence'];
}): SharedFactBundle {
  const accountPortfolios = getAccountPortfolios(input.terminalState, input.accountPortfolios);
  const publicHoldings = getPublicHoldings(input.terminalState);
  const sovereignProfile = createSovereignProfileFromTerminalState(input.terminalState);
  const hasMarket = hasUsableMarketContext(input.terminalState);
  const portfolioIntelligenceMap = input.portfolioIntelligenceMap || (
    accountPortfolios.length > 0 || publicHoldings.length > 0
      ? buildPortfolioIntelligenceMap({
        accountPortfolios,
        terminalState: input.terminalState,
      })
      : undefined
  );
  const sourceRefs = unique([
    input.terminalState ? 'terminal_state' : undefined,
    sovereignProfile ? 'terminal.sovereign_profile' : undefined,
    hasMarket ? 'market_context' : undefined,
    publicHoldings.length > 0 ? 'terminal.distributions.publicHoldings' : undefined,
    accountPortfolios.length > 0 ? 'longbridge.account_portfolios' : undefined,
    portfolioIntelligenceMap ? 'portfolio_intelligence.map' : undefined,
    input.selectedHolding ? 'public_holding.selection' : undefined,
    input.selectedHoldingAnalysis ? 'holding.quant_analysis' : undefined,
    input.userPrompt ? 'manual_prompt' : undefined,
    ...(portfolioIntelligenceMap?.sourceRefs || []),
    ...(input.sourceRefs || []),
  ]);

  const missingFacts = deriveMissingFacts({
    terminalState: input.terminalState,
    selectedHolding: input.selectedHolding,
    selectedHoldingAnalysis: input.selectedHoldingAnalysis,
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
    hasMarketContext: hasMarket,
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
    selectedHoldingAnalysis: input.selectedHoldingAnalysis,
    publicHoldingAccounts: accountPortfolios,
    portfolioIntelligenceMap,
    marketContext: hasMarket ? input.terminalState?.marketContext : undefined,
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
    hasSelectedHoldingAnalysis: Boolean(facts.selectedHoldingAnalysis),
  };
}
