import React, { useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Zap, 
  ChevronDown, 
  Copy, 
  FileText, 
  Sparkles,
  Check,
  Bot,
  Activity,
  Layers
} from 'lucide-react';
import { buildAssistantResponseViewModel } from '../../lib/chat-response-parser';
import { AssistantResponseBlock } from '../../lib/chat-response-types';

export interface AssistantResponseRendererProps {
  content: string;
  markdownComponents?: any;
  metadata?: {
    timeTaken?: number;
    hasMemoryUpdate?: boolean;
    liveSources?: string[];
  };
  isStreaming?: boolean;
  isInteractionDisabled?: boolean;
  onQuickPrompt?: (prompt: string) => void;
}

// 默认的高清 Markdown 渲染配置
const DefaultP = React.memo(({ children }: any) => (
  <p className="mb-3 text-[13px] text-[#A0A5AF] leading-relaxed font-sans">{children}</p>
));
DefaultP.displayName = 'DefaultP';

const DefaultLi = React.memo(({ children }: any) => (
  <li className="mb-1 text-[13px] text-[#A0A5AF] list-disc ml-5 leading-relaxed font-sans">{children}</li>
));
DefaultLi.displayName = 'DefaultLi';

const DefaultStrong = React.memo(({ children }: any) => (
  <strong className="font-semibold text-[#E7D7B0] font-sans">{children}</strong>
));
DefaultStrong.displayName = 'DefaultStrong';

const DefaultPre = React.memo(({ children }: any) => (
  <pre className="my-3 p-4 rounded-xl bg-[#0B0D10] text-[#E7D7B0] text-[12px] font-mono border border-[#1C2026] overflow-x-auto selection:bg-[#C9B284]/20">
    {children}
  </pre>
));
DefaultPre.displayName = 'DefaultPre';

