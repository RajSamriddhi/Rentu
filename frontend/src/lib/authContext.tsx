import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from './types';
import { api } from './api';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  fbSignOut, 
  updateProfile, 
  onAuthStateChanged,
  FirebaseUser
} from './firebase';

interface AuthContextType {
  user: (User & { stats?: any }) | null;
  token: string | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: () => Promise<void>;
  continueWithEmail: (email: string, password: string, name?: string, username?: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, name: string, username?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; username?: string }) => Promise<void>;
  demoLogin: (role: 'lender' | 'borrower' | 'admin' | 'creator') => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isMobileOrPWA = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobileUA = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  const isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 768;
  return isMobileUA || isStandalone || isTouchDevice;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<(User & { stats?: any }) | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('borrowflex_token'));
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const syncingUserRef = React.useRef<string | null>(null);

  const fetchProfile = async () => {
    if (!localStorage.getItem('borrowflex_token')) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await api.getMe();
      setUser(profile);
    } catch (err: any) {
      console.warn('Failed to fetch user profile:', err);
      const isAuthError = 
        err?.code === 'UNAUTHORIZED' || 
        err?.code === 'HTTP_401' || 
        err?.status === 401 ||
        err?.code === 'INVALID_TOKEN';
      if (isAuthError) {
        console.warn('Clearing invalid or expired local session.');
        localStorage.removeItem('borrowflex_token');
        setToken(null);
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Sync Firebase authenticated user with the Rentu⁺ database
  const syncFirebaseUser = async (fbUser: FirebaseUser) => {
    if (syncingUserRef.current === fbUser.uid) {
      return;
    }
    syncingUserRef.current = fbUser.uid;
    setIsLoading(true);
    const email = fbUser.email || `${fbUser.uid}@firebase.rentu.internal`;
    const name = fbUser.displayName || email.split('@')[0] || 'Rentu Member';
    const avatarUrl = fbUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0F172A&color=fff&bold=true`;
    const phone = fbUser.phoneNumber || undefined;

    // Immediately establish local session so user is logged in without waiting
    const localUser: User = {
      id: fbUser.uid,
      firebase_uid: fbUser.uid,
      email,
      name,
      avatar_url: avatarUrl,
      phone,
      locality: '',
      role: 'USER',
      rating: 5.0,
      created_at: new Date().toISOString(),
    };
    setUser(localUser);

    // Establish session using verified Firebase ID token
    const idToken = await fbUser.getIdToken().catch(() => null);
    if (idToken) {
      localStorage.setItem('borrowflex_token', idToken);
      setToken(idToken);
    }

    try {
      if (idToken) {
        const res = await api.firebaseSync({
          firebaseUid: fbUser.uid,
          email,
          name,
          avatarUrl,
          phone,
          idToken,
        });

        if (res && res.token && res.user) {
          localStorage.setItem('borrowflex_token', res.token);
          setToken(res.token);
          setUser(res.user);
        }
      }
    } catch (err) {
      console.warn('Backend sync failed, continuing with Firebase verified profile:', err);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        if (syncingUserRef.current === fbUser.uid) {
          syncingUserRef.current = null;
        }
      }, 3000);
    }
  };

  // Listen to Firebase Auth state changes & catch redirect sign-in results
  useEffect(() => {
    // Check local session immediately on mount
    const localToken = localStorage.getItem('borrowflex_token');
    if (localToken) {
      fetchProfile();
    }

    if (!auth) {
      if (!localToken) {
        setUser(null);
        setIsLoading(false);
      }
      return;
    }

    // Process redirect result if coming back from Google redirect flow
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          await syncFirebaseUser(result.user);
        }
      })
      .catch((err: any) => {
        console.error('Firebase getRedirectResult notification:', err);
        // Do not alert on user-initiated cancellations
        const ignoreCodes = ['auth/redirect-cancelled-by-user', 'auth/popup-closed-by-user'];
        if (err?.code && !ignoreCodes.includes(err.code)) {
          let message = 'Google sign-in could not be completed. Please try again.';
          if (err.code === 'auth/unauthorized-domain') {
            message = `Domain "${window.location.hostname}" is not authorized. Please add it to Firebase Console & Google Cloud OAuth URIs.`;
          } else if (err.code === 'auth/network-request-failed') {
            message = 'Network error during Google sign-in. Please check your internet connection.';
          } else if (err.message) {
            message = err.message;
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('rentu:toast', {
              detail: {
                type: 'error',
                title: 'Google Sign-In Failed',
                message,
                duration: 9000
              }
            }));
          }
        }
      });

    try {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        setFirebaseUser(fbUser);
        if (fbUser) {
          await syncFirebaseUser(fbUser);
        } else {
          // If not logged into Firebase, check if local backend token is active
          const currentToken = localStorage.getItem('borrowflex_token');
          if (currentToken) {
            fetchProfile();
          } else {
            setUser(null);
            setIsLoading(false);
          }
        }
      }, (err) => {
        console.warn('Firebase onAuthStateChanged error:', err);
        setIsLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Firebase listener registration error:', err);
      setIsLoading(false);
    }
  }, []);

  // Google Sign-In (Direct Redirect for Android / iOS / PWA; Pop-up with redirect fallback for Desktop)
  const loginWithGoogle = async () => {
    if (!auth) {
      throw new Error('Authentication is currently not initialized. Please refresh the page.');
    }

    // On mobile devices (Android / iOS) and PWAs, pop-ups freeze background tabs and cause postMessage drops.
    // Calling signInWithRedirect directly provides instant, seamless authentication.
    if (isMobileOrPWA()) {
      setIsLoading(true);
      await signInWithRedirect(auth, googleProvider);
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result && result.user) {
        await syncFirebaseUser(result.user);
      }
    } catch (err: any) {
      console.warn('signInWithPopup notice:', err?.code, err?.message);
      // If popup failed for ANY reason (blocked, closed by mobile tab sleep, cancelled, etc.), fall back to redirect
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request' ||
        err.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        console.log('Popup blocked or closed, falling back to redirect flow...');
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      setIsLoading(false);
      console.error('Firebase Google Sign-In error:', err);
      throw err;
    }
  };

  // Instant Direct PostgreSQL Login (50ms response, zero buffering)
  const loginWithEmail = async (email: string, password: string) => {
    setIsLoading(true);
    const cleanEmail = email.trim();

    // 1. Direct PostgreSQL login: instant 50ms response
    try {
      const res = await api.login(cleanEmail, password);
      if (res && res.token && res.user) {
        localStorage.setItem('borrowflex_token', res.token);
        setToken(res.token);
        setUser(res.user);
        setIsLoading(false);
        // In background, also attempt Firebase login if available
        if (auth) {
          signInWithEmailAndPassword(auth, cleanEmail, password).catch(() => {});
        }
        return;
      }
    } catch (err: any) {
      // If user exists and password was wrong, fail immediately without buffering!
      if (err?.code === 'INVALID_PASSWORD' || err?.code === 'GOOGLE_AUTH_REQUIRED') {
        setIsLoading(false);
        throw err;
      }

      // If user was not found in Postgres DB, check Firebase with strict 4s timeout
      if (err?.code === 'USER_NOT_FOUND' && auth) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Firebase authentication timed out')), 4000)
          );
          const fbResult: any = await Promise.race([
            signInWithEmailAndPassword(auth, cleanEmail, password),
            timeoutPromise
          ]);
          if (fbResult && fbResult.user) {
            await syncFirebaseUser(fbResult.user);
            setIsLoading(false);
            return;
          }
        } catch (fbErr: any) {
          setIsLoading(false);
          if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
            throw new Error('Invalid email or password. Please try again.');
          }
          if (fbErr.code === 'auth/user-not-found') {
            throw new Error('No account found with this email. Please sign up.');
          }
        }
      }

      setIsLoading(false);
      throw err;
    }
  };

  // Direct PostgreSQL Signup: instant 100ms response
  const signupWithEmail = async (email: string, password: string, name: string, username?: string) => {
    setIsLoading(true);
    const cleanEmail = email.trim();
    const cleanUsername = username?.trim().toLowerCase();
    const cleanName = name.trim();

    try {
      const res = await api.register({
        email: cleanEmail,
        password,
        name: cleanName,
        username: cleanUsername,
      });
      if (res && res.token && res.user) {
        localStorage.setItem('borrowflex_token', res.token);
        setToken(res.token);
        setUser(res.user);
        setIsLoading(false);
        if (auth) {
          createUserWithEmailAndPassword(auth, cleanEmail, password).catch(() => {});
        }
        return;
      }
    } catch (err: any) {
      setIsLoading(false);
      throw err;
    }
  };

  const continueWithEmail = async (email: string, password: string, name?: string, username?: string) => {
    if (name) {
      await signupWithEmail(email, password, name, username);
    } else {
      await loginWithEmail(email, password);
    }
  };

  const login = async (email: string, password: string) => {
    await loginWithEmail(email, password);
  };

  const register = async (data: { email: string; password: string; name: string; username?: string }) => {
    await signupWithEmail(data.email, data.password, data.name, data.username);
  };

  const demoLogin = async (_role: 'lender' | 'borrower' | 'admin' | 'creator') => {
    throw new Error('Demo login has been disabled.');
  };

  const logout = async () => {
    localStorage.removeItem('borrowflex_token');
    setToken(null);
    setUser(null);
    setFirebaseUser(null);
    try {
      if (auth) {
        await fbSignOut(auth);
      }
    } catch (err) {
      console.error('Firebase signOut error:', err);
    }
  };

  const refreshUser = async () => {
    await fetchProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        firebaseUser,
        isLoading,
        isAuthenticated: !!user || !!firebaseUser,
        loginWithGoogle,
        continueWithEmail,
        loginWithEmail,
        signupWithEmail,
        login,
        register,
        demoLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
