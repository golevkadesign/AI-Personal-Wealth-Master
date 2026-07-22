import { useState, useRef, useEffect, useCallback, type SetStateAction } from 'react';
import { getDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getSettings } from '../lib/settings';
import { sanitizeTerminalState } from '../lib/sanitizer';
import { Attachment } from '../App';
import { useWealthStore } from './useWealthStore';
import { normalizeSDUISchema } from '../lib/sdui-normalizer';
import { normalizeDynamicWidgetsForDashboard } from '../lib/sdui-intake-policy';
import { filterAiWritableStatePatch } from '../lib/ai-state-permissions';
import { parseSseBuffer } from '../lib/sse-parser';
import { deriveTerminalStatePatchFromProfile } from '../lib/profile-to-terminal-state';
import { getApiEndpoint } from '../lib/api-endpoints';
import {
  AiAgentProfileWriteMode,
  resolveAiAgentProfileWritePolicy,
} from '../lib/ai-profile-write-policy';
import { runWorkbenchChatResult } from '../lib/workbench-client';
import { LIVE_VALUATION_VERSION } from '../types/terminal';
import type { WorkbenchSessionSpec } from '../types/workbench';
import { useTranslation } from './useTranslation';

function normalizeMarketContextForStore(marketContext: any) {
  if (!marketContext || typeof marketContext !== 'object') return marketContext;

  const hasInstruments = Array.isArray(marketContext.instruments);
  const hasKeyInstruments = Array.isArray(marketContext.keyInstruments);

  if (!hasInstruments && hasKeyInstruments) {
    return {
      ...marketContext,
      instruments: marketContext.keyInstruments
    };
  }

  return marketContext;
}

const AGENT_HISTORY_LIMIT = 6;
const AGENT_TEXT_LIMIT = 1800;
const AGENT_CONTEXT_STRING_LIMIT = 3000;
const AGENT_CONTEXT_ARRAY_LIMIT = 60;
const AGENT_CONTEXT_DEPTH_LIMIT = 7;
const AGENT_REQUEST_TIMEOUT_MS = 290000;

type AiChatHistoryItem = {
  user: string;
  ai: string;
  attachments: Attachment[];
  thinking?: string;
  isThinkingExpanded?: boolean;
  hasMemoryUpdate?: boolean;
  _liveSources?: string[];
  timeTaken?: number;
  debugData?: any;
  aiSuggestedState?: any;
  suggestedStateApplied?: boolean;
};

type UseAiAgentOptions = {
  setIsSynthesizing?: (value: boolean) => void;
  historyScope?: string;
  persistHistory?: boolean;
  contextAugment?: any | (() => any);
  profileWriteMode?: AiAgentProfileWriteMode;
  workbenchNativeSession?: WorkbenchSessionSpec | null;
};

type AiAgentRuntimeState = {
  inputMsg: string;
  syncProfile: boolean;
  isLoading: boolean;
  attachments: Attachment[];
  chatHistory: AiChatHistoryItem[];
  abortController: AbortController | null;
};

const aiAgentRuntimeByScope = new Map<string, AiAgentRuntimeState>();

function getRuntimeScopeKey(userId: string | undefined, historyScope: string) {
  return `${userId || 'anonymous'}:${historyScope || 'default'}`;
}

function getAiAgentRuntime(scopeKey: string): AiAgentRuntimeState {
  const existing = aiAgentRuntimeByScope.get(scopeKey);
  if (existing) return existing;

  const runtime: AiAgentRuntimeState = {
    inputMsg: '',
    syncProfile: true,
    isLoading: false,
    attachments: [],
    chatHistory: [],
    abortController: null,
  };
  aiAgentRuntimeByScope.set(scopeKey, runtime);
  return runtime;
}

function resolveStateAction<T>(action: SetStateAction<T>, previous: T): T {
  return typeof action === 'function'
    ? (action as (value: T) => T)(previous)
    : action;
}

function getChatStorageKey(userId: string, historyScope?: string) {
  if (!historyScope || historyScope === 'default') return `ai_terminal_chat_${userId}`;
  return `ai_terminal_chat_${userId}_${encodeURIComponent(historyScope)}`;
}

function normalizeStoredChatHistory(value: unknown): AiChatHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item: any) => ({
    ...item,
    attachments: item.attachments
      ? item.attachments
      : (item.img ? [{ mimeType: 'image/jpeg', data: item.img.split(',')[1], name: 'legacy_img.jpg' }] : []),
  }));
}

