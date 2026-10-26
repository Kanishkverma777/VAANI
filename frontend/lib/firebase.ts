import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  Auth,
} from 'firebase/auth';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import { apiClient, setStoredToken, setStoredUser, clearStoredToken } from './api-client';

// Your web app's Firebase configuration provided by Firebase Console
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDRfFR9DrK_K3Fo-SGequP17S3c2G4HVKU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "vaani-372c2.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "vaani-372c2",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "vaani-372c2.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "210979202294",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:210979202294:web:b4a0a9a101c37f9d58b8d7",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-4W188Z8NFT",
};

// Safe initialization (singleton prevents re-initialization during hot reloading)
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Client-side Analytics initialization
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {});
}

/**
 * Synchronize Firebase user session with FastAPI backend and local storage
 */
export async function syncFirebaseWithBackend(firebaseUser: User): Promise<{ access_token: string; user: any }> {
  const idToken = await firebaseUser.getIdToken();
  try {
    const res = await apiClient<{ access_token: string; user: any }>('/api/v1/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        id_token: idToken,
        display_name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        photo_url: firebaseUser.photoURL || undefined,
      }),
    });
    setStoredToken(res.access_token);
    setStoredUser(
      res.user || {
        email: firebaseUser.email || '',
        full_name: firebaseUser.displayName || 'User',
      }
    );
    return res;
  } catch (err) {
    // Graceful fallback: set local storage with Firebase session so the user is never blocked
    setStoredToken(idToken);
    const fallbackUser = {
      email: firebaseUser.email || '',
      full_name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    };
    setStoredUser(fallbackUser);
    return { access_token: idToken, user: fallbackUser };
  }
}

/**
 * Sign in with Google Popup
 */
export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return await syncFirebaseWithBackend(result.user);
}

/**
 * Sign in with Email & Password
 */
export async function loginWithEmail(email: string, pass: string) {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return await syncFirebaseWithBackend(result.user);
}

/**
 * Register with Email & Password
 */
export async function registerWithEmail(email: string, pass: string, displayName?: string) {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName && result.user) {
    try {
      await updateProfile(result.user, { displayName });
    } catch {}
  }
  return await syncFirebaseWithBackend(result.user);
}

/**
 * Sign Out from Firebase and clear local storage
 */
export async function logoutUser() {
  try {
    await firebaseSignOut(auth);
  } catch {}
  clearStoredToken();
}

/**
 * Listen to auth state changes
 */
export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
