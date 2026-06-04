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
  role?: string;
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
  currentLabel: string;
  status: AgentThinkingStatus;
  steps: AgentThinkingStep[];
  meta: AgentThinkingTraceMeta;
}
