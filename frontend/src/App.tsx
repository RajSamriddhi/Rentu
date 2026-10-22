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
import { DropGearModal } from './components/DropGearModal';
import { DropWishModal } from './components/DropWishModal';
import { MessagesView } from './components/MessagesView';
import { CommunityView } from './components/CommunityView';
import { HowItWorksSection } from './components/HowItWorksSection';
import { MobileBottomNav } from './components/MobileBottomNav';
import { AuthModal } from './components/AuthModal';
import { ItemCard } from './components/ItemCard';
import { PublicProfileView } from './components/PublicProfileView';
import { useAuth } from './lib/authContext';
import { api } from './lib/api';
import { Item, CommunityRequest } from './lib/types';

export type TabType = 'home' | 'explore' | 'requests' | 'bookings' | 'messages' | 'community' | 'hustle' | 'profile';

const getUserIdFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  const hash = window.location.hash;
  const pathMatch = path.match(/^\/(?:user|u)\/([^/?#]+)/i);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  const hashMatch = hash.match(/^#\/?(?:user|u)\/([^/?#]+)/i);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);
  return null;
};

const getTabFromUrl = (): TabType => {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (path === '/admin' || hash === '#admin') return 'hustle';
  if (path === '/requests' || hash === '#requests') return 'requests';
  if (path === '/bookings' || hash === '#bookings') return 'bookings';
  if (path === '/messages' || hash === '#messages' || path === '/chat' || hash === '#chat') return 'messages';
  if (path === '/community' || hash === '#community') return 'community';
  if (path === '/profile' || hash === '#profile') return 'profile';
  if (path === '/explore' || hash === '#explore' || path === '/marketplace' || hash === '#marketplace') return 'explore';
  return 'home';
};

export const App: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  // Navigation State with URL synchronization
  const [activeTab, setActiveTabState] = useState<TabType>(getTabFromUrl);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Public User Profile Viewing State
  const [viewingUserId, setViewingUserId] = useState<string | null>(getUserIdFromUrl);

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    const targetPath = tab === 'home' ? '/' : tab === 'hustle' ? '/admin' : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenUserProfile = (userId: string) => {
    setViewingUserId(userId);
    const targetPath = `/user/${encodeURIComponent(userId)}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  const handleCloseUserProfile = () => {
    setViewingUserId(null);
    const targetPath = activeTab === 'home' ? '/' : activeTab === 'hustle' ? '/admin' : `/${activeTab}`;
    if (window.location.pathname.startsWith('/user/') || window.location.pathname.startsWith('/u/')) {
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
  const [isDropGearOpen, setIsDropGearOpen] = useState(false);
  const [isDropWishOpen, setIsDropWishOpen] = useState(false);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

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
      await api.updateRequestStatus(req.id, 'FULFILLED');
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: 'FULFILLED' } : r))
      );
      alert(`Awesome! You've connected to lend gear for "${req.item_name}". Reach out to ${req.seeker_name}!`);
    } catch (err: any) {
      alert(err.message || 'Could not fulfill request.');
    }
  };

  const handleOpenChatWithBooking = (bookingId: string) => {
    setChatBookingId(bookingId);
    setActiveTab('messages');
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
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenChat={() => setActiveTab('messages')}
        onOpenHowItWorks={() => setActiveTab('community')}
        onOpenUserProfile={handleOpenUserProfile}
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
          />
        ) : (
          <>
            {/* VIEW 1: HOMEPAGE / LANDING (Screen 1 in Mockup) */}
            {activeTab === 'home' && (
              <div>
                {/* Screen 1: Cream Blush Hero Section with Scrapbook Collage */}
                <HeroSection
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onSearch={handleSearch}
                  onGetStarted={() => setActiveTab('explore')}
                  onOpenDropGear={() => setIsDropGearOpen(true)}
                  itemsCount={(items || []).length}
                  requestsCount={(requests || []).length}
                  onOpenUserProfile={handleOpenUserProfile}
                />

                {/* Screen 1: 8 Soft Pastel Category Tiles Container */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <CategoryTiles
                    selectedCategory={selectedCategory}
                    onSelectCategory={(cat) => {
                      setSelectedCategory(cat);
                      setActiveTab('explore');
                    }}
                  />
                </div>

                {/* Popular / Trending Gear */}
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

                {/* How Rentu⁺ Works Section on the Main Page */}
                <HowItWorksSection
                  onExploreGear={() => setActiveTab('explore')}
                  onOpenDropGear={() => setIsDropGearOpen(true)}
                  onOpenDropWish={() => setIsDropWishOpen(true)}
                  onOpenAuth={() => setIsAuthOpen(true)}
                  onViewCommunity={() => setActiveTab('community')}
                  showCommunityLink={true}
                />
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
              />
            )}

            {/* VIEW 7: BOOKINGS (Screen 7 in Mockup) */}
            {activeTab === 'bookings' && (
              <BookingsView
                onOpenChat={(bookingId) => handleOpenChatWithBooking(bookingId)}
              />
            )}

            {/* VIEW 8: DEDICATED FULL-PAGE MESSAGES VIEW */}
            {activeTab === 'messages' && (
              <MessagesView
                initialBookingId={chatBookingId}
                onOpenAuth={() => setIsAuthOpen(true)}
                onNavigateHome={() => setActiveTab('explore')}
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

            {/* VIEW 10: ADMIN DASHBOARD (Screen 10 in Mockup) */}
            {activeTab === 'hustle' && (
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
        />
      )}

      {/* Screen 5: List an Item Modal */}
      <DropGearModal
        isOpen={isDropGearOpen}
        onClose={() => setIsDropGearOpen(false)}
        onSuccess={() => loadFeed()}
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

    </div>
  );
};
