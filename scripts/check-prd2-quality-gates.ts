import fs from 'node:fs';
import path from 'node:path';
import { translations } from '../src/i18n/translations';
import { createWorkbenchAgentRunResult } from '../src/lib/workbench-agent-result';
import { hydrateWorkbenchMemoryProjection } from '../src/lib/workbench-memory';
import { runWorkbenchRailOrchestration } from '../src/lib/workbench-rails';
import {
  createDashboardBriefWorkbenchSession,
  createHoldingWorkbenchSession,
  createLifeStrategyWorkbenchSession,
  createManualChatWorkbenchSession,
  createPortfolioIntelligenceWorkbenchSession,
} from '../src/lib/workbench-session';
import { getRenderableWorkbenchWidgetSelection } from '../src/lib/workbench-widget-registry';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child)
      ? flattenKeys(child, next)
      : [next];
  });
}

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const terminalState: any = {
  userProfile: {
    name: 'Test User',
    wealthStage: 'accumulation',
    riskProfile: 'balanced',
  },
  userPersona: {
    description: 'Evidence-backed long-horizon investor.',
    tags: ['long horizon', 'balanced risk'],
  },
  insights: {
    global: 'Preserve liquidity while reviewing concentrated growth exposure.',
  },
  goal: {
    name: 'Long-term resilience',
    current: 400000,
    target: 1000000,
  },
  distributions: {
    publicHoldings: [
      { id: 'VOO.US', symbol: 'VOO.US', name: 'Vanguard S&P 500 ETF', value: 6779, marketValue: 6779, percentage: 62 },
      { id: 'MSFT.US', symbol: 'MSFT.US', name: 'Microsoft', value: 4150, marketValue: 4150, percentage: 38 },
    ],
  },
};

async function verifyAgentScenarios() {
  const scenarios = [
    createManualChatWorkbenchSession(),
    createDashboardBriefWorkbenchSession({ terminalState, insight: terminalState.insights.global }),
    createHoldingWorkbenchSession(terminalState.distributions.publicHoldings[0], terminalState),
    createPortfolioIntelligenceWorkbenchSession({ terminalState }),
    createLifeStrategyWorkbenchSession({ terminalState, initialPrompt: 'Review long-term constraints.' }),
  ];
  const initialSelections = new Set<string>();

  for (const session of scenarios) {
    initialSelections.add(getRenderableWorkbenchWidgetSelection(session).selectedTypes.join(','));
    const railRun = await runWorkbenchRailOrchestration(session);
    const hydrated = hydrateWorkbenchMemoryProjection({ ...session, railRun });
    const result = createWorkbenchAgentRunResult(hydrated);
    const railIds = railRun.railResults.map((rail) => rail.railId);

    assert(railRun.summary.railCount === 3, `${session.entryType}: expected exactly three rails`);
    assert(new Set(railIds).size === 3, `${session.entryType}: rail IDs must be unique`);
    assert(railIds.includes('equity') && railIds.includes('allocation') && railIds.includes('life'), `${session.entryType}: all rail domains must run`);
    assert(result.cioBrief, `${session.entryType}: CIO synthesis is required`);
    assert(result.widgetManifest.some((widget) => widget.type === 'cio_brief'), `${session.entryType}: CIO widget is required`);
    assert(new Set(result.widgetManifest.map((widget) => widget.id)).size === result.widgetManifest.length, `${session.entryType}: widget IDs must be unique`);
    assert(result.sourceRefs.length > 0, `${session.entryType}: agent result must retain source references`);

    railRun.railResults.forEach((rail) => {
      assert(['ready', 'partial', 'blocked', 'error', 'waiting_signals', 'awaiting_context'].includes(rail.status), `${session.entryType}/${rail.railId}: invalid status`);
      if (rail.status === 'ready') {
        assert(rail.evidenceRefs.length > 0, `${session.entryType}/${rail.railId}: ready rail requires evidence`);
      }
    });
  }

  assert(initialSelections.size >= 4, 'entry-aware initial widget presets must not collapse into one universal layout');
  return scenarios.map((session) => session.entryType);
}

function verifyProductContracts() {
  const zhKeys = flattenKeys(translations['zh-CN']).sort();
  const enKeys = flattenKeys(translations['en-US']).sort();
  const zhOnly = zhKeys.filter((key) => !enKeys.includes(key));
  const enOnly = enKeys.filter((key) => !zhKeys.includes(key));
  assert(zhOnly.length === 0, `zh-CN-only i18n keys: ${zhOnly.slice(0, 8).join(', ')}`);
  assert(enOnly.length === 0, `en-US-only i18n keys: ${enOnly.slice(0, 8).join(', ')}`);

  const index = read('index.html');
  const app = read('src/App.tsx');
  const settings = read('src/components/SettingsModal.tsx');
  const developer = read('src/components/DeveloperView.tsx');
  const workbenchRoute = read('server/routes/workbench.ts');
  const chartRuntime = read('src/components/ReactECharts.tsx');
  const styles = read('src/index.css');

  assert(index.includes('<title>ARBITRA | Wealth Operating System</title>'), 'document title must use the product brand');
  assert(app.includes('React.lazy'), 'secondary product surfaces must be code split');
  assert(settings.includes('role="dialog"') && settings.includes('aria-modal="true"'), 'settings must be an accessible modal');
  assert(developer.includes('role="dialog"') && developer.includes('aria-modal="true"'), 'developer view must be an accessible modal');
  assert(!settings.includes('aw-modal-header flex shrink-0 items-center justify-between gap-4 border-b'), 'settings header must use spacing instead of a divider');
  assert(!developer.includes('aw-modal-header min-h-16 px-4 sm:min-h-20 sm:px-8 border-b'), 'developer header must use spacing instead of a divider');
  assert(workbenchRoute.includes('formatMissingFacts'), 'native replies must translate protocol fact IDs');
  assert(chartRuntime.includes("import('./charts/echarts-runtime')"), 'chart engine must load on demand');
  assert(styles.includes('.aw-chart-min-empty') && styles.includes('min-height: 176px'), 'empty charts must use compact semantic height');
  assert(styles.includes('--aw-card-bg: #111412'), 'card background must map to the canonical token');

  return { i18nKeyCount: zhKeys.length };
}

async function main() {
  const scenarios = await verifyAgentScenarios();
  const contracts = verifyProductContracts();
  console.log(JSON.stringify({
    status: 'ok',
    checked: [
      'five-entry-agent-scenarios',
      'three-parallel-rails',
      'cio-and-source-contracts',
      'entry-aware-widget-presets',
      'i18n-locale-parity',
      'accessible-secondary-modals',
      'compact-empty-state-contract',
      'lazy-ui-and-chart-runtime',
    ],
    scenarios,
    ...contracts,
  }));
}

void main();
