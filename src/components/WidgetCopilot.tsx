import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Compass } from 'lucide-react';
import Markdown from 'react-markdown';
import { getSettings } from '../lib/settings';
import { motion, AnimatePresence } from 'motion/react';

export interface WidgetCopilotProps {
  isOpen: boolean;
  onClose: () => void;
  widgetTitle: string;
  widgetData: any;
  expertRole?: string;
  globalData?: any;
  onPromoteIntent: (prompt: string) => void;
  inline?: boolean;
  initialMessage?: string;
}

// Stylized Compass Reticle Icon for high-end advisory terminal header and advisor avatar
const ReticleIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <div className={`relative flex items-center justify-center shrink-0 rounded-full border border-[#C9B284]/30 bg-[#16181A] p-1.5 shadow-sm ${className}`}>
    <svg viewBox="0 0 100 100" className="w-full h-full text-[#C9B284]" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="4" strokeDasharray="8 8" className="opacity-40 animate-[spin_40s_linear_infinite]" />
      <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="6" />
      <circle cx="50" cy="50" r="12" stroke="currentColor" strokeWidth="6" />
      <path d="M50 8 L50 92" stroke="currentColor" strokeWidth="6" />
      <path d="M8 50 L92 50" stroke="currentColor" strokeWidth="6" />
      <circle cx="50" cy="50" r="5" fill="#6B8E6B" className="animate-pulse" />
    </svg>
  </div>
);

