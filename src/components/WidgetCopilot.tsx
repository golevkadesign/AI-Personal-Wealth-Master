import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { getSettings } from '../lib/settings';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../hooks/useTranslation';
import { useWealthStore } from '../hooks/useWealthStore';
import { MaterialIcon } from './ui/MaterialIcon';

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

const ReticleIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <div className={`aw-chart-state-icon shrink-0 ${className}`}>
    <MaterialIcon name="explore" size={20} className="text-aw-accent-mist" />
  </div>
);

export const WidgetCopilot: React.FC<WidgetCopilotProps> = ({
  isOpen,
  onClose,
  widgetTitle,
  widgetData,
  expertRole,
  globalData,
  onPromoteIntent,
  inline = false,
  initialMessage
}) => {
  const { t } = useTranslation();
  const resolvedExpertRole = expertRole || t('charts.portfolioStrategist');
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
      // Extract global variables for Agent analysis
      const globalStateFromZustand = useWealthStore.getState().data;
      const memSnapshots = useWealthStore.getState().agentMemorySnapshots || [];
      const currentLivePortfolio = globalStateFromZustand?.distributions?.publicHoldings || [];
      
      let snapshotDiff = {};
      if (memSnapshots.length >= 2) {
         const currentSnap = memSnapshots[0];
         const previousSnap = memSnapshots[1];
         snapshotDiff = {
            totalMarketValueChange: (currentSnap.totalMarketValue || 0) - (previousSnap.totalMarketValue || 0),
            timeDiffMs: currentSnap.timestamp - previousSnap.timestamp
         };
      }

      const res = await fetch('/api/sandbox/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          history: currentHistory,
          message: userMsg,
          widgetContext: {
             ...widgetData,
             currentLivePortfolio,
             previousSnapshots: memSnapshots,
             snapshotDiff
          },
          widgetTitle: widgetTitle,
	          expertRole: resolvedExpertRole,
          globalState: globalStateFromZustand,
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
    : "fixed inset-0 z-[100] aw-drawer-backdrop flex justify-end transition-all duration-300";

  const modalClass = inline
    ? "w-full flex-1 flex flex-col min-h-0"
    : "w-full sm:max-w-[500px] h-screen flex flex-col aw-drawer-shell aw-workbench-shell overflow-hidden transition-all duration-300 relative";

  return (
    <div className={containerClass} onClick={!inline ? onClose : undefined}>
      <div className={modalClass} onClick={(e) => e.stopPropagation()}>
        
        {/* Header (Compass logo + title + expertRole with active status dot) */}
	        <div className="aw-drawer-header aw-workbench-header flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <ReticleIcon className="w-9 h-9" />
            <div className="flex flex-col">
              <h3 className="aw-body font-semibold aw-text-primary flex items-center gap-1.5 leading-tight">
                {widgetTitle}
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="aw-status-dot aw-status-success animate-pulse" />
                <span className="aw-caption aw-text-tertiary uppercase font-mono font-semibold">
	                  {resolvedExpertRole}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="aw-icon-button"
            aria-label={t('settings.close')}
          >
            <MaterialIcon name="close" size={20} />
          </button>
        </div>

        {/* Scrollable Conversation area and metadata snap */}
	        <div ref={scrollRef} onScroll={handleScroll} className="aw-workbench-scroll flex-1 overflow-y-auto p-4 space-y-4 custom-scroll min-h-[300px]">
          
          {/* Data Snapshot (With collapsible button toggle) */}
          <AnimatePresence>
            {showSnapshot && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="aw-structured-card mb-4 overflow-hidden p-3 font-sans"
              >
                <div className="flex items-center justify-between border-b border-aw-border-subtle pb-2 mb-2.5 font-mono">
                  <div className="aw-caption font-bold text-aw-accent-mist uppercase">
                    {t('copilot.dataSnapshot')}
                  </div>
                  <button 
                    onClick={() => setShowSnapshot(false)} 
                    className="aw-icon-button !h-7 !min-w-7"
                  >
                    <MaterialIcon name="close" size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Card 1: Top Holding */}
                  <div className="aw-structured-card-muted p-2.5">
                    <div className="aw-caption uppercase font-mono aw-text-tertiary">{t('copilot.topHolding')}</div>
                    <div className="aw-body font-bold aw-text-primary mt-1 font-sans">{topHoldingSymbol}</div>
                    <div className="aw-caption font-mono text-aw-accent-mist mt-0.5">{topHoldingProportion}</div>
                  </div>

                  {/* Card 2: Allocation */}
                  <div className="aw-structured-card-muted p-2.5">
                    <div className="aw-caption uppercase font-mono aw-text-tertiary">{t('copilot.allocation')}</div>
                    <div className="aw-body font-bold aw-text-primary mt-1 font-sans">{allocationPercent}</div>
                    <div className="aw-caption font-mono aw-text-tertiary mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{allocationCategory}</div>
                  </div>

                  {/* Card 3: Risk Level */}
                  <div className="aw-structured-card-muted p-2.5">
                    <div className="aw-caption uppercase font-mono aw-text-tertiary">{t('copilot.riskLevel')}</div>
                    <div className="aw-body font-bold aw-text-primary mt-1 font-sans">{t('copilot.moderate')}</div>
                    <div className="w-full bg-aw-surface-3 h-1 rounded-full mt-2 overflow-hidden">
                      <div className="bg-aw-accent-mist h-full w-[60%]" />
                    </div>
                  </div>

                  {/* Card 4: Currency */}
                  <div className="aw-structured-card-muted p-2.5">
                    <div className="aw-caption uppercase font-mono aw-text-tertiary">{t('copilot.currency')}</div>
                    <div className="aw-body font-bold aw-text-primary mt-1 font-sans">{currencyCode}</div>
                    <div className="aw-caption font-mono aw-text-tertiary mt-0.5">{t('copilot.assetBase')}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12 opacity-80">
               <MaterialIcon name="explore" size={32} className="text-aw-accent-mist mb-4 opacity-45 animate-pulse" />
               <p className="aw-caption aw-text-tertiary leading-relaxed max-w-[280px]">
                 {t('copilot.sandboxActive')} <span className="aw-text-primary font-medium">{widgetTitle}</span>{t('copilot.sandboxActive2')}
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
                  <div className="flex items-center gap-1.5 aw-caption font-mono aw-text-tertiary uppercase mb-1 font-bold">
                    {isUser ? (
                      <>
                        <div className="aw-chart-state-icon !h-5 !w-5 shrink-0">
                          <MaterialIcon name="person" size={16} className="text-aw-accent-mist" />
                        </div>
                        <span className="text-aw-accent-mist">{t('copilot.you')}</span>
                      </>
                    ) : (
                      <>
                        <ReticleIcon className="w-4.5 h-4.5 !p-0.5 bg-transparent border-0" />
	                        <span className="text-aw-accent-mist">{resolvedExpertRole}</span>
                      </>
                    )}
                  </div>

                  <div className="aw-chat-bubble-assistant p-4 font-sans">
                    {isUser ? (
                      <p className="aw-body leading-relaxed text-aw-accent-mist whitespace-pre-wrap font-sans">
                        {msg.content}
                      </p>
                    ) : (
                      <div className="aw-body leading-relaxed aw-text-primary space-y-3 font-sans aw-copilot-markdown">
                        <Markdown>{msg.content}</Markdown>
                        {isTyping && idx === messages.length - 1 && (
                          <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-aw-accent-mist animate-pulse rounded-sm" />
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
               <div className="aw-structured-card-muted px-4 py-2.5 flex items-center gap-3 max-w-[200px]">
                 <div className="flex gap-1.5 items-center">
                   <span className="aw-status-dot aw-status-success animate-bounce [animation-delay:-0.3s]" />
                   <span className="aw-status-dot aw-status-success animate-bounce [animation-delay:-0.15s]" />
                   <span className="aw-status-dot aw-status-success animate-bounce" />
                 </div>
                 <span className="aw-caption aw-text-tertiary font-bold uppercase">{t('copilot.expertResearching')}</span>
               </div>
             </div>
          )}
        </div>

        {/* Input Composer area */}
	        <div className="aw-drawer-footer aw-workbench-footer p-4 border-t flex flex-col gap-3 shrink-0">
          <div className="relative flex items-center aw-chat-input !rounded-xl !pl-3">
            <input
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               placeholder={t('copilot.placeholder')}
               className="aw-body w-full bg-transparent border-none py-3 aw-text-primary placeholder:text-aw-text-tertiary focus:outline-none"
            />
            <button
               onClick={handleSend}
               disabled={!input.trim() || isTyping}
               className="aw-button aw-button-primary !min-h-8 !px-2.5 shrink-0 disabled:opacity-40 m-[5px]"
               aria-label={t('drawer.sendMessage')}
            >
               <MaterialIcon name="send" size={16} />
            </button>
          </div>
          
          {/* Centered Promote strategy link */}
          <div className="flex items-center justify-center mt-0.5">
             <button
               onClick={handlePromote}
               className="aw-button aw-button-ghost !min-h-8 cursor-pointer"
             >
               <MaterialIcon name="trending_up" size={16} />
               <span>{t('copilot.promoteToGlobal')}</span>
             </button>
          </div>
        </div>

      </div>
    </div>
  );
};
