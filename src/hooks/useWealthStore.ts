import { create } from 'zustand';
import axios from 'axios';
import { getSettings } from '../lib/settings';
import { TerminalState, LIVE_VALUATION_VERSION, AccountPortfolio } from '../types/terminal';
import { MarketContext } from '../types/market-context';
import { sanitizeTerminalState } from '../lib/sanitizer';
import { mergeWith, isArray, debounce } from 'lodash-es';
import { setDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirestoreQuotaExceeded } from '../lib/firebase';
import { DEFAULT_DASHBOARD_SCHEMA, DASHBOARD_SCHEMA_VERSION } from '../lib/default-schema';
import { normalizeDashboardSchema } from '../lib/dashboard-schema-migration';
import { PortfolioReviewSession, PortfolioReviewMemory } from '../types/portfolio-review';
import { createPortfolioReviewSnapshot } from '../lib/portfolio-review/snapshot';
import { diffPortfolioSnapshots } from '../lib/portfolio-review/diff';


export const EMPTY_STATE: TerminalState = {
  userPersona: { tags: [], description: "唤起总监生成您的个人资产画像模型" },
  userProfile: {},
  metrics: { 
    netWorth: undefined, 
    liquidity: undefined, 
    safetyRatio: undefined, 
    safetyRatioSummary: undefined,
    fcf: undefined,
    fcfSummary: undefined
  },
  distributions: { liquidity: [], expenses: [], privateAssets: [], publicHoldings: [], fixedAssets: [], options: [] },
  goal: { name: '等待设定目标', current: undefined, target: undefined, index: undefined },
  insights: { global: "等待数据注入...", private: "暂无非公开资产数据" },
  lifeStrategiesShort: [],
  lifeStrategiesLong: [],
  dynamicWidgets: [],
  dashboardSchema: DEFAULT_DASHBOARD_SCHEMA,
  _dashboardSchemaVersion: DASHBOARD_SCHEMA_VERSION,
  historicalSnapshots: [],
  marketContext: undefined,
  marketContextLastFetchedAt: undefined,
};

const getSafeMktVal = (p: any): number => {
  const mktVal = Number(p.marketValue);
  const val = Number(p.value);
  if (!isNaN(mktVal) && mktVal > 0) return mktVal;
  if (!isNaN(val) && val > 0) return val;
  
  const qty = Number(p.quantity) || 0;
  const currentPx = Number(p.currentPrice) || Number(p.lastPrice);
  if (qty > 0 && currentPx > 0) return qty * currentPx;
  
  return 0;
};

const debouncedSyncToCloud = debounce((uid: string, payload: any) => {
  if (isFirestoreQuotaExceeded) return;
  
  setDoc(doc(db, "userProfiles", uid), payload, { merge: true })
    .catch(e => {
        console.error("Failed to commit appData to firestore:", e);
        handleFirestoreError(e, OperationType.WRITE, `userProfiles/${uid}`);
    });
}, 2000);

const preserveLiveLongbridgeSlice = (prevData: TerminalState, incomingData: TerminalState): boolean => {
  if (prevData?._liveSources?.includes('longbridge')) {
    const currentHoldings = prevData.distributions?.publicHoldings;
    const hasCurrentHoldings = currentHoldings && currentHoldings.length > 0;
    
    const newHoldings = incomingData.distributions?.publicHoldings;
    const hasNewHoldings = newHoldings && newHoldings.length > 0;
    const newVersion = Number(incomingData._liveValuationVersion || 0);

    // We preserve existing live holdings if the incoming data doesn't have valid new ones
    if (hasCurrentHoldings && (!hasNewHoldings || newVersion < LIVE_VALUATION_VERSION)) {
        if (!incomingData.distributions) incomingData.distributions = { liquidity: [], expenses: [], privateAssets: [], publicHoldings: [], fixedAssets: [], options: [] };
        incomingData.distributions.publicHoldings = currentHoldings;
        incomingData._liveSources = prevData._liveSources;
        incomingData._liveValuationVersion = prevData._liveValuationVersion;
        incomingData._liveFetchedAt = prevData._liveFetchedAt;
        
        if (process.env.NODE_ENV !== 'production') console.log('[useWealthStore] Preserved Longbridge live holdings during commitData/setData');
        return true;
    }
  }
  return false;
};

