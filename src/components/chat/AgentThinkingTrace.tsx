import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MaterialIcon } from '@/src/components/ui/MaterialIcon';
import { buildAgentThinkingTrace } from '../../lib/agent-thinking-parser';
import { AgentThinkingStep } from '../../lib/agent-thinking-types';
import { getSharedAgentDefinition } from '../../lib/agent-definitions';
import { useTranslation } from '../../hooks/useTranslation';

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


export const AgentThinkingTrace: React.FC<AgentThinkingTraceProps> = ({
  rawThinking,
  isStreaming = false,
  startedAt,
  defaultExpanded = false,
  className = ''
}) => {
  const { t, language } = useTranslation();
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
        headline: isStreaming ? t('chat.thinkingRunning') : t('chat.thinkingComplete'),
        currentLabel: lines.length > 0 ? lines[lines.length - 1] : t('chat.parseFailedRaw'),
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
  }, [safeRawThinking, isStreaming, startedAt, language]);

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
  const globalTone =
    globalStatus === 'error' ? 'text-aw-danger' :
    globalStatus === 'running' ? 'text-aw-warning' :
    'text-aw-success';

  return (
    <div className={`aw-structured-card w-full overflow-hidden text-left font-sans select-none transition-colors ${className}`}>
      
      {/* 1. Header 单行进度控制台 */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="relative flex cursor-pointer select-none items-center justify-between overflow-hidden px-3 py-2 font-mono aw-caption hover:bg-aw-surface-3"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* 左侧状态运行 Icon */}
          <div className="flex items-center justify-center shrink-0">
            {globalStatus === 'running' ? (
              <MaterialIcon name="progress_activity" size={16} className="text-aw-warning animate-spin" />
            ) : globalStatus === 'error' ? (
              <MaterialIcon name="warning" size={16} className="text-aw-danger animate-pulse" />
            ) : (
              <MaterialIcon name="check" size={16} className="text-aw-success" />
            )}
          </div>

          {/* 标题 & 当前状态 */}
          <div className="flex items-center gap-2 min-w-0">
            <span className={`font-sans font-medium shrink-0 ${globalTone}`}>
              {globalStatus === 'running' ? t('chat.thinkingProgress') : trace.headline}
            </span>
            <span className="aw-text-tertiary font-sans select-none shrink-0">•</span>
            <span className="aw-text-secondary truncate max-w-[200px] sm:max-w-[340px] font-sans font-normal" title={trace.currentLabel}>
              {trace.currentLabel}
            </span>
          </div>
        </div>

        {/* 右侧流逝时间及展开控件 */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0 aw-text-tertiary">
          {/* 耗时显示 */}
          <div className="aw-state-chip">
            <MaterialIcon name="schedule" size={16} />
            <span>
              {globalStatus === 'running' 
                ? `${(elapsedMs / 1000).toFixed(1)}s` 
                : trace.meta.stepCount > 0 
                  ? `${trace.meta.completedCount}/${trace.meta.stepCount} ${t('chat.nodes')}` 
                  : `${(trace.meta.rawLength / 1024).toFixed(1)} KB`
              }
            </span>
          </div>

          {isExpanded ? (
            <MaterialIcon name="keyboard_arrow_up" size={16} />
          ) : (
            <MaterialIcon name="keyboard_arrow_down" size={16} />
          )}
        </div>

        {/* 流转中的底部非常微妙的扫光进度条 */}
        {globalStatus === 'running' && (
          <div className="absolute inset-x-0 bottom-0 h-px overflow-hidden bg-aw-surface-3">
            <motion.div
              className="h-full w-1/2 bg-gradient-to-r from-transparent via-aw-accent-mist to-transparent"
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
            className="border-t border-aw-border-subtle"
          >
            <div className="p-4 space-y-4">
              
              {/* Timeline Agent Grid/List */}
              {trace.steps.length > 0 ? (
                <div className="relative pl-1.5 space-y-3.5">
                  {trace.steps.map((step: AgentThinkingStep, index: number) => {
                    const visual = getSharedAgentDefinition(step.kind).visual;
                    const isLast = index === trace.steps.length - 1;
                    
                    return (
                      <div key={step.id || index} className="flex gap-3 items-start min-w-0 relative">
                        {/* 根据节点位置渲染连接线 */}
                        {!isLast && (
                          <div className="absolute left-[10px] top-6 bottom-[-14px] w-px bg-aw-border-subtle" />
                        )}

                        {/* 左侧状态节点 —— 使用共享 Agent 视觉语义 */}
                        <div className="relative flex items-center justify-center shrink-0 w-5 h-5 mt-0.5">
                          {step.status === 'running' ? (
                            <div className="flex h-4 w-4 items-center justify-center rounded-full border border-aw-warning bg-aw-warning/10 animate-pulse">
                              <span className={`aw-status-dot ${visual.dot || 'aw-status-warning'}`} />
                            </div>
                          ) : step.status === 'error' ? (
                            <div className="flex h-4 w-4 items-center justify-center rounded-full border border-aw-danger bg-aw-danger/10">
                              <span className="aw-status-dot aw-status-danger animate-ping" />
                            </div>
                          ) : step.status === 'complete' ? (
                            <div className={`flex h-4 w-4 items-center justify-center rounded-full border ${visual.bg}`}>
                              <MaterialIcon name="check" size={16} className={visual.color} />
                            </div>
                          ) : (
                            <div className={`h-3 w-3 rounded-full border ${visual.bg}`} />
                          )}
                        </div>

                        {/* 右侧 Agent 具体内容 */}
                        <div className="aw-structured-card-muted flex min-w-0 flex-1 flex-col justify-between gap-1 px-3 py-2 md:flex-row md:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 aw-caption">
                              <span className={`font-bold font-sans tracking-wide ${visual.color}`}>
                                {step.label}
                              </span>
                              {step.role && (
                                <span className={visual.bg}>
                                  {step.role}
                                </span>
                              )}
                            </div>
                            
                            {/* 最新一条信息 */}
                            {step.messages.length > 0 && (
                              <p className="aw-caption aw-text-tertiary mt-1 select-text line-clamp-2 md:line-clamp-1 font-mono leading-relaxed" title={step.messages[step.messages.length - 1]}>
                                {step.messages[step.messages.length - 1]}
                              </p>
                            )}
                          </div>

                          {/* 模块特定状态 */}
                          <div className="shrink-0 self-end select-none md:self-center">
                            <span className={`aw-state-chip ${
                              step.status === 'running' ? 'aw-state-chip-warning' :
                              step.status === 'error' ? 'aw-state-chip-danger' :
                              step.status === 'complete' ? 'aw-state-chip-success' :
                              ''
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
                <div className="aw-panel-muted flex flex-col items-center justify-center py-4 text-center select-none">
                  <MaterialIcon name="account_tree" size={20} className="aw-text-tertiary animate-pulse mb-1" />
                  <span className="aw-caption aw-text-tertiary">{t('chat.structureFallback')}</span>
                </div>
              )}

              {/* 3. 二级折叠： 原始进度日志 */}
              <div className="aw-structured-card-muted overflow-hidden">
                <div 
                  onClick={() => setIsRawLogExpanded(!isRawLogExpanded)}
                  className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-aw-surface-3"
                >
                  <div className="flex items-center gap-2 aw-caption aw-text-secondary select-none">
                    <MaterialIcon name="terminal" size={16} />
                    <span className="font-sans font-medium">{t('chat.viewRawProgressLog')}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyRawLog}
                      className="aw-icon-button !h-7 !min-w-7"
                      title={t('chat.copyRawLog')}
                    >
                      {isCopied ? (
                        <MaterialIcon name="check" size={16} className="text-aw-success" />
                      ) : (
                        <MaterialIcon name="content_copy" size={16} />
                      )}
                    </button>
                    {isRawLogExpanded ? (
                      <MaterialIcon name="keyboard_arrow_up" size={16} className="aw-text-tertiary" />
                    ) : (
                      <MaterialIcon name="keyboard_arrow_down" size={16} className="aw-text-tertiary" />
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
                      <pre className="max-h-[160px] overflow-y-auto font-mono aw-caption aw-text-tertiary leading-normal p-3 bg-aw-bg border-t border-aw-border-subtle select-text whitespace-pre-wrap select-all">
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
