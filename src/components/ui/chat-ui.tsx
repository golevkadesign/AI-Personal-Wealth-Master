import React, { useRef, useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { Send, FileText, Bot, User as UserIcon, Loader2, Activity, ChevronDown, Sparkles, StopCircle, Check, Copy, RefreshCw, MessageSquare, X, Mic, Maximize2, Cpu, Download } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

const CodeBlock = React.memo(({ inline, className, children, setFullScreenCode, isBlock }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children).replace(/\n$/, '');
  const [copied, setCopied] = useState(false);

  if (!isBlock) {
    return <code className="bg-dash-surface-hover text-dash-primary font-semibold px-2 py-1 rounded-[6px] border border-dash-subtle text-[0.85em] font-mono whitespace-pre-wrap tracking-wide">{children}</code>;
  }

  return (
    <div className="relative group/code my-6 rounded-[20px] bg-dash-surface border border-dash-subtle overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-3 bg-dash-surface-hover border-b border-dash-subtle">
        <span className="text-xs font-mono font-semibold uppercase tracking-widest text-dash-tertiary">{match?.[1] || 'Code'}</span>
        <div className="flex gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
            <button onClick={() => {
                navigator.clipboard.writeText(codeString);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }} className="text-dash-tertiary hover:text-dash-primary p-2 rounded-lg hover:bg-dash-subtle transition-colors">
                {copied ? <Check className="w-4 h-4 text-dash-green" /> : <Copy className="w-4 h-4" />}
            </button>
            <button onClick={() => setFullScreenCode({ code: codeString, language: match?.[1] || 'Code' })} className="text-dash-tertiary hover:text-dash-primary p-2 rounded-lg hover:bg-dash-subtle transition-colors hidden sm:block">
                <Maximize2 className="w-4 h-4" />
            </button>
        </div>
      </div>
      <pre className="p-5 sm:p-6 overflow-x-auto text-[13px] sm:text-[14px] font-mono text-dash-primary leading-relaxed custom-scroll">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
});

const PComponent = React.memo(({ children }: any) => <div className="mb-4 text-dash-secondary">{children}</div>);
const LiComponent = React.memo(({ children }: any) => <li className="mb-1 text-dash-secondary">{children}</li>);
const StrongComponent = React.memo(({ children }: any) => <strong className="font-bold text-dash-primary">{children}</strong>);

const LiveTimer = () => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 100);
    return () => clearInterval(interval);
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold bg-white/5 text-dash-tertiary border border-white/10">
      <Cpu className="w-3.5 h-3.5 animate-pulse text-emerald-400" /> { (elapsed / 1000).toFixed(1) }s 耗时
    </span>
  );
};