// We define persistence mode states
export type PersistenceMode = 'disabled' | 'manual' | 'auto';

interface WealthState {
  data: TerminalState;
  user: any;
  loadingAuth: boolean;
  persistenceMode: PersistenceMode;
  agentMemorySnapshots: any[];
  setPersistenceMode: (mode: PersistenceMode) => void;
  saveCloudCheckpoint: () => void;
  setUser: (user: any) => void;
  setLoadingAuth: (loadingAuth: boolean) => void;
  setData: (data: TerminalState, options?: { preserveLiveData?: boolean }) => void;
  commitData: (newDataOrUpdater: any) => void;
  clearDynamicWidgets: () => void;
  clearData: () => void;
  selectedHolding: any | null;
  setSelectedHolding: (holding: any) => void;
  fetchLongbridge: () => Promise<void>;
  fetchLongbridgeAccountPortfolios: () => Promise<void>;
  language: 'zh-CN' | 'en-US';
  setLanguage: (lang: 'zh-CN' | 'en-US') => void;
  publicHoldingsSyncStatus: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  publicHoldingsError?: string;
  publicHoldingsLastSyncAt?: number;
  publicHoldingAccountsSyncStatus: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  publicHoldingAccountsError?: string;
  publicHoldingAccountsLastSyncAt?: number;
  marketContextStatus: 'idle' | 'loading' | 'success' | 'error';
  marketContextError?: string;
  fetchMarketContext: (options?: { forceRefresh?: boolean }) => Promise<void>;
  portfolioReviewSessions: PortfolioReviewSession[];
  activePortfolioReviewSessionId?: string;
  createPortfolioReviewSession: () => PortfolioReviewSession | null;
  setActivePortfolioReviewSession: (id: string | undefined) => void;
  updatePortfolioReviewSession: (id: string, patch: Partial<PortfolioReviewSession>) => void;
  clearPortfolioReviewSessions: () => void;
  analyzePortfolioReviewSession: (id: string, userRiskPolicy?: any) => Promise<void>;
  portfolioReviewMemory?: PortfolioReviewMemory;
  savePortfolioReviewMemoryFromSession: (sessionId: string, riskPreferenceObserved?: string) => void;
}

const syncToCloud = (uid: string, data: any) => {
    if (isFirestoreQuotaExceeded) return;
    setDoc(doc(db, "userProfiles", uid), data, { merge: true })
      .catch(e => {
          console.error("Failed to manually save cloud checkpoint:", e);
      });
};

