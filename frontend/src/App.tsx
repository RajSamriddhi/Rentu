import React, { useState, useEffect } from 'react';
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
import { ItemCard } from './components/ItemCard';
import { PublicProfileView } from './components/PublicProfileView';
import { SetUsernameModal } from './components/SetUsernameModal';
import { useAuth } from './lib/authContext';
import { api } from './lib/api';
import { Item, CommunityRequest, isAuthorizedAdmin } from './lib/types';
import confetti from 'canvas-confetti';

export type TabType = 'home' | 'explore' | 'requests' | 'bookings' | 'messages' | 'community' | 'hustle' | 'profile';

const RESERVED_ROUTES = new Set([
  'admin',
  'requests',
  'bookings',
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

  // Check /user/:id or /u/:id
  const pathMatch = path.match(/^(?:user|u)\/([^/?#]+)/i);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  const hashMatch = hash.match(/^(?:user|u)\/([^/?#]+)/i);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);

  // Check root slug as unique username (e.g. rentu.site/sadiqua or rentu.site/geetansh)
  if (path && !path.includes('/')) {
    const slug = path.toLowerCase();
    if (!RESERVED_ROUTES.has(slug) && /^[a-z0-9_]{3,30}$/.test(slug)) {
      return decodeURIComponent(slug);
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
  if (path === 'bookings' || hash === 'bookings') return 'bookings';
  if (path === 'messages' || hash === 'messages' || path === 'chat' || hash === 'chat') return 'messages';
  if (path === 'community' || hash === 'community') return 'community';
  if (path === 'profile' || hash === 'profile') return 'profile';
  if (path === 'explore' || hash === 'explore' || path === 'marketplace' || hash === 'marketplace') return 'explore';
  return 'home';
};

export const App: React.FC = () => {
  const { user, firebaseUser, isAuthenticated } = useAuth();
  const currentUserEmail = (user?.email || firebaseUser?.email || '').trim().toLowerCase();
  const isUserAdmin = isAuthorizedAdmin(currentUserEmail);

  // Navigation State with URL synchronization
  const [activeTab, setActiveTabState] = useState<TabType>(getTabFromUrl);
  const [bookingSubTab, setBookingSubTab] = useState<'ongoing' | 'requests' | 'finished'>('ongoing');
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Public User Profile Viewing State
  const [viewingUserId, setViewingUserId] = useState<string | null>(getUserIdFromUrl);

  const setActiveTab = (tab: TabType) => {
    // Non-admin users cannot access 'hustle' (admin dashboard)
    if (tab === 'hustle' && !isUserAdmin) {
      tab = 'home';
    }
    setActiveTabState(tab);
    const targetPath = tab === 'home' ? '/' : tab === 'hustle' ? '/admin' : `/${tab}`;
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

  const handleOpenUserProfile = (userIdOrUsername: string) => {
    setViewingUserId(userIdOrUsername);
    // If it's a clean username (not a UUID with hyphens), use direct /username URL
    const isCleanUsername = /^[a-zA-Z0-9_]{3,30}$/.test(userIdOrUsername) && !userIdOrUsername.includes('-');
    const targetPath = isCleanUsername 
      ? `/${encodeURIComponent(userIdOrUsername.toLowerCase())}` 
      : `/user/${encodeURIComponent(userIdOrUsername)}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  const handleCloseUserProfile = () => {
    setViewingUserId(null);
    const targetPath = activeTab === 'home' ? '/' : activeTab === 'hustle' ? '/admin' : `/${activeTab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  // Sync browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setActiveTabState(getTabFromUrl());
      setViewingUserId(getUserIdFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
      const [itemsData, requestsData] = await Promise.all([
        api.getItems({
          category: selectedCategory,
          search: searchQuery,
        }),
        api.getRequests({
          category: selectedCategory,
        }),
      ]);
      setItems(Array.isArray(itemsData) ? itemsData : []);
      setRequests(Array.isArray(requestsData) ? requestsData : []);
    } catch (err) {
      console.error('Failed to load feed data:', err);
      setItems([]);
      setRequests([]);
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
      alert(`Offer sent! We notified ${req.seeker_name || 'the requester'}. When they accept your offer in messages, the ongoing booking will automatically start in your Ongoing Bookings!`);
      if (req.seeker_id) {
        handleOpenChatWithUser(req.seeker_id, req.seeker_name || 'Neighbor', req.seeker_avatar);
      }
    } catch (err: any) {
      alert(err.message || 'Could not send lend offer.');
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
    bookingSubTab?: 'ongoing' | 'requests' | 'finished';
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
        onOpenHelpSupport={() => setIsHelpOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNavigateNotification={handleNavigateNotification}
        onOpenChatWithUser={handleOpenChatWithUser}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {viewingUserId ? (
          <PublicProfileView
            userId={viewingUserId}
            onClose={handleCloseUserProfile}
            onSelectItem={(item) => setSelectedItem(item)}
            onClaimRequest={handleClaimRequest}
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenChatWithBooking={handleOpenChatWithBooking}
            onOpenChatWithUser={handleOpenChatWithUser}
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
                      Explore All ({(items || []).length}) →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {(items || []).slice(0, 4).map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onClick={() => setSelectedItem(item)}
                        onOpenUserProfile={handleOpenUserProfile}
                      />
                    ))}
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

            {/* VIEW 7: BOOKINGS (Screen 7 in Mockup) */}
            {activeTab === 'bookings' && (
              <BookingsView
                initialTab={bookingSubTab}
                initialBookingId={highlightedBookingId}
                onOpenChat={(bookingId) => handleOpenChatWithBooking(bookingId)}
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
                onOpenDropGear={() => setIsDropGearOpen(true)}
                onOpenDropWish={() => setIsDropWishOpen(true)}
                onOpenChatWithBooking={handleOpenChatWithBooking}
                onOpenAuth={() => setIsAuthOpen(true)}
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
        onSuccess={() => loadFeed()}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenDropGear={() => setIsDropGearOpen(true)}
        onOpenDropWish={() => setIsDropWishOpen(true)}
        onOpenChat={() => setActiveTab('messages')}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Help & Community Support Modal */}
      <HelpSupportModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Account & Radar Alert Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Required Unique Username Modal for All Users */}
      {isAuthenticated && user && !user.username && (
        <SetUsernameModal />
      )}

    </div>
  );
};
