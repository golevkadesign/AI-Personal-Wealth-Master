export type AgentThinkingStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'error'
  | 'skipped';

export type AgentThinkingKind =
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

export interface AgentThinkingStep {
  id: string;
  kind: AgentThinkingKind;
  label: string;
  labelKey?: string;
  role?: string;
  roleKey?: string;
  status: AgentThinkingStatus;
  messages: string[];
  startedAt?: number;
  completedAt?: number;
}

export interface AgentThinkingTraceMeta {
  rawLength: number;
  stepCount: number;
  completedCount: number;
  runningCount: number;
  hasError: boolean;
  parserVersion: string;
  parsedAt: number;
  isFallback: boolean;
}

export interface AgentThinkingTraceViewModel {
  rawText: string;
  headline: string;
  headlineKey?: string;
  currentLabel: string;
  currentLabelKey?: string;
  status: AgentThinkingStatus;
  steps: AgentThinkingStep[];
  meta: AgentThinkingTraceMeta;
}
