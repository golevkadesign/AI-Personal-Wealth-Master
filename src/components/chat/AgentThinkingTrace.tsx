import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, 
  Check, 
  Loader2, 
  AlertTriangle, 
  Clock, 
  Copy, 
  ChevronUp, 
  Terminal, 
  Workflow
} from 'lucide-react';
import { buildAgentThinkingTrace } from '../../lib/agent-thinking-parser';
import { AgentThinkingStep, AgentThinkingKind } from '../../lib/agent-thinking-types';

export interface AgentThinkingTraceProps {
  rawThinking?: string;
  isStreaming?: boolean;
  startedAt?: number;
  defaultExpanded?: boolean;
  className?: string;
}

// 计时器 Hook 
function useElapsedTimer(enabled: boolean, startedAt?: number) {
  const [elapsed, setElapsed] = useState(0);

  React.useEffect(() => {
    if (!enabled) {
      setElapsed(0);
      return;
    }
    const base = startedAt || Date.now();
    const tick = () => {
      setElapsed(Date.now() - base);
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [enabled, startedAt]);

  return elapsed;
}

// 获取各 Agent 的视觉主题配置
function getKindVisual(kind: AgentThinkingKind) {
  switch (kind) {
    case 'rag':
      return {
        bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]',
        color: 'text-emerald-400'
      };
    case 'external':
      return {
        bg: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
        dot: 'bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.5)]',
        color: 'text-teal-400'
      };
    case 'hydrator':
      return {
        bg: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
        dot: 'bg-slate-400',
        color: 'text-slate-300'
      };
    case 'market':
      return {
        bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
        dot: 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]',
        color: 'text-cyan-400'
      };
    case 'debt':
    case 'devil':
      return {
        bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
        dot: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]',
        color: 'text-rose-400'
      };
    case 'orchestrator':
      return {
        bg: 'bg-[#C9B284]/10 border-[#C9B284]/20 text-[#E7D7B0]',
        dot: 'bg-[#C9B284] shadow-[0_0_6px_rgba(201,178,132,0.5)]',
        color: 'text-[#E7D7B0]'
      };
    case 'general':
    case 'hnw':
    case 'memory':
      return {
        bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        dot: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]',
        color: 'text-amber-400'
      };
    case 'unknown':
    default:
      return {
        bg: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400',
        dot: 'bg-zinc-500',
        color: 'text-[#8C8370]'
      };
  }
}

