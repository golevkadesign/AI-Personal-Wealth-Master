export type AssistantResponseTone =
  | 'neutral'
  | 'risk'
  | 'opportunity'
  | 'action'
  | 'mixed';

export interface AssistantResponseMeta {
  rawLength: number;
  estimatedReadMinutes: number;
  parsedAt: number;
  parserVersion: string;
  isFallback: boolean;
  confidence: 'low' | 'medium' | 'high';
}

export interface AssistantSummaryBlock {
  type: 'summary';
  title: string;
  items: string[];
}

export interface AssistantJudgmentCard {
  id: string;
  tone: 'risk' | 'opportunity' | 'action' | 'neutral';
  title: string;
  body: string;
  evidence?: string;
}

export interface AssistantJudgmentCardsBlock {
  type: 'judgmentCards';
  title: string;
  cards: AssistantJudgmentCard[];
}

export interface AssistantBulletBlock {
  type: 'bullets';
  title: string;
  items: string[];
}

export interface AssistantTableBlock {
  type: 'table';
  title: string;
  headers: string[];
  rows: string[][];
}

export interface AssistantChipBlock {
  type: 'chips';
  title: string;
  chips: string[];
}

export interface AssistantPromptBlock {
  type: 'followupPrompts';
  title: string;
  prompts: string[];
}

export interface AssistantAccordionBlock {
  type: 'accordion';
  title: string;
  content: string;
}

export interface AssistantMarkdownFallbackBlock {
  type: 'markdownFallback';
  title?: string;
  content: string;
}

export type AssistantResponseBlock =
  | AssistantSummaryBlock
  | AssistantJudgmentCardsBlock
  | AssistantBulletBlock
  | AssistantTableBlock
  | AssistantChipBlock
  | AssistantPromptBlock
  | AssistantAccordionBlock
  | AssistantMarkdownFallbackBlock;

export interface AssistantResponseViewModel {
  rawText: string;
  meta: AssistantResponseMeta;
  title: string;
  tone: AssistantResponseTone;
  blocks: AssistantResponseBlock[];
  remainderMarkdown: string;
}
