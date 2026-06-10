import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatList } from './ui/chat-ui';
import { useAiAgent } from '../hooks/useAiAgent';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { useWealthStore } from '../hooks/useWealthStore';
import { useTranslation } from '../hooks/useTranslation';
import { MaterialIcon } from './ui/MaterialIcon';

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
  const { data, commitData } = useWealthStore();
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

  const handleApplySuggestedState = (patch: any, sourceChatIndex?: number) => {
    if (!patch || typeof patch !== 'object') return;
    
    const allowedKeys = [
      'metrics',
      'distributions',
      'goal',
      'insights'
    ];
    
    const filteredPatch: any = {};
    for (const key of allowedKeys) {
      if (patch[key] !== undefined) {
        if (key === 'distributions') {
          const dist = patch[key];
          if (dist && typeof dist === 'object') {
            const allowedDistKeys = [
              'liquidity',
              'expenses',
              'privateAssets',
              'fixedAssets',
              'options'
            ];
            const filteredDist: any = {};
            for (const dKey of allowedDistKeys) {
              if (dist[dKey] !== undefined) {
                filteredDist[dKey] = dist[dKey];
              }
            }
            filteredPatch.distributions = filteredDist;
          }
        } else {
          filteredPatch[key] = patch[key];
        }
      }
    }

    if (filteredPatch.distributions) {
      delete (filteredPatch.distributions as any).publicHoldings;
    }
    delete (filteredPatch as any).publicHoldingAccounts;
    delete (filteredPatch as any)._liveSources;
    delete (filteredPatch as any)._liveValuationVersion;
    delete (filteredPatch as any)._liveFetchedAt;

    commitData((prev: any) => ({
      ...prev,
      ...filteredPatch,
      metrics: { ...prev.metrics, ...(filteredPatch.metrics || {}) },
      distributions: {
        ...prev.distributions,
        ...(filteredPatch.distributions || {}),
        publicHoldings: prev.distributions?.publicHoldings || []
      },
      goal: filteredPatch.goal !== undefined ? filteredPatch.goal : prev.goal,
      insights: filteredPatch.insights !== undefined ? filteredPatch.insights : prev.insights
    }));

    if (sourceChatIndex !== undefined) {
      setChatHistory((prevHistory: any[]) => {
        const newHistory = [...prevHistory];
        if (newHistory[sourceChatIndex]) {
          newHistory[sourceChatIndex] = {
            ...newHistory[sourceChatIndex],
            suggestedStateApplied: true
          };
        }
        return newHistory;
      });
    }
  };

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
    <>
    {isDrawerOpen && (
      <div
        className="fixed inset-0 aw-drawer-backdrop z-[99]"
        onClick={() => setIsDrawerOpen(false)}
      />
    )}
    <div 
      className={`aw-drawer-shell aw-workbench-shell fixed inset-y-0 right-0 w-full sm:w-[500px] md:w-[600px] z-[100] transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col overflow-hidden ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
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
        <div className="absolute inset-0 z-[100] bg-aw-success/10 backdrop-blur-md border-2 border-dashed border-aw-success/50 flex items-center justify-center">
           <div className="aw-panel p-8 flex flex-col items-center pointer-events-none scale-105 transition-transform">
              <MaterialIcon name="upload_file" size={32} className="mb-4 text-aw-success animate-bounce" />
              <p className="aw-label aw-text-primary font-bold tracking-tight">{t('drawer.dropToUpload')}</p>
           </div>
        </div>
      )}
      
      <div className="aw-drawer-header aw-workbench-header px-4 py-3 sm:px-5 sm:py-4 border-b flex justify-between items-center relative z-10 shrink-0">
        <div className="flex items-center gap-3">
           <div className="aw-chart-state-icon w-8 h-8">
              <div className="w-3.5 h-3.5 rounded-full bg-aw-accent-mist"></div>
           </div>
           <div>
              <p className="aw-caption aw-text-tertiary font-mono uppercase mb-0.5">{t('drawer.terminalAiTitle')}</p>
              <h2 className="aw-label aw-text-primary font-semibold leading-tight tracking-tight">{t('drawer.agentName')}</h2>
           </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
           {chatHistory.length > 0 && (
              <div className="relative">
                 <button 
                   onClick={() => setShowDrawerClearConfirm(true)} 
                   className="aw-button aw-button-ghost !min-h-8 !px-3 text-aw-danger cursor-pointer"
                   title={t('drawer.clearScreen')}
                   aria-label={t('drawer.clearScreen')}
                 >
                   <MaterialIcon name="refresh" size={16} /> <span className="hidden sm:inline">{t('drawer.clearScreen')}</span>
                 </button>
                 
                 {showDrawerClearConfirm && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setShowDrawerClearConfirm(false)}></div>
                     <div className="aw-danger-panel absolute right-0 top-full mt-2 w-64 p-5 z-50 animate-in fade-in slide-in-from-top-2">
                        <p className="aw-caption aw-text-secondary mb-4 leading-relaxed font-medium">{t('drawer.clearConfirmText')}</p>
                        <div className="flex justify-end gap-2">
                           <button onClick={() => setShowDrawerClearConfirm(false)} className="aw-button aw-button-ghost !min-h-8 !px-3">{t('drawer.cancel')}</button>
                           <button onClick={() => { setChatHistory([]); setShowDrawerClearConfirm(false); }} className="aw-button !min-h-8 !px-3 border border-aw-danger text-aw-danger hover:bg-aw-danger/10">{t('drawer.confirmClear')}</button>
                        </div>
                     </div>
                   </>
                 )}
              </div>
           )}
           <button 
             onClick={() => setIsDrawerOpen(false)} 
             className="aw-icon-button w-11 h-11 sm:w-12 sm:h-12 ml-1 cursor-pointer"
             aria-label={t('settings.close')}
           >
             <MaterialIcon name="close" size={24} />
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
              msgs.push({ 
                role: 'assistant', 
                content: c.ai || '', 
                thinking: c.thinking, 
                hasMemoryUpdate: c.hasMemoryUpdate, 
                _liveSources: data?._liveSources, 
                timeTaken: c.timeTaken, 
                debugData: (c as any).debugData,
                aiSuggestedState: c.aiSuggestedState,
                suggestedStateApplied: c.suggestedStateApplied,
                sourceChatIndex: i
              });
           }
           return msgs;
        }), [chatHistory, isLoading, data?._liveSources])} 
        isTyping={isLoading} 
        onRegenerate={chatHistory.length > 0 ? handleRegenerate : undefined}
        onQuickPrompt={(prompt: string) => handleAiSubmit(prompt)}
        onApplySuggestedState={handleApplySuggestedState}
      />

      <div className="aw-drawer-footer aw-workbench-footer absolute bottom-0 left-0 right-0 z-40 px-4 sm:px-5 pb-5 pt-4 border-t pointer-events-none">
        <div className="mx-auto w-full max-w-4xl pointer-events-auto relative">
          
          {/* Memory Toggle */}
          <div className="absolute right-2 -top-10 flex items-center">
            <label className="aw-status-pill cursor-pointer group shadow-sm">
              <div className={`w-3.5 h-3.5 aw-mini-token flex items-center justify-center transition-colors ${syncProfile ? 'bg-aw-accent-mist border-none text-aw-text-inverse' : 'bg-aw-surface-3 border border-aw-border-subtle'}`}>
                 {syncProfile && <MaterialIcon name="check" size={16} />}
              </div>
              <input type="checkbox" className="hidden" checked={syncProfile} onChange={(e) => setSyncProfile(e.target.checked)} />
              <span className={`aw-caption uppercase font-mono font-semibold transition-colors ${syncProfile ? 'text-aw-accent-mist' : 'aw-text-tertiary group-hover:text-aw-accent-mist'}`}>{t('drawer.syncMemory')}</span>
            </label>
          </div>

          {/* Main Capsule Container */}
          <div className="aw-chat-input relative overflow-hidden flex flex-col">
            
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
                             <img src={`data:${att.mimeType};base64,${att.data}`} alt="upload" className="w-20 h-20 object-cover aw-panel-muted" />
                          ) : (
                             <div className="aw-panel-muted w-20 h-20 flex flex-col items-center justify-center p-2 aw-caption aw-text-secondary font-sans">
                                <MaterialIcon name="description" size={24} className="mb-1 aw-text-tertiary" />
                                <span className="truncate w-full text-center px-1 font-medium">{att.name}</span>
                             </div>
                          )}
                          <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} aria-label={t('drawer.removeAttachment')} className="aw-icon-button absolute -top-1.5 -right-1.5 bg-aw-bg text-aw-text-primary rounded-full w-5 h-5 min-w-5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <MaterialIcon name="close" size={16} />
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
                 className="aw-icon-button flex-shrink-0 w-11 h-11 ml-1 mb-0.5 active:scale-95"
                 aria-label={t('drawer.uploadFile')}
               >
                 <MaterialIcon name="attach_file" size={24} />
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
                    className="aw-chat-textarea w-full !px-2 custom-scroll"
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
                     className="aw-icon-button w-11 h-11 text-aw-danger border border-aw-border-subtle"
                     aria-label={t('drawer.stopGeneration')}
                   >
                     <MaterialIcon name="stop_circle" size={24} />
                   </motion.button>
                 ) : (
                   <motion.button
                     key="send"
                     initial={{ scale: 0.8, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     exit={{ scale: 0.8, opacity: 0 }}
                     type="button"
                     onClick={() => {(inputMsg.trim() || attachments.length > 0) && handleAiSubmit()}}
                     className={`w-11 h-11 flex items-center justify-center transition-all active:scale-95 ${inputMsg.trim() || attachments.length > 0 ? 'aw-button aw-button-primary !px-0' : 'aw-icon-button border border-aw-border-subtle cursor-default'}`}
                     aria-label={t('drawer.sendMessage')}
                   >
                     <MaterialIcon name="send" size={24} />
                   </motion.button>
                 )}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};
