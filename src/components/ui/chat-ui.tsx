import React, { useRef, useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { AssistantResponseRenderer } from '../chat/AssistantResponseRenderer';
import { AgentThinkingTrace } from '../chat/AgentThinkingTrace';
import { MaterialIcon } from './MaterialIcon';
import { useTranslation } from '../../hooks/useTranslation';

const CodeBlock = React.memo(({ inline, className, children, setFullScreenCode, isBlock }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children).replace(/\n$/, '');
  const [copied, setCopied] = useState(false);

  if (!isBlock) {
    return <code className="aw-chat-code-inline">{children}</code>;
  }

  return (
    <div className="aw-chat-code-block relative group/code my-6">
      <div className="flex items-center justify-between px-5 pt-3 pb-1">
        <span className="aw-caption aw-text-tertiary font-mono font-semibold uppercase">{match?.[1] || 'Code'}</span>
        <div className="flex gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
            <button onClick={() => {
                navigator.clipboard.writeText(codeString);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }} className="aw-icon-button">
                <MaterialIcon name={copied ? 'check' : 'content_copy'} size={20} className={copied ? 'text-aw-success' : ''} />
            </button>
            <button onClick={() => setFullScreenCode({ code: codeString, language: match?.[1] || 'Code' })} className="aw-icon-button hidden sm:inline-flex">
                <MaterialIcon name="open_in_full" size={20} />
            </button>
        </div>
      </div>
      <pre className="aw-body p-5 sm:p-6 overflow-x-auto font-mono text-aw-accent-mist leading-relaxed custom-scroll">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
});

const PComponent = React.memo(({ children }: any) => <div className="mb-4 text-dash-secondary">{children}</div>);
const LiComponent = React.memo(({ children }: any) => <li className="mb-1 text-dash-secondary">{children}</li>);
const StrongComponent = React.memo(({ children }: any) => <strong className="font-bold text-dash-primary">{children}</strong>);

const LiveTimer = () => {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 100);
    return () => clearInterval(interval);
  }, []);
  return (
    <span className="aw-status-pill font-mono uppercase">
      <MaterialIcon name="memory" size={16} className="animate-pulse text-aw-success" /> { (elapsed / 1000).toFixed(1) }s {t('chat.elapsed')}
    </span>
  );
};

