export type SharedAgentKind =
  | 'rag'
  | 'hydrator'
  | 'general'
  | 'hnw'
  | 'debt'
  | 'market'
  | 'devil'
  | 'orchestrator'
  | 'memory'
  | 'external'
  | 'unknown';

export type SharedAgentType =
  | 'rag'
  | 'middleware'
  | 'llm'
  | 'system'
  | 'external'
  | 'unknown';

export interface SharedAgentDefinition {
  id: SharedAgentKind;
  kind: SharedAgentKind;
  name: string;
  label: string;
  role: string;
  type: SharedAgentType;
  color: string;
  visual: {
    bg: string;
    dot: string;
    color: string;
  };
  keywords: string[];
}

export const SHARED_AGENT_DEFINITIONS: SharedAgentDefinition[] = [
  {
    id: 'rag',
    kind: 'rag',
    name: 'RAG Memory Agent',
    label: 'RAG Memory Agent',
    role: 'Context Retrieval',
    type: 'rag',
    color: 'aw-state-chip-success',
    visual: {
      bg: 'aw-state-chip-success',
      dot: 'aw-status-success',
      color: 'text-aw-success'
    },
    keywords: ['rag', 'memory agent', '长期记忆', '记忆检索', 'user profile', 'profile']
  },
  {
    id: 'hydrator',
    kind: 'hydrator',
    name: 'Context Hydrator',
    label: 'Context Hydrator',
    role: 'Deterministic Layer',
    type: 'middleware',
    color: 'aw-state-chip',
    visual: {
      bg: 'aw-state-chip',
      dot: '',
      color: 'aw-text-secondary'
    },
    keywords: ['hydrator', 'context hydrator', '上下文', 'context', 'deterministic', 'payload']
  },
  {
    id: 'general',
    kind: 'general',
    name: 'General Finance',
    label: 'General Finance',
    role: 'Standard Planning',
    type: 'llm',
    color: 'aw-state-chip-info',
    visual: {
      bg: 'aw-state-chip-info',
      dot: 'aw-status-info',
      color: 'text-aw-info'
    },
    keywords: ['general finance', 'general', '标准规划', 'finance']
  },
  {
    id: 'hnw',
    kind: 'hnw',
    name: 'HNW Manager',
    label: 'HNW Manager',
    role: 'Wealth Structuring',
    type: 'llm',
    color: 'aw-state-chip',
    visual: {
      bg: 'aw-state-chip',
      dot: 'aw-status-info',
      color: 'text-aw-accent-mist'
    },
    keywords: ['hnw', '高净值', 'wealth structuring', 'wealth manager']
  },
  {
    id: 'debt',
    kind: 'debt',
    name: 'Debt Crisis',
    label: 'Debt Crisis',
    role: 'Leverage & Risk',
    type: 'llm',
    color: 'aw-state-chip-danger',
    visual: {
      bg: 'aw-state-chip-danger',
      dot: 'aw-status-danger',
      color: 'text-aw-danger'
    },
    keywords: ['debt', '债务', '杠杆', 'leverage', 'risk']
  },
  {
    id: 'market',
    kind: 'market',
    name: 'Market Quant',
    label: 'Market Quant',
    role: 'Macro Strategy',
    type: 'llm',
    color: 'aw-state-chip-info',
    visual: {
      bg: 'aw-state-chip-info',
      dot: 'aw-status-info',
      color: 'text-aw-info'
    },
    keywords: ['market context', 'stooq', 'quant', '宏观', 'market', '市场']
  },
  {
    id: 'devil',
    kind: 'devil',
    name: "Devil's Advocate",
    label: "Devil's Advocate",
    role: 'Stress Testing',
    type: 'llm',
    color: 'aw-state-chip-danger',
    visual: {
      bg: 'aw-state-chip-danger',
      dot: 'aw-status-danger',
      color: 'text-aw-danger'
    },
    keywords: ['devil', '反方', 'stress', '压力测试', '反证']
  },
  {
    id: 'orchestrator',
    kind: 'orchestrator',
    name: 'CEO / Synthesizer',
    label: 'CEO / Synthesizer',
    role: 'Final Aggregation',
    type: 'llm',
    color: 'aw-state-chip',
    visual: {
      bg: 'aw-state-chip',
      dot: 'aw-status-success',
      color: 'text-aw-accent-mist'
    },
    keywords: ['ceo', 'synthesizer', 'orchestrator', 'synthesis', 'synthesize', '综合', '最终结论', '各节点数据已回流', '汇总']
  },
  {
    id: 'memory',
    kind: 'memory',
    name: 'Memory Sync',
    label: 'Memory Sync',
    role: 'Profile Update',
    type: 'system',
    color: 'aw-state-chip-warning',
    visual: {
      bg: 'aw-state-chip-warning',
      dot: 'aw-status-warning',
      color: 'text-aw-warning'
    },
    keywords: ['记忆更新', 'profile update', 'updatedprofile', 'memory update']
  },
  {
    id: 'external',
    kind: 'external',
    name: 'External Data',
    label: 'External Data',
    role: 'Live Data / Market Context',
    type: 'external',
    color: 'aw-state-chip-info',
    visual: {
      bg: 'aw-state-chip-info',
      dot: 'aw-status-info',
      color: 'text-aw-info'
    },
    keywords: ['外部数据', 'live portfolio', 'live data', 'longbridge', '行情', '券商']
  },
  {
    id: 'unknown',
    kind: 'unknown',
    name: 'Unknown Agent',
    label: 'Unknown Agent',
    role: 'Internal Node',
    type: 'unknown',
    color: 'aw-state-chip',
    visual: {
      bg: 'aw-state-chip',
      dot: '',
      color: 'aw-text-tertiary'
    },
    keywords: []
  }
];

export const DEVELOPER_PIPELINE_AGENT_IDS: SharedAgentKind[] = [
  'rag',
  'hydrator',
  'general',
  'hnw',
  'debt',
  'market',
  'devil',
  'orchestrator'
];

export function getSharedAgentDefinition(kind: SharedAgentKind | string): SharedAgentDefinition {
  return SHARED_AGENT_DEFINITIONS.find(a => a.kind === kind) || SHARED_AGENT_DEFINITIONS.find(a => a.kind === 'unknown')!;
}

export function detectSharedAgentKind(line: string): SharedAgentKind {
  const safeLine = typeof line === 'string' ? line.toLowerCase() : '';
  
  const matches = (kind: SharedAgentKind) => {
    const def = getSharedAgentDefinition(kind);
    return def.keywords.some(kw => safeLine.includes(kw));
  };

  // 1. memory
  if (matches('memory')) return 'memory';
  // 2. external
  if (matches('external')) return 'external';
  // 3. orchestrator
  if (matches('orchestrator')) return 'orchestrator';
  // 4. devil
  if (matches('devil')) return 'devil';
  // 5. market
  if (matches('market')) return 'market';
  // 6. debt
  if (matches('debt')) return 'debt';
  // 7. hnw
  if (matches('hnw')) return 'hnw';
  // 8. general
  if (matches('general')) return 'general';
  // 9. hydrator
  if (matches('hydrator')) return 'hydrator';
  // 10. rag
  if (matches('rag')) return 'rag';
  
  return 'unknown';
}
