import { create } from 'zustand';
import axios from 'axios';
import { getSettings } from '../lib/settings';
import { TerminalState, LIVE_VALUATION_VERSION } from '../types/terminal';
import { sanitizeTerminalState } from '../lib/sanitizer';
import { mergeWith, isArray, debounce } from 'lodash-es';
import { setDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirestoreQuotaExceeded } from '../lib/firebase';
import { DEFAULT_DASHBOARD_SCHEMA } from '../lib/default-schema';

export const EMPTY_STATE: TerminalState = {
  userPersona: { tags: [], description: "唤起总监生成您的个人资产画像模型" },
  userProfile: {},
  metrics: { 
    netWorth: 0, 
    liquidity: 0, 
    safetyRatio: 0, 
    safetyRatioSummary: '当前流动性支撑乘数',
    fcf: 0,
    fcfSummary: '测算月结余'
  },
  distributions: { liquidity: [], expenses: [], privateAssets: [], publicHoldings: [], fixedAssets: [], options: [] },
  goal: { name: '等待设定目标', current: 0, target: 1, index: 0 },
  insights: { global: "等待数据注入...", private: "暂无非公开资产数据" },
  lifeStrategiesShort: [],
  lifeStrategiesLong: [],
  dynamicWidgets: [],
  dashboardSchema: DEFAULT_DASHBOARD_SCHEMA,
  historicalSnapshots: [],
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
  clearData: () => void;
  selectedHolding: any | null;
  setSelectedHolding: (holding: any) => void;
  fetchLongbridge: () => Promise<void>;
  language: 'zh-CN' | 'en-US';
  setLanguage: (lang: 'zh-CN' | 'en-US') => void;
  publicHoldingsSyncStatus: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  publicHoldingsError?: string;
  publicHoldingsLastSyncAt?: number;
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
  language: 'zh-CN',
  setLanguage: (lang) => set({ language: lang }),
  selectedHolding: null,
  setSelectedHolding: (holding) => set({ selectedHolding: holding }),
  setUser: (user) => set({ user }),
  setLoadingAuth: (loadingAuth) => set({ loadingAuth }),
  setData: (newData, options) => set((state) => {
    const shouldPreserve = options?.preserveLiveData !== false;
    
    if (shouldPreserve) {
        const preserved = preserveLiveLongbridgeSlice(state.data, newData);
        if (preserved) {
            return {
                data: newData,
                publicHoldingsSyncStatus: state.publicHoldingsSyncStatus,
                publicHoldingsLastSyncAt: state.publicHoldingsLastSyncAt,
                publicHoldingsError: state.publicHoldingsError
            };
        }
    }
    return { data: newData };
  }),
  clearData: () => {
    set({ data: JSON.parse(JSON.stringify(EMPTY_STATE)), agentMemorySnapshots: [], publicHoldingsSyncStatus: 'empty', publicHoldingsError: undefined, publicHoldingsLastSyncAt: undefined });
    const { user, persistenceMode } = get();
    if (user?.uid) {
        localStorage.removeItem(`ai_terminal_data_${user.uid}`);
        localStorage.removeItem(`ai_terminal_snapshots_${user.uid}`);
        localStorage.removeItem(`ai_terminal_position_snapshots_${user.uid}`);
        localStorage.removeItem(`ai_terminal_chat_${user.uid}`);
        localStorage.removeItem('arbitra_app_settings');
        localStorage.removeItem('custom_gemini_api_key');
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

      if (state.user?.uid) {
          localStorage.setItem(`ai_terminal_data_${state.user.uid}`, JSON.stringify(fullData));
          
          if (state.persistenceMode === 'auto') {
              const appDataToSave = { ...fullData };
              delete appDataToSave.userProfile;
              debouncedSyncToCloud(state.user.uid, { appData: appDataToSave, userProfile: fullData.userProfile });
          }
      }

      return { data: fullData };
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

              const prevData = state.data;
              const nextData = {
                  ...prevData,
                  distributions: {
                      ...prevData.distributions,
                      publicHoldings: newData
                  },
                  _liveSources: ['longbridge'],
                  _liveValuationVersion: LIVE_VALUATION_VERSION,
                  _liveFetchedAt: Date.now()
              };
              
              const totalMktVal = newData.reduce((sum: number, p: any) => sum + getSafeMktVal(p), 0);
              
              const snapshot = {
                 timestamp: Date.now(),
                 totalMarketValue: totalMktVal,
                 topHoldings: [...newData].sort((a: any, b: any) => getSafeMktVal(b) - getSafeMktVal(a)).slice(0, 5).map(h => ({ symbol: h.symbol, marketValue: getSafeMktVal(h), quantity: h.quantity })),
                 source: 'longbridge',
                 quoteCoverage: meta.quoteCoverage,
                 missingQuoteSymbols: meta.missingQuoteSymbols
              };
              
              const newSnapshots = [snapshot, ...state.agentMemorySnapshots].slice(0, 10);
              
              if (state.user?.uid) {
                  localStorage.setItem(`ai_terminal_data_${state.user.uid}`, JSON.stringify(nextData));
                  localStorage.setItem(`ai_terminal_snapshots_${state.user.uid}`, JSON.stringify(newSnapshots));
              }

              if (process.env.NODE_ENV !== 'production') console.log(`[useWealthStore] fetchLongbridge success, updated ${newData.length} positions`);

              let syncStatus: WealthState['publicHoldingsSyncStatus'] = newData.length === 0 ? 'empty' : 'success';
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
  }
}));
