import type { TerminalState, UserPersona } from '../types/terminal';
import type {
  DashboardProjection,
  SovereignProfile,
  SovereignProfilePatchEvent,
} from '../types/workbench';
import { isKnownI18nText } from '../i18n/translations';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const compactText = (value: unknown, limit = 420) => {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
};

const unique = (items: Array<string | undefined | null>) =>
  Array.from(new Set(items.filter((item): item is string => Boolean(item))));

const pushStringValues = (
  tags: string[],
  record: Record<string, unknown> | undefined,
  keys: string[],
) => {
  if (!record) return;
  keys.forEach((key) => {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) tags.push(value.trim());
  });
};

const extractProfileTags = (profile: SovereignProfile) => {
  const tags: string[] = [];
  const behavioralTags = profile.behavioralPatterns?.tags;
  if (Array.isArray(behavioralTags)) {
    behavioralTags.forEach((tag) => {
      if (typeof tag === 'string' && tag.trim()) tags.push(tag.trim());
    });
  }

  pushStringValues(tags, profile.identity, [
    'wealthStage',
    'background',
    'career',
    'industry',
    'role',
    'planningHorizon',
    'riskPreference',
  ]);
  pushStringValues(tags, profile.riskPreferences, ['riskLevel', 'riskPreference', 'style']);
  pushStringValues(tags, profile.lifeConstraints, ['planningHorizon', 'familyStage', 'location']);

  const publicMarketIntent = profile.behavioralPatterns?.publicMarketIntent;
  if (isRecord(publicMarketIntent) && typeof publicMarketIntent.labelKey === 'string') {
    tags.push(publicMarketIntent.labelKey);
  }

  return unique(tags).slice(0, 8);
};

const getProfileDescription = (profile: SovereignProfile, tags: string[]) => {
  const directDescription =
    compactText(profile.behavioralPatterns?.description) ||
    compactText(profile.identity?.description) ||
    compactText(profile.identity?.notes);

  if (directDescription && !isKnownI18nText(directDescription, 'dashboard.personaFallback')) {
    return directDescription;
  }

  if (tags.length > 0) {
    return `主权档案 v${profile.version || 1} 已沉淀 ${tags.slice(0, 4).join(' / ')} 等长期特征，并将作为后续策略判断的默认上下文。`;
  }

  if (profile.updatedAt) {
    return `主权档案 v${profile.version || 1} 已更新，将作为后续策略判断的默认上下文。`;
  }

  return undefined;
};

const getDashboardSummary = (dashboardProjection?: DashboardProjection) => {
  const summary = compactText(dashboardProjection?.cioBrief?.summary, 900);
  if (!summary || summary.startsWith('workbench.')) return '';
  return summary;
};

type SovereignTerminalPatch = Omit<Partial<TerminalState>, 'insights' | 'userPersona'> & {
  insights?: Partial<TerminalState['insights']>;
  userPersona?: Partial<UserPersona>;
  sovereignProfileProjection?: Record<string, unknown>;
  dashboardProjection?: DashboardProjection;
  portfolioIntelligenceMap?: DashboardProjection['portfolioIntelligenceMap'];
};

export function deriveTerminalPatchFromDashboardProjection(input: {
  dashboardProjection?: DashboardProjection;
  profile?: SovereignProfile;
  event?: SovereignProfilePatchEvent;
}): SovereignTerminalPatch {
  const { dashboardProjection, profile, event } = input;
  if (!dashboardProjection) return {};

  const dashboardSummary = getDashboardSummary(dashboardProjection);
  const portfolioMap = dashboardProjection.portfolioIntelligenceMap;

  return {
    dashboardProjection,
    ...(portfolioMap ? { portfolioIntelligenceMap: portfolioMap } : {}),
    ...(dashboardSummary ? {
      insights: {
        global: dashboardSummary,
        publicSummary: dashboardSummary,
      },
    } : {}),
    sovereignProfileProjection: {
      profileVersion: profile?.version || dashboardProjection.profileVersion,
      profileUpdatedAt: profile?.updatedAt,
      generatedAt: dashboardProjection.generatedAt || Date.now(),
      status: dashboardProjection.status || 'awaiting_context',
      cioSummary: dashboardProjection.cioBrief?.summary,
      cioDecisionState: dashboardProjection.cioBrief?.decisionState,
      memoryCandidateCount: dashboardProjection.memoryCandidateCount || 0,
      widgetCount: dashboardProjection.widgetCount || dashboardProjection.dynamicWidgets?.length || 0,
      portfolioMapId: portfolioMap?.id,
      portfolioMapPositionCount: portfolioMap?.positions.length || 0,
      portfolioMapMissingCount: portfolioMap?.missingPieces.length || 0,
      portfolioMapTiltCount: portfolioMap?.suggestedTilts.length || 0,
      sourceRefs: dashboardProjection.sourceRefs || profile?.sourceRefs || [],
      trace: dashboardProjection.trace,
      lastDecisionEvent: event,
    },
  };
}

export function deriveTerminalPatchFromSovereignProfile(input: {
  profile: SovereignProfile;
  dashboardProjection?: DashboardProjection;
  event?: SovereignProfilePatchEvent;
}): SovereignTerminalPatch {
  const { profile, dashboardProjection, event } = input;
  const tags = extractProfileTags(profile);
  const description = getProfileDescription(profile, tags);
  const projectionPatch = deriveTerminalPatchFromDashboardProjection({
    dashboardProjection,
    profile,
    event,
  });
  const longContext = compactText(profile.identity?.longContext, 1200);
  const goal = isRecord(profile.identity?.goal) ? profile.identity.goal : undefined;
  const userPersona: Partial<UserPersona> = {};

  if (tags.length > 0) userPersona.tags = tags;
  if (description) userPersona.description = description;

  return {
    ...projectionPatch,
    ...(goal ? { goal: { ...goal } } : {}),
    userProfile: {
      ...(profile.identity || {}),
      sovereignProfile: profile,
      sovereignProfileVersion: profile.version,
      sovereignProfileUpdatedAt: profile.updatedAt,
      riskPreferences: profile.riskPreferences,
      lifeConstraints: profile.lifeConstraints,
      allocationPolicy: profile.allocationPolicy,
      behavioralPatterns: profile.behavioralPatterns,
      decisionLedger: profile.decisionLedger,
    },
    ...(Object.keys(userPersona).length > 0 ? { userPersona } : {}),
    ...(longContext ? {
      insights: {
        ...(projectionPatch.insights || {}),
        global: longContext,
      },
    } : {}),
    sovereignProfileProjection: {
      ...(projectionPatch.sovereignProfileProjection || {}),
      profileVersion: profile.version,
      profileUpdatedAt: profile.updatedAt,
      generatedAt: dashboardProjection?.generatedAt || Date.now(),
      status: dashboardProjection?.status || 'awaiting_context',
      memoryCandidateCount: dashboardProjection?.memoryCandidateCount || 0,
      sourceRefs: dashboardProjection?.sourceRefs || profile.sourceRefs || [],
      trace: dashboardProjection?.trace,
      lastDecisionEvent: event,
    },
  };
}
