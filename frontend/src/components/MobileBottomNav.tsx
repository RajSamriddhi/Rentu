import React, { useState } from 'react';
import { 
  Compass, 
  Target, 
  Plus, 
  Calendar, 
  User, 
  MessageSquare, 
  Sparkles, 
  X, 
  LogIn 
} from 'lucide-react';
import { useAuth } from '../lib/authContext';

interface MobileBottomNavProps {
  activeTab: 'home' | 'explore' | 'requests' | 'bookings' | 'hustle' | 'profile';
  setActiveTab: (tab: 'home' | 'explore' | 'requests' | 'bookings' | 'hustle' | 'profile') => void;
  onOpenDropGear: () => void;
  onOpenDropWish: () => void;
  onOpenChat: () => void;
  onOpenAuth: () => void;
  onOpenHowItWorks?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenDropGear,
  onOpenDropWish,
  onOpenChat,
  onOpenAuth,
  onOpenHowItWorks,
}) => {
  const { user, isAuthenticated } = useAuth();
  const [showPostSheet, setShowPostSheet] = useState(false);

  return (
    <>
      {/* Post Action Sheet on Mobile (Only visible when user taps the + button) */}
      {showPostSheet && isAuthenticated && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150">
          <div 
            className="fixed inset-0" 
            onClick={() => setShowPostSheet(false)} 
          />
          <div className="relative bg-surface border-t border-divider rounded-t-3xl p-5 shadow-2xl space-y-3 z-10 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-divider">
              <span className="text-xs font-black uppercase text-ink tracking-wider font-display">
                Create on Rentu⁺
              </span>
              <button
                onClick={() => setShowPostSheet(false)}
                className="p-1 rounded-full hover:bg-canvas text-ink-secondary hover:text-ink cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 pt-1">
              <button
                onClick={() => {
                  setShowPostSheet(false);
                  onOpenDropGear();
                }}
                className="w-full text-left p-3.5 rounded-2xl bg-canvas hover:bg-pink-50 dark:hover:bg-pink-950/30 border border-divider flex items-center gap-3 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center text-lg shrink-0">
                  💸
                </div>
                <div>
                  <div className="font-bold text-sm text-ink">List Gear for Rent</div>
                  <div className="text-[11px] text-ink-secondary">Monetize cameras, tools, camping equipment</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowPostSheet(false);
                  onOpenDropWish();
                }}
                className="w-full text-left p-3.5 rounded-2xl bg-canvas hover:bg-purple-50 dark:hover:bg-purple-950/30 border border-divider flex items-center gap-3 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center text-lg shrink-0">
                  🎯
                </div>
                <div>
                  <div className="font-bold text-sm text-ink">Post a Request</div>
                  <div className="text-[11px] text-ink-secondary">Ask neighbors for gear you need to borrow</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Fixed Bottom Navigation Bar */}
      <nav 
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 dark:bg-[#111218]/95 backdrop-blur-md border-t border-divider px-3 py-1.5 flex items-center justify-around shadow-lg pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {/* Tab 1: Explore */}
        <button
          onClick={() => setActiveTab('explore')}
          className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold transition-all cursor-pointer ${
            activeTab === 'explore' ? 'text-brand scale-105' : 'text-ink-secondary hover:text-ink'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span>Explore</span>
        </button>

        {/* Tab 2: Requests */}
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold transition-all cursor-pointer ${
            activeTab === 'requests' ? 'text-brand scale-105' : 'text-ink-secondary hover:text-ink'
          }`}
        >
          <Target className="w-5 h-5" />
          <span>Requests</span>
        </button>

        {/* LOGGED IN: Show Center Post Button + Messages + Profile */}
        {isAuthenticated ? (
          <>
            {/* Center Action: Floating + Post button (ONLY VISIBLE AFTER LOGIN) */}
            <button
              onClick={() => setShowPostSheet(!showPostSheet)}
              className="w-12 h-12 -mt-5 rounded-full bg-brand text-white flex items-center justify-center shadow-pink cursor-pointer transition-transform active:scale-90 hover:scale-105 border-4 border-surface"
              title="Post gear or request"
              aria-label="Create listing or request"
            >
              <Plus className="w-6 h-6 stroke-[3]" />
            </button>

            {/* Tab 4: Messages */}
            <button
              onClick={onOpenChat}
              className="flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold text-ink-secondary hover:text-ink transition-all cursor-pointer relative"
            >
              <MessageSquare className="w-5 h-5" />
              <span>Chat</span>
            </button>

            {/* Tab 5: Profile */}
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold transition-all cursor-pointer ${
                activeTab === 'profile' ? 'text-brand scale-105' : 'text-ink-secondary hover:text-ink'
              }`}
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className={`w-5 h-5 rounded-full object-cover border ${
                    activeTab === 'profile' ? 'border-brand ring-1 ring-brand' : 'border-divider'
                  }`}
                />
              ) : (
                <User className="w-5 h-5" />
              )}
              <span>Profile</span>
            </button>
          </>
        ) : (
          /* LOGGED OUT: No post button, show How it Works and Log In */
          <>
            {/* Tab 3: How it Works */}
            <button
              onClick={() => onOpenHowItWorks?.()}
              className="flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold text-ink-secondary hover:text-ink transition-all cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              <span>How it works</span>
            </button>

            {/* Tab 4: Sign In */}
            <button
              onClick={onOpenAuth}
              className="flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold text-brand transition-all cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              <span>Sign In</span>
            </button>
          </>
        )}
      </nav>
    </>
  );
};
