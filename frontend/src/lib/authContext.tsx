import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/react';
import { User } from './types';
import { api } from './api';

interface AuthContextType {
  user: (User & { stats?: any }) | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  demoLogin: (role: 'lender' | 'borrower' | 'admin' | 'creator') => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clerkUser: any;
  isClerkSignedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<(User & { stats?: any }) | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('borrowflex_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn: isClerkSignedIn } = useUser();
  const { signOut: clerkSignOut } = useClerk();

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
      console.warn('Failed to fetch user profile, clearing session:', err);
      localStorage.removeItem('borrowflex_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync with Clerk whenever Clerk authentication status changes
  useEffect(() => {
    if (!isClerkLoaded) return;

    if (isClerkSignedIn && clerkUser) {
      const syncClerkUser = async () => {
        setIsLoading(true);
        try {
          const email = clerkUser.primaryEmailAddress?.emailAddress || `${clerkUser.id}@clerk.rentu.internal`;
          const name = clerkUser.fullName || clerkUser.firstName || clerkUser.username || 'Rentu Member';
          const avatarUrl = clerkUser.imageUrl;
          const phone = clerkUser.primaryPhoneNumber?.phoneNumber;

          const res = await api.clerkSync({
            clerkId: clerkUser.id,
            email,
            name,
            avatarUrl,
            phone,
          });

          localStorage.setItem('borrowflex_token', res.token);
          setToken(res.token);
          setUser(res.user);
        } catch (err) {
          console.error('Failed to sync Clerk account:', err);
        } finally {
          setIsLoading(false);
        }
      };

      syncClerkUser();
    } else {
      // Not signed in with Clerk; load local token profile if present
      if (token) {
        fetchProfile();
      } else {
        setIsLoading(false);
      }
    }
  }, [isClerkLoaded, isClerkSignedIn, clerkUser?.id]);

  // If local token changes (e.g. from demo login)
  useEffect(() => {
    if (token && !isClerkSignedIn) {
      fetchProfile();
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      localStorage.setItem('borrowflex_token', res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: any) => {
    setIsLoading(true);
    try {
      const res = await api.register(data);
      localStorage.setItem('borrowflex_token', res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
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
    if (isClerkSignedIn) {
      try {
        await clerkSignOut();
      } catch (err) {
        console.error('Clerk signOut error:', err);
      }
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
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        demoLogin,
        logout,
        refreshUser,
        clerkUser,
        isClerkSignedIn: !!isClerkSignedIn,
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

