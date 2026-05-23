import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from '../../firebase-applet-config.json';

const env = import.meta.env;
const requiredFirebaseEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;
const usingEnvFirebaseProject = requiredFirebaseEnvKeys.some(key => Boolean(env[key]));

if (usingEnvFirebaseProject) {
  const missingKeys = requiredFirebaseEnvKeys.filter(key => !env[key]);
  if (missingKeys.length > 0) {
    throw new Error(`Missing Firebase environment variables: ${missingKeys.join(', ')}`);
  }
}

const resolvedFirebaseConfig = {
  apiKey: usingEnvFirebaseProject ? env.VITE_FIREBASE_API_KEY : firebaseConfig.apiKey,
  authDomain: usingEnvFirebaseProject ? env.VITE_FIREBASE_AUTH_DOMAIN : firebaseConfig.authDomain,
  projectId: usingEnvFirebaseProject ? env.VITE_FIREBASE_PROJECT_ID : firebaseConfig.projectId,
  storageBucket: usingEnvFirebaseProject ? env.VITE_FIREBASE_STORAGE_BUCKET : firebaseConfig.storageBucket,
  messagingSenderId: usingEnvFirebaseProject ? env.VITE_FIREBASE_MESSAGING_SENDER_ID : firebaseConfig.messagingSenderId,
  appId: usingEnvFirebaseProject ? env.VITE_FIREBASE_APP_ID : firebaseConfig.appId,
  measurementId: usingEnvFirebaseProject ? env.VITE_FIREBASE_MEASUREMENT_ID : firebaseConfig.measurementId,
};

const firestoreDatabaseId = env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || (usingEnvFirebaseProject ? '(default)' : firebaseConfig.firestoreDatabaseId);

const app = initializeApp(resolvedFirebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firestoreDatabaseId);

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
  } catch (error: any) {
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
      return signInWithRedirect(auth, provider);
    }
    throw error;
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
