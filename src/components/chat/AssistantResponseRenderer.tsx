/**
 * @file AssistantResponseRenderer.tsx
 * @description
 * 这是一个展示层包装适配器 (Presentation Adapter)。
 * 1. msg.content 是输入数据的核心唯一事实源。
 * 2. 这里的 viewModel 解析结果由 parser 即时编译呈现，绝不进行持久化 / 写入 chatHistory / store / Firestore / localStorage。
 * 3. 完整原文查看与复制能力永远保留，确保渲染层不丢失、不篡改任何 AI 原始输出。
 * 4. 出错或非结构化消息时，会自动安全降级为普通高清 Markdown fallback 渲染。
 */

import React, { useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { MaterialIcon } from '@/src/components/ui/MaterialIcon';
import { buildAssistantResponseViewModel } from '../../lib/chat-response-parser';
import { AssistantResponseBlock } from '../../lib/chat-response-types';
import { useTranslation } from '../../hooks/useTranslation';
import { getWorkbenchResponseWidgets } from '../../lib/workbench-widget-registry';
import type { WorkbenchSessionSpec } from '../../types/workbench';
import { WorkbenchWidgetRenderer } from '../WorkbenchWidgetRenderer';

export interface AssistantResponseRendererProps {
  content: string;
  markdownComponents?: any;
  metadata?: {
    timeTaken?: number;
    hasMemoryUpdate?: boolean;
    liveSources?: string[];
    workbenchSession?: WorkbenchSessionSpec;
  };
  isStreaming?: boolean;
  isInteractionDisabled?: boolean;
  onQuickPrompt?: (prompt: string) => void;
}

// 默认的高清 Markdown 渲染配置
const DefaultP = React.memo(({ children }: any) => (
  <p className="mb-3 aw-body aw-text-secondary leading-relaxed font-sans">{children}</p>
));
DefaultP.displayName = 'DefaultP';

const DefaultLi = React.memo(({ children }: any) => (
  <li className="mb-1 aw-body aw-text-secondary list-disc ml-5 leading-relaxed font-sans">{children}</li>
));
DefaultLi.displayName = 'DefaultLi';

const DefaultStrong = React.memo(({ children }: any) => (
  <strong className="font-semibold aw-text-primary font-sans">{children}</strong>
));
DefaultStrong.displayName = 'DefaultStrong';

const DefaultPre = React.memo(({ children }: any) => (
  <pre className="aw-panel-muted my-3 p-4 aw-body aw-text-primary font-mono overflow-x-auto">
    {children}
  </pre>
));
DefaultPre.displayName = 'DefaultPre';

const DefaultCode = React.memo(({ inline, children, ...props }: any) => {
  if (inline) {
    return (
      <code className="aw-state-chip mx-0.5 font-medium normal-case" {...props}>
        {children}
      </code>
    );
  }
  return <code className="aw-text-primary aw-body font-mono" {...props}>{children}</code>;
});
DefaultCode.displayName = 'DefaultCode';

export const AssistantResponseRenderer: React.FC<AssistantResponseRendererProps> = ({
  content,
  markdownComponents,
  metadata,
  isStreaming = false,
  isInteractionDisabled = false,
  onQuickPrompt,
}) => {
  const { t } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const [isRawExpanded, setIsRawExpanded] = useState(false);
  const [expandedAccordionIndexes, setExpandedAccordionIndexes] = useState<Record<number, boolean>>({});
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);
  const [expandedBullets, setExpandedBullets] = useState<Record<number, boolean>>({});
  const [isSecondaryExpanded, setIsSecondaryExpanded] = useState(false);

  const handleFollowupPrompt = (prompt: string) => {
    const safePrompt = typeof prompt === 'string' ? prompt.trim() : '';
    if (!safePrompt) return;
    if (!onQuickPrompt) return;
    if (isInteractionDisabled || isStreaming) return;
    if (submittedPrompt === safePrompt) return;

    setSubmittedPrompt(safePrompt);
    onQuickPrompt(safePrompt);

    window.setTimeout(() => {
      setSubmittedPrompt(prev => prev === safePrompt ? null : prev);
    }, 1500);
  };

  // 1. 拼合 Markdown 渲染单元
  const finalMarkdownComponents = useMemo(() => {
    return {
      p: DefaultP,
      li: DefaultLi,
      strong: DefaultStrong,
      pre: DefaultPre,
      code: DefaultCode,
      ...(markdownComponents || {}),
    };
  }, [markdownComponents]);

  // 可复用的内部 Markdown 渲染函数
  const renderMarkdown = (text: string) => {
    if (typeof text !== 'string') return null;
    return (
      <div className="markdown-body text-left">
        <Markdown components={finalMarkdownComponents}>{text}</Markdown>
      </div>
    );
  };

  const responseWidgets = useMemo(() => {
    if (isStreaming || !metadata?.workbenchSession) return [];
    return getWorkbenchResponseWidgets(metadata.workbenchSession);
  }, [isStreaming, metadata?.workbenchSession]);

  const renderResponseWidgets = () => {
    if (!metadata?.workbenchSession || responseWidgets.length === 0) return null;
    return (
      <div
        className="mt-4 space-y-2"
        data-aw-response-widgets="true"
        data-aw-response-widget-count={responseWidgets.length}
        data-aw-response-widget-types={responseWidgets.map((widget) => widget.type).join(',')}
      >
        <div className="aw-caption aw-text-tertiary font-mono uppercase flex items-center gap-1.5">
          <MaterialIcon name="widgets" size={16} className="text-aw-accent-mist" />
          <span>{t('workbench.phaseReply')}</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {responseWidgets.map((widget) => (
            <WorkbenchWidgetRenderer
              key={`${widget.railId || 'response'}:${widget.id}`}
              session={metadata.workbenchSession!}
              widget={widget}
            />
          ))}
        </div>
      </div>
    );
  };

  // 2. 核心状态计算：流式传输状态下直接降级 Markdown 避免闪烁
  const viewModel = useMemo(() => {
    if (isStreaming) {
      return null;
    }
    try {
      return buildAssistantResponseViewModel(content);
    } catch (err) {
      console.error('[AssistantResponseRenderer] Build ViewModel error:', err);
      return null;
    }
  }, [content, isStreaming]);

  // 3. 决定是否采用精简/降级渲染策略
  const shouldUseCompactMarkdown = useMemo(() => {
    if (!viewModel) return true;
    if (viewModel.meta.isFallback) return true;
    if (content.length < 360) return true;

    const interactiveBlocks = viewModel.blocks.filter(b => b.type !== 'summary');
    if (interactiveBlocks.length < 2) return true;

    return false;
  }, [viewModel, content]);

  // Split blocks for priority-based layout
  const { primaryBlocks, secondaryBlocks } = useMemo(() => {
    if (!viewModel) return { primaryBlocks: [], secondaryBlocks: [] };

    const primary: AssistantResponseBlock[] = [];
    const secondary: AssistantResponseBlock[] = [];

    const evidenceTypes = ['table', 'bullets', 'chips', 'followupPrompts'];
    let chosenEvidenceBlock: AssistantResponseBlock | null = null;

    for (const type of evidenceTypes) {
      const found = viewModel.blocks.find(b => b.type === type);
      if (found) {
        chosenEvidenceBlock = found;
        break;
      }
    }

    viewModel.blocks.forEach((block) => {
      if (block.type === 'summary' || block.type === 'judgmentCards') {
        primary.push(block);
      } else if (block === chosenEvidenceBlock) {
        primary.push(block);
      } else {
        // markdownFallback types and other non-prioritized blocks go to secondary collapsible
        secondary.push(block);
      }
    });

    return { primaryBlocks: primary, secondaryBlocks: secondary };
  }, [viewModel]);

  // Dev mode diagnostics logger
  if ((import.meta as any).env?.DEV && viewModel && !isStreaming) {
    console.debug('[AssistantResponseRenderer]', {
      mode: shouldUseCompactMarkdown ? 'compact' : 'structured',
      rawLength: viewModel.meta.rawLength,
      blockTypes: viewModel.blocks.map(b => b.type),
      primaryCount: primaryBlocks.length,
      secondaryCount: secondaryBlocks.length,
      confidence: viewModel.meta.confidence,
      hasRawText: Boolean(viewModel.rawText),
    });
  }

  // 4. 复制功能
  const handleCopyRaw = () => {
    const textToCopy = viewModel?.rawText || content || '';
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch((err) => {
        console.error('Copy clip failed:', err);
      });
  };

  // 切换特定的 accordion 展开折叠状态
  const toggleAccordion = (idx: number) => {
    setExpandedAccordionIndexes(prev => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // block 渲染核心组件
  const renderBlock = (block: AssistantResponseBlock, idx: number) => {
    switch (block.type) {
      case 'summary':
        return (
          <div key={idx} className="aw-structured-card p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 aw-caption text-aw-accent-mist/20 font-mono select-none pointer-events-none uppercase font-bold">
              {t('chat.summaryFallbackTitle')}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <MaterialIcon name="auto_awesome" size={16} className="text-aw-accent-mist" />
              <h4 className="aw-body font-semibold aw-text-primary tracking-normal">{block.title || t('chat.summaryFallbackTitle')}</h4>
            </div>
            <div className="space-y-2">
              {block.items.slice(0, 2).map((item, itemIdx) => (
                <div key={itemIdx} className="flex items-start gap-2 aw-body leading-relaxed aw-text-secondary">
                  <span className="text-aw-accent-mist select-none font-semibold mt-0.5">▪</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case 'judgmentCards':
        return (
          <div key={idx} className="space-y-2">
            {block.title && (
              <div className="aw-section-kicker mb-1 flex items-center gap-1.5">
                <span className="aw-status-dot aw-status-success"></span>
                {block.title}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
              {block.cards.slice(0, 3).map((card) => {
                const toneConfig = {
                  risk: {
                    card: 'aw-danger-panel',
                    text: 'text-aw-danger',
                    labelColor: 'aw-text-primary',
                    badge: 'aw-state-chip-danger'
                  },
                  opportunity: {
                    card: 'aw-success-panel',
                    text: 'text-aw-success',
                    labelColor: 'aw-text-primary',
                    badge: 'aw-state-chip-success'
                  },
                  action: {
                    card: 'aw-structured-card',
                    text: 'text-aw-accent-mist',
                    labelColor: 'aw-text-primary',
                    badge: 'aw-state-chip'
                  },
                  neutral: {
                    card: 'aw-structured-card-muted',
                    text: 'aw-text-tertiary',
                    labelColor: 'aw-text-secondary',
                    badge: 'aw-state-chip'
                  }
                }[card.tone || 'neutral'];

                return (
                  <div 
                    key={card.id} 
                    className={`flex flex-col p-4 relative transition-colors ${toneConfig.card}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="aw-body font-semibold aw-text-primary">
                        {card.title}
                      </span>
                      <span className={`aw-state-chip ${toneConfig.badge}`}>
                        {card.tone}
                      </span>
                    </div>
                    
                    <div className="aw-body aw-text-secondary leading-relaxed font-sans mb-2 flex-grow">
                      {card.body}
                    </div>

                    {card.evidence && (
                      <div className="mt-2 pt-2 border-t border-aw-border-subtle aw-caption font-mono aw-text-tertiary leading-normal truncate" title={card.evidence}>
                        {t('chat.evidence')}: {card.evidence}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'table':
        return (
          <div key={idx} className="space-y-1.5">
            {block.title && (
              <div className="aw-section-kicker mb-1 flex items-center gap-1.5">
                <span className="aw-status-dot aw-status-success"></span>
                {block.title}
              </div>
            )}
            <div className="aw-table-shell overflow-auto max-h-[260px] custom-scroll">
              <table className="aw-table text-left font-mono whitespace-nowrap">
                <thead>
                  <tr>
                    {block.headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-3.5 py-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-2 aw-text-secondary">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'bullets': {
        const isBulletsExpanded = !!expandedBullets[idx];
        const bulletsToShow = isBulletsExpanded ? block.items : block.items.slice(0, 3);
        const hasMoreBullets = block.items.length > 3;

        return (
          <div key={idx} className="space-y-2">
            {block.title && (
              <div className="aw-section-kicker mb-1 flex items-center gap-1.5">
                <span className="aw-status-dot aw-status-success"></span>
                {block.title}
              </div>
            )}
            <div className="aw-structured-card-muted space-y-1.5 p-3.5">
              {bulletsToShow.map((bullet, bIdx) => (
                <div key={bIdx} className="flex items-start gap-2.5 aw-body leading-relaxed aw-text-secondary">
                  <span className="font-mono text-aw-accent-mist select-none font-semibold mt-0.5 aw-caption">[{bIdx + 1}]</span>
                  <div className="font-sans flex-1">{bullet}</div>
                </div>
              ))}
              {hasMoreBullets && (
                <div className="mt-2 pt-1 border-t border-aw-border-subtle flex justify-end">
                  <button
                    type="button"
                    onClick={() => setExpandedBullets(prev => ({ ...prev, [idx]: !prev[idx] }))}
                    className="aw-chat-meta-action cursor-pointer"
                  >
                    <span>{isBulletsExpanded ? t('chat.collapseLocal') : `${t('chat.expandAllPrefix')} ${block.items.length} ${t('chat.expandAllSuffix')}`}</span>
                    <MaterialIcon name="keyboard_arrow_down" size={16} className={`transition-transform duration-200 ${isBulletsExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'chips':
        return (
          <div key={idx} className="aw-structured-card-muted space-y-1.5 p-3 flex flex-col gap-1">
            {block.title && (
              <div className="aw-caption font-mono aw-text-tertiary uppercase">{block.title}:</div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {block.chips.map((chip, cIdx) => (
                <span 
                  key={cIdx} 
                  className="aw-status-pill font-mono"
                >
                  <span className="aw-status-dot aw-status-success" />
                  {chip}
                </span>
              ))}
            </div>
          </div>
        );

      case 'followupPrompts': {
        if (!onQuickPrompt) return null;
        const validPrompts = block.prompts.filter(p => typeof p === 'string' && p.trim().length > 0);
        if (validPrompts.length === 0) return null;
        return (
          <div key={idx} className="space-y-2 pt-3">
            {block.title && (
              <div className="aw-caption font-mono aw-text-tertiary uppercase font-semibold flex items-center gap-1.5">
                {block.title}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              {validPrompts.map((prompt, pIdx) => {
                const safePrompt = prompt.trim();
                const isCurrentSubmitted = submittedPrompt === safePrompt;
                const isDisabled = isInteractionDisabled || isStreaming || !!submittedPrompt;

                return (
                  <button
                    key={pIdx}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleFollowupPrompt(safePrompt)}
                    className={`text-left w-full aw-body rounded-xl px-4 py-2 transition-all duration-200 flex items-center justify-between gap-3 group border ${
                      isDisabled
                        ? 'bg-aw-surface-2 aw-text-tertiary border-aw-border-subtle cursor-not-allowed opacity-50'
                        : 'bg-aw-surface-2 hover:bg-aw-surface-3 aw-text-secondary hover:text-aw-text-primary border-aw-border-subtle hover:border-aw-border-strong cursor-pointer'
                    }`}
                  >
                    <span className="font-sans font-medium line-clamp-1">{safePrompt}</span>
                    {isCurrentSubmitted ? (
                      <span className="flex items-center gap-1 aw-caption font-mono text-aw-accent-mist shrink-0">
                        <MaterialIcon name="check" size={16} className="text-aw-accent-mist" />
                        <span>{t('chat.sent')}</span>
                      </span>
                    ) : (
                      <MaterialIcon name="keyboard_arrow_down" size={16} className="rotate-270 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-aw-accent-mist shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      case 'accordion': {
        const isExpanded = !!expandedAccordionIndexes[idx];
        return (
          <div key={idx} className="aw-structured-card overflow-hidden">
            <button
              onClick={() => toggleAccordion(idx)}
              className="w-full flex items-center justify-between px-4 py-2.5 aw-body aw-text-primary font-medium tracking-normal hover:bg-aw-surface-3 transition-colors"
            >
              <span>{block.title || t('chat.accordionFallbackTitle')}</span>
              <MaterialIcon name="keyboard_arrow_down" size={16} className={`aw-text-tertiary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-aw-border-subtle"
                >
                  <div className="p-4 aw-body leading-relaxed">
                    {renderMarkdown(block.content)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      }

      case 'markdownFallback':
        return (
          <div key={idx} className="aw-body leading-relaxed aw-text-secondary">
            {renderMarkdown(block.content)}
          </div>
        );

      default:
        return null;
    }
  };

  // 如果处于流式模式、编译失败或者是轻量短文本消息，则直接采用传统简洁 Markdown 形式，不抢主视觉
  if (isStreaming || !viewModel || shouldUseCompactMarkdown) {
    return (
      <div className="w-full text-left font-sans select-text space-y-1 group/compact relative">
        {renderMarkdown(content)}
        {renderResponseWidgets()}
        
        {!isStreaming && content.length > 0 && (
          <div className="flex justify-end pt-1 opacity-0 group-hover/compact:opacity-100 transition-opacity duration-150">
            <button
              type="button"
              onClick={handleCopyRaw}
              className="aw-chat-meta-action cursor-pointer"
              title={t('chat.copyOriginal')}
            >
              {isCopied ? (
                <>
                  <MaterialIcon name="check" size={16} className="text-aw-success" />
                  <span className="text-aw-success">{t('chat.copied')}</span>
                </>
              ) : (
                <>
                  <MaterialIcon name="content_copy" size={16} />
                  <span>{t('chat.copy')}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full text-left font-sans flex flex-col space-y-4 select-text">
      {/* Container header / Terminal Meta Header info */}
      <div className="flex flex-wrap items-center justify-between gap-2 aw-caption font-mono aw-text-tertiary">
        <div className="flex items-center gap-1.5">
          <MaterialIcon name="smart_toy" size={16} className="text-aw-accent-mist" />
          <span className="aw-text-primary font-medium tracking-normal">{t('chat.analysisTitle')}</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5">
          {metadata?.timeTaken && (
            <span className="aw-state-chip" title={`${t('chat.took')} ${metadata.timeTaken}ms`}>
              <MaterialIcon name="monitoring" size={16} className="text-aw-accent-mist" />
              {(metadata.timeTaken / 1000).toFixed(1)}s
            </span>
          )}
          {viewModel.meta.confidence && (
            <span className={`aw-state-chip ${
              viewModel.meta.confidence === 'high' 
                ? 'aw-state-chip-success' 
                : 'aw-state-chip-warning'
            }`}>
              {t('chat.parsed')}: {viewModel.meta.confidence}
            </span>
          )}
          {viewModel.meta.estimatedReadMinutes && (
            <span className="aw-state-chip">
              <MaterialIcon name="schedule" size={16} />
              {t('chat.readMinutesPrefix')} {viewModel.meta.estimatedReadMinutes} {t('chat.readMinutesSuffix')}
            </span>
          )}
          {metadata?.liveSources?.includes('longbridge') && (
            <span className="aw-state-chip aw-state-chip-success">
              <span className="aw-status-dot aw-status-success" /> {t('chat.liveSourceActive')}
            </span>
          )}
          {metadata?.hasMemoryUpdate && (
            <span className="aw-state-chip">
              <MaterialIcon name="layers" size={16} />
              {t('chat.memorySnapshotRefreshed')}
            </span>
          )}
        </div>
      </div>

      {/* Main Struct blocks mapper (Primary Blocks) */}
      <div className="space-y-4">
        {primaryBlocks.map((block, idx) => renderBlock(block, idx))}
        {renderResponseWidgets()}

        {/* Collapsible Secondary Blocks */}
        {secondaryBlocks.length > 0 && (
          <div className="aw-structured-card overflow-hidden">
            <button
              type="button"
              onClick={() => setIsSecondaryExpanded(!isSecondaryExpanded)}
              className="w-full flex items-center justify-between px-4 py-2.5 aw-body aw-text-primary font-medium tracking-normal hover:bg-aw-surface-3 transition-colors cursor-pointer"
            >
              <span>{t('chat.moreDetails')}</span>
              <MaterialIcon name="keyboard_arrow_down" size={16} className={`aw-text-tertiary transition-transform duration-200 ${isSecondaryExpanded ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {isSecondaryExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-aw-border-subtle"
                >
                  <div className="p-4 space-y-4">
                    {secondaryBlocks.map((block, sIdx) => renderBlock(block, sIdx + 100))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Persistent Original text display Accordion at footer container */}
      <div className="border-t border-aw-border-subtle pt-3 mt-1 text-left">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsRawExpanded(!isRawExpanded)}
            className="aw-chat-meta-action cursor-pointer"
          >
            <MaterialIcon name="keyboard_arrow_down" size={16} className={`transition-transform duration-200 ${isRawExpanded ? 'rotate-180' : ''}`} />
            <span>{isRawExpanded ? t('chat.collapseFullRaw') : t('chat.viewFullRaw')}</span>
          </button>

          <button
            onClick={handleCopyRaw}
            className="aw-chat-meta-action cursor-pointer"
            title={t('chat.copyAiRaw')}
          >
            {isCopied ? (
              <>
                <MaterialIcon name="check" size={16} className="text-aw-success" />
                <span className="text-aw-success">{t('chat.copied')}</span>
              </>
            ) : (
              <>
                <MaterialIcon name="content_copy" size={16} />
                <span>{t('chat.copy')}</span>
              </>
            )}
          </button>
        </div>

        {isRawExpanded && (
          <div className="mt-1 aw-caption font-mono aw-text-tertiary pl-5">
            {t('chat.rawWrapperDesc')}
          </div>
        )}

        <AnimatePresence>
          {isRawExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-2.5"
            >
              <div className="aw-panel-muted p-4 aw-body leading-relaxed aw-text-secondary max-h-[350px] overflow-y-auto custom-scroll">
                {renderMarkdown(viewModel.rawText || content)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