export const ChatList = React.memo(function ChatList({ messages, isTyping, onRegenerate, onQuickPrompt }: { messages: any[], isTyping: boolean, onRegenerate?: () => void, onQuickPrompt?: (p: string) => void }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const [expandedThinking, setExpandedThinking] = React.useState<Record<number, boolean>>({});
  const [expandedUserMsg, setExpandedUserMsg] = React.useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [fullScreenCode, setFullScreenCode] = React.useState<{ code: string, language: string } | null>(null);
  
  React.useEffect(() => {
    if (!isTyping && messages.length > 0) {
      // 自动折叠最后一条消息的思考过程
      setExpandedThinking(prev => ({ ...prev, [messages.length - 1]: false }));
    }
  }, [isTyping, messages.length]);

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
    "解析我的核心开支并在大盘中找出现金流最优打法",
    "利用我的现有被动收入做二次风险对冲",
    "提供未来一年基于当前行情的防御型资产配置计划",
    "审查我的非公开投资并给出清退或加码建议"
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scroll pb-[200px]" ref={containerRef} onScroll={handleScroll}>
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center opacity-65 py-16 px-4">
          <Sparkles className="w-6 h-6 mb-3 text-[#C9B284]" />
          <p className="text-[10px] font-mono tracking-[0.2em] mb-2 text-[#A39167] uppercase font-bold">Awaiting wealth strategy parameters</p>
          <p className="text-dash-tertiary max-w-sm tracking-tight leading-relaxed font-sans text-xs">
            Enter a quantitative command, attach financial records, or execute a Suggested Prompt above to synthesize AI strategies.
          </p>
        </div>
      ) : (
        messages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <div key={i} className="flex flex-col items-end gap-1 w-full max-w-[90%] ml-auto">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-dash-tertiary uppercase tracking-wider mb-0.5 font-semibold">
                  <span>You</span>
                </div>
                <div className="relative group bg-[#16181A] border border-[#C9B284]/20 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] leading-relaxed shadow-sm font-sans w-full">
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {msg.attachments.map((att: any, attIdx: number) => (
                          <div key={attIdx} className="relative shadow-sm rounded-lg overflow-hidden border border-white/5 bg-dash-surface">
                              {att.mimeType?.startsWith('image/') ? (
                                <img src={att.url || `data:${att.mimeType};base64,${att.data}`} alt="attachment" className="w-16 h-16 object-cover hover:scale-105 transition-transform" />
                              ) : (
                                <div className="w-16 h-16 bg-white/5 flex flex-col items-center justify-center p-2 text-[9px] text-dash-secondary font-sans text-center font-medium">
                                    <FileText className="w-5 h-5 mb-1 text-[#8C8270]" />
                                    <span className="truncate w-full">{att.name}</span>
                                </div>
                              )}
                          </div>
                        ))}
                    </div>
                  )}
                  {msg.content.length > 500 ? (
                      <div className="text-[13px] leading-relaxed text-dash-primary">
                        <motion.div layout className="relative">
                          <div className={cn("overflow-hidden transition-all duration-300", expandedUserMsg[i] ? "max-h-[5000px]" : "max-h-[120px]")}>
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          </div>
                          {!expandedUserMsg[i] && (
                            <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#16181A] to-transparent pointer-events-none" />
                          )}
                        </motion.div>
                        <button 
                          onClick={() => setExpandedUserMsg(prev => ({ ...prev, [i]: !prev[i] }))} 
                          className="text-[10px] text-dash-secondary hover:text-dash-primary mt-2 font-mono uppercase tracking-widest w-full text-left transition-colors font-bold"
                        >
                            {expandedUserMsg[i] ? "收起" : "展开"}
                        </button>
                      </div>
                  ) : (
                      <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words text-dash-primary">{msg.content}</div>
                  )}
                </div>
              </div>
            );
          } else {
            return (
              <div key={i} className="flex flex-col items-start gap-1 w-full max-w-[95%]">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-dash-tertiary uppercase tracking-wider mb-1 font-semibold">
                  <span className="font-bold text-[#C9B284]">Arbitra AI</span>
                </div>
                
                {/* Thinking Section styled to be elegant and progressive */}
                {msg.thinking && (
                  <div className="w-full mb-2">
                    <div className="rounded-xl overflow-hidden bg-dash-surface-hover/50 border border-[#C9B284]/15 shadow-sm backdrop-blur-sm">
                        <button onClick={() => {
                            setExpandedThinking(prev => ({ ...prev, [i]: prev[i] === undefined ? false : !prev[i] }))
                        }} className="w-full flex items-center justify-between py-2 px-3 hover:bg-white/5 transition-colors border-b border-transparent data-[expanded=true]:border-[#C9B284]/10" data-expanded={expandedThinking[i] !== false}>
                            <div className="flex items-center gap-2 overflow-hidden flex-1 shrink">
                              {isTyping && i === messages.length - 1 && !msg.content ? (
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                                  <Sparkles className="w-3.5 h-3.5 text-[#C9B284] animate-pulse" />
                                </motion.div>
                              ) : <Check className="w-3.5 h-3.5 text-[#8C8270]" />}
                              <span className="font-semibold text-[11px] text-[#C9B284] tracking-wide shrink-0">
                                {isTyping && i === messages.length - 1 && !msg.content ? '深度推演中...' : '推演完成'}
                              </span>
                              {expandedThinking[i] === false && (
                                <span className="text-[10px] text-[#A39167]/70 truncate flex-1 block text-left ml-2 font-mono">
                                   {msg.thinking.trim().split('\n').filter(Boolean).pop()?.replace(/^["'-]|["'-]$/g, '').trim() || '分析数据...'}
                                </span>
                              )}
                            </div>
                            <ChevronDown className={`w-3.5 h-3.5 text-[#8C8270] transition-transform duration-300 ml-2 shrink-0 ${expandedThinking[i] !== false ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {expandedThinking[i] !== false && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="text-[#A39167] font-mono text-[10px] leading-relaxed whitespace-pre-wrap bg-[#08090A]/50 border-t border-[#C9B284]/10"
                              >
                                <div className="p-3 border-l-2 border-[#C9B284]/30 ml-2.5 my-2 max-h-[160px] overflow-y-auto custom-scroll">{msg.thinking}</div>
                              </motion.div>
                          )}
                        </AnimatePresence>
                    </div>
                  </div>
                )}
                
                {/* Custom Private Wealth Advisor Memo Card */}
                <div className="w-full bg-[#16181A] border border-[#C9B284]/15 rounded-2xl p-4 sm:p-5 shadow-sm font-sans">
                  {(!msg.content && isTyping && i === messages.length - 1) ? (
                      <div className="flex items-center gap-2.5 text-dash-tertiary font-mono text-xs py-1">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                          <Loader2 className="w-3.5 h-3.5 text-[#C9B284]" />
                        </motion.div>
                        <span>SYNTHESIZING STRATEGY...</span>
                      </div>
                  ) : (
                      <div className="text-[13px] sm:text-sm leading-relaxed text-[#E7D7B0] space-y-3 font-sans ai-message">
                        <Markdown components={markdownComponents}>
                          {msg.content}
                        </Markdown>
                        {msg.content && (
                           <div className="mt-6 pt-4 border-t border-[#C9B284]/10 flex flex-col gap-3 font-sans">
                             {/* Metric Badges Info */}
                             <div className="flex flex-wrap gap-2 items-center">
                               {msg._liveSources?.includes('longbridge') && (
                                 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#6B8E6B]/10 text-[#6B8E6B] border border-[#6B8E6B]/20">
                                   <Activity className="w-3 h-3" />
                                   实盘数据源
                                 </span>
                               )}
                               {msg.hasMemoryUpdate && (
                                 <motion.span 
                                   initial={{ opacity: 0, y: 5 }}
                                   animate={{ opacity: 1, y: 0 }}
                                   className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-[#C9B284] bg-[#C9B284]/10 border border-[#C9B284]/20 relative overflow-hidden group/memory"
                                 >
                                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C9B284]/10 to-transparent -translate-x-full group-hover/memory:animate-[shimmer_1.5s_infinite]" />
                                   <Sparkles className="w-3 h-3 opacity-80" />
                                   已刷新长期记忆
                                 </motion.span>
                               )}
                               {msg.timeTaken !== undefined && (
                                 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider text-dash-tertiary bg-[#1D1F21] border border-[#C9B284]/10">
                                   {(msg.timeTaken / 1000).toFixed(1)}s
                                 </span>
                               )}
                             </div>

                             {/* Memo Toolbar utilities */}
                             <div className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity mt-1">
                               <button onClick={() => handleCopy(msg.content, i)} className="flex items-center gap-1 text-[11px] font-mono text-[#8C8270] hover:text-white transition-colors uppercase tracking-wider">
                                 {copiedIndex === i ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                 {copiedIndex === i ? <span className="text-emerald-400 font-sans">Copied</span> : 'Copy'}
                               </button>
                               {i === messages.length - 1 && onRegenerate && (
                                 <button onClick={onRegenerate} className="flex items-center gap-1 text-[11px] font-mono text-[#8C8270] hover:text-white transition-colors uppercase tracking-wider">
                                   <RefreshCw className="w-3 h-3" /> Re-run
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
                                 }} className="flex items-center gap-1 text-[11px] font-mono text-[#8C8270] hover:text-white transition-colors uppercase tracking-wider">
                                     <Download className="w-3 h-3" /> JSON Data
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
            className="fixed inset-0 z-50 bg-[#0B0D0F]/90 backdrop-blur-md flex flex-col pt-4 sm:pt-10 px-0 sm:px-10 pb-0"
          >
             <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col bg-dash-bg border border-dash-subtle sm:rounded-t-3xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-dash-subtle bg-dash-surface">
                   <span className="text-sm font-mono font-bold text-dash-secondary uppercase tracking-widest">{fullScreenCode.language}</span>
                   <div className="flex items-center gap-2">
                      <button onClick={() => {
                        navigator.clipboard.writeText(fullScreenCode.code);
                        handleCopy(fullScreenCode.code, -1);
                      }} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">
                        {copiedIndex === -1 ? <Check className="w-3.5 h-3.5 text-dash-green" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedIndex === -1 ? '已复制' : '复制代码'}
                      </button>
                      <button onClick={() => setFullScreenCode(null)} className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg border border-rose-500/20 hover:bg-rose-500/10 transition-colors ml-2">
                        <X className="w-4 h-4" /> 关闭
                      </button>
                   </div>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-[#0B0D0F]">
                   <pre className="text-sm font-mono text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
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
    <form onSubmit={handleSubmit} className="relative group w-full flex items-end gap-2 bg-dash-surface-hover/80 backdrop-blur-xl border border-dash-subtle rounded-[24px] p-2 transition-all focus-within:border-dash-primary/30 focus-within:ring-4 focus-within:ring-dash-primary/5 shadow-sm">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleCustomKeyDown}
        onPaste={onPaste}
        placeholder="发送消息..."
        rows={1}
        className="flex-1 bg-transparent border-none py-3 px-4 text-[15px] text-dash-primary placeholder:text-dash-tertiary focus:outline-none resize-none custom-scroll h-auto leading-relaxed"
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
              className="w-10 h-10 sm:w-11 sm:h-11 bg-dash-surface text-dash-secondary hover:text-dash-red hover:bg-dash-red/10 rounded-xl flex items-center justify-center transition-colors shadow-sm active:scale-95 border border-dash-subtle"
              title="Stop Generation"
            >
              <StopCircle className="w-5 h-5" />
            </motion.button>
          ) : (input.trim() || hasAttachments) ? (
              <motion.button
              key="send"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              type="submit"
              className="w-10 h-10 sm:w-11 sm:h-11 bg-dash-primary text-[#0B0D0F] hover:bg-white rounded-xl flex items-center justify-center transition-colors shadow-sm active:scale-95"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </motion.button>
          ) : (
            <motion.button
              key="voice"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              type="button"
              className="w-10 h-10 sm:w-11 sm:h-11 bg-transparent text-dash-tertiary hover:text-dash-primary hover:bg-dash-surface rounded-xl flex items-center justify-center transition-colors active:scale-95"
              title="Voice Input (Coming soon)"
            >
              <Mic className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
