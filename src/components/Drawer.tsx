import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, FileText, RefreshCw, Paperclip, Send, StopCircle, Check } from 'lucide-react';
import { ChatList } from './ui/chat-ui';
import { useAiAgent } from '../hooks/useAiAgent';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { useWealthStore } from '../hooks/useWealthStore';
import { useTranslation } from '../hooks/useTranslation';

// Shared utility
function fileToBase64(file: File): Promise<{ mimeType: string, data: string, name: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
       const base64String = reader.result as string;
       const [prefix, baseData] = base64String.split(',');
       const mimeType = prefix.match(/:(.*?);/)?.[1] || file.type;
       resolve({ mimeType, data: baseData, name: file.name });
    };
    reader.onerror = reject;
  });
}

export const Drawer = ({ isDrawerOpen, setIsDrawerOpen, setIsSynthesizing }: any) => {
  const { t } = useTranslation();
  const { data } = useWealthStore();
  const [showDrawerClearConfirm, setShowDrawerClearConfirm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    inputMsg,
    setInputMsg,
    syncProfile,
    setSyncProfile,
    isLoading,
    attachments,
    setAttachments,
    chatHistory,
    setChatHistory,
    handleStop,
    handleRegenerate,
    handleAiSubmit,
  } = useAiAgent({ setIsSynthesizing });

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      const files = Array.from(e.clipboardData.files);
      const newAtts = await Promise.all(files.map(file => fileToBase64(file)));
      setAttachments(prev => [...prev, ...newAtts]);
    }
  };

  const { pendingGlobalIntent, clearPendingIntent } = useInteractionStore();

  useEffect(() => {
    if (pendingGlobalIntent) {
      handleAiSubmit(pendingGlobalIntent);
      clearPendingIntent();
    }
  }, [pendingGlobalIntent, handleAiSubmit, clearPendingIntent]);

  useEffect(() => {
    const handleAddAttachment = (e: any) => {
      const att = e.detail;
      setAttachments(prev => [...prev, att]);
    };
    window.addEventListener('add-attachment', handleAddAttachment);
    return () => {
       window.removeEventListener('add-attachment', handleAddAttachment);
    };
  }, [setAttachments]);

  return (
    <div 
      className={`fixed inset-y-0 right-0 w-full sm:w-[500px] md:w-[600px] arbitra-drawer-panel z-[100] transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const files = Array.from(e.dataTransfer.files);
          const newAtts = await Promise.all(files.map(file => fileToBase64(file)));
          setAttachments(prev => [...prev, ...newAtts]);
        }
      }}
    >
      {isDragging && (
        <div className="absolute inset-0 z-[100] bg-dash-green/10 backdrop-blur-md border-2 border-dashed border-dash-green/50 flex items-center justify-center">
           <div className="bg-dash-surface p-8 rounded-2xl shadow-2xl flex flex-col items-center pointer-events-none border border-dash-subtle scale-105 transition-transform">
              <Upload className="w-12 h-12 mb-4 text-dash-green animate-bounce" />
              <p className="text-dash-primary font-bold text-lg tracking-tight">{t('drawer.dropToUpload')}</p>
           </div>
        </div>
      )}
      
      <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-dash-subtle flex justify-between items-center bg-[#0B0D0F]/80 backdrop-blur-md relative z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-[10px] bg-dash-surface flex items-center justify-center border border-dash-subtle shadow-sm">
              <div className="w-3.5 h-3.5 rounded-full bg-dash-primary shadow-[0_0_10px_rgba(201,178,132,0.4)]"></div>
           </div>
           <div>
              <p className="arbitra-text-mono text-[9px] uppercase tracking-[0.2em] arbitra-text-tertiary mb-0.5">{t('drawer.terminalAiTitle')}</p>
              <h2 className="text-[15px] font-semibold arbitra-text-primary leading-tight tracking-tight">{t('drawer.agentName')}</h2>
           </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
           {chatHistory.length > 0 && (
              <div className="relative">
                 <button 
                   onClick={() => setShowDrawerClearConfirm(true)} 
                   className="arbitra-btn-base arbitra-btn-secondary !text-[10px] !px-2.5 !py-1.5 arbitra-focus-ring hover:!text-dash-red hover:!border-dash-red/30 hover:!bg-dash-red/10 flex items-center gap-1.5"
                   title={t('drawer.clearScreen')}
                   aria-label="Clear Screen"
                 >
                   <RefreshCw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t('drawer.clearScreen')}</span>
                 </button>
                 
                 {showDrawerClearConfirm && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setShowDrawerClearConfirm(false)}></div>
                     <div className="absolute right-0 top-full mt-2 w-64 arbitra-panel border-dash-red/30 p-5 z-50 animate-in fade-in slide-in-from-top-2">
                        <p className="text-xs arbitra-text-secondary mb-4 leading-relaxed font-medium">{t('drawer.clearConfirmText')}</p>
                        <div className="flex justify-end gap-2">
                           <button onClick={() => setShowDrawerClearConfirm(false)} className="arbitra-btn-base arbitra-btn-ghost !text-xs !px-3 !py-1.5 hover:bg-dash-surface-hover arbitra-focus-ring">{t('drawer.cancel')}</button>
                           <button onClick={() => { setChatHistory([]); setShowDrawerClearConfirm(false); }} className="arbitra-btn-base arbitra-btn-primary !text-xs !px-3 !py-1.5 !bg-rose-600/20 !text-rose-500 !border-rose-500/30 hover:!bg-rose-600 hover:!text-white arbitra-focus-ring">{t('drawer.confirmClear')}</button>
                        </div>
                     </div>
                   </>
                 )}
              </div>
           )}
           <button 
             onClick={() => setIsDrawerOpen(false)} 
             className="arbitra-btn-base arbitra-btn-ghost w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center p-3 !gap-0 rounded-[12px] arbitra-focus-ring ml-1 text-slate-400 hover:text-white"
             aria-label="关闭"
           >
             <X className="w-5 h-5 sm:w-6 sm:h-6 text-current" />
           </button>
        </div>
      </div>

      <ChatList 
        messages={React.useMemo(() => chatHistory.flatMap((c, i) => {
           const msgs = [];
           if (c.user || (c.attachments && c.attachments.length > 0)) {
              msgs.push({ role: 'user', content: c.user || '', attachments: c.attachments });
           }
           if (c.ai || (i === chatHistory.length - 1 && isLoading) || c.thinking) {
              msgs.push({ role: 'assistant', content: c.ai || '', thinking: c.thinking, hasMemoryUpdate: c.hasMemoryUpdate, _liveSources: data?._liveSources, timeTaken: c.timeTaken, debugData: (c as any).debugData });
           }
           return msgs;
        }), [chatHistory, isLoading, data?._liveSources])} 
        isTyping={isLoading} 
        onRegenerate={chatHistory.length > 0 ? handleRegenerate : undefined}
        onQuickPrompt={(prompt: string) => handleAiSubmit(prompt)}
      />

      <div className="absolute bottom-0 left-0 right-0 z-40 px-4 sm:px-6 pb-6 pt-10 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none">
        <div className="mx-auto w-full max-w-4xl pointer-events-auto relative">
          
          {/* Memory Toggle */}
          <div className="absolute right-2 -top-10 flex items-center">
            <label className="flex items-center gap-2 cursor-pointer group bg-dash-surface-hover/90 backdrop-blur-md border border-white/5 py-1.5 px-3 rounded-full shadow-sm hover:border-dash-primary/30 transition-colors">
              <div className={`w-3.5 h-3.5 rounded-[4px] flex items-center justify-center transition-colors ${syncProfile ? 'bg-dash-primary shadow-[0_0_8px_rgba(201,178,132,0.4)] border-none' : 'bg-[#1A1D20] border border-white/20'}`}>
                 {syncProfile && <Check className="w-2.5 h-2.5 text-black stroke-[4px]" />}
              </div>
              <input type="checkbox" className="hidden" checked={syncProfile} onChange={(e) => setSyncProfile(e.target.checked)} />
              <span className={`text-[10px] uppercase font-mono tracking-wider font-semibold transition-colors ${syncProfile ? 'text-dash-primary' : 'text-dash-tertiary group-hover:text-dash-secondary'}`}>{t('drawer.syncMemory')}</span>
            </label>
          </div>

          {/* Main Capsule Container */}
          <div className="relative arbitra-panel overflow-hidden p-2 flex flex-col focus-within:border-dash-primary/40 focus-within:ring-1 focus-within:ring-dash-primary/20 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            
            <input type="file" multiple accept="image/*,.pdf,.txt" ref={fileInputRef} onChange={async e => {
                if (e.target.files) {
                  const files = Array.from(e.target.files);
                  const newAtts = await Promise.all(files.map(file => fileToBase64(file)));
                  setAttachments(prev => [...prev, ...newAtts]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }
            }} className="hidden" />

            {/* Attachments Gallery */}
            <AnimatePresence>
               {attachments.length > 0 && (
                   <div className="flex flex-wrap gap-3 px-3 pt-3 pb-1">
                     {attachments.map((att, i) => (
                        <motion.div 
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          key={att.name + i} 
                          className="relative group"
                        >
                          {att.mimeType.startsWith('image/') ? (
                             <img src={`data:${att.mimeType};base64,${att.data}`} alt="upload" className="w-20 h-20 object-cover rounded-[16px] border border-white/10 shadow-sm" />
                          ) : (
                             <div className="w-20 h-20 bg-white/5 rounded-[16px] border border-white/10 flex flex-col items-center justify-center p-2 text-[10px] text-dash-secondary font-sans shadow-sm">
                                <FileText className="w-6 h-6 mb-1 text-dash-tertiary" />
                                <span className="truncate w-full text-center px-1 font-medium">{att.name}</span>
                             </div>
                          )}
                          <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} aria-label="Remove attachment" className="absolute -top-1.5 -right-1.5 bg-black text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg border border-white/10 z-10 arbitra-focus-ring">
                            <X className="w-2.5 h-2.5 stroke-[3]" />
                          </button>
                        </motion.div>
                     ))}
                   </div>
               )}
            </AnimatePresence>

            {/* Input Row */}
            <div className="flex items-end gap-1 w-full relative">
               <button 
                 onClick={() => fileInputRef.current?.click()} 
                 className="flex-shrink-0 w-11 h-11 ml-1 mb-0.5 rounded-[12px] arbitra-text-tertiary hover:text-dash-primary hover:bg-surface-hover transition-colors flex items-center justify-center active:scale-95 arbitra-focus-ring"
                 aria-label="Upload File"
               >
                 <Paperclip className="w-[20px] h-[20px]" />
               </button>

               <div className="flex-1 relative flex flex-col justify-center min-h-[48px]">
                  <textarea
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if ((inputMsg.trim() || attachments.length > 0) && !isLoading) {
                          handleAiSubmit();
                        }
                      }
                    }}
                    onPaste={handlePaste}
                    placeholder={t('copilot.placeholder')}
                    rows={1}
                    className="w-full bg-transparent border-none py-3 px-2 text-[15px] sm:text-[16px] arbitra-text-primary placeholder:text-dash-tertiary focus:outline-none resize-none custom-scroll h-auto leading-relaxed"
                    style={{ minHeight: '48px', maxHeight: '150px' }}
                    ref={(el) => {
                       if (el) {
                         el.style.height = 'auto';
                         el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
                       }
                    }}
                  />
               </div>

               {/* Send / Stop button */}
               <div className="flex-shrink-0 self-end mb-1 mr-1">
                 {isLoading ? (
                   <motion.button
                     key="stop"
                     initial={{ scale: 0.8, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     exit={{ scale: 0.8, opacity: 0 }}
                     type="button"
                     onClick={handleStop}
                     className="w-11 h-11 bg-dash-surface-hover border border-dash-subtle rounded-[12px] text-dash-secondary hover:text-dash-red hover:border-dash-red/30 transition-colors flex items-center justify-center shadow-sm arbitra-focus-ring"
                     aria-label="Stop Generation"
                   >
                     <StopCircle className="w-5 h-5" />
                   </motion.button>
                 ) : (
                   <motion.button
                     key="send"
                     initial={{ scale: 0.8, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     exit={{ scale: 0.8, opacity: 0 }}
                     type="button"
                     onClick={() => {(inputMsg.trim() || attachments.length > 0) && handleAiSubmit()}}
                     className={`w-11 h-11 flex items-center justify-center rounded-[12px] shadow-sm transition-all arbitra-focus-ring active:scale-95 ${inputMsg.trim() || attachments.length > 0 ? 'bg-dash-primary text-[#0B0D0F] hover:bg-dash-primary/90' : 'bg-surface-hover border border-dash-subtle text-dash-tertiary cursor-default'}`}
                     aria-label="Send Message"
                   >
                     <Send className="w-4 h-4 ml-0.5" />
                   </motion.button>
                 )}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
