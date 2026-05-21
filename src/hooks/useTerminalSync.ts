import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { subscribeToAuthChanges, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { TerminalState } from '../types/terminal';
import { sanitizeTerminalState } from '../lib/sanitizer';
import { mergeWith, isArray, debounce } from 'lodash-es';
import { DEFAULT_DASHBOARD_SCHEMA } from '../lib/default-schema';
import { getSettings } from '../lib/settings';

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

export function useTerminalSync() {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [data, setData] = useState<TerminalState>(EMPTY_STATE);

  useEffect(() => {
    const isTestMode = new URLSearchParams(window.location.search).get('test') === '1';
    
    if (isTestMode) {
       const dummyUser = { uid: 'test-user', displayName: 'Test User' };
       setUser(dummyUser);
       setData(EMPTY_STATE);
       setLoadingAuth(false);
       return;
    }

    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = subscribeToAuthChanges((u) => {
      setUser(u);
      
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (u) {
         unsubscribeSnapshot = onSnapshot(doc(db, "userProfiles", u.uid), (snapshot) => {
            if (snapshot.exists()) {
               const fsData = snapshot.data();
               let localState: TerminalState = EMPTY_STATE;
               
               if (fsData.appData && Object.keys(fsData.appData).length > 0) {
                  localState = { ...EMPTY_STATE, ...fsData.appData };
               }
               if (fsData.userProfile) {
                  localState = { ...localState, userProfile: fsData.userProfile };
               } else if (!fsData.appData && !fsData.chatHistory) {
                  localState = { ...localState, userProfile: fsData };
               }
               
               setData(sanitizeTerminalState(localState) as TerminalState);
            } else {
               // 💥 修复清空残留：如果远程文档被删除了，本地立刻归零
               console.log("Terminal: Remote document deleted, resetting local state.");
               setData(EMPTY_STATE);
            }
            setLoadingAuth(false);
         }, (error) => {
            console.error("Firestore sync error:", error);
            setLoadingAuth(false);
            handleFirestoreError(error, OperationType.GET, `userProfiles/${u.uid}`);
         });
      } else {
         setData(EMPTY_STATE);
         setLoadingAuth(false);
      }
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  useEffect(() => {
    let intervalId: any;
    const fetchLongbridge = async () => {
      const settings = getSettings();
      if (!settings.longbridgeAccounts || settings.longbridgeAccounts.length === 0) return;
      if (!user) return;
      
      try {
        const headerValue = btoa(encodeURIComponent(JSON.stringify(settings.longbridgeAccounts)));
        const response = await axios.get('/api/v1/wealth/longbridge/positions', {
            headers: {
                'X-Longbridge-Accounts': headerValue,
                'Cache-Control': 'no-cache'
            },
            params: {
                _t: Date.now()
            }
        });
        
        if (response.data && response.data.success && response.data.data) {
            commitData((prevData: any) => ({
                ...prevData,
                distributions: {
                    ...prevData.distributions,
                    publicHoldings: response.data.data
                },
                _liveSources: ['longbridge']
            }));
        }
      } catch (err) {
        console.error('[Longbridge] error fetching positions via API:', err);
      }
    };

    if (user && !loadingAuth) {
      // First fetch
      fetchLongbridge();
      // Poll every 60s
      intervalId = setInterval(fetchLongbridge, 60 * 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, loadingAuth]);

  const commitData = useCallback((newDataOrUpdater: any) => {
    setData((prev: TerminalState) => {
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

      if (user?.uid) {
          localStorage.setItem(`ai_terminal_data_${user.uid}`, JSON.stringify(fullData));
          const appDataToSave = { ...fullData };
          delete appDataToSave.userProfile; // RAG profile saved separately in the same doc
          debouncedSyncToCloud(user.uid, { appData: appDataToSave, userProfile: fullData.userProfile });
      }
      return fullData;
    });
  }, [user?.uid]);

  return { user, data, loadingAuth, commitData };
}
