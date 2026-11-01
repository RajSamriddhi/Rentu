import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fbSignOut,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB6ah1Pz0RdCilzVhUvra-6Yl0TIeDmFtY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "rentu-732b7.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "rentu-732b7",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "rentu-732b7.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1009683861079",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1009683861079:web:389e73ee13af411ba69d12",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-GCD80T1NWM"
};

// Initialize or reuse Firebase App instance safely
let app: any;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (err) {
  console.warn('Firebase initializeApp error:', err);
}

let authInstance: any = null;
try {
  if (app) {
    authInstance = getAuth(app);
  }
} catch (err) {
  console.warn('Firebase getAuth error:', err);
}

export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();
try {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch {
  // Ignore fallback
}

export type { FirebaseUser };
export { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  fbSignOut, 
  updateProfile, 
  onAuthStateChanged 
};
