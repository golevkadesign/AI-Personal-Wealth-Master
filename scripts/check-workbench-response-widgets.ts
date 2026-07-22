import { createWorkbenchAgentRunResult } from '../src/lib/workbench-agent-result';
import { bridgeChatResultToWorkbenchSession } from '../src/lib/workbench-chat-bridge';
import { runWorkbenchRailOrchestration } from '../src/lib/workbench-rails';
import { getWorkbenchResponseWidgets } from '../src/lib/workbench-widget-registry';
import {
  createHoldingWorkbenchSession,
  createPortfolioIntelligenceWorkbenchSession,
} from '../src/lib/workbench-session';
import type { TerminalState } from '../src/types/terminal';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const terminalState = {
  userPersona: { tags: [], description: '' },
  userProfile: {},
  metrics: {},
  goal: { name: 'Long-term wealth operating system' },
  insights: {
    global: 'Portfolio context is ready for workbench orchestration.',
    private: '',
  },
  lifeStrategiesShort: [],
  lifeStrategiesLong: [],
  distributions: {
    liquidity: [],
    expenses: [],
    privateAssets: [],
    publicHoldings: [
      { id: 'VOO.US', symbol: 'VOO.US', name: 'Vanguard S&P 500 ETF', value: 6779, marketValue: 6779 },
      { id: 'NVDA.US', symbol: 'NVDA.US', name: 'NVIDIA', value: 3996, marketValue: 3996 },
      { id: 'VST.US', symbol: 'VST.US', name: 'Vistra Energy', value: 2826, marketValue: 2826 },
    ],
    fixedAssets: [],
    options: [],
  },
} as unknown as TerminalState;

async function main() {
  const holdingSession = createHoldingWorkbenchSession({
    id: 'VOO.US',
    symbol: 'VOO.US',
    name: 'Vanguard S&P 500 ETF',
    value: 6779,
    marketValue: 6779,
    quantity: 10,
    currentPrice: 677.9,
  } as any, terminalState);
  const holdingRailRun = await runWorkbenchRailOrchestration(holdingSession);
  const holdingReply = bridgeChatResultToWorkbenchSession({
    sessionSpec: holdingSession,
    railRun: holdingRailRun,
    chatResult: {
      expertAnalysis: {
        综合统筹结论: 'VOO.US should remain an anchor while the user checks technical context.',
        持仓智能分析: 'This holding is an equity anchor. Keep the review focused on risk, opportunity, and action.',
        技术量化指标: 'RSI and MACD context should be checked before changing exposure.',
        历史趋势: 'Price trend context should be reviewed against recent support and resistance.',
        调仓倾向建议: 'Only tilt after the broader portfolio gap is visible.',
      },
    },
  });
  const holdingWidgets = getWorkbenchResponseWidgets(holdingReply, 8);
  const holdingTypes = holdingWidgets.map((widget) => widget.type);

  assert(holdingTypes[0] === 'holding_strategy_deductions', 'holding reply should start with holding strategy widget');
  assert(holdingTypes.includes('holding_quant_indicators'), 'holding reply should include quant indicator widget');
  assert(holdingTypes.includes('holding_trend_chart'), 'holding reply should include trend widget');
  assert(
    holdingWidgets.some((widget) => widget.type === 'holding_strategy_deductions' && Array.isArray(widget.props?.sections)),
    'holding strategy widget should carry matched chat sections',
  );

  const portfolioSession = createPortfolioIntelligenceWorkbenchSession({ terminalState });
  const portfolioRailRun = await runWorkbenchRailOrchestration(portfolioSession);
  const portfolioReply = bridgeChatResultToWorkbenchSession({
    sessionSpec: portfolioSession,
    railRun: portfolioRailRun,
    chatResult: {
      expertAnalysis: {
        综合统筹结论: 'Portfolio needs an exposure map, missing-piece review, and projected post-action state.',
        组合智能地图: 'The portfolio map should summarize current industry and exposure distribution.',
        缺失拼图: 'Missing upstream and defensive pieces should be made visible before execution.',
        调仓倾向建议: 'Tilt gradually toward the missing pieces while preserving core exposure.',
        执行后预测版图: 'Projected exposure should show the expected map after suggested actions.',
      },
    },
  });
  const portfolioWidgets = getWorkbenchResponseWidgets(portfolioReply, 8);
  const portfolioTypes = portfolioWidgets.map((widget) => widget.type);

  assert(portfolioTypes.includes('portfolio_map'), 'portfolio reply should include portfolio map widget');
  assert(portfolioTypes.includes('missing_pieces'), 'portfolio reply should include missing pieces widget');
  assert(portfolioTypes.includes('suggested_tilt'), 'portfolio reply should include suggested tilt widget');
  assert(portfolioTypes.includes('projected_exposure'), 'portfolio reply should include projected exposure widget');
  assert(
    portfolioWidgets.some((widget) => widget.type === 'suggested_tilt' && Array.isArray(widget.props?.sections)),
    'portfolio suggested tilt widget should carry matched chat sections',
  );

  const agentResult = createWorkbenchAgentRunResult(portfolioReply, {
    runMode: 'chat_bridged',
    hasChatResult: true,
  });
  assert(agentResult.trace.generatedFrom.includes('chat'), 'agent result trace should include chat source');
  assert(agentResult.widgetManifest.some((widget) => widget.id === 'chat-portfolio-projected-exposure'), 'agent result should expose entry-specific reply widget');

  console.log(JSON.stringify({
    status: 'ok',
    checked: [
      'holding-entry-reply-widgets',
      'portfolio-entry-reply-widgets',
      'chat-section-props-preserved',
      'agent-result-exposes-entry-specific-widgets',
    ],
    holdingTypes,
    portfolioTypes,
    agentWidgetCount: agentResult.widgetManifest.length,
  }));
}

void main();
