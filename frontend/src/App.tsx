import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { CategoryTiles } from './components/CategoryTiles';
import { ExploreView } from './components/ExploreView';
import { RequestsBoard } from './components/RequestsBoard';
import { BookingsView } from './components/BookingsView';
import { ProfileView } from './components/ProfileView';
import { HustleHub } from './components/HustleHub';
import { ItemDetailModal } from './components/ItemDetailModal';
import { EditItemModal } from './components/EditItemModal';
import { DropGearModal } from './components/DropGearModal';
import { DropWishModal } from './components/DropWishModal';
import { MessagesView } from './components/MessagesView';
import { CommunityView } from './components/CommunityView';
import { HowItWorksSection } from './components/HowItWorksSection';
import { MobileBottomNav } from './components/MobileBottomNav';
import { AuthModal } from './components/AuthModal';
import { HelpSupportModal } from './components/HelpSupportModal';
import { SettingsModal } from './components/SettingsModal';
import { SetLocationModal } from './components/SetLocationModal';
import { ItemCard } from './components/ItemCard';
import { PublicProfileView } from './components/PublicProfileView';
import { useAuth } from './lib/authContext';
import { api } from './lib/api';
import { Item, CommunityRequest, isAuthorizedAdmin } from './lib/types';
import confetti from 'canvas-confetti';
import { CheckCircle2, AlertCircle, X, ArrowRight } from 'lucide-react';

export type TabType = 'home' | 'explore' | 'requests' | 'bookings' | 'messages' | 'community' | 'hustle' | 'profile';

const RESERVED_ROUTES = new Set([
  'admin',
  'requests',
  'bookings',
  'booking',
  'messages',
  'chat',
  'community',
  'profile',
  'explore',
  'marketplace',
  'api',
  'login',
  'signup',
  'register',
  'auth',
  'terms',
  'privacy',
  'settings',
  'hustle',
]);

const getUserIdFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
  const hash = window.location.hash.replace(/^#\/?/, '');

  // Never parse reserved administration paths or keywords as usernames
  if (path.toLowerCase() === 'admin' || hash.toLowerCase() === 'admin') {
    return null;
  }

  // Check /user/:id or /u/:id
  const pathMatch = path.match(/^(?:user|u)\/([^/?#]+)/i);
  if (pathMatch) {
    const raw = decodeURIComponent(pathMatch[1]);
    if (RESERVED_ROUTES.has(raw.toLowerCase())) return null;
    return raw;
  }
  const hashMatch = hash.match(/^(?:user|u)\/([^/?#]+)/i);
  if (hashMatch) {
    const raw = decodeURIComponent(hashMatch[1]);
    if (RESERVED_ROUTES.has(raw.toLowerCase())) return null;
    return raw;
  }

  // Check root slug as unique username (e.g. rentu.site/sadiqua or rentu.site/@sadiqua)
  if (path && !path.includes('/')) {
    const rawSlug = path.replace(/^@/, '');
    const slug = rawSlug.toLowerCase();
    if (!RESERVED_ROUTES.has(slug) && /^[a-z0-9_]{3,30}$/.test(slug)) {
      return decodeURIComponent(rawSlug);
    }
  }

  return null;
};

const getTabFromUrl = (): TabType => {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.toLowerCase().replace(/^\/+|\/+$/g, '');
  const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');

  if (path === 'admin' || hash === 'admin') return 'hustle';
  if (path === 'requests' || hash === 'requests') return 'requests';
  if (path === 'bookings' || hash === 'bookings' || path === 'booking' || hash === 'booking') return 'bookings';
  if (path === 'messages' || hash === 'messages' || path === 'chat' || hash === 'chat') return 'messages';
  if (path === 'community' || hash === 'community') return 'community';
  if (path === 'profile' || hash === 'profile') return 'profile';
  if (path === 'explore' || hash === 'explore' || path === 'marketplace' || hash === 'marketplace') return 'explore';
  return 'home';
};

export const App: React.FC = () => {
  const { user, firebaseUser, isAuthenticated } = useAuth();
  const currentUserEmail = (user?.email || firebaseUser?.email || '').trim().toLowerCase();
  const isUserAdmin = isAuthorizedAdmin(user || currentUserEmail);

  // Navigation State with URL synchronization
  const [activeTab, setActiveTabState] = useState<TabType>(getTabFromUrl);
  const [bookingSubTab, setBookingSubTab] = useState<'ongoing' | 'requests' | 'finished' | 'cancelled'>('ongoing');
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Public User Profile Viewing State
  const [viewingUserId, setViewingUserId] = useState<string | null>(getUserIdFromUrl);

  // Unread Messages Badge Count (Instagram-style)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  const fetchUnreadMessagesCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadMessagesCount(0);
      return;
    }
    try {
      const res = await api.getUnreadMessagesCount();
      if (res && typeof res.unread_count === 'number') {
        setUnreadMessagesCount(res.unread_count);
      }
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadMessagesCount(0);
      return;
    }
    fetchUnreadMessagesCount();
    const interval = setInterval(fetchUnreadMessagesCount, 10000);
    const handleUpdate = () => fetchUnreadMessagesCount();
    window.addEventListener('rentu:messages-updated', handleUpdate);
    window.addEventListener('rentu:notifications-updated', handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('rentu:messages-updated', handleUpdate);
      window.removeEventListener('rentu:notifications-updated', handleUpdate);
    };
  }, [isAuthenticated, fetchUnreadMessagesCount]);

  const setActiveTab = (tab: TabType) => {
    // Non-admin users cannot access 'hustle' (admin dashboard)
    if (tab === 'hustle' && !isUserAdmin) {
      tab = 'home';
    }
    // ALWAYS dismiss public profile view when navigating to any tab!
    setViewingUserId(null);
    setActiveTabState(tab);
    const targetPath = tab === 'home'
      ? '/'
      : tab === 'hustle'
      ? '/admin'
      : tab === 'bookings'
      ? '/bookings'
      : tab === 'profile'
      ? '/profile'
      : `/${tab}`;

    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Strictly prevent any non-admin user from remaining on the admin dashboard
  useEffect(() => {
    if (activeTab === 'hustle' && !isUserAdmin) {
      setActiveTab('home');
    }
  }, [activeTab, isUserAdmin]);

  // If the opened username URL belongs to the currently logged in user, directly switch to own account
  useEffect(() => {
    if (user && viewingUserId) {
      const cleanHandle = viewingUserId.replace(/^@/, '').trim().toLowerCase();
      const isSelf = Boolean(
        (user.id && viewingUserId.toLowerCase() === user.id.toLowerCase()) ||
        (user.username && cleanHandle === user.username.toLowerCase()) ||
        (user.email && cleanHandle === user.email.split('@')[0].toLowerCase())
      );
      if (isSelf) {
        setViewingUserId(null);
        setActiveTabState('profile');
      }
    }
  }, [user, viewingUserId]);

  const handleOpenUserProfile = (userIdOrUsername: string) => {
    if (!userIdOrUsername) return;
    const cleanHandle = userIdOrUsername.replace(/^@/, '').trim().toLowerCase();

    // If it's the current user's own profile, lead directly to their own account
    const isSelf = Boolean(
      user && (
        (user.id && userIdOrUsername.toLowerCase() === user.id.toLowerCase()) ||
        (user.username && cleanHandle === user.username.toLowerCase()) ||
        (user.email && cleanHandle === user.email.split('@')[0].toLowerCase())
      )
    );

    if (isSelf) {
      setViewingUserId(null);
      setActiveTab('profile');
      return;
    }

    setViewingUserId(userIdOrUsername);
    const isProbableRawId = userIdOrUsername.includes('-') || userIdOrUsername.length > 24;
    const isCleanUsername = !isProbableRawId && /^[a-zA-Z0-9_]{3,24}$/.test(cleanHandle);
    const targetPath = isCleanUsername 
      ? `/${encodeURIComponent(cleanHandle)}` 
      : `/user/${encodeURIComponent(userIdOrUsername)}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  const handleCloseUserProfile = () => {
    setViewingUserId(null);
    const targetPath = activeTab === 'home'
      ? '/'
      : activeTab === 'hustle'
      ? '/admin'
      : activeTab === 'bookings'
      ? '/bookings'
      : activeTab === 'profile'
      ? '/profile'
      : `/${activeTab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  // Sync browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const targetUserId = getUserIdFromUrl();
      const targetTab = getTabFromUrl();

      if (targetUserId) {
        const cleanHandle = targetUserId.replace(/^@/, '').trim().toLowerCase();
        const isSelf = Boolean(
          user && (
            (user.id && targetUserId.toLowerCase() === user.id.toLowerCase()) ||
            (user.username && cleanHandle === user.username.toLowerCase()) ||
            (user.email && cleanHandle === user.email.split('@')[0].toLowerCase())
          )
        );
        if (isSelf) {
          setViewingUserId(null);
          setActiveTabState('profile');
          return;
        }
        setViewingUserId(targetUserId);
      } else {
        setViewingUserId(null);
        setActiveTabState(targetTab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  // Data State
  const [items, setItems] = useState<Item[]>([]);
  const [requests, setRequests] = useState<CommunityRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isDropGearOpen, setIsDropGearOpen] = useState(false);
  const [isDropWishOpen, setIsDropWishOpen] = useState(false);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [chatPartner, setChatPartner] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpInitialTab, setHelpInitialTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSetLocationOpen, setIsSetLocationOpen] = useState(false);

  // In-App Toast Notification
  const [toast, setToast] = useState<{
    id: string;
    type?: 'success' | 'info' | 'error';
    title: string;
    message: string;
    avatar?: string;
    actionLabel?: string;
    onAction?: () => void;
    duration?: number;
  } | null>(null);

  const showToast = useCallback((toastData: {
    type?: 'success' | 'info' | 'error';
    title: string;
    message: string;
    avatar?: string;
    actionLabel?: string;
    onAction?: () => void;
    duration?: number;
  }) => {
    const id = Date.now().toString();
    setToast({ ...toastData, id });
    if (toastData.duration !== 0) {
      setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
      }, toastData.duration || 6500);
    }
  }, []);

  // Listen for global toast events dispatched across the app
  useEffect(() => {
    const handleGlobalToast = (e: any) => {
      if (e.detail) {
        showToast(e.detail);
      }
    };
    window.addEventListener('rentu:toast', handleGlobalToast);
    return () => {
      window.removeEventListener('rentu:toast', handleGlobalToast);
    };
  }, [showToast]);

  const handleOpenAuth = (mode: 'login' | 'signup' = 'login') => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  };

  useEffect(() => {
    loadFeed();
  }, [selectedCategory]);

  const loadFeed = async () => {
    setIsLoading(true);
    try {
      const [itemsRes, requestsRes] = await Promise.allSettled([
        api.getItems({
          category: selectedCategory,
          search: searchQuery,
        }),
        api.getRequests({
          category: selectedCategory,
        }),
      ]);

      if (itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value)) {
        setItems(itemsRes.value);
      } else if (itemsRes.status === 'rejected') {
        console.error('Failed to load items:', itemsRes.reason);
        setItems([]);
      }

      if (requestsRes.status === 'fulfilled' && Array.isArray(requestsRes.value)) {
        setRequests(requestsRes.value);
      } else if (requestsRes.status === 'rejected') {
        console.error('Failed to load requests:', requestsRes.reason);
        setRequests([]);
      }
    } catch (err) {
      console.error('Failed to load feed data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    loadFeed();
    setActiveTab('explore');
  };

  const handleClaimRequest = async (req: CommunityRequest) => {
    if (!isAuthenticated) {
      setIsAuthOpen(true);
      return;
    }
    try {
      await api.offerLendOnRequest(req.id);
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch {}

      showToast({
        type: 'success',
        title: 'Offer Sent Successfully!',
        message: `We notified ${req.seeker_name || 'the requester'}. When they accept your offer in messages, the ongoing booking will automatically start in your Ongoing Bookings!`,
        avatar: req.seeker_avatar,
        actionLabel: 'Chat with ' + (req.seeker_name ? req.seeker_name.split(' ')[0] : 'Requester'),
        onAction: () => {
          if (req.seeker_id) {
            handleOpenChatWithUser(req.seeker_id, req.seeker_name || 'Neighbor', req.seeker_avatar);
          }
        },
        duration: 8000,
      });

      // Refresh notification counts
      window.dispatchEvent(new CustomEvent('rentu:notifications-updated'));
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Could Not Send Offer',
        message: err.message || 'Something went wrong while sending your offer. Please try again.',
        duration: 5000,
      });
    }
  };

  const handleOpenChatWithBooking = (bookingId: string) => {
    setChatPartner(null);
    setChatBookingId(bookingId);
    setActiveTab('messages');
  };

  const handleOpenChatWithUser = (targetUserId: string, targetUserName?: string, avatarUrl?: string) => {
    setChatBookingId(null);
    setChatPartner({ id: targetUserId, name: targetUserName || 'Neighbor', avatar: avatarUrl });
    handleCloseUserProfile();
    setActiveTab('messages');
  };

  const handleNavigateNotification = (target: {
    tab: TabType;
    bookingSubTab?: 'ongoing' | 'requests' | 'finished' | 'cancelled';
    bookingId?: string;
    userId?: string;
  }) => {
    if (target.userId) {
      handleOpenUserProfile(target.userId);
      return;
    }
    if (target.bookingSubTab) {
      setBookingSubTab(target.bookingSubTab);
    }
    if (target.bookingId) {
      setHighlightedBookingId(target.bookingId);
    } else {
      setHighlightedBookingId(null);
    }
    setActiveTab(target.tab);
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas font-sans">
      
      {/* Top Navbar matching Mockup Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearch={handleSearch}
        onOpenDropGear={() => setIsDropGearOpen(true)}
        onOpenDropWish={() => setIsDropWishOpen(true)}
        onOpenAuth={handleOpenAuth}
        onOpenChat={() => setActiveTab('messages')}
        onOpenHowItWorks={() => setActiveTab('community')}
        onOpenUserProfile={handleOpenUserProfile}
        onOpenHelpSupport={(tab) => {
          setHelpInitialTab(tab || 'NEW');
          setIsHelpOpen(true);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNavigateNotification={handleNavigateNotification}
        onOpenChatWithUser={handleOpenChatWithUser}
        unreadMessagesCount={unreadMessagesCount}
      />

      {/* Main View Router */}
      <main className="flex-1 pb-20 lg:pb-0 overflow-x-hidden min-w-0 w-full">
        {viewingUserId && activeTab !== 'hustle' ? (
          <PublicProfileView
            userId={viewingUserId}
            onClose={handleCloseUserProfile}
            onOpenMyAccount={() => {
              setViewingUserId(null);
              setActiveTab('profile');
            }}
            onSelectItem={(item) => setSelectedItem(item)}
            onClaimRequest={handleClaimRequest}
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenChatWithBooking={handleOpenChatWithBooking}
            onOpenChatWithUser={handleOpenChatWithUser}
            onOpenUserProfile={handleOpenUserProfile}
          />
        ) : (
          <>
            {/* VIEW 1: HOMEPAGE / LANDING (Screen 1 in Mockup) */}
            {activeTab === 'home' && (
              <div>
                {/* Minimalist Chic Hero Section */}
                <HeroSection
                  onGetStarted={() => setActiveTab('explore')}
                  onOpenDropGear={() => setIsDropGearOpen(true)}
                  onOpenDropWish={() => setIsDropWishOpen(true)}
                  itemsCount={(items || []).length}
                  requestsCount={(requests || []).length}
                  isLoading={isLoading}
                  onOpenUserProfile={handleOpenUserProfile}
                />

                {/* 8 Soft Pastel Category Tiles Container */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <CategoryTiles
                    selectedCategory={selectedCategory}
                    onSelectCategory={(cat) => {
                      setSelectedCategory(cat);
                      setActiveTab('explore');
                    }}
                  />
                </div>

                {/* How Rentu⁺ Works Section (Placed Above Popular Gear) */}
                <HowItWorksSection
                  onExploreGear={() => setActiveTab('explore')}
                  onOpenDropGear={() => setIsDropGearOpen(true)}
                  onOpenDropWish={() => setIsDropWishOpen(true)}
                  onOpenAuth={() => setIsAuthOpen(true)}
                  onViewCommunity={() => setActiveTab('community')}
                  showCommunityLink={true}
                />

                {/* Popular Gear Near You (Placed Below How Rentu Works) */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-ink font-display">
                        Popular Gear Near You
                      </h2>
                      <p className="text-xs sm:text-sm text-ink-secondary">
                        Available for rent from verified community lenders
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('explore')}
                      className="text-xs font-bold text-brand hover:underline cursor-pointer"
                    >
                      {isLoading ? 'Explore All →' : `Explore All (${(items || []).length}) →`}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                    {isLoading ? (
                      [1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-surface border border-divider rounded-3xl p-3 sm:p-4 space-y-2.5 animate-pulse">
                          <div className="aspect-[4/3] w-full rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md w-3/4" />
                          <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-md w-1/2" />
                          <div className="pt-2 border-t border-divider flex items-center justify-between">
                            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md w-1/3" />
                            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-full w-12" />
                          </div>
                        </div>
                      ))
                    ) : (
                      (items || []).slice(0, 4).map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          onClick={() => setSelectedItem(item)}
                          onOpenUserProfile={handleOpenUserProfile}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: UNIFIED MARKETPLACE (Gear Listings & Community Requests in One Page) */}
            {(activeTab === 'explore' || activeTab === 'requests') && (
              <ExploreView
                items={items}
                requests={requests}
                isLoading={isLoading}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                onSelectItem={(item) => setSelectedItem(item)}
                onOpenDropWish={() => setIsDropWishOpen(true)}
                onOpenDropGear={() => setIsDropGearOpen(true)}
                onClaimRequest={handleClaimRequest}
                onOpenAuth={() => setIsAuthOpen(true)}
                initialSubView={activeTab === 'requests' ? 'requests' : 'items'}
                onOpenUserProfile={handleOpenUserProfile}
                searchQuery={searchQuery}
                onOpenChatWithUser={handleOpenChatWithUser}
              />
            )}

            {/* VIEW 7: DEDICATED FULL-PAGE BOOKINGS VIEW */}
            {activeTab === 'bookings' && (
              <BookingsView
                onOpenChat={handleOpenChatWithBooking}
                initialTab={bookingSubTab}
                initialBookingId={highlightedBookingId}
              />
            )}

            {/* VIEW 8: DEDICATED FULL-PAGE MESSAGES VIEW */}
            {activeTab === 'messages' && (
              <MessagesView
                initialBookingId={chatBookingId}
                initialPartner={chatPartner}
                onOpenAuth={() => setIsAuthOpen(true)}
                onNavigateHome={() => setActiveTab('explore')}
                onOpenUserProfile={handleOpenUserProfile}
                onOpenBookings={() => setActiveTab('bookings')}
              />
            )}

            {/* VIEW 9: PROFILE VIEW (Screen 9 in Mockup) */}
            {activeTab === 'profile' && (
              <ProfileView
                initialTab="listings"
                onOpenDropGear={() => setIsDropGearOpen(true)}
                onOpenDropWish={() => setIsDropWishOpen(true)}
                onOpenChatWithBooking={handleOpenChatWithBooking}
                onOpenAuth={() => setIsAuthOpen(true)}
                onOpenUserProfile={handleOpenUserProfile}
              />
            )}

            {/* VIEW 10: ADMIN DASHBOARD (Exclusively available to authorized platform administrators) */}
            {activeTab === 'hustle' && isUserAdmin && (
              <HustleHub />
            )}

            {/* VIEW 11: COMMUNITY & TOP 10 LEADERBOARD (Replaces How It Works) */}
            {activeTab === 'community' && (
              <CommunityView
                onOpenDropGear={() => setIsDropGearOpen(true)}
                onOpenDropWish={() => setIsDropWishOpen(true)}
                onExploreGear={() => setActiveTab('explore')}
                onOpenAuth={() => setIsAuthOpen(true)}
                onOpenUserProfile={handleOpenUserProfile}
              />
            )}
          </>
        )}
      </main>

      {/* Screen 3: Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onBookingSuccess={() => loadFeed()}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenChatWithBooking={handleOpenChatWithBooking}
          onOpenUserProfile={handleOpenUserProfile}
          onEditItem={(itemToEdit) => {
            setSelectedItem(null);
            setEditingItem(itemToEdit);
          }}
          onDeleteItem={() => {
            setSelectedItem(null);
            loadFeed();
          }}
        />
      )}

      {/* Edit Gear Listing Modal */}
      <EditItemModal
        item={editingItem}
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        onSuccess={() => {
          setEditingItem(null);
          loadFeed();
        }}
      />

      {/* Screen 5: List an Item Modal */}
      <DropGearModal
        isOpen={isDropGearOpen}
        onClose={() => setIsDropGearOpen(false)}
        onSuccess={(createdItem) => {
          loadFeed();
          if (createdItem) {
            setSelectedItem(createdItem);
          }
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenProfile={() => setActiveTab('profile')}
      />

      {/* Screen 4: Post a Request Modal */}
      <DropWishModal
        isOpen={isDropWishOpen}
        onClose={() => setIsDropWishOpen(false)}
        onSuccess={() => loadFeed()}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authMode}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(isNewUser) => {
          loadFeed();
          if (isNewUser) {
            setIsSetLocationOpen(true);
          }
        }}
      />

      {/* Set Location Onboarding Modal */}
      <SetLocationModal
        isOpen={isSetLocationOpen}
        onClose={() => setIsSetLocationOpen(false)}
        onSuccess={() => {
          setIsSetLocationOpen(false);
          loadFeed();
        }}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenDropGear={() => setIsDropGearOpen(true)}
        onOpenDropWish={() => setIsDropWishOpen(true)}
        onOpenChat={() => setActiveTab('messages')}
        onOpenAuth={() => setIsAuthOpen(true)}
        unreadMessagesCount={unreadMessagesCount}
      />

      {/* Help & Community Support Modal */}
      <HelpSupportModal
        isOpen={isHelpOpen}
        initialTab={helpInitialTab}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Account & Radar Alert Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenSetLocation={() => setIsSetLocationOpen(true)}
      />

      {/* Floating In-App Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-4 sm:right-8 z-[100] max-w-md w-[calc(100vw-32px)] sm:w-full bg-surface/95 dark:bg-zinc-900/95 backdrop-blur-md border border-divider shadow-2xl rounded-2xl p-4 animate-in slide-in-from-top-4 fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {toast.avatar ? (
                <img
                  src={toast.avatar}
                  alt="User"
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-brand/30"
                />
              ) : toast.type === 'error' ? (
                <div className="w-9 h-9 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
                  <AlertCircle className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-xs sm:text-sm font-extrabold text-ink font-display leading-tight">
                {toast.title}
              </h4>
              <p className="text-xs text-ink-secondary font-medium mt-1 leading-relaxed">
                {toast.message}
              </p>

              {toast.actionLabel && toast.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onAction?.();
                    setToast(null);
                  }}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-brand text-white hover:bg-brand/90 transition-all cursor-pointer shadow-xs"
                >
                  <span>{toast.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="shrink-0 p-1 rounded-lg text-ink-secondary hover:text-ink hover:bg-canvas transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