export const useWealthStore = create<WealthState>((set, get) => ({
  data: EMPTY_STATE,
  user: null,
  loadingAuth: true,
  persistenceMode: 'disabled', // default to disabled to protect quota
  agentMemorySnapshots: [],
  portfolioReviewSessions: [],
  activePortfolioReviewSessionId: undefined,
  portfolioReviewMemory: undefined,
  setPersistenceMode: (mode) => set({ persistenceMode: mode }),
  saveCloudCheckpoint: () => {
      const { user, data } = get();
      if (user?.uid) {
          const appDataToSave = { ...data };
          delete appDataToSave.userProfile;
          syncToCloud(user.uid, { appData: appDataToSave, userProfile: data.userProfile });
      }
  },
  publicHoldingsSyncStatus: 'idle',
  publicHoldingsError: undefined,
  publicHoldingsLastSyncAt: undefined,
  publicHoldingAccountsSyncStatus: 'idle',
  publicHoldingAccountsError: undefined,
  publicHoldingAccountsLastSyncAt: undefined,
  marketContextStatus: 'idle',
  marketContextError: undefined,
  language: 'zh-CN',
  setLanguage: (lang) => set({ language: lang }),
  selectedHolding: null,
  setSelectedHolding: (holding) => set({ selectedHolding: holding }),
  setUser: (user) => {
    if (user) {
      let sessions = [];
      let mem: PortfolioReviewMemory | undefined = undefined;
      try {
        const stored = localStorage.getItem(`ai_terminal_portfolio_reviews_${user.uid}`);
        if (stored) {
          sessions = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Failed to load portfolio review sessions", e);
      }
      try {
        const storedMem = localStorage.getItem(`ai_terminal_portfolio_review_memory_${user.uid}`);
        if (storedMem) {
          mem = JSON.parse(storedMem);
        }
      } catch (e) {
        console.error("Failed to load portfolio review memory", e);
      }
      set({ 
        user, 
        portfolioReviewSessions: sessions, 
        activePortfolioReviewSessionId: sessions[0]?.id,
        portfolioReviewMemory: mem
      });
    } else {
      set({ 
        user, 
        portfolioReviewSessions: [], 
        activePortfolioReviewSessionId: undefined,
        portfolioReviewMemory: undefined
      });
    }
  },
  setLoadingAuth: (loadingAuth) => set({ loadingAuth }),
  setData: (newData, options) => set((state) => {
    const normalizedData = normalizeDashboardSchema(newData);
    const shouldPreserve = options?.preserveLiveData !== false;
    
    if (shouldPreserve) {
        const preserved = preserveLiveLongbridgeSlice(state.data, normalizedData);
        if (preserved) {
            return {
                data: normalizedData,
                publicHoldingsSyncStatus: state.publicHoldingsSyncStatus,
                publicHoldingsLastSyncAt: state.publicHoldingsLastSyncAt,
                publicHoldingsError: state.publicHoldingsError
            };
        }
    }
    return { data: normalizedData };
  }),
  clearDynamicWidgets: () => {
    get().commitData({ dynamicWidgets: [] });
  },
  clearData: () => {
    // ⚠️ API Key / Token 等安全凭证只能由用户在 Settings 表单中手动清理。
    // clearData 仅清空当前工作区的用户财务数据、聊天记录、状态树、指标跟进及快照文件，静默保留所有 API 密钥与股票账户配置。
    set({ 
      data: JSON.parse(JSON.stringify(EMPTY_STATE)), 
      agentMemorySnapshots: [], 
      portfolioReviewSessions: [],
      activePortfolioReviewSessionId: undefined,
      portfolioReviewMemory: undefined,
      selectedHolding: null,
      publicHoldingsSyncStatus: 'empty', 
      publicHoldingsError: undefined, 
      publicHoldingsLastSyncAt: undefined,
      publicHoldingAccountsSyncStatus: 'empty',
      publicHoldingAccountsError: undefined,
      publicHoldingAccountsLastSyncAt: undefined,
      marketContextStatus: 'idle',
      marketContextError: undefined
    });

    const { user, persistenceMode } = get();
    if (user?.uid) {
        localStorage.removeItem(`ai_terminal_data_${user.uid}`);
        localStorage.removeItem(`ai_terminal_snapshots_${user.uid}`);
        localStorage.removeItem(`ai_terminal_position_snapshots_${user.uid}`);
        localStorage.removeItem(`ai_terminal_chat_${user.uid}`);
        localStorage.removeItem(`ai_terminal_portfolio_reviews_${user.uid}`);
        localStorage.removeItem(`ai_terminal_portfolio_review_memory_${user.uid}`);
        
        if (persistenceMode !== 'disabled') {
            debouncedSyncToCloud(user.uid, { appData: JSON.parse(JSON.stringify(EMPTY_STATE)), userProfile: EMPTY_STATE.userProfile });
        }
    }
  },
  commitData: (newDataOrUpdater) => {
    set((state) => {
      const prev = state.data;
      const rawNewData = typeof newDataOrUpdater === 'function' ? newDataOrUpdater(prev) : newDataOrUpdater;
      const newData = sanitizeTerminalState(rawNewData) as TerminalState;
      
      // Before deep merge, if we currently hold valid Longbridge live data,
      // prevent the AI patch from overwriting it unless it explicitly provides a valid newer live version.
      if (prev?._liveSources?.includes('longbridge') && prev?.distributions?.publicHoldings?.length > 0) {
          const incomingVersion = Number(newData._liveValuationVersion || 0);
          if (incomingVersion < LIVE_VALUATION_VERSION) {
              if (newData.distributions && newData.distributions.publicHoldings) {
                  delete newData.distributions.publicHoldings;
                  if (process.env.NODE_ENV !== 'production') console.log('[useWealthStore] Filtered out AI patch publicHoldings to protect Longbridge live data.');
              }
              // Also protect live metadata from being overwritten by empty/stale AI patches
              delete newData._liveSources;
              delete newData._liveValuationVersion;
              delete newData._liveFetchedAt;
          }
      }

      const fullData = mergeWith({}, prev, newData, (objValue, srcValue) => {
        if (isArray(srcValue)) return srcValue;
      });
      
      // Protect live data from AI patch overwriting
      preserveLiveLongbridgeSlice(prev, fullData);
      
      if (prev.metrics?.netWorth > 0) {
        const coreChanged = 
          JSON.stringify(prev.distributions) !== JSON.stringify(fullData.distributions) || 
          JSON.stringify(prev.metrics) !== JSON.stringify(fullData.metrics);

        if (coreChanged) {
          const history = prev.historicalSnapshots || [];
          const lastSnap = history[0];
          if (!lastSnap || (Date.now() - lastSnap.timestamp > 5 * 60 * 1000)) {
            const newSnapshot = {
              timestamp: Date.now(),
              metrics: prev.metrics,
              distributions: prev.distributions
            };
            fullData.historicalSnapshots = [newSnapshot, ...history].slice(0, 5);
          } else {
            fullData.historicalSnapshots = history;
          }
        } else {
          fullData.historicalSnapshots = prev.historicalSnapshots;
        }
      }

      const normalizedFullData = normalizeDashboardSchema(fullData);

      if (state.user?.uid) {
          localStorage.setItem(`ai_terminal_data_${state.user.uid}`, JSON.stringify(normalizedFullData));
          
          if (state.persistenceMode === 'auto') {
              const appDataToSave = { ...normalizedFullData };
              delete appDataToSave.userProfile;
              debouncedSyncToCloud(state.user.uid, { appData: appDataToSave, userProfile: normalizedFullData.userProfile });
          }
      }

      return { data: normalizedFullData };
    });
  },
  fetchLongbridge: async () => {
    const settings = getSettings();
    if (!settings.longbridgeAccounts || settings.longbridgeAccounts.length === 0) return;
    const { user } = get();
    if (!user) return;
    
    set({ publicHoldingsSyncStatus: 'loading', publicHoldingsError: undefined });

    try {
      const headerValue = btoa(encodeURIComponent(JSON.stringify(settings.longbridgeAccounts)));
      const response = await axios.get('/api/v1/wealth/longbridge/positions', {
          headers: { 'X-Longbridge-Accounts': headerValue, 'Cache-Control': 'no-cache' },
          params: { _t: Date.now() }
      });
      
      if (response.data && response.data.success && response.data.data) {
          const newData = response.data.data;
          const meta = response.data.meta || {};
          
          set((state) => {
              // If it's empty, we must ensure it's a real empty response, not a failure disguised as empty
              if (newData.length === 0) {
                 const isGenuinelyEmpty = meta.accountCount > 0 && meta.positionCount === 0;
                 if (!isGenuinelyEmpty) {
                     return {
                         publicHoldingsSyncStatus: 'error',
                         publicHoldingsError: 'API returned empty list without empty confirmation. Retaining old data.'
                     };
                 }
              }

              // Preserve old marketValues if the new data is missing it due to API rate limits (quote failures)
              const existingHoldings = state.data?.distributions?.publicHoldings || [];
              const mergedNewData = newData.map((newPos: any) => {
                  const mVal = getSafeMktVal(newPos);
                  if (mVal <= 0) {
                      const oldPos = existingHoldings.find((p: any) => p.symbol === newPos.symbol);
                      if (oldPos) {
                          const oldMVal = getSafeMktVal(oldPos);
                          if (oldMVal > 0) {
                              return {
                                  ...newPos,
                                  marketValue: oldPos.marketValue !== undefined ? oldPos.marketValue : oldMVal,
                                  value: oldPos.value !== undefined ? oldPos.value : oldMVal,
                                  currentPrice: oldPos.currentPrice,
                                  _staleQuote: true
                              };
                          }
                      }
                  }
                  return newPos;
              });

              const prevData = state.data;
              const nextData = {
                  ...prevData,
                  distributions: {
                      ...prevData.distributions,
                      publicHoldings: mergedNewData
                  },
                  _liveSources: ['longbridge'],
                  _liveValuationVersion: LIVE_VALUATION_VERSION,
                  _liveFetchedAt: Date.now()
              };
              
              const totalMktVal = mergedNewData.reduce((sum: number, p: any) => sum + getSafeMktVal(p), 0);
              
              const snapshot = {
                 timestamp: Date.now(),
                 totalMarketValue: totalMktVal,
                 topHoldings: [...mergedNewData].sort((a: any, b: any) => getSafeMktVal(b) - getSafeMktVal(a)).slice(0, 5).map(h => ({ symbol: h.symbol, marketValue: getSafeMktVal(h), quantity: h.quantity })),
                 source: 'longbridge',
                 quoteCoverage: meta.quoteCoverage,
                 missingQuoteSymbols: meta.missingQuoteSymbols
              };
              
              const newSnapshots = [snapshot, ...state.agentMemorySnapshots].slice(0, 10);
              
              if (state.user?.uid) {
                  localStorage.setItem(`ai_terminal_data_${state.user.uid}`, JSON.stringify(nextData));
                  localStorage.setItem(`ai_terminal_snapshots_${state.user.uid}`, JSON.stringify(newSnapshots));
              }

              if (process.env.NODE_ENV !== 'production') console.log(`[useWealthStore] fetchLongbridge success, updated ${mergedNewData.length} positions`);

              let syncStatus: WealthState['publicHoldingsSyncStatus'] = mergedNewData.length === 0 ? 'empty' : 'success';
              let syncError: string | undefined = undefined;

              if (meta.quoteCoverage !== undefined && meta.quoteCoverage < 1) {
                  syncError = `部分持仓缺少实时价格：${(meta.missingQuoteSymbols || []).join(', ')}`;
                  if (process.env.NODE_ENV !== 'production') console.log(`[useWealthStore] fetchLongbridge warning: ${syncError}`);
              }

              return {
                  data: nextData,
                  agentMemorySnapshots: newSnapshots,
                  publicHoldingsSyncStatus: syncStatus,
                  publicHoldingsLastSyncAt: Date.now(),
                  publicHoldingsError: syncError
              };
          });
      } else {
         set({
             publicHoldingsSyncStatus: 'error',
             publicHoldingsError: response.data?.error || response.data?.message || "Unknown error fetching positions"
         });
      }
    } catch (err: any) {
      console.error('[Longbridge] error fetching positions via API:', err);
      set({
        publicHoldingsSyncStatus: 'error',
        publicHoldingsError: err?.message || String(err)
      });
    }
  },
  fetchLongbridgeAccountPortfolios: async () => {
    const settings = getSettings();
    if (!settings.longbridgeAccounts || settings.longbridgeAccounts.length === 0) return;
    const { user } = get();
    if (!user) return;
    
    set({ publicHoldingAccountsSyncStatus: 'loading', publicHoldingAccountsError: undefined });

    try {
      const headerValue = btoa(encodeURIComponent(JSON.stringify(settings.longbridgeAccounts)));
      const response = await axios.get('/api/v1/wealth/longbridge/account-portfolios', {
          headers: { 'X-Longbridge-Accounts': headerValue, 'Cache-Control': 'no-cache' },
          params: { _t: Date.now() }
      });
      
      if (response.data && response.data.success && response.data.data) {
          const newData = response.data.data;
          const meta = response.data.meta || {};
          
          set((state) => {
              const allPositions: any[] = [];
              newData.forEach((account: any) => {
                if (Array.isArray(account.positions)) {
                  account.positions.forEach((pos: any) => {
                    allPositions.push({
                      ...pos,
                      accountId: account.accountId,
                      accountName: account.accountName
                    });
                  });
                }
              });

              const groupedPositions: Record<string, any[]> = {};
              allPositions.forEach(p => {
                if (!p.symbol) return;
                if (!groupedPositions[p.symbol]) {
                  groupedPositions[p.symbol] = [];
                }
                groupedPositions[p.symbol].push(p);
              });

              const legacyPublicHoldings: any[] = [];
              Object.entries(groupedPositions).forEach(([symbol, posList]) => {
                const firstPos = posList[0];
                const totalQuantity = posList.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
                
                let totalCost = 0;
                posList.forEach(p => {
                  const qty = Number(p.quantity) || 0;
                  const price = Number(p.costPrice) || 0;
                  totalCost += qty * price;
                });
                const costPrice = totalQuantity > 0 ? (totalCost / totalQuantity) : (Number(firstPos.costPrice) || 0);
                const totalMktVal = posList.reduce((sum, p) => sum + getSafeMktVal(p), 0);
                
                const breakdown = posList.map(p => ({
                  accountId: p.accountId,
                  accountName: p.accountName,
                  quantity: Number(p.quantity || 0),
                  marketValue: getSafeMktVal(p)
                }));
                
                legacyPublicHoldings.push({
                  symbol,
                  name: firstPos.name || symbol,
                  quantity: totalQuantity,
                  costPrice,
                  marketValue: totalMktVal,
                  value: totalMktVal,
                  currency: firstPos.currency || 'USD',
                  accountBreakdown: breakdown
                });
              });

              const prevData = state.data;
              const nextData = {
                  ...prevData,
                  publicHoldingAccounts: newData,
                  distributions: {
                      ...prevData.distributions,
                      publicHoldings: legacyPublicHoldings
                  },
                  _liveSources: ['longbridge'],
                  _liveValuationVersion: LIVE_VALUATION_VERSION,
                  _liveFetchedAt: Date.now()
              };
              
              if (state.user?.uid) {
                  localStorage.setItem(`ai_terminal_data_${state.user.uid}`, JSON.stringify(nextData));
              }

              if (process.env.NODE_ENV !== 'production') console.log(`[useWealthStore] fetchLongbridgeAccountPortfolios success, updated ${newData.length} accounts`);

              let syncStatus: 'idle' | 'loading' | 'success' | 'empty' | 'error' = newData.length === 0 ? 'empty' : 'success';
              let syncError: string | undefined = undefined;

              if (meta.accountErrors && Object.keys(meta.accountErrors).length > 0) {
                  syncError = `部分账户同步失败: ${Object.entries(meta.accountErrors).map(([acc, err]) => `${acc}: ${err}`).join(', ')}`;
              }

              return {
                  data: nextData,
                  publicHoldingAccountsSyncStatus: syncStatus,
                  publicHoldingAccountsLastSyncAt: Date.now(),
                  publicHoldingAccountsError: syncError,
                  publicHoldingsSyncStatus: syncStatus,
                  publicHoldingsLastSyncAt: Date.now(),
                  publicHoldingsError: syncError
              };
          });
      } else {
         set({
             publicHoldingAccountsSyncStatus: 'error',
             publicHoldingAccountsError: response.data?.error || response.data?.message || "Unknown error fetching account portfolios"
         });
      }
    } catch (err: any) {
      console.error('[Longbridge] error fetching account portfolios via API:', err);
      set({
        publicHoldingAccountsSyncStatus: 'error',
        publicHoldingAccountsError: err?.message || String(err)
      });
    }
  },
  fetchMarketContext: async (options) => {
    const { data: stateData } = get();
    const marketContext = stateData.marketContext;
    const lastFetchedAt = stateData.marketContextLastFetchedAt;

    if (!options?.forceRefresh && marketContext && lastFetchedAt && (Date.now() - lastFetchedAt < 15 * 60 * 1000)) {
      set({ marketContextStatus: 'success', marketContextError: undefined });
      return;
    }

    set({ marketContextStatus: 'loading', marketContextError: undefined });

    try {
      const url = options?.forceRefresh ? '/api/market-context?force=1' : '/api/market-context';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch market context: status ${response.status}`);
      }
      const payload = await response.json();
      if (payload.success !== true || !payload.data) {
        throw new Error(payload.error || 'Invalid market context payload' + (payload.message ? `: ${payload.message}` : ''));
      }

      set((state) => {
        const rawNextData = {
          ...state.data,
          marketContext: payload.data,
          marketContextLastFetchedAt: Date.now()
        };
        const nextData = normalizeDashboardSchema(rawNextData);

        if (state.user?.uid) {
          localStorage.setItem(`ai_terminal_data_${state.user.uid}`, JSON.stringify(nextData));
        }

        return {
          data: nextData,
          marketContextStatus: 'success',
          marketContextError: undefined
        };
      });
    } catch (error: any) {
      console.error('[fetchMarketContext] Failed:', error);
      set({
        marketContextStatus: 'error',
        marketContextError: error.message || 'Failed to fetch market context'
      });
    }
  },
  createPortfolioReviewSession: () => {
    const { data, portfolioReviewSessions, user } = get();
    if (!user) return null;

    // 1. 从 state.data.publicHoldingAccounts 或 state.data.distributions.publicHoldingAccounts 获取多账户持仓数据。
    let accountPortfolios: AccountPortfolio[] = data.publicHoldingAccounts || (data.distributions as any)?.publicHoldingAccounts || [];

    // 2. 如果没有多账户数据，但存在 distributions.publicHoldings，则允许生成 low confidence 的 fallback snapshot。
    let source: 'longbridge' | 'screenshot' | 'manual' | 'mixed' = 'longbridge';
    if (accountPortfolios.length === 0) {
      const publicHoldings = data.distributions?.publicHoldings || [];
      if (publicHoldings.length > 0) {
        source = 'manual';
        accountPortfolios = [{
          accountId: 'fallback_manual_account',
          accountName: '手动/单账户持仓 (旧兼容模式)',
          positions: publicHoldings.map((h: any) => ({
            symbol: h.symbol,
            name: h.name || h.symbol,
            quantity: h.quantity,
            costPrice: h.costPrice,
            currentPrice: h.currentPrice || h.lastPrice || 0,
            marketValue: h.marketValue || (h.quantity * (h.currentPrice || h.lastPrice || 0)),
            currency: h.currency || 'USD',
            accountId: 'fallback_manual_account',
            accountName: '手动/单账户持仓 (旧兼容模式)'
          })),
          meta: {
            positionCount: publicHoldings.length,
            generatedAt: Date.now()
          }
        }];
      }
    }

    // 3. previousSnapshot 来源：
    //    - 优先使用 portfolioReviewSessions[0].currentSnapshot；
    //    - 如果没有历史 session，则 previousSnapshot 为 undefined。
    const previousSnapshot = portfolioReviewSessions && portfolioReviewSessions.length > 0
      ? portfolioReviewSessions[0].currentSnapshot
      : undefined;

    // 4. 使用 createPortfolioReviewSnapshot 生成 currentSnapshot。
    const currentSnapshot = createPortfolioReviewSnapshot({
      accountPortfolios,
      source
    });

    // 5. 使用 diffPortfolioSnapshots(previousSnapshot, currentSnapshot) 生成 deltas。
    const deltas = diffPortfolioSnapshots(previousSnapshot, currentSnapshot);

    const marketContextSnapshot = data.marketContext
      ? JSON.parse(JSON.stringify(data.marketContext))
      : undefined;

    const marketContextCapturedAt = data.marketContext
      ? (data.marketContextLastFetchedAt || Date.now())
      : undefined;

    // 6. 创建 PortfolioReviewSession：
    //    - id 使用 review_${Date.now()}
    //    - status = 'draft'
    //    - createdAt = Date.now()
    const newSession: PortfolioReviewSession = {
      id: `review_${Date.now()}`,
      createdAt: Date.now(),
      currentSnapshot,
      previousSnapshot,
      deltas,
      status: 'draft',
      marketContextSnapshot,
      marketContextCapturedAt
    };

    // 7. 插入 portfolioReviewSessions 头部，最多保留 20 条。
    const updatedSessions = [newSession, ...(portfolioReviewSessions || [])].slice(0, 20);

    // 8. 设置 activePortfolioReviewSessionId。
    set({
      portfolioReviewSessions: updatedSessions,
      activePortfolioReviewSessionId: newSession.id
    });

    // 9. 持久化到 localStorage：
    //    - key: ai_terminal_portfolio_reviews_${uid}
    localStorage.setItem(`ai_terminal_portfolio_reviews_${user.uid}`, JSON.stringify(updatedSessions));

    // 10. 不要写入 userProfile。
    // 11. 不要写入 agentMemorySnapshots。
    // 12. 不要调用 AI。
    return newSession;
  },
  setActivePortfolioReviewSession: (id) => set({ activePortfolioReviewSessionId: id }),
  updatePortfolioReviewSession: (id, patch) => {
    const { portfolioReviewSessions, user } = get();
    const updated = portfolioReviewSessions.map(s => s.id === id ? { ...s, ...patch } : s);
    set({ portfolioReviewSessions: updated });
    if (user?.uid) {
      localStorage.setItem(`ai_terminal_portfolio_reviews_${user.uid}`, JSON.stringify(updated));
    }
  },
  clearPortfolioReviewSessions: () => {
    const { user } = get();
    set({ portfolioReviewSessions: [], activePortfolioReviewSessionId: undefined });
    if (user?.uid) {
      localStorage.removeItem(`ai_terminal_portfolio_reviews_${user.uid}`);
    }
  },
  analyzePortfolioReviewSession: async (id, userRiskPolicy?: any) => {
    const { portfolioReviewSessions, user, updatePortfolioReviewSession, portfolioReviewMemory } = get();
    if (!user) return;
    
    const session = portfolioReviewSessions.find(s => s.id === id);
    if (!session) return;
    
    // 1. Change status to 'analyzing'
    updatePortfolioReviewSession(id, { status: 'analyzing', error: undefined });
    
    try {
      const settings = getSettings();
      const customApiKey = localStorage.getItem('custom_gemini_api_key') || undefined;

      // Find previous session report chronologically prior to this session
      const otherSessions = portfolioReviewSessions.filter(
        s => s.id !== id && s.report && s.createdAt < session.createdAt
      );
      otherSessions.sort((a, b) => b.createdAt - a.createdAt);
      const prevSession = otherSessions[0];

      const previousReviewSummary = prevSession ? {
        id: prevSession.id,
        createdAt: prevSession.createdAt,
        summary: prevSession.report?.summary,
        actionPlan: prevSession.report?.actionPlan,
        avoidActions: prevSession.report?.portfolioDiagnosis?.avoidActions
      } : null;
      
      const response = await axios.post('/api/portfolio-review/analyze', {
        session,
        settings,
        userRiskPolicy: userRiskPolicy || {},
        customApiKey,
        reviewMemory: portfolioReviewMemory || null,
        previousReviewSummary
      });
      
      if (response.data && response.data.success) {
        updatePortfolioReviewSession(id, {
          status: 'ready',
          report: response.data.report,
          error: undefined
        });
      } else {
        updatePortfolioReviewSession(id, {
          status: 'error',
          error: response.data?.error || '分析失败：服务器返回了无效数据。'
        });
      }
    } catch (err: any) {
      console.error('[Portfolio Review Analyze] Error: ', err);
      updatePortfolioReviewSession(id, {
        status: 'error',
        error: err?.response?.data?.error || err?.message || String(err)
      });
    }
  },
  savePortfolioReviewMemoryFromSession: (sessionId: string, riskPreferenceObserved?: string) => {
    const { portfolioReviewSessions, user } = get();
    if (!user) return;
    
    const session = portfolioReviewSessions.find(s => s.id === sessionId);
    if (!session || !session.report) return;

    const report = session.report;

    // 1. recurringMistakes from avoidActions
    const recurringMistakes = [...(report.portfolioDiagnosis?.avoidActions || [])];

    // 2. lastActionItems: shortTerm and midTerm priority high/medium
    const allShort = report.actionPlan?.shortTerm || [];
    const allMid = report.actionPlan?.midTerm || [];
    const lastActionItems = [...allShort, ...allMid].filter(
      item => item.priority === 'high' || item.priority === 'medium'
    );

    // 3. nextReviewFocus from nextReviewNeeds
    const nextReviewFocus = [...(report.nextReviewNeeds || [])];

    // 4. behavioralPatterns extracted from summary and avoidActions without nested AI calls
    const summarySentences = (report.summary || '')
      .split(/[。！？\.]/)
      .map(s => s.trim())
      .filter(s => s.length > 5)
      .slice(0, 2);
    
    const behavioralPatterns = [
      ...summarySentences,
      ...(report.portfolioDiagnosis?.avoidActions || []).map(act => `规避动作：${act}`)
    ];

    const memory: PortfolioReviewMemory = {
      lastReviewId: session.id,
      updatedAt: Date.now(),
      behavioralPatterns,
      recurringMistakes,
      lastActionItems,
      nextReviewFocus,
      riskPreferenceObserved
    };

    set({ portfolioReviewMemory: memory });

    localStorage.setItem(
      `ai_terminal_portfolio_review_memory_${user.uid}`,
      JSON.stringify(memory)
    );
  }
}));
