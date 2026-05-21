import { useEffect } from 'react';
import axios from 'axios';
import { subscribeToAuthChanges, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { TerminalState } from '../types/terminal';
import { sanitizeTerminalState } from '../lib/sanitizer';
import { getSettings } from '../lib/settings';
import { useWealthStore, EMPTY_STATE } from './useWealthStore';

export { EMPTY_STATE };

export function useTerminalSync() {
  const { user, loadingAuth, data, setUser, setLoadingAuth, setData, commitData } = useWealthStore();

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
  }, [setUser, setData, setLoadingAuth]);

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
  }, [user, loadingAuth, commitData]);

  // We return user and loadingAuth so App can block UI while starting up
  return { user, loadingAuth, data, commitData }; // kept data & commitData for backward compat but App will stop using them
}
