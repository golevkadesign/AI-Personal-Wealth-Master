import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Zap, Bot, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { getSettings } from '../lib/settings';
import { motion } from 'motion/react';

export interface WidgetCopilotProps {
  isOpen: boolean;
  onClose: () => void;
  widgetTitle: string;
  widgetData: any;
  expertRole?: string;
  globalData?: any;
  onPromoteIntent: (prompt: string) => void;
  inline?: boolean;
}

export const WidgetCopilot: React.FC<WidgetCopilotProps> = ({
  isOpen,
  onClose,
  widgetTitle,
  widgetData,
  expertRole = "首席资产分析师",
  globalData,
  onPromoteIntent,
  inline = false
}) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
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

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const res = await fetch('/api/sandbox/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          history: messages,
          message: userMsg,
          widgetContext: widgetData,
          widgetTitle: widgetTitle,
          expertRole: expertRole,
          globalState: globalData,
          settings: getSettings()
        })
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
      setMessages(prev => [...prev, { role: 'model', content: `**Error:** ${e.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

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

  const containerClass = inline 
    ? "flex flex-col h-full bg-transparent border-0 min-h-0" 
    : "fixed inset-0 z-[60] bg-[#090A0C]/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 transition-opacity";

  const modalClass = inline
    ? "w-full flex-1 flex flex-col min-h-0"
    : "arbitra-modal-panel w-full max-w-lg flex flex-col min-h-0 max-h-[85vh] sm:max-h-[800px]";

  return (
    <div className={containerClass}>
      <div className={modalClass}>
        
        {/* Header */}
        {!inline && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-dash-subtle bg-transparent shrink-0">
            <div className="flex flex-col">
              <p className="arbitra-text-mono text-[10px] uppercase tracking-[0.2em] arbitra-text-tertiary mb-1">
                CONTEXTUAL EXPERT
              </p>
              <h3 className="text-lg font-medium arbitra-text-primary flex items-center gap-2">
                <Bot className="w-4 h-4 arbitra-text-gold" />
                {widgetTitle} Sandbox
              </h3>
              <p className="text-xs arbitra-text-secondary mt-1">
                Role: {expertRole}
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors arbitra-focus-ring ml-2 shrink-0 self-start mt-1 text-slate-400 hover:text-white"
              aria-label="关闭"
            >
              <X className="w-5 h-5 text-current" />
            </button>
          </div>
        )}

        {/* Chat Area */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-5 custom-scroll bg-transparent min-h-[350px]">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center px-4 opacity-70">
               <p className="text-sm arbitra-text-secondary leading-relaxed">
                 A secure local sandbox environment.<br/><br/>
                 You can freely explore scenarios, constraints, and projections regarding <span className="arbitra-text-primary font-medium">{widgetTitle}</span>.<br/>
                 Changes are isolated until you decide to apply them.
               </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <motion.div 
                key={idx} 
                layout 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-[16px] px-4 py-3.5 text-[14px] leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-dash-primary/10 border border-dash-primary/20 arbitra-text-primary rounded-br-sm shadow-sm' 
                    : 'arbitra-panel border-dash-subtle arbitra-text-secondary rounded-bl-sm prose prose-invert prose-p:leading-relaxed prose-sm max-w-none shadow-sm'
                }`}>
                  {msg.role === 'user' ? (
                     msg.content
                  ) : (
                     <div className="markdown-body">
                        <Markdown>{msg.content}</Markdown>
                        {isTyping && idx === messages.length - 1 && (
                          <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-dash-primary/80 animate-pulse rounded-sm" />
                        )}
                     </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
          
          {isTyping && (
             <div className="flex justify-start">
               <div className="arbitra-panel border-dash-subtle rounded-[16px] rounded-bl-sm px-4 py-3 flex items-center gap-3 shadow-sm">
                 <Loader2 className="w-4 h-4 animate-spin arbitra-text-gold" />
                 <span className="text-xs arbitra-text-tertiary font-mono uppercase tracking-widest">Synthesizing...</span>
               </div>
             </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-dash-subtle bg-surface flex flex-col gap-3 shrink-0">
          <div className="relative flex items-center bg-surface-hover border border-dash-subtle rounded-[12px] focus-within:border-dash-primary/40 focus-within:ring-1 focus-within:ring-dash-primary/20 transition-all">
            <input
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               placeholder={`Ask ${expertRole}...`}
               className="w-full bg-transparent border-none py-3 pl-4 pr-12 text-[14px] arbitra-text-primary placeholder:text-dash-tertiary focus:outline-none"
            />
            <button
               onClick={handleSend}
               disabled={!input.trim() || isTyping}
               className="absolute right-1.5 p-2 rounded-[8px] arbitra-btn-ghost text-dash-secondary hover:text-dash-primary disabled:opacity-30 disabled:hover:text-dash-secondary arbitra-focus-ring"
               aria-label="Send"
            >
               <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
          
          <div className="flex justify-end items-center mt-1">
             {messages.length > 0 && messages[messages.length-1].role === 'model' && (
               <motion.button
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 onClick={handlePromote}
                 className="flex items-center gap-2 px-4 py-2 rounded-[10px] arbitra-btn-base arbitra-btn-secondary transition-all text-xs font-medium uppercase tracking-wide"
               >
                 <Zap className="w-3.5 h-3.5 arbitra-text-gold" />
                 Apply Strategy to Portfolio
               </motion.button>
             )}
          </div>
        </div>

      </div>
    </div>
  );
};
