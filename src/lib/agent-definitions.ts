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
    color: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400',
    visual: {
      bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]',
      color: 'text-emerald-400'
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
    color: 'border-slate-500/25 bg-slate-500/5 text-slate-400',
    visual: {
      bg: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
      dot: 'bg-slate-400',
      color: 'text-slate-300'
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
    color: 'border-blue-500/25 bg-blue-500/5 text-blue-400',
    visual: {
      bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
      dot: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]',
      color: 'text-blue-400'
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
    color: 'border-purple-500/25 bg-purple-500/5 text-purple-400',
    visual: {
      bg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
      dot: 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.5)]',
      color: 'text-purple-400'
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
    color: 'border-rose-500/25 bg-rose-500/5 text-rose-400',
    visual: {
      bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      dot: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]',
      color: 'text-rose-400'
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
    color: 'border-cyan-500/25 bg-cyan-500/5 text-cyan-400',
    visual: {
      bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
      dot: 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]',
      color: 'text-cyan-400'
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
    color: 'border-red-600/30 bg-red-600/10 text-red-500',
    visual: {
      bg: 'bg-rose-500/10 border-rose-500/20 text-[#EF4444]',
      dot: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]',
      color: 'text-[#EF4444]'
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
    color: 'border-[#C9B284]/30 bg-[#C9B284]/10 text-[#E7D7B0]',
    visual: {
      bg: 'bg-[#C9B284]/10 border-[#C9B284]/20 text-[#E7D7B0]',
      dot: 'bg-[#C9B284] shadow-[0_0_6px_rgba(201,178,132,0.5)]',
      color: 'text-[#E7D7B0]'
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
    color: 'border-amber-500/25 bg-amber-500/5 text-amber-400',
    visual: {
      bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      dot: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]',
      color: 'text-amber-400'
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
    color: 'border-teal-500/25 bg-teal-500/5 text-teal-400',
    visual: {
      bg: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
      dot: 'bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.5)]',
      color: 'text-teal-400'
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
    color: 'border-zinc-500/25 bg-zinc-500/5 text-zinc-400',
    visual: {
      bg: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400',
      dot: 'bg-zinc-500',
      color: 'text-[#8C8370]'
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
  
  // 1. memory
  if (SHARED_AGENT_DEFINITIONS[8].keywords.some(kw => safeLine.includes(kw))) {
    return 'memory';
  }
  // 2. external
  if (SHARED_AGENT_DEFINITIONS[9].keywords.some(kw => safeLine.includes(kw))) {
    return 'external';
  }
  // 3. orchestrator
  if (SHARED_AGENT_DEFINITIONS[7].keywords.some(kw => safeLine.includes(kw))) {
    return 'orchestrator';
  }
  // 4. devil
  if (SHARED_AGENT_DEFINITIONS[6].keywords.some(kw => safeLine.includes(kw))) {
    return 'devil';
  }
  // 5. market
  if (SHARED_AGENT_DEFINITIONS[5].keywords.some(kw => safeLine.includes(kw))) {
    return 'market';
  }
  // 6. debt
  if (SHARED_AGENT_DEFINITIONS[4].keywords.some(kw => safeLine.includes(kw))) {
    return 'debt';
  }
  // 7. hnw
  if (SHARED_AGENT_DEFINITIONS[3].keywords.some(kw => safeLine.includes(kw))) {
    return 'hnw';
  }
  // 8. general
  if (SHARED_AGENT_DEFINITIONS[2].keywords.some(kw => safeLine.includes(kw))) {
    return 'general';
  }
  // 9. hydrator
  if (SHARED_AGENT_DEFINITIONS[1].keywords.some(kw => safeLine.includes(kw))) {
    return 'hydrator';
  }
  // 10. rag
  if (SHARED_AGENT_DEFINITIONS[0].keywords.some(kw => safeLine.includes(kw))) {
    return 'rag';
  }
  
  return 'unknown';
}