export const ChatList = React.memo(function ChatList({ 
  messages, 
  isTyping, 
  onRegenerate, 
  onQuickPrompt,
  onApplySuggestedState,
  className,
  bottomPaddingClass = 'pb-[176px]',
}: { 
  messages: any[], 
  isTyping: boolean, 
  onRegenerate?: () => void, 
  onQuickPrompt?: (p: string) => void,
  onApplySuggestedState?: (patch: any, sourceChatIndex?: number) => void,
  className?: string,
  bottomPaddingClass?: string,
}) {
  const { t } = useTranslation();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const [expandedUserMsg, setExpandedUserMsg] = React.useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [fullScreenCode, setFullScreenCode] = React.useState<{ code: string, language: string } | null>(null);
  const [showSuggestedJson, setShowSuggestedJson] = React.useState<Record<number, boolean>>({});
  
  const isAtBottomRef = React.useRef(true);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const markdownComponents = useMemo(() => ({
    p: PComponent,
    li: LiComponent,
    strong: StrongComponent,
    pre: ({ children }: any) => {
      if (React.isValidElement(children)) {
        return React.cloneElement(children, { isBlock: true } as any);
      }
      return <>{children}</>;
    },
    code: (props: any) => <CodeBlock {...props} setFullScreenCode={setFullScreenCode} />
  }), [setFullScreenCode]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;
    }
  };

  React.useEffect(() => {
    if (chatEndRef.current && (isAtBottomRef.current || messages.length <= 1)) {
      chatEndRef.current.scrollIntoView({ behavior: isTyping ? 'auto' : 'smooth', block: 'end' });
    }
  }, [messages, isTyping]);

  const quickPrompts = [
    t('prompts.cashflow'),
    t('prompts.hedge'),
    t('prompts.defensive'),
    t('prompts.privateReview')
  ];

  return (
    <div
      className={cn("flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scroll", bottomPaddingClass, className)}
      ref={containerRef}
      onScroll={handleScroll}
    >
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center opacity-65 py-16 px-4">
          <MaterialIcon name="auto_awesome" size={32} className="mb-3 text-aw-accent-mist" />
          <p className="aw-section-kicker mb-2">{t('chat.awaiting')}</p>
          <p className="aw-caption aw-text-tertiary max-w-sm tracking-tight leading-relaxed font-sans">
            {t('chat.awaitingDesc')}
          </p>
        </div>
      ) : (
        messages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <div key={i} className="flex flex-col items-end gap-1 w-full max-w-[90%] ml-auto">
                <div className="aw-caption aw-text-tertiary flex items-center gap-1.5 font-mono uppercase mb-0.5 font-semibold">
                  <span>{t('chat.you')}</span>
                </div>
                <div className="aw-chat-bubble-user relative group px-4 py-2.5 aw-body font-sans">
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {msg.attachments.map((att: any, attIdx: number) => (
                          <div key={attIdx} className="aw-panel-muted relative overflow-hidden">
                              {att.mimeType?.startsWith('image/') ? (
                                <img src={att.url || `data:${att.mimeType};base64,${att.data}`} alt="attachment" className="w-16 h-16 object-cover hover:scale-105 transition-transform" />
                              ) : (
                                <div className="w-16 h-16 bg-aw-surface-3 flex flex-col items-center justify-center p-2 aw-caption aw-text-secondary font-sans text-center font-medium">
                                    <MaterialIcon name="description" size={20} className="mb-1 aw-text-tertiary" />
                                    <span className="truncate w-full">{att.name}</span>
                                </div>
                              )}
                          </div>
                        ))}
                    </div>
                  )}
                  {msg.content.length > 500 ? (
                      <div className="aw-body aw-text-primary">
                        <motion.div layout className="relative">
                          <div className={cn("overflow-hidden transition-all duration-300", expandedUserMsg[i] ? "max-h-[5000px]" : "max-h-[120px]")}>
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          </div>
                          {!expandedUserMsg[i] && (
                            <div className="absolute bottom-0 left-0 w-full h-8 pointer-events-none bg-gradient-to-t from-aw-bg to-transparent" />
                          )}
                        </motion.div>
                        <button 
                          onClick={() => setExpandedUserMsg(prev => ({ ...prev, [i]: !prev[i] }))} 
                          className="aw-caption aw-text-secondary hover:text-aw-accent-mist mt-2 font-mono uppercase w-full text-left transition-colors font-bold"
                        >
                            {expandedUserMsg[i] ? t('chat.collapse') : t('chat.expand')}
                        </button>
                      </div>
                  ) : (
                      <div className="aw-body whitespace-pre-wrap break-words aw-text-primary">{msg.content}</div>
                  )}
                </div>
              </div>
            );
          } else {
            return (
              <div key={i} className="flex flex-col items-start gap-2 w-full max-w-[95%]">
                <div className="aw-caption aw-text-tertiary flex items-center gap-1.5 font-mono uppercase mb-0.5">
                  <span className="font-semibold text-current">{t('chat.arbitra')}</span>
                </div>
                
                {/* Thinking Section styled to be elegant and progressive */}
                {msg.thinking && (
                  <AgentThinkingTrace
                    rawThinking={msg.thinking}
                    isStreaming={isTyping && i === messages.length - 1}
                    defaultExpanded={false}
                    className="w-full"
                  />
                )}
                
                {/* Custom Private Wealth Advisor Memo Card */}
                <div className="aw-chat-bubble-assistant p-4 sm:p-5 font-sans">
                  {(!msg.content && isTyping && i === messages.length - 1) ? (
                    msg.thinking ? (
                      <div className="aw-caption aw-text-secondary flex items-center gap-2.5 font-sans py-1">
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aw-accent-mist opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-aw-accent-mist"></span>
                        </span>
                        <span>{t('chat.awaitingFinal')}</span>
                      </div>
                    ) : (
                      <div className="aw-caption aw-text-tertiary flex items-center gap-2.5 font-mono py-1">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                          <MaterialIcon name="progress_activity" size={16} className="text-aw-accent-mist" />
                        </motion.div>
                        <span>{t('chat.buildingChain')}</span>
                      </div>
                    )
                  ) : (
                      <div className="aw-body leading-relaxed aw-text-primary space-y-3 font-sans ai-message">
                        <AssistantResponseRenderer
                          content={msg.content || ''}
                          markdownComponents={markdownComponents}
                          metadata={{
                            timeTaken: msg.timeTaken,
                            hasMemoryUpdate: msg.hasMemoryUpdate,
                            liveSources: msg._liveSources,
                          }}
                          isStreaming={isTyping && i === messages.length - 1}
                          isInteractionDisabled={isTyping}
                          onQuickPrompt={onQuickPrompt}
                        />

                        {msg.aiSuggestedState && (
                          <div className="aw-panel-muted mt-4 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <h4 className="aw-body font-bold text-aw-accent-mist flex items-center gap-1.5 font-sans">
                                  <MaterialIcon name="auto_awesome" size={16} />
                                  {t('chat.suggestedUpdate')}
                                </h4>
                                <p className="aw-caption aw-text-tertiary mt-0.5">
                                  {t('chat.suggestedUpdateDesc')}
                                </p>
                              </div>
                              {msg.suggestedStateApplied ? (
                                <span className="aw-status-pill font-mono text-aw-success">
                                  <MaterialIcon name="check" size={16} /> {t('chat.applied')}
                                </span>
                              ) : (
                                <span className="aw-status-pill font-mono text-aw-warning">
                                  {t('chat.pending')}
                                </span>
                              )}
                            </div>

                            {/* Details of metrics and distributions */}
                            <div className="space-y-2 aw-caption aw-text-secondary">
                              {msg.aiSuggestedState.metrics && Object.keys(msg.aiSuggestedState.metrics).length > 0 && (
                                <div className="flex gap-2 items-start">
	                                  <span className="aw-status-pill font-mono shrink-0">{t('chat.metrics')}</span>
                                  <div className="flex-1 flex flex-wrap gap-1.5">
                                    {Object.keys(msg.aiSuggestedState.metrics).map(mKey => {
                                      let name = mKey;
	                                      if (mKey === 'netWorth') name = t('chat.metricNetWorth');
	                                      else if (mKey === 'liquidity') name = t('chat.metricLiquidity');
	                                      else if (mKey === 'fcf') name = t('chat.metricFcf');
	                                      else if (mKey === 'safetyRatio') name = t('chat.metricSafetyRatio');
                                      return (
                                        <span key={mKey} className="aw-status-pill">
                                          {name}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {msg.aiSuggestedState.distributions && Object.keys(msg.aiSuggestedState.distributions).length > 0 && (
                                <div className="flex gap-2 items-start">
	                                  <span className="aw-status-pill font-mono shrink-0">{t('chat.distributions')}</span>
                                  <div className="flex-1 flex flex-wrap gap-1.5">
                                    {Object.keys(msg.aiSuggestedState.distributions).map(dKey => {
                                      let name = dKey;
	                                      if (dKey === 'liquidity') name = t('chat.distributionLiquidity');
	                                      else if (dKey === 'expenses') name = t('chat.distributionExpenses');
	                                      else if (dKey === 'privateAssets') name = t('chat.distributionPrivateAssets');
	                                      else if (dKey === 'fixedAssets') name = t('chat.distributionFixedAssets');
	                                      else if (dKey === 'options') name = t('chat.distributionOptions');
                                      return (
                                        <span key={dKey} className="aw-status-pill">
                                          {name}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {msg.aiSuggestedState.goal && (
                                <div className="flex gap-2 items-start">
	                                  <span className="aw-status-pill font-mono shrink-0">{t('chat.goal')}</span>
                                  <span className="aw-status-pill truncate max-w-xs">
	                                    {t('chat.wealthGoal')}: {msg.aiSuggestedState.goal.name || t('chat.update')}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* View complete JSON collapsible */}
                            <div className="pt-1">
                              <button
                                onClick={() => setShowSuggestedJson(prev => ({ ...prev, [i]: !prev[i] }))}
                                className="aw-chat-meta-action"
                              >
                                <MaterialIcon name={showSuggestedJson[i] ? 'expand_less' : 'expand_more'} size={16} />
	                                <span>{showSuggestedJson[i] ? t('chat.hideJson') : t('chat.viewJson')}</span>
                              </button>
                              {showSuggestedJson[i] && (
                                <pre className="aw-panel-muted mt-2 p-3 aw-caption font-mono text-aw-success max-h-48 overflow-y-auto custom-scroll w-full whitespace-pre-wrap break-words">
                                  {JSON.stringify(msg.aiSuggestedState, null, 2)}
                                </pre>
                              )}
                            </div>

                            {/* Action apply button */}
                            <div className="pt-2 flex justify-end">
                              <button
                                onClick={() => {
                                  if (onApplySuggestedState && !msg.suggestedStateApplied) {
                                    onApplySuggestedState(msg.aiSuggestedState, msg.sourceChatIndex);
                                  }
                                }}
                                disabled={msg.suggestedStateApplied}
                                className={cn(
                                  "aw-button font-mono cursor-pointer",
                                  msg.suggestedStateApplied
                                    ? "aw-button-ghost opacity-50 cursor-not-allowed"
                                    : "aw-button-primary"
                                )}
                              >
                                {msg.suggestedStateApplied ? (
                                  <>
                                    <MaterialIcon name="check" size={16} />
	                                    {t('chat.applied')}
                                  </>
                                ) : (
                                  <>
                                    <MaterialIcon name="auto_awesome" size={16} />
	                                    {t('chat.applyToDashboard')}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {msg.content && (
                           <div className="mt-3 pt-3 border-t border-aw-border-subtle flex flex-col gap-2 font-sans aw-caption">
                             {/* Metric Badges Info */}
                             <div className="flex flex-wrap gap-2 items-center">
                               {msg._liveSources?.includes('longbridge') && (
                                 <span className="aw-status-pill">
                                   <MaterialIcon name="monitoring" size={16} className="text-aw-success animate-pulse" />
	                                   {t('chat.liveDataSource')}
                                 </span>
                               )}
                               {msg.hasMemoryUpdate && (
                                 <motion.span 
                                   initial={{ opacity: 0, y: 5 }}
                                   animate={{ opacity: 1, y: 0 }}
                                   className="aw-status-pill relative overflow-hidden group/memory"
                                 >
                                   <MaterialIcon name="auto_awesome" size={16} className="text-aw-warning" />
	                                   {t('chat.longMemoryRefreshed')}
                                 </motion.span>
                               )}
                               {msg.timeTaken !== undefined && (
                                 <span className="aw-status-pill font-mono">
                                   {(msg.timeTaken / 1000).toFixed(1)}s
                                 </span>
                               )}
                             </div>

                             {/* Memo Toolbar utilities */}
                             <div className="flex items-center gap-3 opacity-40 hover:opacity-100 transition-opacity mt-0.5">
                               <button onClick={() => handleCopy(msg.content, i)} className="aw-chat-meta-action">
                                 <MaterialIcon name={copiedIndex === i ? 'check' : 'content_copy'} size={16} className={copiedIndex === i ? 'text-aw-success' : ''} />
	                                 {copiedIndex === i ? <span className="text-aw-success font-sans">{t('chat.copied')}</span> : t('chat.copy')}
                               </button>
                               {i === messages.length - 1 && onRegenerate && (
                                 <button onClick={onRegenerate} className="aw-chat-meta-action">
	                                   <MaterialIcon name="refresh" size={16} /> {t('chat.rerun')}
                                 </button>
                               )}
                               {msg.debugData && (
                                 <button onClick={() => {
                                     const blob = new Blob([JSON.stringify(msg.debugData, null, 2)], { type: 'application/json' });
                                     const url = URL.createObjectURL(blob);
                                     const a = document.createElement('a');
                                     a.href = url;
                                     a.download = `terminal-node-data-${Date.now()}.json`;
                                     a.click();
                                     URL.revokeObjectURL(url);
                                 }} className="aw-chat-meta-action">
	                                     <MaterialIcon name="download" size={16} /> {t('chat.jsonData')}
                                 </button>
                               )}
                             </div>
                           </div>
                        )}
                      </div>
                  )}
                </div>
              </div>
            );
          }
        })
      )}
      <div ref={chatEndRef} className="h-10" />

      {/* Fullscreen Code Modal */}
      <AnimatePresence>
        {fullScreenCode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 aw-modal-backdrop flex flex-col pt-4 sm:pt-10 px-0 sm:px-10 pb-0"
          >
             <div className="aw-modal-shell flex-1 w-full max-w-7xl mx-auto flex flex-col sm:rounded-t-3xl overflow-hidden">
                <div className="aw-modal-header flex items-center justify-between px-6 py-4 border-b">
                   <span className="aw-body font-mono font-bold aw-text-secondary uppercase">{fullScreenCode.language}</span>
                   <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                        navigator.clipboard.writeText(fullScreenCode.code);
                        handleCopy(fullScreenCode.code, -1);
                      }}
                        className="aw-button aw-button-ghost"
                      >
                        <MaterialIcon name={copiedIndex === -1 ? 'check' : 'content_copy'} size={16} className={copiedIndex === -1 ? 'text-aw-success' : ''} />
	                        {copiedIndex === -1 ? t('chat.copied') : t('chat.copyCode')}
                      </button>
                      <button onClick={() => setFullScreenCode(null)} className="aw-button aw-button-ghost ml-2 text-aw-danger">
	                        <MaterialIcon name="close" size={16} /> {t('chat.close')}
                      </button>
                   </div>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-aw-bg">
                   <pre className="aw-body font-mono aw-text-secondary leading-relaxed break-words whitespace-pre-wrap">
                      <code>{fullScreenCode.code}</code>
                   </pre>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export function ChatInput({ input, handleInputChange, handleSubmit, isLoading, onKeyDown, onStop, onPaste, hasAttachments = false }: any) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`; // Adjust height, max 200px
    }
  }, [input]);

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow new line
        return;
      } else {
        // Prevent default newline and submit
        e.preventDefault();
        if ((input.trim() || hasAttachments) && !isLoading) {
          handleSubmit(e);
        }
      }
    }
    if (onKeyDown) onKeyDown(e);
  };

  return (
    <form onSubmit={handleSubmit} className="aw-chat-input relative group">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleCustomKeyDown}
        onPaste={onPaste}
        placeholder={t('chat.sendMessagePlaceholder')}
        rows={1}
        className="aw-chat-textarea custom-scroll"
        style={{ minHeight: '48px', maxHeight: '200px' }}
      />
      <div className="flex self-end mb-1 mr-1">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              type="button"
              onClick={onStop}
              className="aw-icon-button w-10 h-10 sm:w-11 sm:h-11 text-aw-danger border border-aw-border-subtle"
              title={t('chat.stopGeneration')}
            >
              <MaterialIcon name="stop_circle" size={24} />
            </motion.button>
          ) : (input.trim() || hasAttachments) ? (
              <motion.button
              key="send"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              type="submit"
              className="aw-button aw-button-primary w-10 h-10 sm:w-11 sm:h-11 !px-0 active:scale-95"
            >
              <MaterialIcon name="send" size={24} />
            </motion.button>
          ) : (
            <motion.button
              key="voice"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              type="button"
              className="aw-icon-button w-10 h-10 sm:w-11 sm:h-11 active:scale-95"
              title={t('chat.voiceInputComingSoon')}
            >
              <MaterialIcon name="mic" size={24} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