function compactAgentText(value: unknown, limit = AGENT_TEXT_LIMIT): string {
  if (typeof value !== 'string') return '';
  if (value.includes('<!DOCTYPE html') || value.includes('<html')) {
    if (value.includes('502') || value.includes('Server Error')) {
      return '[Previous assistant response omitted: backend returned a temporary 502 HTML error page.]';
    }
    return '[Previous assistant response omitted: HTML error page.]';
  }
  return value.length > limit ? `${value.slice(0, limit)}\n...[truncated]` : value;
}

function compactAgentHistory(history: { user: string; ai: string }[]) {
  return history.slice(-AGENT_HISTORY_LIMIT).map((item) => ({
    user: compactAgentText(item.user),
    ai: compactAgentText(item.ai),
  }));
}

function compactAgentContext(value: any, depth = 0, seen = new WeakSet<object>()): any {
  if (value == null || typeof value !== 'object') {
    if (typeof value === 'string') {
      if (value.startsWith('data:image/')) return '[Stripped image payload]';
      return compactAgentText(value, AGENT_CONTEXT_STRING_LIMIT);
    }
    return value;
  }

  if (seen.has(value)) return '[Circular]';
  if (depth >= AGENT_CONTEXT_DEPTH_LIMIT) return '[Max depth reached]';
  seen.add(value);

  if (Array.isArray(value)) {
    const compacted = value.slice(0, AGENT_CONTEXT_ARRAY_LIMIT).map((item) => compactAgentContext(item, depth + 1, seen));
    if (value.length > AGENT_CONTEXT_ARRAY_LIMIT) {
      compacted.push(`[${value.length - AGENT_CONTEXT_ARRAY_LIMIT} additional items truncated]`);
    }
    return compacted;
  }

  const omittedKeys = new Set([
    'chartOptions',
    'dashboardSchema',
    'debugData',
    'thinking',
    'rawText',
    'img',
    'image',
    'base64',
    'data',
  ]);
  const next: any = {};
  for (const key of Object.keys(value)) {
    if (omittedKeys.has(key)) {
      next[key] = '[Stripped for Agent Payload]';
      continue;
    }
    next[key] = compactAgentContext(value[key], depth + 1, seen);
  }
  return next;
}

function formatAgentErrorMessage(error: any, didTimeout: boolean, t: (key: string) => string): string {
  if (didTimeout) {
    return t('chat.errors.timeout');
  }

  const raw = error?.message || String(error || 'Unknown error');
  const statusMatch = raw.match(/BFF Request Failed \((\d+)\)/);
  const status = statusMatch?.[1];
  const isHtmlError = raw.includes('<!DOCTYPE html') || raw.includes('<html');

  if (status === '502' || raw.includes('502')) {
    return t('chat.errors.backend502');
  }
  if (status === '504' || raw.includes('504')) {
    return t('chat.errors.backend504');
  }
  if (isHtmlError) {
    return `${t('chat.errors.htmlPrefix')}${status ? ` (${status})` : ''}${t('chat.errors.htmlSuffix')}`;
  }
  if (raw.includes('503') || raw.includes('high demand') || raw.includes('UNAVAILABLE')) {
    return t('chat.errors.overloaded');
  }
  if (raw.includes('API key not valid') || raw.includes('API_KEY_INVALID')) {
    return t('chat.errors.invalidApiKey');
  }
  if (raw.includes('exceeded your current quota') || raw.includes('rate limits') || raw.includes('Quota exceeded') || raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('monthly spending cap')) {
    return t('chat.errors.quota');
  }
  if (raw.includes('{')) {
    try {
      const parsed = JSON.parse(raw.substring(raw.indexOf('{')));
      if (parsed.error?.message) return parsed.error.message;
    } catch {}
  }
  return raw;
}

