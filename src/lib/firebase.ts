import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import bundledFirebaseConfig from '../../firebase-applet-config.json';

type FirebaseClientConfig = typeof bundledFirebaseConfig;

const envFirebaseConfig: FirebaseClientConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

const hasEnvFirebaseConfig =
  Boolean(envFirebaseConfig.projectId) &&
  Boolean(envFirebaseConfig.appId) &&
  Boolean(envFirebaseConfig.apiKey) &&
  Boolean(envFirebaseConfig.authDomain) &&
  Boolean(envFirebaseConfig.storageBucket) &&
  Boolean(envFirebaseConfig.messagingSenderId);

const firebaseConfig = hasEnvFirebaseConfig ? envFirebaseConfig : bundledFirebaseConfig;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
import { initializeFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getStorage } from "firebase/storage";
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
// Removed testConnection(); to save reads

export const storage = getStorage(app);

const provider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const canFallbackToAnonymous =
      message.includes('auth/configuration-not-found') ||
      message.includes('auth/invalid-continue-uri') ||
      message.includes('auth/operation-not-allowed') ||
      message.includes('auth/popup-closed-by-user') ||
      message.includes('auth/unauthorized-domain') ||
      message.includes('CONFIGURATION_NOT_FOUND') ||
      message.includes('INVALID_CONTINUE_URI') ||
      message.includes('INVALID_CONFIG');

    if (!canFallbackToAnonymous) {
      throw error;
    }

    console.warn('Google sign-in is not configured for this Firebase project. Falling back to anonymous sign-in.');
    return await signInAnonymously(auth);
  }
};
export const logout = () => signOut(auth);

export const subscribeToAuthChanges = (callback: (user: any) => void) => {
  return onAuthStateChanged(auth, callback);
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export let isFirestoreQuotaExceeded = false;

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Ignore quota limit exceeded errors gracefully without throwing UI exceptions
  if (errorMessage.includes('resource-exhausted') || errorMessage.includes('Quota limit exceeded')) {
    isFirestoreQuotaExceeded = true;
    console.warn(`Firestore Quota Exceeded for ${operationType} on ${path}. Continuing with local state.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
