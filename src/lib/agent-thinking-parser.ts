import {
  AgentThinkingTraceViewModel,
  AgentThinkingStep,
  AgentThinkingStatus,
  AgentThinkingKind
} from './agent-thinking-types';

const AGENT_DEFINITIONS = [
  { kind: 'rag', label: 'RAG Memory Agent', role: 'Context Retrieval' },
  { kind: 'hydrator', label: 'Context Hydrator', role: 'Deterministic Layer' },
  { kind: 'general', label: 'General Finance', role: 'Standard Planning' },
  { kind: 'hnw', label: 'HNW Manager', role: 'Wealth Structuring' },
  { kind: 'debt', label: 'Debt Crisis', role: 'Leverage & Risk' },
  { kind: 'market', label: 'Market Quant', role: 'Macro Strategy' },
  { kind: 'devil', label: 'Devil’s Advocate', role: 'Stress Testing' },
  { kind: 'orchestrator', label: 'CEO / Synthesizer', role: 'Final Aggregation' },
  { kind: 'memory', label: 'Memory Sync', role: 'Profile Update' },
  { kind: 'external', label: 'External Data', role: 'Live Data / Market Context' }
];

function detectKind(line: string): AgentThinkingKind {
  const lower = line.toLowerCase();
  
  if (
    lower.includes('rag') || 
    lower.includes('memory agent') || 
    lower.includes('长期记忆') || 
    lower.includes('记忆检索') || 
    lower.includes('user profile') ||
    (lower.includes('profile') && !lower.includes('update'))
  ) {
    return 'rag';
  }
  if (
    lower.includes('hydrator') || 
    lower.includes('context hydrator') || 
    lower.includes('上下文') || 
    lower.includes('context') || 
    lower.includes('deterministic') || 
    lower.includes('payload')
  ) {
    return 'hydrator';
  }
  if (
    lower.includes('general finance') || 
    lower.includes('general') || 
    lower.includes('标准规划') || 
    lower.includes('finance')
  ) {
    return 'general';
  }
  if (
    lower.includes('hnw') || 
    lower.includes('高净值') || 
    lower.includes('wealth structuring') || 
    lower.includes('wealth manager')
  ) {
    return 'hnw';
  }
  if (
    lower.includes('debt') || 
    lower.includes('债务') || 
    lower.includes('杠杆') || 
    lower.includes('leverage') || 
    lower.includes('risk')
  ) {
    return 'debt';
  }
  if (
    lower.includes('market context') || 
    lower.includes('stooq') || 
    lower.includes('quant') || 
    lower.includes('宏观') || 
    (lower.includes('market') && !lower.includes('live')) || 
    (lower.includes('市场') && !lower.includes('券商') && !lower.includes('行情'))
  ) {
    return 'market';
  }
  if (
    lower.includes('devil') || 
    lower.includes('反方') || 
    lower.includes('stress') || 
    lower.includes('压力测试') || 
    lower.includes('反证')
  ) {
    return 'devil';
  }
  if (
    lower.includes('ceo') || 
    lower.includes('synthesizer') || 
    lower.includes('orchestrator') || 
    lower.includes('synthesis') || 
    lower.includes('synthesize') || 
    lower.includes('综合') || 
    lower.includes('最终结论') || 
    lower.includes('各节点数据已回流') ||
    lower.includes('汇总')
  ) {
    return 'orchestrator';
  }
  if (
    lower.includes('记忆更新') || 
    lower.includes('profile update') || 
    lower.includes('updatedprofile') || 
    lower.includes('memory update')
  ) {
    return 'memory';
  }
  if (
    lower.includes('外部数据') || 
    lower.includes('live portfolio') || 
    lower.includes('live data') || 
    lower.includes('longbridge') || 
    lower.includes('行情') || 
    lower.includes('券商')
  ) {
    return 'external';
  }

  return 'unknown';
}