export const WidgetCopilot: React.FC<WidgetCopilotProps> = ({
  isOpen,
  onClose,
  widgetTitle,
  widgetData,
  expertRole = "首席组合策略师",
  globalData,
  onPromoteIntent,
  inline = false,
  initialMessage
}) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  // 💥 1. 防冲突滚动侦测
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // 设定 60px 的触底容差阈值。如果用户往上滑超过 60px，立刻切断自动滚动。
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setIsAutoScroll(isAtBottom);
  };

  // 💥 2. 极其平滑的自动锚定
  useEffect(() => {
    if (isAutoScroll && scrollRef.current) {
      // 采用 smooth 行为，让流出时的视窗跟随像水流一样平滑
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth' 
      });
    }
  }, [messages, isTyping, isAutoScroll]);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // When closed or unmounted, abort the stream
    if (!isOpen && abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    return () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };
  }, [isOpen]);

  const executeChatMessage = async (userMsg: string, currentHistory: { role: 'user' | 'model', content: string }[]) => {
    setIsTyping(true);
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/sandbox/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          history: currentHistory,
          message: userMsg,
          widgetContext: widgetData,
          widgetTitle: widgetTitle,
          expertRole: expertRole,
          globalState: globalData,
          settings: getSettings()
        }),
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) {
        let errText = "Unknown Server Error";
        try {
           const errData = await res.json();
           errText = errData.error || res.statusText;
        } catch(e) {
           errText = res.statusText;
        }
        throw new Error(`[HTTP ${res.status}] ${errText}`);
      }
      if (!res.body) throw new Error("No response body stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      setMessages(prev => [...prev, { role: 'model', content: '' }]);

      let buffer = ''; // 新增：粘包缓冲器
      
      while (true) {
        if (abortControllerRef.current.signal.aborted) throw new Error('AbortError');
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // 将最后可能不完整的字符串放回 buffer，等待下一个 chunk 补齐
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr.trim() === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.text) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const lastIndex = newMsgs.length - 1;
                  const last = newMsgs[lastIndex];
                  if (last && last.role === 'model') {
                    // 💥 修复复读机Bug：必须生成一个全新的对象，不能直接 += 修改原对象
                    newMsgs[lastIndex] = { ...last, content: last.content + data.text };
                  }
                  return newMsgs;
                });
              }
            } catch (e) {
              // Parse error or stream structure issue, ignore
            }
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || e.message === 'AbortError') return;
      setMessages(prev => [...prev, { role: 'model', content: `**Error:** ${e.message}` }]);
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMsg = input.trim();
    setInput('');
    const newHistory = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(newHistory);
    await executeChatMessage(userMsg, messages);
  };

  const autoSentRef = useRef(false);
  useEffect(() => {
    if (isOpen && initialMessage && !autoSentRef.current) {
      autoSentRef.current = true;
      const newHistory = [{ role: 'user' as const, content: initialMessage }];
      setMessages(newHistory);
      executeChatMessage(initialMessage, []);
    }
  }, [isOpen, initialMessage]);

  const handlePromote = () => {
    const lastModelMessage = [...messages].reverse().find(m => m.role === 'model');
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    
    let prompt = `我在分析【${widgetTitle}】时得出了以下设想：\n`;
    if (lastUserMessage) {
       prompt += `我的核心诉求：${lastUserMessage.content}\n`;
    }
    if (lastModelMessage) {
       prompt += `系统沙盒结论：${lastModelMessage.content}\n`;
    }
    prompt += `\n请结合全局配置，帮我生成具体的执行策略和系统更新。`;

    onPromoteIntent(prompt);
    onClose();
  };

  if (!isOpen) return null;

  // ----------------- Extract data from context for Snapshot -----------------
  const publicHoldings = globalData?.distributions?.publicHoldings || [];
  const calculateValue = (v: any) => {
    if (v.value !== undefined) return Number(v.value);
    if (v.marketValue !== undefined) return Number(v.marketValue);
    const qty = Number(v.quantity) || 0;
    const price = Number(v.currentPrice) || Number(v.costPrice) || 0;
    return qty * price;
  };

  const sortedHoldings = [...publicHoldings].sort((a: any, b: any) => calculateValue(b) - calculateValue(a));
  const topItem = sortedHoldings[0];

  // 1. Top Holding (Dynamic)
  const topHoldingSymbol = widgetData?.holdingDetail?.symbol || topItem?.symbol || topItem?.name?.split(' ')[0] || "AAPL";
  const publicTotal = publicHoldings.reduce((sum: number, item: any) => sum + calculateValue(item), 0);
  const topHoldingProportion = widgetData?.holdingDetail?.proportion || (publicTotal > 0 && topItem 
    ? ((calculateValue(topItem) / publicTotal) * 100).toFixed(2) + '%' 
    : '7.42%');

  // 2. Allocation (Dynamic)
  const allDistributionValues = Object.values(globalData?.distributions || {}).flat() as any[];
  const totalAssets = allDistributionValues.reduce((sum: number, item: any) => sum + calculateValue(item), 0);
  const allocationPercent = totalAssets > 0 && publicTotal > 0
    ? ((publicTotal / totalAssets) * 100).toFixed(1) + '%'
    : '38.6%';
  const allocationCategory = widgetData?.holdingDetail?.category || topItem?.category || 'US Equities';

  // 3. Currency (Dynamic)
  const currencyCode = widgetData?.holdingDetail?.currency || topItem?.currency || globalData?.distributions?.publicHoldings?.[0]?.currency || 'USD';

  // Modal / Container Classes (Redesigned contextual Expert Panel layout)
  const containerClass = inline 
    ? "flex flex-col h-full bg-transparent border-0 min-h-0" 
    : "fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px] flex items-center justify-end p-4 md:p-6 transition-all duration-300";

  const modalClass = inline
    ? "w-full flex-1 flex flex-col min-h-0"
    : "w-full sm:max-w-[465px] h-[calc(100vh-2rem)] sm:h-[calc(100vh-4rem)] max-h-[820px] flex flex-col bg-[#111315]/95 border border-[#C9B284]/15 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 relative";

  return (
    <div className={containerClass} onClick={!inline ? onClose : undefined}>
      <style>{`
        .copilot-markdown p { margin-bottom: 0.75rem; text-align: justify; }
        .copilot-markdown p:last-child { margin-bottom: 0px; }
        .copilot-markdown strong { color: #C9B284; font-weight: 600; }
        .copilot-markdown ul, .copilot-markdown ol { margin: 0.5rem 0 0.75rem 1.25rem; }
        .copilot-markdown ul { list-style-type: disc; }
        .copilot-markdown ol { list-style-type: decimal; }
        .copilot-markdown li { margin-bottom: 0.4rem; font-size: 13px; color: #E7D7B0; line-height: 1.6; }
        .copilot-markdown li::marker { color: #8C8270; font-weight: bold; }
        .copilot-markdown blockquote { border-left: 2px solid #C9B284; padding-left: 0.75rem; color: #8C8270; font-family: monospace; }
        .custom-scroll::-webkit-scrollbar { width: 5px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(201, 178, 132, 0.15); border-radius: 999px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(201, 178, 132, 0.3); }
      `}</style>

      <div className={modalClass} onClick={(e) => e.stopPropagation()}>
        
        {/* Header (Compass logo + title + expertRole with active status dot) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#C9B284]/15 bg-[#121416] shrink-0">
          <div className="flex items-center gap-3">
            <ReticleIcon className="w-9 h-9" />
            <div className="flex flex-col">
              <h3 className="text-[15px] font-medium text-[#E7D7B0] font-sans flex items-center gap-1.5 leading-tight">
                {widgetTitle}
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6B8E6B] animate-pulse" />
                <span className="text-[11px] text-[#8C8270] uppercase font-mono tracking-wider font-semibold">
                  {expertRole}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#C9B284]/10 transition-colors text-[#8C8270] hover:text-[#E7D7B0] shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-current" />
          </button>
        </div>

        {/* Scrollable Conversation area and metadata snap */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll bg-[#121415]/65 min-h-[300px]">
          
          {/* Data Snapshot (With collapsible button toggle) */}
          <AnimatePresence>
            {showSnapshot && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden mb-4 rounded-xl border border-[#C9B284]/15 bg-[#16181A] p-3 text-xs shadow-sm font-sans"
              >
                <div className="flex items-center justify-between border-b border-[#C9B284]/10 pb-2 mb-2.5 font-mono">
                  <div className="text-[10px] font-bold text-[#C9B284] uppercase tracking-wider">
                    Data Snapshot
                  </div>
                  <button 
                    onClick={() => setShowSnapshot(false)} 
                    className="text-[#8C8270] hover:text-[#C9B284] p-0.5 rounded transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Card 1: Top Holding */}
                  <div className="rounded-lg bg-[#111214] border border-[#C9B284]/10 p-2.5">
                    <div className="text-[9px] uppercase font-mono tracking-wider text-[#8C8270]">Top Holding</div>
                    <div className="text-sm font-bold text-[#E7D7B0] mt-1 font-sans">{topHoldingSymbol}</div>
                    <div className="text-[10px] font-mono text-[#C9B284] mt-0.5">{topHoldingProportion}</div>
                  </div>

                  {/* Card 2: Allocation */}
                  <div className="rounded-lg bg-[#111214] border border-[#C9B284]/10 p-2.5">
                    <div className="text-[9px] uppercase font-mono tracking-wider text-[#8C8270]">Allocation</div>
                    <div className="text-sm font-bold text-[#E7D7B0] mt-1 font-sans">{allocationPercent}</div>
                    <div className="text-[10px] font-mono text-[#8C8270] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{allocationCategory}</div>
                  </div>

                  {/* Card 3: Risk Level */}
                  <div className="rounded-lg bg-[#111214] border border-[#C9B284]/10 p-2.5">
                    <div className="text-[9px] uppercase font-mono tracking-wider text-[#8C8270]">Risk Level</div>
                    <div className="text-sm font-bold text-[#E7D7B0] mt-1 font-sans">Moderate</div>
                    <div className="w-full bg-neutral-800 h-1 rounded-full mt-2 overflow-hidden">
                      <div className="bg-[#C9B284] h-full w-[60%]" />
                    </div>
                  </div>

                  {/* Card 4: Currency */}
                  <div className="rounded-lg bg-[#111214] border border-[#C9B284]/10 p-2.5">
                    <div className="text-[9px] uppercase font-mono tracking-wider text-[#8C8270]">Currency</div>
                    <div className="text-sm font-bold text-[#E7D7B0] mt-1 font-sans">{currencyCode}</div>
                    <div className="text-[10px] font-mono text-[#8C8270] mt-0.5">Asset Base</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12 opacity-80">
               <Compass className="w-8 h-8 text-[#C9B284] mb-4 opacity-40 animate-pulse" />
               <p className="text-xs text-[#8C8270] leading-relaxed max-w-[280px]">
                 Local sandbox workspace active. Freely explore specific scenarios and metrics regarding <span className="text-[#E7D7B0] font-medium">{widgetTitle}</span>.
               </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex flex-col items-start gap-1 w-full"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#8C8270]/90 uppercase tracking-wider mb-1 font-bold">
                    {isUser ? (
                      <>
                        <div className="w-4 h-4 rounded-full border border-[#C9B284]/25 bg-[#16181A] flex items-center justify-center p-0.5 shrink-0">
                          <User className="w-2.5 h-2.5 text-[#C9B284]" />
                        </div>
                        <span className="text-[#C9B284]">You</span>
                      </>
                    ) : (
                      <>
                        <ReticleIcon className="w-4.5 h-4.5 !p-0.5 bg-transparent border-0" />
                        <span className="text-[#C9B284]">{expertRole}</span>
                      </>
                    )}
                    <span className="text-[#8C8270]/60">•</span>
                    <span className="text-[#8C8270]/50 font-normal">10:32 AM</span>
                  </div>

                  <div className="w-full bg-[#16181A] border border-[#C9B284]/15 rounded-2xl p-4 shadow-sm font-sans">
                    {isUser ? (
                      <p className="text-[13px] leading-relaxed text-[#C9B284] whitespace-pre-wrap font-sans">
                        {msg.content}
                      </p>
                    ) : (
                      <div className="text-[13px] leading-relaxed text-[#E7D7B0] space-y-3 font-sans copilot-markdown">
                        <Markdown>{msg.content}</Markdown>
                        {isTyping && idx === messages.length - 1 && (
                          <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-[#C9B284] animate-pulse rounded-sm" />
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
          
          {isTyping && (
             <div className="flex justify-start font-mono">
               <div className="bg-[#101113] border border-[#C9B284]/15 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-md max-w-[200px]">
                 <div className="flex gap-1.5 items-center">
                   <span className="w-1.5 h-1.5 rounded-full bg-[#C9B284]/50 animate-bounce [animation-delay:-0.3s]" />
                   <span className="w-1.5 h-1.5 rounded-full bg-[#C9B284]/80 animate-bounce [animation-delay:-0.15s]" />
                   <span className="w-1.5 h-1.5 rounded-full bg-[#C9B284] animate-bounce" />
                 </div>
                 <span className="text-[9.5px] text-[#A39167] font-bold tracking-wider uppercase">专家正在研究</span>
               </div>
             </div>
          )}
        </div>

        {/* Input Composer area */}
        <div className="p-4 border-t border-[#C9B284]/15 bg-[#121416] flex flex-col gap-3 shrink-0">
          <div className="relative flex items-center bg-[#16181A] border border-[#C9B284]/15 rounded-xl focus-within:border-[#C9B284]/40 transition-all pl-3">
            <input
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               placeholder="Ask a follow-up about this widget..."
               className="w-full bg-transparent border-none py-3 text-[13px] text-[#E7D7B0] placeholder:text-[#8C8270] focus:outline-none"
            />
            <button
               onClick={handleSend}
               disabled={!input.trim() || isTyping}
               className="p-2.5 shrink-0 text-[#111315] disabled:text-[#8C8270] bg-[#C9B284] disabled:bg-[#C9B284]/15 m-[5px] rounded-lg transition-all"
               aria-label="Send"
            >
               <Send className="w-3.5 h-3.5 transform -rotate-45 translate-x-px -translate-y-[0.5px]" strokeWidth={2.5} />
            </button>
          </div>
          
          {/* Centered Promote strategy link */}
          <div className="flex items-center justify-center mt-0.5">
             <button
               onClick={handlePromote}
               className="flex items-center gap-1.5 text-xs text-[#C9B284] hover:text-[#E7D7B0] transition-colors font-semibold tracking-wide"
             >
               <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
               </svg>
               <span>Promote to Global Strategy</span>
             </button>
          </div>
        </div>

      </div>
    </div>
  );
};