export function useAiAgent({
  setIsSynthesizing,
  historyScope = 'default',
  persistHistory = true,
  contextAugment,
  profileWriteMode = 'direct',
  workbenchNativeSession = null,
}: UseAiAgentOptions) {
  const { user, data, commitData } = useWealthStore();
  const { t, language } = useTranslation();
  const runtimeScopeKey = getRuntimeScopeKey(user?.uid, historyScope);
  const runtime = getAiAgentRuntime(runtimeScopeKey);
  const [inputMsgState, setInputMsgState] = useState(runtime.inputMsg);
  const [syncProfileState, setSyncProfileState] = useState(runtime.syncProfile);
  const [isLoadingState, setIsLoadingState] = useState(runtime.isLoading);
  const [attachmentsState, setAttachmentsState] = useState<Attachment[]>(runtime.attachments);
  const [chatHistoryState, setChatHistoryState] = useState<AiChatHistoryItem[]>(runtime.chatHistory);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(false);
  const isChatLoaded = useRef(false);
  const isDefaultHistoryScope = !historyScope || historyScope === 'default';
  const historyStorageKey = user?.uid ? getChatStorageKey(user.uid, historyScope) : null;

  const inputMsg = inputMsgState;
  const syncProfile = syncProfileState;
  const profileWritePolicy = resolveAiAgentProfileWritePolicy({
    syncProfile,
    profileWriteMode,
  });
  const isLoading = isLoadingState;
  const attachments = attachmentsState;
  const chatHistory = chatHistoryState;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setInputMsg = useCallback((action: SetStateAction<string>) => {
    const targetRuntime = getAiAgentRuntime(runtimeScopeKey);
    const next = resolveStateAction(action, targetRuntime.inputMsg);
    targetRuntime.inputMsg = next;
    if (isMountedRef.current) setInputMsgState(next);
  }, [runtimeScopeKey]);

  const setSyncProfile = useCallback((action: SetStateAction<boolean>) => {
    const targetRuntime = getAiAgentRuntime(runtimeScopeKey);
    const next = resolveStateAction(action, targetRuntime.syncProfile);
    targetRuntime.syncProfile = next;
    if (isMountedRef.current) setSyncProfileState(next);
  }, [runtimeScopeKey]);

  const setIsLoading = useCallback((action: SetStateAction<boolean>) => {
    const targetRuntime = getAiAgentRuntime(runtimeScopeKey);
    const next = resolveStateAction(action, targetRuntime.isLoading);
    targetRuntime.isLoading = next;
    if (isMountedRef.current) setIsLoadingState(next);
  }, [runtimeScopeKey]);

  const setAttachments = useCallback((action: SetStateAction<Attachment[]>) => {
    const targetRuntime = getAiAgentRuntime(runtimeScopeKey);
    const next = resolveStateAction(action, targetRuntime.attachments);
    targetRuntime.attachments = next;
    if (isMountedRef.current) setAttachmentsState(next);
  }, [runtimeScopeKey]);

  const setChatHistory = useCallback((action: SetStateAction<AiChatHistoryItem[]>) => {
    const targetRuntime = getAiAgentRuntime(runtimeScopeKey);
    const next = resolveStateAction(action, targetRuntime.chatHistory);
    targetRuntime.chatHistory = next;
    if (isMountedRef.current) setChatHistoryState(next);
  }, [runtimeScopeKey]);

  useEffect(() => {
    const nextRuntime = getAiAgentRuntime(runtimeScopeKey);
    abortControllerRef.current = nextRuntime.abortController;
    setInputMsgState(nextRuntime.inputMsg);
    setSyncProfileState(nextRuntime.syncProfile);
    setIsLoadingState(nextRuntime.isLoading);
    setAttachmentsState(nextRuntime.attachments);
    setChatHistoryState(nextRuntime.chatHistory);
  }, [runtimeScopeKey]);

  useEffect(() => {
    const handleClearChat = (event: Event) => {
        const targetScope = (event as CustomEvent<{ historyScope?: string }>).detail?.historyScope;
        if (targetScope && targetScope !== historyScope) return;
        setChatHistory([]);
    };
    window.addEventListener('clear-chat-history', handleClearChat);
    return () => window.removeEventListener('clear-chat-history', handleClearChat);
  }, [historyScope, setChatHistory]);

  useEffect(() => {
     isChatLoaded.current = false;
     if (user?.uid) {
        if (!persistHistory) {
           setChatHistory(getAiAgentRuntime(runtimeScopeKey).chatHistory);
           isChatLoaded.current = true;
           return;
        }

        const loadHistory = async () => {
           try {
              if (isDefaultHistoryScope) {
                const snap = await getDoc(doc(db, "userProfiles", user.uid));
                if (snap.exists() && snap.data().chatHistory) {
                  const normalized = normalizeStoredChatHistory(snap.data().chatHistory);
                  setChatHistory(normalized);
                  if (historyStorageKey) {
                    localStorage.setItem(historyStorageKey, JSON.stringify(normalized));
                  }
                  isChatLoaded.current = true;
                  return;
                }
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
           const stored = historyStorageKey ? localStorage.getItem(historyStorageKey) : null;
           let targetStored = stored;
           
           if (!stored && isDefaultHistoryScope) {
              const oldStored = localStorage.getItem('ai_terminal_chat');
              if (oldStored) {
                  targetStored = oldStored;
                  if (historyStorageKey) {
                    localStorage.setItem(historyStorageKey, oldStored);
                  }
                  localStorage.removeItem('ai_terminal_chat');
              }
           }

           if (targetStored) {
              try {
                const parsed = JSON.parse(targetStored);
                setChatHistory(normalizeStoredChatHistory(parsed));
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
  }, [historyScope, historyStorageKey, isDefaultHistoryScope, persistHistory, runtimeScopeKey, setChatHistory, user?.uid]);

  useEffect(() => {
    if (user?.uid && isChatLoaded.current && persistHistory && historyStorageKey) {
       localStorage.setItem(historyStorageKey, JSON.stringify(chatHistory));
       if (!isDefaultHistoryScope) return;
       const timeoutId = setTimeout(() => {
           // Prevent Firestore 1MB document size limit by stripping very large attachments and truncating thinking logs
           (async () => {
             const { storage } = await import('../lib/firebase-storage');
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
  }, [chatHistory, historyStorageKey, isDefaultHistoryScope, persistHistory, user?.uid]);
  
  const handleStop = () => {
      const runtimeController = getAiAgentRuntime(runtimeScopeKey).abortController;
      const controller = abortControllerRef.current || runtimeController;
      if (controller) {
          controller.abort();
          abortControllerRef.current = null;
          getAiAgentRuntime(runtimeScopeKey).abortController = null;
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
                    const { storage } = await import('../lib/firebase-storage');
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

    if (!actualMsg.trim() && attsToSend.length === 0) return null;

    const userMsg = actualMsg;
    
    setChatHistory(prev => [...prev, { user: userMsg, ai: '', attachments: attsToSend }]);
    if (typeof overrideMsg !== 'string') setInputMsg('');
    setAttachments([]);
    setIsLoading(true);

    const requestAbortController = new AbortController();
    abortControllerRef.current = requestAbortController;
    getAiAgentRuntime(runtimeScopeKey).abortController = requestAbortController;
    const signal = requestAbortController.signal;
    let didTimeout = false;
    const requestTimeoutId = window.setTimeout(() => {
      didTimeout = true;
      abortControllerRef.current?.abort();
    }, AGENT_REQUEST_TIMEOUT_MS);

    try {
      const cleanedContextData = compactAgentContext(data);
      const resolvedContextAugment = typeof contextAugment === 'function'
        ? contextAugment()
        : contextAugment;
      if (resolvedContextAugment) {
        cleanedContextData.workbenchContext = compactAgentContext(resolvedContextAugment);
      }
      const publicHoldingAccounts = cleanedContextData?.publicHoldingAccounts || cleanedContextData?.distributions?.publicHoldingAccounts;
      if (publicHoldingAccounts && publicHoldingAccounts.length > 0) {
        cleanedContextData.livePortfolioAccounts = publicHoldingAccounts;
      }

      if (workbenchNativeSession) {
        const nativeSession: WorkbenchSessionSpec = {
          ...workbenchNativeSession,
          facts: {
            ...(workbenchNativeSession.facts || {}),
            terminalState: data,
            sourceRefs: Array.from(new Set([
              ...(workbenchNativeSession.facts?.sourceRefs || []),
              'workbench.native_chat',
            ])),
          },
        };
        const thinkingProgress = t('workbench.nativeChat.thinking');
        setChatHistory(prev => {
          const newHist = [...prev];
          if (newHist.length === 0) return newHist;
          newHist[newHist.length - 1].thinking = thinkingProgress;
          newHist[newHist.length - 1].isThinkingExpanded = false;
          return newHist;
        });

        const nativeResponse = await runWorkbenchChatResult(nativeSession, userMsg, undefined, {
          longbridgeAccounts: getSettings().longbridgeAccounts || [],
          language,
        });
        if (signal.aborted) throw new Error('AbortError');

        const bffData = {
          ...(nativeResponse.chatResult || {}),
          aiResponse: nativeResponse.assistantMessage,
          workbenchNative: true,
          workbenchSession: nativeResponse.session,
          workbenchAgentResult: nativeResponse.agentResult,
        };

        setChatHistory(prev => {
          const newHist = [...prev];
          if (newHist.length === 0) return newHist;
          newHist[newHist.length - 1].thinking = `${thinkingProgress}\n${t('workbench.nativeChat.completed')}`;
          newHist[newHist.length - 1].ai = nativeResponse.assistantMessage || t('workbench.nativeChat.emptyAssistant');
          newHist[newHist.length - 1].debugData = bffData;
          newHist[newHist.length - 1].hasMemoryUpdate = Boolean(nativeResponse.memoryInbox?.pendingCount);
          return newHist;
        });

        return bffData;
      }

      const contextRes = await fetch(getApiEndpoint('/api/chat', { streaming: true }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           message: userMsg,
           history: compactAgentHistory(chatHistory.map(c => ({ user: c.user, ai: c.ai }))),
           contextData: cleanedContextData,
           settings: getSettings(),
           userId: user?.uid,
           customApiKey: localStorage.getItem('custom_gemini_api_key') || undefined,
           attachments: attsToSend,
           skipMemoryUpdate: !profileWritePolicy.requestMemoryUpdate
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

                               if (extData.marketContext) {
                                   nextData.marketContext = normalizeMarketContextForStore(extData.marketContext);
                                   nextData.marketContextLastFetchedAt = Date.now();
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
                         displayText = textBefore || t('chat.jsonPayloadLoading');
                      }
                      
                      setChatHistory(prev => {
                         const newHist = [...prev];
                         newHist[newHist.length - 1].ai = displayText;
                         return newHist;
                      });
                   } else if (parsed.type === 'error') {
                      serverError = parsed.error || parsed.message || t('chat.errors.unknownBackend');
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
      if (!bffData) throw new Error(t('chat.errors.emptyServerData'));

      // 1.5 Handle permanent RAG profile updates
      if (bffData.updatedProfile && Object.keys(bffData.updatedProfile).length > 0 && profileWritePolicy.directProfileWrite) {
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
              
              const profilePatch = deriveTerminalStatePatchFromProfile(bffData.updatedProfile, language);
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

               if (extDataFinal.marketContext) {
                   nextData.marketContext = normalizeMarketContextForStore(extDataFinal.marketContext);
                   nextData.marketContextLastFetchedAt = Date.now();
                   updated = true;
               }

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
         return bffData;
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
        newHist[newHist.length - 1].ai = displayAi || (sduiPayload ? t('chat.advancedViewSynced') : txt);
        newHist[newHist.length - 1].debugData = bffData;
        if (suggestedStatePatch) {
           newHist[newHist.length - 1].aiSuggestedState = suggestedStatePatch;
        }
        return newHist;
      });

      if (sduiPayload?.updateGlobalState) {
         // Filter out any unauthorized properties utilizing the source-aware permission gating whitelist
         const filteredUpdate = filterAiWritableStatePatch(sduiPayload.updateGlobalState, {
            allowMemoryWrite: profileWritePolicy.stateMemoryWrite,
            allowTrustedFactWrite: false, // updateGlobalState by the AI is defaulted to untrusted/suggestions
            livePortfolio: bffData?.externalData?.livePortfolio,
            livePortfolioAccounts: bffData?.externalData?.livePortfolioAccounts
         });
         // Sanitize AI's raw update payload BEFORE merging, removing nulls/bad types but keeping omitted fields untouched
         const sanitizedUpdate = sanitizeTerminalState(filteredUpdate);

         if (sanitizedUpdate.dynamicWidgets) {
           sanitizedUpdate.dynamicWidgets = normalizeDynamicWidgetsForDashboard(sanitizedUpdate.dynamicWidgets);
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

      return bffData;

    } catch (error: any) {
      if (error.message === 'AbortError' || error.name === 'AbortError') {
          if (didTimeout) {
            setChatHistory(prev => {
              const newHist = [...prev];
              if (newHist.length === 0) return newHist;
              const currentAiText = newHist[newHist.length - 1].ai || '';
              newHist[newHist.length - 1].ai = currentAiText + (currentAiText ? '\n\n' : '') + `⚠️ **${t('chat.errors.communicationInterrupted')}**: ${formatAgentErrorMessage(error, didTimeout, t)}`;
              return newHist;
            });
            return null;
          }
          console.log('AI Generation Stopped.');
          return null;
      }
      setChatHistory(prev => {
        const newHist = [...prev];
        if (newHist.length === 0) return newHist;
        const errMsg = formatAgentErrorMessage(error, didTimeout, t);
        const currentAiText = newHist[newHist.length - 1].ai || '';
        newHist[newHist.length - 1].ai = currentAiText + (currentAiText ? '\n\n' : '') + `⚠️ **${t('chat.errors.communicationInterrupted')}**: ${errMsg}`;
        return newHist;
      });
      return null;
    } finally {
      window.clearTimeout(requestTimeoutId);
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
      getAiAgentRuntime(runtimeScopeKey).abortController = null;
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
