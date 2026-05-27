import { useEffect } from 'react';
import { subscribeToAuthChanges, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { TerminalState, LIVE_VALUATION_VERSION } from '../types/terminal';
import { sanitizeTerminalState } from '../lib/sanitizer';
import { useWealthStore, EMPTY_STATE } from './useWealthStore';

export { EMPTY_STATE };

export function useTerminalSync() {
  const { user, loadingAuth, data, setUser, setLoadingAuth, setData, commitData, persistenceMode } = useWealthStore();

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

    const unsubscribeAuth = subscribeToAuthChanges(async (u) => {
      setUser(u);
      
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (u) {
          try {
              const localDataStr = localStorage.getItem(`ai_terminal_data_${u.uid}`);
              const localSnapshotsStr = localStorage.getItem(`ai_terminal_snapshots_${u.uid}`);
              
              if (localSnapshotsStr) {
                  try {
                      useWealthStore.setState({ agentMemorySnapshots: JSON.parse(localSnapshotsStr) });
                  } catch(e) {}
              }
              
              if (persistenceMode === 'auto') {
                 // Auto mode: keep the original behavior with onSnapshot
                 unsubscribeSnapshot = onSnapshot(doc(db, "userProfiles", u.uid), (snapshot) => {
                    if (snapshot.exists()) {
                       const fsData = snapshot.data();
                       let localState: TerminalState = EMPTY_STATE;
                       
                       if (fsData.appData && Object.keys(fsData.appData).length > 0) {
                          localState = { ...EMPTY_STATE, ...fsData.appData };
                       }
                       if (localState?.distributions?.publicHoldings) {
                           const hasNegative = localState.distributions.publicHoldings.some((p: any) => Number(p.marketValue) < 0 || Number(p.value) < 0);
                           const version = Number(localState._liveValuationVersion || 0);
                           if (hasNegative || (version > 0 && version < LIVE_VALUATION_VERSION)) {
                               localState.distributions.publicHoldings = [];
                           }
                       }
                       if (fsData.userProfile) {
                          localState = { ...localState, userProfile: fsData.userProfile };
                       } else if (!fsData.appData && !fsData.chatHistory) {
                          localState = { ...localState, userProfile: fsData };
                       }
                       
                       setData(sanitizeTerminalState(localState) as TerminalState);
                    } else {
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
                 // Disabled or Manual mode: load from localStorage if present
                 if (localDataStr) {
                     let localState = JSON.parse(localDataStr);
                     if (localState?.distributions?.publicHoldings) {
                         const hasNegative = localState.distributions.publicHoldings.some((p: any) => Number(p.marketValue) < 0 || Number(p.value) < 0);
                         const version = Number(localState._liveValuationVersion || 0);
                         if (hasNegative || (version > 0 && version < LIVE_VALUATION_VERSION)) {
                             localState.distributions.publicHoldings = [];
                         }
                     }
                     setData(sanitizeTerminalState(localState) as TerminalState);
                     setLoadingAuth(false);
                 } else if (persistenceMode === 'manual') {
                     // In manual mode, we might want to fetch from cloud once if local is empty
                     const snapshot = await getDoc(doc(db, "userProfiles", u.uid));
                     if (snapshot.exists()) {
                         const fsData = snapshot.data();
                         let localState: TerminalState = EMPTY_STATE;
                         if (fsData.appData && Object.keys(fsData.appData).length > 0) {
                            localState = { ...EMPTY_STATE, ...fsData.appData };
                         }
                         if (localState?.distributions?.publicHoldings) {
                             const hasNegative = localState.distributions.publicHoldings.some((p: any) => Number(p.marketValue) < 0 || Number(p.value) < 0);
                             const version = Number(localState._liveValuationVersion || 0);
                             if (hasNegative || (version > 0 && version < LIVE_VALUATION_VERSION)) {
                                 localState.distributions.publicHoldings = [];
                             }
                         }
                         if (fsData.userProfile) {
                            localState = { ...localState, userProfile: fsData.userProfile };
                         } else if (!fsData.appData && !fsData.chatHistory) {
                            localState = { ...localState, userProfile: fsData };
                         }
                         setData(sanitizeTerminalState(localState) as TerminalState);
                     } else {
                         setData(EMPTY_STATE);
                     }
                     setLoadingAuth(false);
                 } else {
                     setData(EMPTY_STATE);
                     setLoadingAuth(false);
                 }
              }
          } catch (e) {
              console.error("Error setting up sync:", e);
              setData(EMPTY_STATE);
              setLoadingAuth(false);
          }
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
  }, [setUser, setData, setLoadingAuth, persistenceMode]);

  const fetchLongbridgeAccountPortfolios = useWealthStore(state => state.fetchLongbridgeAccountPortfolios);

  useEffect(() => {
    let intervalId: any;

    if (user && !loadingAuth) {
      if (process.env.NODE_ENV !== 'production') console.log('[useTerminalSync] Automount fetchLongbridgeAccountPortfolios Triggered');
      // Execute the initial fetch async to offload the hook immediately
      setTimeout(() => fetchLongbridgeAccountPortfolios(), 0);
      intervalId = setInterval(() => fetchLongbridgeAccountPortfolios(), 60 * 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, loadingAuth, fetchLongbridgeAccountPortfolios]);

  return { user, loadingAuth, data, commitData };
}