export const AgentThinkingTrace: React.FC<AgentThinkingTraceProps> = ({
  rawThinking,
  isStreaming = false,
  startedAt,
  defaultExpanded = false,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isRawLogExpanded, setIsRawLogExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // 1. 建立运行时输入兜底 safeRawThinking 机制，阻断异常输入崩盘
  const safeRawThinking = typeof rawThinking === 'string'
    ? rawThinking
    : rawThinking == null
    ? ''
    : String(rawThinking);

  // 运行流逝时间
  const elapsedMs = useElapsedTimer(isStreaming, startedAt);

  // 解析 trace view model
  const trace = useMemo(() => {
    try {
      return buildAgentThinkingTrace(safeRawThinking, { isStreaming, startedAt });
    } catch (err) {
      console.error('[AgentThinkingTrace] Parser crashed:', err);
      // Fallback
      const lines = safeRawThinking.split('\n').filter(Boolean);
      return {
        rawText: safeRawThinking,
        headline: isStreaming ? '正在推演' : '推演完成',
        currentLabel: lines.length > 0 ? lines[lines.length - 1] : '解析失败，正在展示原文',
        status: isStreaming ? 'running' : 'complete',
        steps: [],
        meta: {
          rawLength: safeRawThinking.length,
          stepCount: 0,
          completedCount: 0,
          runningCount: 0,
          hasError: false,
          parserVersion: '1.0.0-fallback',
          parsedAt: Date.now(),
          isFallback: true
        }
      } as any;
    }
  }, [safeRawThinking, isStreaming, startedAt]);

  // 如果原始输入为空，则直接不渲染任何壳子
  if (!safeRawThinking.trim()) {
    return null;
  }

  // 复制原始日志
  const handleCopyRawLog = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(safeRawThinking);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy raw thinking trace log:', err);
    }
  };

  const globalStatus = trace.status; // 'pending' | 'running' | 'complete' | 'error'

  return (
    <div className={`w-full text-left font-sans select-none border border-white/[0.04] bg-[#111315]/40 rounded-xl overflow-hidden shadow-sm transition-all duration-200 ${className}`}>
      
      {/* 1. Header 单行进度控制台 */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer hover:bg-white/[0.01] active:bg-white/[0.02] select-none text-[11px] font-mono relative overflow-hidden"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* 左侧状态运行 Icon */}
          <div className="flex items-center justify-center shrink-0">
            {globalStatus === 'running' ? (
              <Loader2 className="w-3.5 h-3.5 text-[#C9B284] animate-spin" />
            ) : globalStatus === 'error' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            ) : (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </div>

          {/* 标题 & 当前状态 */}
          <div className="flex items-center gap-2 min-w-0">
            <span className={`font-sans font-medium shrink-0 ${
              globalStatus === 'error' ? 'text-rose-400' :
              globalStatus === 'running' ? 'text-amber-400' : 'text-[#8C8370]'
            }`}>
              {trace.headline === '正在推演' ? '推演进度' : trace.headline}
            </span>
            <span className="text-zinc-600 font-sans select-none shrink-0">•</span>
            <span className="text-zinc-400 truncate max-w-[200px] sm:max-w-[340px] font-sans font-normal" title={trace.currentLabel}>
              {trace.currentLabel}
            </span>
          </div>
        </div>

        {/* 右侧流逝时间及展开控件 */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0 text-[#8C8370]">
          {/* 耗时显示 */}
          <div className="flex items-center gap-1 font-mono text-[10px] select-none text-zinc-500 bg-white/[0.02] px-1.5 py-0.5 rounded border border-white/[0.01]">
            <Clock className="w-2.5 h-2.5 text-zinc-500" />
            <span>
              {globalStatus === 'running' 
                ? `${(elapsedMs / 1000).toFixed(1)}s` 
                : trace.meta.stepCount > 0 
                  ? `${trace.meta.completedCount}/${trace.meta.stepCount} 节点` 
                  : `${(trace.meta.rawLength / 1024).toFixed(1)} KB`
              }
            </span>
          </div>

          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          )}
        </div>

        {/* 流转中的底部非常微妙的扫光进度条 */}
        {globalStatus === 'running' && (
          <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-[#1a1d1f] overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-transparent via-[#C9B284]/50 to-transparent w-1/2"
              animate={{ x: ['-200%', '300%'] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            />
          </div>
        )}
      </div>

      {/* 2. 展开态：结构化 Agent Pipeline */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="border-t border-white/[0.03]"
          >
            <div className="p-4 space-y-4">
              
              {/* Timeline Agent Grid/List */}
              {trace.steps.length > 0 ? (
                <div className="relative pl-1.5 space-y-3.5">
                  {trace.steps.map((step: AgentThinkingStep, index: number) => {
                    const visual = getKindVisual(step.kind);
                    const isLast = index === trace.steps.length - 1;
                    
                    return (
                      <div key={step.id || index} className="flex gap-3 items-start min-w-0 relative">
                        {/* 局部的 Pipeline 线下延续 —— 深度利用 isLast 变量实现动态精准连线 */}
                        {!isLast && (
                          <div className="absolute left-[10px] top-6 bottom-[-14px] w-px bg-white/[0.04]" />
                        )}

                        {/* 左侧圆圈与连接线节点 —— 完美融合 getKindVisual 动态特质语义色 */}
                        <div className="relative flex items-center justify-center shrink-0 w-5 h-5 mt-0.5">
                          {step.status === 'running' ? (
                            <div className="w-4 h-4 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center animate-pulse">
                              <span className={`w-1.5 h-1.5 rounded-full ${visual.dot}`} />
                            </div>
                          ) : step.status === 'error' ? (
                            <div className="w-4 h-4 bg-rose-500/20 border border-rose-500/40 rounded-full flex items-center justify-center">
                              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
                            </div>
                          ) : step.status === 'complete' ? (
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${visual.bg}`}>
                              <Check className={`w-2.5 h-2.5 ${visual.color}`} />
                            </div>
                          ) : (
                            <div className={`w-3 h-3 rounded-full border border-white/[0.06] ${visual.bg}`} />
                          )}
                        </div>

                        {/* 右侧 Agent 具体内容 */}
                        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-1 border border-white/[0.01] bg-white/[0.005] px-2.5 py-1.5 rounded-lg">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              <span className={`font-bold font-sans tracking-wide ${visual.color}`}>
                                {step.label}
                              </span>
                              {step.role && (
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${visual.bg}`}>
                                  {step.role}
                                </span>
                              )}
                            </div>
                            
                            {/* 最新一条信息 */}
                            {step.messages.length > 0 && (
                              <p className="text-[10px] text-zinc-500 mt-1 select-text line-clamp-2 md:line-clamp-1 font-mono leading-relaxed" title={step.messages[step.messages.length - 1]}>
                                {step.messages[step.messages.length - 1]}
                              </p>
                            )}
                          </div>

                          {/* 模块特定状态 */}
                          <div className="shrink-0 text-[10px] font-sans md:text-right self-end md:self-center mt-1 md:mt-0 select-none">
                            <span className={`px-1.5 py-0.5 rounded font-mono font-medium text-[9px] ${
                              step.status === 'running' ? 'text-amber-400 bg-amber-400/5 border border-amber-400/10' :
                              step.status === 'error' ? 'text-rose-400 bg-rose-400/5 border border-rose-400/10' :
                              step.status === 'complete' ? 'text-emerald-400 bg-emerald-400/5 border border-emerald-400/10' :
                              'text-zinc-500 bg-zinc-500/5 border border-zinc-500/10'
                            }`}>
                              {step.status === 'running' ? 'RUNNING' :
                               step.status === 'error' ? 'ERROR' :
                               step.status === 'complete' ? 'COMPLETE' : 'PENDING'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 bg-zinc-950/20 rounded-lg text-center select-none">
                  <Workflow className="w-5 h-5 text-zinc-600 animate-pulse mb-1" />
                  <span className="text-[10.5px] text-zinc-500">无法自动结构化，请展开原始进度日志查看</span>
                </div>
              )}

              {/* 3. 二级折叠： 原始进度日志 */}
              <div className="border border-white/[0.02] bg-[#141618]/30 rounded-lg overflow-hidden">
                <div 
                  onClick={() => setIsRawLogExpanded(!isRawLogExpanded)}
                  className="flex items-center justify-between px-3 py-2 bg-white/[0.01] hover:bg-white/[0.02] cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 select-none">
                    <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="font-sans font-medium">查看原始进度日志</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyRawLog}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors rounded hover:bg-white/[0.03]"
                      title="复制原始日志"
                    >
                      {isCopied ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    {isRawLogExpanded ? (
                      <ChevronUp className="w-3 h-3 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-zinc-500" />
                    )}
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isRawLogExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <pre className="max-h-[160px] overflow-y-auto font-mono text-[9.5px] text-zinc-500 leading-normal p-3 bg-black/20 border-t border-white/[0.01] select-text whitespace-pre-wrap select-all">
                        {safeRawThinking}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
};
