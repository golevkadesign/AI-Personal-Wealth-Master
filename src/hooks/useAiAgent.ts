import { useState, useRef, useEffect } from 'react';
import { getDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getSettings } from '../lib/settings';
import { sanitizeTerminalState } from '../lib/sanitizer';
import { Attachment } from '../App';
import { useWealthStore } from './useWealthStore';
import { normalizeSDUISchema } from '../lib/sdui-normalizer';
import { filterAiWritableStatePatch } from '../lib/ai-state-permissions';
import { parseSseBuffer } from '../lib/sse-parser';
import { deriveTerminalStatePatchFromProfile } from '../lib/profile-to-terminal-state';
import { LIVE_VALUATION_VERSION } from '../types/terminal';

export function useAiAgent({ setIsSynthesizing }: any) {
  const { user, data, commitData } = useWealthStore();
  const [inputMsg, setInputMsg] = useState('');
  const [syncProfile, setSyncProfile] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isChatLoaded = useRef(false);

  const [chatHistory, setChatHistory] = useState<{ user: string, ai: string, attachments: Attachment[], thinking?: string, isThinkingExpanded?: boolean, hasMemoryUpdate?: boolean, _liveSources?: string[], timeTaken?: number, debugData?: any, aiSuggestedState?: any, suggestedStateApplied?: boolean }[]>([]);

  useEffect(() => {
    const handleClearChat = () => {
        setChatHistory([]);
    };
    window.addEventListener('clear-chat-history', handleClearChat);
    return () => window.removeEventListener('clear-chat-history', handleClearChat);
  }, []);

  useEffect(() => {
     if (user?.uid) {
        const loadHistory = async () => {
           try {
              const snap = await getDoc(doc(db, "userProfiles", user.uid));
              if (snap.exists() && snap.data().chatHistory) {
                  setChatHistory(snap.data().chatHistory);
                  localStorage.setItem(`ai_terminal_chat_${user.uid}`, JSON.stringify(snap.data().chatHistory));
                  isChatLoaded.current = true;
                  return;
              }
           } catch(e: any) { 
              if (e.message && e.message.includes('offline')) {
                 console.log("Offline mode: using local cache for chat history.");
              } else {
                 console.error("Failed to load chat history from firestore:", e);
                 try {
                     const { handleFirestoreError, OperationType } = await import('../lib/firebase');
                     handleFirestoreError(e, OperationType.GET, `userProfiles/${user.uid}`);
                 } catch (err) {}
              }
           }

           // Fallback to localStorage if not found in Firestore
           const stored = localStorage.getItem(`ai_terminal_chat_${user.uid}`);
           let targetStored = stored;
           
           if (!stored) {
              const oldStored = localStorage.getItem('ai_terminal_chat');
              if (oldStored) {
                  targetStored = oldStored;
                  localStorage.setItem(`ai_terminal_chat_${user.uid}`, oldStored);
                  localStorage.removeItem('ai_terminal_chat');
              }
           }

           if (targetStored) {
              try {
                const parsed = JSON.parse(targetStored);
                setChatHistory(parsed.map((item: any) => ({
                  ...item,
                  attachments: item.attachments ? item.attachments : (item.img ? [{ mimeType: 'image/jpeg', data: item.img.split(',')[1], name: 'legacy_img.jpg' }] : [])
                })));
              } catch { setChatHistory([]); }
           } else {
              setChatHistory([]);
           }
           isChatLoaded.current = true;
        };
        loadHistory();
     } else {
        isChatLoaded.current = false;
        setChatHistory([]);
     }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid && isChatLoaded.current) {
       localStorage.setItem(`ai_terminal_chat_${user.uid}`, JSON.stringify(chatHistory));
       const timeoutId = setTimeout(() => {
           // Prevent Firestore 1MB document size limit by stripping very large attachments and truncating thinking logs
           (async () => {
             const { storage } = await import('../lib/firebase');
             const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
             
             const chatToSync = await Promise.all(chatHistory.map(async c => {
                 const newC = { ...c };
                 if (newC.thinking) {
                     newC.thinking = newC.thinking.substring(0, 5000) + (newC.thinking.length > 5000 ? '\n...[truncated]' : '');
                 }
                 newC.attachments = await Promise.all(newC.attachments?.map(async att => {
                      const newAtt = { ...att };
                      // If attachment is larger than 100KB, remove its raw data from persistent storage to save space, keeping just metadata
                      if (newAtt.data && newAtt.data.length > 100000) {
                          if (!newAtt.url) {
                              try {
                                  const storageRef = ref(storage, `chat_attachments/${user.uid}/${Date.now()}_${Math.random().toString(36).substring(7)}`);
                                  await uploadString(storageRef, newAtt.data, 'base64', { contentType: newAtt.mimeType });
                                  newAtt.url = await getDownloadURL(storageRef);
                              } catch (e) {
                                  console.error("Storage upload failed", e);
                              }
                          }
                          newAtt.data = "";
                          newAtt.isTruncated = true;
                      }
                      return newAtt;
                 }) || []);
                 Object.keys(newC).forEach(key => (newC as any)[key] === undefined && delete (newC as any)[key]);
                 return newC;
             }));
             
             try {
                const { doc, setDoc } = await import('firebase/firestore');
                const { db, handleFirestoreError, OperationType, isFirestoreQuotaExceeded } = await import('../lib/firebase');
                if (isFirestoreQuotaExceeded) return;
                try {
                    await setDoc(doc(db, "userProfiles", user.uid), { chatHistory: chatToSync }, { merge: true });
                } catch (e) {
                    handleFirestoreError(e, OperationType.WRITE, `userProfiles/${user.uid}`);
                }
             } catch(e) {
                console.error("Failed to save chat to firestore:", e);
             }
           })();
       }, 2000);
       return () => clearTimeout(timeoutId);
    }
  }, [chatHistory, user?.uid]);
  
  const handleStop = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
      }
      setIsLoading(false);
  };

  const handleRegenerate = () => {
      if (isLoading) return;
      setChatHistory(prev => {
         const h = [...prev];
         if (h.length === 0) return h;
         const last = h.pop();
         if (last && last.user) {
             setTimeout(() => handleAiSubmit(last.user, last.attachments), 50);
         }
         return h;
      });
  };

  const handleAiSubmit = async (overrideMsg?: string, overrideAtts?: Attachment[]) => {
    const startTime = Date.now();
    const actualMsg = typeof overrideMsg === 'string' ? overrideMsg : inputMsg;
    
    let attsToSend = overrideAtts || [...attachments];

    // Upload large attachments to Firebase Storage before sending
    if (user?.uid) {
        attsToSend = await Promise.all(attsToSend.map(async (att) => {
            if (att.data && att.data.length > 50000 && !att.url) {
                try {
                    const { storage } = await import('../lib/firebase');
                    const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
                    const storageRef = ref(storage, `chat_attachments/${user.uid}/${Date.now()}_${Math.random().toString(36).substring(7)}`);
                    await uploadString(storageRef, att.data, 'base64', { contentType: att.mimeType });
                    const url = await getDownloadURL(storageRef);
                    return { ...att, url, data: '', isTruncated: true };
                } catch (e) {
                    console.error("Storage upload failed pre-send", e);
                    return att;
                }
            }
            return att;
        }));
    }

    if (!actualMsg.trim() && attsToSend.length === 0) return;

    const userMsg = actualMsg;
    
    setChatHistory(prev => [...prev, { user: userMsg, ai: '', attachments: attsToSend }]);
    if (typeof overrideMsg !== 'string') setInputMsg('');
    setAttachments([]);
    setIsLoading(true);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // 1. Gather Context from BFF & Strip heavy data
      const stripHeavyData = (obj: any): any => {
         if (!obj || typeof obj !== 'object') return obj;
         if (Array.isArray(obj)) return obj.map(stripHeavyData);
         const newObj: any = {};
         for (const key in obj) {
            if (key === 'chartOptions' || (typeof obj[key] === 'string' && obj[key].startsWith('data:image/'))) {
               newObj[key] = '[Stripped for Agent Payload]';
            } else {
               newObj[key] = stripHeavyData(obj[key]);
            }
         }
         return newObj;
      };
      
      const cleanedContextData = stripHeavyData(data);
      const publicHoldingAccounts = cleanedContextData?.publicHoldingAccounts || cleanedContextData?.distributions?.publicHoldingAccounts;
      if (publicHoldingAccounts && publicHoldingAccounts.length > 0) {
        cleanedContextData.livePortfolioAccounts = publicHoldingAccounts;
      }

      const contextRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           message: userMsg,
           history: chatHistory.map(c => ({ user: c.user, ai: c.ai })),
           contextData: cleanedContextData,
           settings: getSettings(),
           userId: user?.uid,
           customApiKey: localStorage.getItem('custom_gemini_api_key') || undefined,
           attachments: attsToSend,
           skipMemoryUpdate: !syncProfile
        }),
        signal
      });

      if (!contextRes.ok) {
         const errText = await contextRes.text();
         throw new Error(`BFF Request Failed (${contextRes.status}): ${errText}`);
      }
      
      let bffData: any = null;
      let serverError: string | null = null;
      let thinkingProgress = "";
      let streamedAi = "";
      const reader = contextRes.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      
      if (reader) {
        let buffer = '';
        while (true) {
          if (signal.aborted) throw new Error('AbortError');
          const { done, value } = await reader.read();
          
          if (done) break;
          const chunkText = decoder.decode(value, { stream: true });
          const { events, remainingBuffer } = parseSseBuffer(buffer, chunkText);
          buffer = remainingBuffer;
          
          for (const parsed of events) {
             if (parsed.type === '__parse_error') {
                console.error("[SSE Parser Error]:", parsed.error, parsed.dataStr);
                continue;
             }
             if (parsed.type === 'progress') {
                      thinkingProgress += parsed.message + '\n';
                      if (parsed.message.includes("各节点数据已回流") || parsed.message.includes("CEO 级全局 Synthesizer")) {
                          setIsSynthesizing?.(true);
                      }
                      setChatHistory(prev => {
                         const newHist = [...prev];
                         newHist[newHist.length - 1].thinking = thinkingProgress.trim();
                         if (newHist[newHist.length - 1].isThinkingExpanded === undefined) {
                            newHist[newHist.length - 1].isThinkingExpanded = false;
                         }
                         return newHist;
                      });
                   } else if (parsed.type === 'partial_result') {
                      bffData = { ...bffData, ...parsed.data };
                      // Eagerly merge Live Portfolio to bypass AI latency and ensure badge
                      const extData = parsed.data.externalData;
                       if (extData) {
                           commitData((prevData: any) => {
                               const nextData = { ...prevData };
                               let updated = false;

                               if (Array.isArray(extData.livePortfolioAccounts) && extData.livePortfolioAccounts.length > 0) {
                                   nextData.publicHoldingAccounts = extData.livePortfolioAccounts;
                                   nextData._liveSources = ['longbridge'];
                                   nextData._liveValuationVersion = LIVE_VALUATION_VERSION;
                                   nextData._liveFetchedAt = Date.now();
                                   updated = true;
                               }

                               if (Array.isArray(extData.livePortfolio) && extData.livePortfolio.length > 0) {
                                   nextData.distributions = {
                                       ...prevData.distributions,
                                       publicHoldings: extData.livePortfolio
                                   };
                                   nextData._liveSources = ['longbridge'];
                                   updated = true;
                               }

                               return updated ? nextData : prevData;
                           });
                       }

                      if (parsed.data.updatedProfile && Object.keys(parsed.data.updatedProfile).length > 0) {
                          setChatHistory(prev => {
                             const newHist = [...prev];
                             newHist[newHist.length - 1].hasMemoryUpdate = true;
                             return newHist;
                          });
                      }
                   } else if (parsed.type === 'result') {
                      bffData = parsed.data;
                   } else if (parsed.type === 'summary_chunk') {
                      streamedAi += parsed.text;
                      let displayText = streamedAi;
                      
                      // 动态侦测 JSON 块边界
                      const jsonMatch = streamedAi.indexOf('```json');
                      if (jsonMatch !== -1) {
                         const textBefore = streamedAi.substring(0, jsonMatch).trim();
                         // 核心修复 1：如果大模型跳过文本直接吐 JSON，不要展示空白，给用户明确的加载感知
                         displayText = textBefore || "> ⚙️ 正在编译底层终端状态树 (JSON Payload)... 稍候...";
                      }
                      
                      setChatHistory(prev => {
                         const newHist = [...prev];
                         newHist[newHist.length - 1].ai = displayText;
                         return newHist;
                      });
                   } else if (parsed.type === 'error') {
                      serverError = parsed.error || parsed.message || "Unknown Backend Server Error (无明确错误信息)";
                   }
                // } catch(e: any) {
                   // console.error("SSE JSON Parse Error for line:", e);
                   // 如果是严重格式错误，不要继续静默
                // }
             }
          // }
        }
      }

      if (signal.aborted) throw new Error('AbortError');
      if (serverError) throw new Error(serverError);
      if (!bffData) throw new Error("未能从服务器获取核心分析数据。(Timeout or Stream Empty)");

      // 1.5 Handle permanent RAG profile updates
      if (bffData.updatedProfile && Object.keys(bffData.updatedProfile).length > 0 && syncProfile) {
          try {
              if (user?.uid) {
                  try {
                      const { handleFirestoreError, OperationType, isFirestoreQuotaExceeded } = await import('../lib/firebase');
                      if (!isFirestoreQuotaExceeded) {
                          await setDoc(doc(db, "userProfiles", user.uid), { userProfile: bffData.updatedProfile }, { merge: true });
                      }
                  } catch (e) {
                      const { handleFirestoreError, OperationType } = await import('../lib/firebase');
                      handleFirestoreError(e, OperationType.WRITE, `userProfiles/${user.uid}`);
                  }
              }
              
              const profilePatch = deriveTerminalStatePatchFromProfile(bffData.updatedProfile);
              commitData((prev: any) => ({
                 ...prev,
                 ...profilePatch,
                 userProfile: bffData.updatedProfile,
                 metrics: { ...prev.metrics, ...(profilePatch.metrics || {}) },
                 distributions: {
                   ...prev.distributions,
                   ...(profilePatch.distributions || {}),
                   publicHoldings: prev.distributions?.publicHoldings || []
                 },
                 goal: profilePatch.goal || prev.goal,
                 userPersona: profilePatch.userPersona || prev.userPersona
              }));
          } catch(e) {
              console.error("Failed to commit profile updates:", e);
          }
      }
      
      // 1.6 Eagerly merge Live Portfolio to bypass AI latency and ensure badge
      const extDataFinal = bffData.externalData;
       if (extDataFinal) {
           commitData((prevData: any) => {
               const nextData = { ...prevData };
               let updated = false;

               if (Array.isArray(extDataFinal.livePortfolioAccounts) && extDataFinal.livePortfolioAccounts.length > 0) {
                   nextData.publicHoldingAccounts = extDataFinal.livePortfolioAccounts;
                   nextData._liveSources = ['longbridge'];
                   nextData._liveValuationVersion = LIVE_VALUATION_VERSION;
                   nextData._liveFetchedAt = Date.now();
                   updated = true;
               }

               if (Array.isArray(extDataFinal.livePortfolio) && extDataFinal.livePortfolio.length > 0) {
                   nextData.distributions = {
                       ...prevData.distributions,
                       publicHoldings: extDataFinal.livePortfolio
                   };
                   nextData._liveSources = ['longbridge'];
                   updated = true;
               }

               return updated ? nextData : prevData;
           });
       }


      if (bffData.isQuickReply) {
         setChatHistory(prev => {
           const newHist = [...prev];
           newHist[newHist.length - 1].ai = bffData.expertAnalysis['快速回应'];
           return newHist;
         });
         setIsLoading(false);
         return;
      }
      
      // 3. 全量 JSON 解析 (核心修复 2：极度鲁棒的正则引擎与优雅降级)
      const txt = streamedAi || bffData.expertAnalysis?.['综合统筹结论'] || "";

      let sduiPayload: any = null;
      let suggestedStatePatch: any = null;

      try {
        // 策略：匹配所有的代码块，强制提取最后一个（因为 AI 的 JSON Patch 必定在最后）
        const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
        let lastMatchedJson = null;
        let match;
        while ((match = jsonBlockRegex.exec(txt)) !== null) {
            lastMatchedJson = match[1];
        }

        let rawPayload = txt;
        if (lastMatchedJson) {
            rawPayload = lastMatchedJson;
        }

        const startIdx = rawPayload.indexOf('{');
        const endIdx = rawPayload.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
            sduiPayload = JSON.parse(rawPayload.substring(startIdx, endIdx + 1));
        }
      } catch(e) { 
        console.error("Parse SDUI error:", e); 
      }

      if (sduiPayload?.updateGlobalState) {
         let suggest: any = {};
         if (sduiPayload.updateGlobalState.metrics) {
            suggest.metrics = sduiPayload.updateGlobalState.metrics;
         }
         if (sduiPayload.updateGlobalState.distributions) {
            suggest.distributions = sduiPayload.updateGlobalState.distributions;
         }
         if (Object.keys(suggest).length > 0) {
            suggestedStatePatch = suggest;
            if (bffData) {
               bffData.suggestedStatePatch = suggest;
            }
         }
      }

      setChatHistory(prev => {
        const newHist = [...prev];
        const displayAi = txt.substring(0, txt.indexOf('```json') !== -1 ? txt.indexOf('```json') : txt.length).trim();
        newHist[newHist.length - 1].ai = displayAi || (sduiPayload ? "> ⚙️ 高级视图数据已同步至终端..." : txt);
        newHist[newHist.length - 1].debugData = bffData;
        if (suggestedStatePatch) {
           newHist[newHist.length - 1].aiSuggestedState = suggestedStatePatch;
        }
        return newHist;
      });

      if (sduiPayload?.updateGlobalState) {
         // Filter out any unauthorized properties utilizing the source-aware permission gating whitelist
         const filteredUpdate = filterAiWritableStatePatch(sduiPayload.updateGlobalState, {
            allowMemoryWrite: syncProfile,
            allowTrustedFactWrite: false, // updateGlobalState by the AI is defaulted to untrusted/suggestions
            livePortfolio: bffData?.externalData?.livePortfolio,
            livePortfolioAccounts: bffData?.externalData?.livePortfolioAccounts
         });
         // Sanitize AI's raw update payload BEFORE merging, removing nulls/bad types but keeping omitted fields untouched
         const sanitizedUpdate = sanitizeTerminalState(filteredUpdate);

         if (sanitizedUpdate.dynamicWidgets) {
           sanitizedUpdate.dynamicWidgets = normalizeSDUISchema(sanitizedUpdate.dynamicWidgets);
         }
         
         if (sanitizedUpdate.dashboardSchema) {
           const normalized = normalizeSDUISchema(sanitizedUpdate.dashboardSchema);
           if (normalized && normalized.length > 0) {
             sanitizedUpdate.dashboardSchema = normalized;
           } else {
             delete sanitizedUpdate.dashboardSchema;
           }
         }

         commitData((prevData: any) => ({ 
            ...prevData, 
            ...sanitizedUpdate, 
            metrics: { ...prevData.metrics, ...(sanitizedUpdate.metrics || {}) },
            distributions: { 
                ...prevData.distributions, 
                ...(sanitizedUpdate.distributions || {}),
            // Ensure AI doesn't accidentally overwrite deterministic live portfolio
            ...(bffData.externalData?.livePortfolio ? { publicHoldings: bffData.externalData.livePortfolio } : { publicHoldings: prevData.distributions?.publicHoldings })
        },
        insights: { ...prevData.insights, ...(sanitizedUpdate.insights || {}) },
        goal: sanitizedUpdate.goal || prevData.goal,
        _liveSources: bffData.externalData?.livePortfolio ? ['longbridge'] : prevData._liveSources
     }));
      }

    } catch (error: any) {
      if (error.message === 'AbortError' || error.name === 'AbortError') {
          console.log('AI Generation Stopped.');
          return;
      }
      setChatHistory(prev => {
        const newHist = [...prev];
        let errMsg = error.message;
        if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
           errMsg = "API 当前负载较高 (503 Service Unavailable)。需求激增通常是暂时的，请您稍后重试。";
        } else if (errMsg.includes('API key not valid') || errMsg.includes('API_KEY_INVALID')) {
           errMsg = "获取到的 API Key 无效。请点击环境的 Settings -> Secrets 面板，检查并清除或同步更新您自定义的 API_KEY。";
        } else if (errMsg.includes('exceeded your current quota') || errMsg.includes('rate limits') || errMsg.includes('Quota exceeded') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('monthly spending cap')) {
           errMsg = "API 额度已耗尽 (Resource Exhausted - Quota Exceeded)。您配置的 API Key 免费额度/速率或可用资金余额已达上限，请检查计费层级或更换 Key 后重试。";
        } else if (errMsg.includes('{')) {
            try {
                const parsed = JSON.parse(errMsg.substring(errMsg.indexOf('{')));
                if (parsed.error?.message) errMsg = parsed.error.message;
            } catch {}
        }
        const currentAiText = newHist[newHist.length - 1].ai || '';
        newHist[newHist.length - 1].ai = currentAiText + (currentAiText ? '\n\n' : '') + `⚠️ **通信中断**: ${errMsg}`;
        return newHist;
      });
    } finally {
      const endTime = Date.now();
      const diff = endTime - startTime;
      setChatHistory(prev => {
        const newHist = [...prev];
        if (newHist.length > 0) {
           newHist[newHist.length - 1].timeTaken = diff;
        }
        return newHist;
      });
      setIsLoading(false);
      setIsSynthesizing?.(false);
      abortControllerRef.current = null;
    }
  };

  return {
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
  };
}