/**
 * 将原始的 Thinking Trace 字符串完美解析为结构化 Agent 进度流 ViewModel。
 * 不丢弃任何非空原文内容，无法匹配的均兜底划分至 'unknown' 步骤，并适配实时流式输出及多重异常感知。
 */
export function buildAgentThinkingTrace(rawThinking: string, options?: {
  isStreaming?: boolean;
  startedAt?: number;
}): AgentThinkingTraceViewModel {
  const safeRawText = typeof rawThinking === 'string'
    ? rawThinking
    : (rawThinking ? String(rawThinking) : '');

  if (!safeRawText.trim()) {
    const isStreaming = Boolean(options?.isStreaming);
    return {
      rawText: '',
      headline: '等待推演信号',
      currentLabel: '等待 Agent 进度',
      status: isStreaming ? 'running' : 'pending',
      steps: [],
      meta: {
        rawLength: 0,
        stepCount: 0,
        completedCount: 0,
        runningCount: 0,
        hasError: false,
        parserVersion: '1.0.0',
        parsedAt: Date.now(),
        isFallback: true
      }
    };
  }

  const lines = safeRawText.split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const steps: AgentThinkingStep[] = [];
  let hasError = false;

  for (const line of lines) {
    const kind = detectKind(line);
    let step = steps.find(s => s.kind === kind);
    if (!step) {
      const def = AGENT_DEFINITIONS.find(d => d.kind === kind);
      step = {
        id: kind,
        kind,
        label: def?.label || (kind === 'unknown' ? '其他推演过程' : kind),
        role: def?.role || (kind === 'unknown' ? '系统日志' : 'Internal Node'),
        status: 'pending',
        messages: []
      };
      steps.push(step);
    }
    step.messages.push(line);

    // 检查是否有错误
    const lowerLine = line.toLowerCase();
    const containsError = ['error', 'failed', '异常', '失败', 'timeout'].some(kw => lowerLine.includes(kw));
    if (containsError) {
      step.status = 'error';
      hasError = true;
    }
  }

  const isStreaming = Boolean(options?.isStreaming);

  // 状态校准与计数
  let completedCount = 0;
  let runningCount = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.status === 'error') {
      hasError = true;
      continue;
    }

    if (isStreaming) {
      if (i === steps.length - 1) {
        step.status = 'running';
        runningCount++;
      } else {
        step.status = 'complete';
        completedCount++;
      }
    } else {
      step.status = 'complete';
      completedCount++;
    }
  }

  // 确定全局 status
  let globalStatus: AgentThinkingStatus = 'complete';
  if (hasError) {
    globalStatus = 'error';
  } else if (isStreaming) {
    globalStatus = 'running';
  }

  // headline / currentLabel 的规则设计
  let headline = '推演完成';
  let currentLabel = `${completedCount} 个节点已完成`;

  if (globalStatus === 'error') {
    headline = '推演异常';
    // 找出第一条包含错误的 message
    let firstErrorMsg = '';
    for (const s of steps) {
      if (s.status === 'error') {
        const errLine = s.messages.find(m => {
          const ml = m.toLowerCase();
          ml;
          return ['error', 'failed', '异常', '失败', 'timeout'].some(kw => ml.includes(kw));
        });
        if (errLine) {
          firstErrorMsg = errLine;
          break;
        }
      }
    }
    currentLabel = firstErrorMsg || 'Agent 流程出现异常';
  } else if (isStreaming) {
    headline = '正在推演';
    const runningStep = steps[steps.length - 1];
    const lastMsg = runningStep?.messages[runningStep.messages.length - 1] || runningStep?.label || '';
    currentLabel = lastMsg.length > 42 ? lastMsg.slice(0, 42) + '…' : lastMsg;
  }

  return {
    rawText: safeRawText,
    headline,
    currentLabel,
    status: globalStatus,
    steps,
    meta: {
      rawLength: safeRawText.length,
      stepCount: steps.length,
      completedCount,
      runningCount,
      hasError,
      parserVersion: '1.0.0',
      parsedAt: Date.now(),
      isFallback: false
    }
  };
}