const DefaultCode = React.memo(({ inline, children, ...props }: any) => {
  if (inline) {
    return (
      <code className="bg-[#12151A] text-[#C9B284] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[#1C2026] mx-0.5 font-medium" {...props}>
        {children}
      </code>
    );
  }
  return <code className="text-[#E7D7B0] text-[12px] font-mono" {...props}>{children}</code>;
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
          <div key={idx} className="rounded-xl border border-[#C9B284]/20 bg-[#12151A]/80 p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 text-[14px] text-[#C9B284]/15 font-mono select-none pointer-events-none uppercase tracking-widest font-bold">
              SUMMARY
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[#C9B284]" />
              <h4 className="text-[13px] font-semibold text-[#E7D7B0] tracking-wide">{block.title || '核心判断'}</h4>
            </div>
            <div className="space-y-2">
              {block.items.slice(0, 2).map((item, itemIdx) => (
                <div key={itemIdx} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-[#D0D4DC]">
                  <span className="text-[#C9B284] select-none font-semibold mt-0.5">▪</span>
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
              <div className="text-[12px] font-serif text-[#C9B284] font-medium tracking-wider uppercase mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9B284]"></span>
                {block.title}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
              {block.cards.slice(0, 3).map((card) => {
                const toneConfig = {
                  risk: {
                    border: 'border-rose-500/20',
                    bg: 'bg-rose-500/5',
                    text: 'text-rose-400',
                    labelColor: 'text-[#E7D7B0]',
                    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  },
                  opportunity: {
                    border: 'border-emerald-500/20',
                    bg: 'bg-emerald-500/5',
                    text: 'text-emerald-400',
                    labelColor: 'text-[#E7D7B0]',
                    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  },
                  action: {
                    border: 'border-[#C9B284]/25',
                    bg: 'bg-[#C9B284]/5',
                    text: 'text-[#C9B284]',
                    labelColor: 'text-[#E7D7B0]',
                    badge: 'bg-[#C9B284]/10 text-[#C9B284] border-[#C9B284]/20'
                  },
                  neutral: {
                    border: 'border-[#1C2026]',
                    bg: 'bg-[#12151A]/60',
                    text: 'text-neutral-400',
                    labelColor: 'text-neutral-300',
                    badge: 'bg-[#1C2026] text-neutral-400 border-neutral-700/10'
                  }
                }[card.tone || 'neutral'];

                return (
                  <div 
                    key={card.id} 
                    className={`flex flex-col p-4 rounded-xl border ${toneConfig.border} ${toneConfig.bg} relative transition-all duration-200 hover:scale-[1.01]`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[12px] font-semibold text-[#E7D7B0]">
                        {card.title}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-widest font-mono font-bold ${toneConfig.badge}`}>
                        {card.tone}
                      </span>
                    </div>
                    
                    <div className="text-[12px] text-neutral-300 leading-relaxed font-sans mb-2 flex-grow">
                      {card.body}
                    </div>

                    {card.evidence && (
                      <div className="mt-2 pt-2 border-t border-[#1C2026] text-[10px] font-mono text-[#8C8370] leading-normal truncate" title={card.evidence}>
                        Evidence: {card.evidence}
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
              <div className="text-[12px] font-serif text-[#C9B284] font-medium tracking-wider uppercase mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9B284]"></span>
                {block.title}
              </div>
            )}
            <div className="overflow-auto max-h-[260px] custom-scroll rounded-xl border border-[#1C2026] bg-[#0E1114]">
              <table className="w-full text-left border-collapse text-[11.5px] font-mono whitespace-nowrap">
                <thead>
                  <tr className="bg-[#12151A] border-b border-[#1C2026] text-[#8C8370]">
                    {block.headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-3.5 py-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C2026]">
                  {block.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[#12151A]/60 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-2 text-neutral-300">
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
              <div className="text-[12px] font-serif text-[#C9B284] font-medium tracking-wider uppercase mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9B284]"></span>
                {block.title}
              </div>
            )}
            <div className="space-y-1.5 bg-[#12151A]/40 rounded-xl border border-[#1C2026]/80 p-3.5">
              {bulletsToShow.map((bullet, bIdx) => (
                <div key={bIdx} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-neutral-300">
                  <span className="font-mono text-[#C9B284] select-none font-semibold mt-0.5 text-[11px]">[{bIdx + 1}]</span>
                  <div className="font-sans flex-1">{bullet}</div>
                </div>
              ))}
              {hasMoreBullets && (
                <div className="mt-2 pt-1 border-t border-[#1C2026]/30 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setExpandedBullets(prev => ({ ...prev, [idx]: !prev[idx] }))}
                    className="text-[11px] font-mono text-[#C9B284] hover:text-[#E7D7B0] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isBulletsExpanded ? '收起局部内容' : `展开全部 ${block.items.length} 条`}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isBulletsExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'chips':
        return (
          <div key={idx} className="space-y-1.5 bg-[#12151A]/40 p-3 rounded-xl border border-[#1C2026] flex flex-col gap-1">
            {block.title && (
              <div className="text-[10px] font-mono text-[#8C8370] uppercase tracking-wider">{block.title}:</div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {block.chips.map((chip, cIdx) => (
                <span 
                  key={cIdx} 
                  className="text-[11px] font-mono text-[#E7D7B0] bg-[#12151A]/90 border border-[#1C2026] rounded-full px-2.5 py-0.5 inline-flex items-center gap-1"
                >
                  <span className="w-1 h-1 rounded-full bg-[#C9B284]" />
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
          <div key={idx} className="space-y-2 border-t border-[#1C2026] pt-3">
            {block.title && (
              <div className="text-[10px] font-mono text-[#8C8370] uppercase tracking-widest font-semibold flex items-center gap-1.5">
                <span className="flex-1 border-t border-[#1C2026]"></span>
                {block.title}
                <span className="flex-1 border-t border-[#1C2026]"></span>
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
                    className={`text-left w-full text-[12px] rounded-xl px-4 py-2 transition-all duration-200 flex items-center justify-between gap-3 group border ${
                      isDisabled
                        ? 'bg-[#12151A]/40 text-neutral-500 border-[#1C2026] cursor-not-allowed opacity-50'
                        : 'bg-[#12151A] hover:bg-[#1C2026] text-neutral-300 hover:text-white border-[#1C2026] hover:border-[#C9B284]/20 cursor-pointer'
                    }`}
                  >
                    <span className="font-sans font-medium line-clamp-1">{safePrompt}</span>
                    {isCurrentSubmitted ? (
                      <span className="flex items-center gap-1 text-[11px] font-mono text-[#C9B284] shrink-0">
                        <Check className="w-3.5 h-3.5 text-[#C9B284]" />
                        <span>已发送</span>
                      </span>
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 rotate-270 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[#C9B284] shrink-0" />
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
          <div key={idx} className="rounded-xl border border-[#1C2026] bg-[#0E1114] overflow-hidden">
            <button
              onClick={() => toggleAccordion(idx)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-serif text-[#E7D7B0] bg-[#12151A]/60 font-medium tracking-wide hover:bg-[#12151A] transition-colors"
            >
              <span>{block.title || '展开额外明细'}</span>
              <ChevronDown className={`w-4 h-4 text-[#8C8370] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-[#1C2026]"
                >
                  <div className="p-4 text-[12.5px] leading-relaxed">
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
          <div key={idx} className="text-[13px] leading-relaxed text-neutral-300">
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
      <div className="w-full text-left font-sans select-text">
        {renderMarkdown(content)}
      </div>
    );
  }

  return (
    <div className="w-full text-left font-sans flex flex-col space-y-4 select-text">
      {/* Container header / Terminal Meta Header info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1C2026] pb-3 text-[11px] font-mono tracking-tight text-[#8C8370]">
        <div className="flex items-center gap-1.5">
          <Bot className="w-4 h-4 text-[#C9B284]" />
          <span className="font-serif text-[#E7D7B0] font-medium tracking-wide">ARBITRA ANALYSIS</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5">
          {metadata?.timeTaken && (
            <span className="bg-[#12151A] px-2 py-0.5 rounded border border-[#1C2026] flex items-center gap-1 text-[#8C8370]" title={`Took ${metadata.timeTaken}ms`}>
              <Activity className="w-3 h-3 text-[#C9B284]" />
              {(metadata.timeTaken / 1000).toFixed(1)}s
            </span>
          )}
          {viewModel.meta.confidence && (
            <span className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
              viewModel.meta.confidence === 'high' 
                ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' 
                : 'bg-amber-500/5 text-amber-400 border-amber-500/15'
            }`}>
              Parsed: {viewModel.meta.confidence}
            </span>
          )}
          {viewModel.meta.estimatedReadMinutes && (
            <span className="bg-[#12151A] px-2 py-0.5 rounded border border-[#1C2026] flex items-center gap-1 text-[#8C8370]">
              <Clock className="w-3 h-3" />
              约 {viewModel.meta.estimatedReadMinutes} 分钟
            </span>
          )}
          {metadata?.liveSources?.includes('longbridge') && (
            <span className="bg-emerald-500/5 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
              ● 实盘行情源已激活
            </span>
          )}
          {metadata?.hasMemoryUpdate && (
            <span className="bg-[#12151A] border border-[#1C2026] px-2 py-0.5 rounded text-[#C9B284] flex items-center gap-1">
              <Layers className="w-3 h-3" />
              记忆快照刷新
            </span>
          )}
        </div>
      </div>

      {/* Main Struct blocks mapper (Primary Blocks) */}
      <div className="space-y-4">
        {primaryBlocks.map((block, idx) => renderBlock(block, idx))}

        {/* Collapsible Secondary Blocks */}
        {secondaryBlocks.length > 0 && (
          <div className="rounded-xl border border-[#1C2026] bg-[#0E1114] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsSecondaryExpanded(!isSecondaryExpanded)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-serif text-[#E7D7B0] bg-[#12151A]/60 font-medium tracking-wide hover:bg-[#12151A] transition-colors cursor-pointer"
            >
              <span>更多分析细节</span>
              <ChevronDown className={`w-4 h-4 text-[#8C8370] transition-transform duration-200 ${isSecondaryExpanded ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {isSecondaryExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-[#1C2026]"
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
      <div className="border-t border-[#1C2026] pt-3 mt-1 text-left">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsRawExpanded(!isRawExpanded)}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#8C8370] hover:text-[#C9B284] transition-colors cursor-pointer"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isRawExpanded ? 'rotate-180' : ''}`} />
            <span>{isRawExpanded ? '收起完整原文' : '查看完整原文 / Raw'}</span>
          </button>

          <button
            onClick={handleCopyRaw}
            className="inline-flex items-center gap-1 text-[11px] font-mono text-[#8C8370] hover:text-[#C9B284] transition-colors cursor-pointer"
            title="复制 AI 分析原文"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {isRawExpanded && (
          <div className="mt-1 text-[10px] font-mono text-[#8C8370]/70 pl-5">
            包装层不会改写原始回答，可在此查看完整内容。
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
              <div className="bg-[#0B0D10]/80 p-4 rounded-xl border border-[#1C2026] text-[12.5px] leading-relaxed text-neutral-300 max-h-[350px] overflow-y-auto custom-scroll selection:bg-[#C9B284]/20">
                {renderMarkdown(viewModel.rawText || content)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
