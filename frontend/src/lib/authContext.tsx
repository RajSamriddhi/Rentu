import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from './types';
import { api } from './api';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
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
  continueWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string }) => Promise<void>;
  demoLogin: (role: 'lender' | 'borrower' | 'admin' | 'creator') => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<(User & { stats?: any }) | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('borrowflex_token'));
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    if (!localStorage.getItem('borrowflex_token')) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await api.getMe();
      setUser(profile);
    } catch (err) {
      console.warn('Failed to fetch user profile, clearing local session:', err);
      localStorage.removeItem('borrowflex_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync Firebase authenticated user with the Rentu⁺ database
  const syncFirebaseUser = async (fbUser: FirebaseUser) => {
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

    // Immediately establish local session and token so user is authenticated for API calls
    const idToken = await fbUser.getIdToken().catch(() => null);
    const initialToken = idToken || `fb_${fbUser.uid}`;
    localStorage.setItem('borrowflex_token', initialToken);
    setToken(initialToken);

    try {
      const res = await api.firebaseSync({
        firebaseUid: fbUser.uid,
        email,
        name,
        avatarUrl,
        phone,
      });

      if (res && res.token && res.user) {
        localStorage.setItem('borrowflex_token', res.token);
        setToken(res.token);
        setUser(res.user);
      }
    } catch (err) {
      console.warn('Backend sync failed, continuing with Firebase verified profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await syncFirebaseUser(fbUser);
      } else {
        // If not logged into Firebase, check if local demo token is active
        const localToken = localStorage.getItem('borrowflex_token');
        if (localToken && !localToken.startsWith('fb_')) {
          fetchProfile();
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Google Sign-In with popup
  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await syncFirebaseUser(result.user);
      }
    } catch (err: any) {
      setIsLoading(false);
      console.error('Firebase Google Sign-In error:', err);
      throw err;
    }
  };

  // Unified Email Auth: Signs in if user exists, or creates new account seamlessly
  const continueWithEmail = async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    const cleanEmail = email.trim();
    try {
      // 1. First attempt to sign in
      const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
      if (result.user) {
        await syncFirebaseUser(result.user);
        return;
      }
    } catch (signInErr: any) {
      const isNotFound = 
        signInErr.code === 'auth/user-not-found' || 
        signInErr.code === 'auth/invalid-credential';

      if (isNotFound) {
        // 2. User doesn't exist yet, automatically create their account
        try {
          const createResult = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          if (createResult.user) {
            const displayName = name?.trim() || cleanEmail.split('@')[0] || 'Rentu Member';
            await updateProfile(createResult.user, { displayName });
            await syncFirebaseUser(createResult.user);
            return;
          }
        } catch (createErr: any) {
          setIsLoading(false);
          // If creation says email already in use, it was an incorrect password
          if (createErr.code === 'auth/email-already-in-use') {
            throw new Error('Incorrect password for this email account.');
          }
          throw createErr;
        }
      } else {
        setIsLoading(false);
        throw signInErr;
      }
    }
  };

  // Email & Password login
  const loginWithEmail = async (email: string, password: string) => {
    await continueWithEmail(email, password);
  };

  // Email & Password signup
  const signupWithEmail = async (email: string, password: string, name: string) => {
    await continueWithEmail(email, password, name);
  };

  const login = async (email: string, password: string) => {
    await continueWithEmail(email, password);
  };

  const register = async (data: { email: string; password: string; name: string }) => {
    await continueWithEmail(data.email, data.password, data.name);
  };

  const demoLogin = async (role: 'lender' | 'borrower' | 'admin' | 'creator') => {
    setIsLoading(true);
    try {
      const res = await api.demoLogin(role);
      localStorage.setItem('borrowflex_token', res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('borrowflex_token');
    setToken(null);
    setUser(null);
    setFirebaseUser(null);
    try {
      await fbSignOut(auth);
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
