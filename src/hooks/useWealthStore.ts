import { create } from 'zustand';
import { TerminalState } from '../types/terminal';
import { sanitizeTerminalState } from '../lib/sanitizer';
import { mergeWith, isArray, debounce } from 'lodash-es';
import { setDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
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

const debouncedSyncToCloud = debounce((uid: string, payload: any) => {
  setDoc(doc(db, "userProfiles", uid), payload, { merge: true })
    .catch(e => {
        console.error("Failed to commit appData to firestore:", e);
        handleFirestoreError(e, OperationType.WRITE, `userProfiles/${uid}`);
    });
}, 2000);

interface WealthState {
  data: TerminalState;
  user: any;
  loadingAuth: boolean;
  setUser: (user: any) => void;
  setLoadingAuth: (loadingAuth: boolean) => void;
  setData: (data: TerminalState) => void;
  commitData: (newDataOrUpdater: any) => void;
  clearData: () => void;
}

export const useWealthStore = create<WealthState>((set, get) => ({
  data: EMPTY_STATE,
  user: null,
  loadingAuth: true,
  setUser: (user) => set({ user }),
  setLoadingAuth: (loadingAuth) => set({ loadingAuth }),
  setData: (newData) => set((state) => {
    // 💥 竞态修复：如果当前已经在通过 Live API (如长桥) 轮询拉取数据，
    // 则拒绝接受 Firestore onSnapshot 传来的旧 publicHoldings，防止最新持仓被覆盖为空或旧值
    if (state.data?._liveSources?.includes('longbridge')) {
      if (!newData.distributions) newData.distributions = { liquidity: [], expenses: [], privateAssets: [], publicHoldings: [], fixedAssets: [], options: [] };
      newData.distributions.publicHoldings = state.data.distributions.publicHoldings;
      newData._liveSources = state.data._liveSources;
    }
    return { data: newData };
  }),
  clearData: () => {
    set({ data: EMPTY_STATE });
    const { user } = get();
    if (user?.uid) {
        localStorage.removeItem(`ai_terminal_data_${user.uid}`);
        debouncedSyncToCloud(user.uid, { appData: EMPTY_STATE, userProfile: EMPTY_STATE.userProfile });
    }
  },
  commitData: (newDataOrUpdater) => {
    set((state) => {
      const prev = state.data;
      const rawNewData = typeof newDataOrUpdater === 'function' ? newDataOrUpdater(prev) : newDataOrUpdater;
      const newData = sanitizeTerminalState(rawNewData) as TerminalState;
      
      // 使用 mergeWith 进行防御性合并，并在遇到数组时直接覆盖，防止出现数组索引混合污染
      const fullData = mergeWith({}, prev, newData, (objValue, srcValue) => {
        if (isArray(srcValue)) {
          return srcValue; // 数组全量替换，不执行深度合并
        }
      });
      
      // 💥 新增：时序快照拦截器 (Temporal Snapshot Interceptor)
      // 只有当用户真的有资产，且核心资产/指标发生实质性变化时，才进行快照
      if (prev.metrics?.netWorth > 0) {
        const coreChanged = 
          JSON.stringify(prev.distributions) !== JSON.stringify(fullData.distributions) || 
          JSON.stringify(prev.metrics) !== JSON.stringify(fullData.metrics);

        if (coreChanged) {
          const history = prev.historicalSnapshots || [];
          const lastSnap = history[0];
          // 防抖：如果距离上次快照不到 5 分钟，则不重复记录，避免频繁的微调污染时序
          if (!lastSnap || (Date.now() - lastSnap.timestamp > 5 * 60 * 1000)) {
            const newSnapshot = {
              timestamp: Date.now(),
              metrics: prev.metrics,
              distributions: prev.distributions
            };
            fullData.historicalSnapshots = [newSnapshot, ...history].slice(0, 5); // 永远只保留最近 5 次核心变更
          } else {
            fullData.historicalSnapshots = history;
          }
        } else {
          fullData.historicalSnapshots = prev.historicalSnapshots;
        }
      }

      if (state.user?.uid) {
          localStorage.setItem(`ai_terminal_data_${state.user.uid}`, JSON.stringify(fullData));
          const appDataToSave = { ...fullData };
          delete appDataToSave.userProfile; // RAG profile saved separately in the same doc
          debouncedSyncToCloud(state.user.uid, { appData: appDataToSave, userProfile: fullData.userProfile });
      }

      return { data: fullData };
    });
  }
}));
