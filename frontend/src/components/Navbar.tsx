import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  MapPin, 
  ChevronDown, 
  User as UserIcon, 
  LogOut, 
  MessageSquare, 
  BarChart3, 
  Bell, 
  Search,
  Calendar,
  Sparkles,
  Sun,
  Moon,
  Menu,
  X,
  Compass,
  Target,
  Users,
  ShieldCheck,
  Star,
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useTheme } from '../lib/themeContext';
import { api } from '../lib/api';
import { UserSearchResult, isAuthorizedAdmin } from '../lib/types';

interface NavbarProps {
  activeTab: 'home' | 'explore' | 'requests' | 'bookings' | 'hustle' | 'profile' | 'messages' | 'community';
  setActiveTab: (tab: 'home' | 'explore' | 'requests' | 'bookings' | 'hustle' | 'profile' | 'messages' | 'community') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearch: () => void;
  onOpenDropGear: () => void;
  onOpenDropWish: () => void;
  onOpenAuth: () => void;
  onOpenChat: () => void;
  onOpenHowItWorks?: () => void;
  onOpenUserProfile?: (userId: string) => void;
  onOpenHelpSupport?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onSearch,
  onOpenDropGear,
  onOpenDropWish,
  onOpenAuth,
  onOpenChat,
  onOpenHowItWorks,
  onOpenUserProfile,
  onOpenHelpSupport,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Live User Search State
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Live Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  const postMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const mobileSearchBoxRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    setIsLoadingNotifications(true);
    try {
      const data = await api.getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Debounced user search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setUserSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const results = await api.searchUsers(trimmed);
        setUserSearchResults(Array.isArray(results) ? results : []);
      } catch (err) {
        console.error('Failed to search users:', err);
        setUserSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (postMenuRef.current && !postMenuRef.current.contains(target)) {
        setShowPostMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (
        searchBoxRef.current && !searchBoxRef.current.contains(target) &&
        mobileSearchBoxRef.current && !mobileSearchBoxRef.current.contains(target)
      ) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      await api.markNotificationRead(notif.id).catch(() => {});
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    setShowNotifications(false);
    if (notif.reference_type === 'REQUEST') {
      setActiveTab('requests');
    } else if (notif.sender_id && onOpenUserProfile) {
      onOpenUserProfile(notif.sender_id);
    }
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#111218]/95 backdrop-blur-md border-b border-divider transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-6">
          
          {/* Left: Brand Logo (Rentu⁺) + Desktop Nav Links */}
          <div className="flex items-center gap-5 sm:gap-8 shrink-0">
            <button 
              onClick={() => { setActiveTab('home'); setShowMobileMenu(false); }}
              className="flex items-center gap-1.5 group text-left cursor-pointer focus:outline-none"
              title="Rentu⁺ Home"
            >
              <span className="font-extrabold text-2xl sm:text-3xl tracking-tight text-ink font-display">
                Rentu<sup className="text-brand font-black text-lg">⁺</sup>
              </span>
            </button>

            {/* Nav links: Marketplace, Community */}
            <nav className="hidden md:flex items-center gap-5 text-xs font-bold">
              <button
                onClick={() => setActiveTab('explore')}
                className={`transition-colors cursor-pointer ${
                  activeTab === 'explore' || activeTab === 'requests' ? 'text-brand' : 'text-ink-secondary hover:text-ink'
                }`}
              >
                Marketplace
              </button>

              <button
                onClick={() => setActiveTab('community')}
                className={`transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'community' ? 'text-brand' : 'text-ink-secondary hover:text-ink'
                }`}
              >
                <span>Community</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-colors ${
                  activeTab === 'community' ? 'bg-brand text-white' : 'bg-brand-soft text-brand'
                }`}>
                  Top 10
                </span>
              </button>
            </nav>
          </div>

          {/* Center: Search Bar in Navbar on Desktop */}
          <div ref={searchBoxRef} className="flex-1 max-w-md hidden lg:block relative">
            <form 
              onSubmit={(e) => { 
                e.preventDefault(); 
                setShowUserDropdown(false);
                onSearch(); 
              }}
              className="relative flex items-center bg-canvas border border-divider hover:border-zinc-300 dark:hover:border-zinc-600 rounded-full px-3.5 py-2 transition-all focus-within:border-brand focus-within:bg-surface shadow-xs"
            >
              <Search className="w-4 h-4 text-ink-muted mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowUserDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowUserDropdown(true);
                }}
                placeholder="Search community members or gear..."
                className="bg-transparent border-none outline-none text-xs font-semibold text-ink placeholder:text-ink-muted placeholder:font-normal w-full"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setUserSearchResults([]);
                    setShowUserDropdown(false);
                  }}
                  className="text-ink-muted hover:text-ink text-xs px-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {/* Live Search Flyout Dropdown */}
            {showUserDropdown && searchQuery.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-surface/98 backdrop-blur-xl border border-divider rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-divider">
                {/* Community Members section */}
                <div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-brand" />
                      <span>Community Members</span>
                    </span>
                    {isSearchingUsers ? (
                      <span className="text-[10px] text-ink-secondary flex items-center gap-1 animate-pulse">Searching...</span>
                    ) : (
                      <span>{userSearchResults.length} found</span>
                    )}
                  </div>

                  {userSearchResults.length > 0 ? (
                    <div className="space-y-1 mt-1 max-h-56 overflow-y-auto">
                      {userSearchResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (onOpenUserProfile) {
                              onOpenUserProfile(u.id);
                            }
                            setShowUserDropdown(false);
                          }}
                          onClick={() => {
                            if (onOpenUserProfile) {
                              onOpenUserProfile(u.id);
                            }
                            setShowUserDropdown(false);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-canvas text-left cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={u.avatar_url || (u.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')}
                              alt={u.name}
                              className="w-8 h-8 rounded-full object-cover border border-divider group-hover:border-brand shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-ink group-hover:text-brand truncate">{u.name}</span>
                                <span className="inline-flex items-center text-[10px] font-black text-amber-500">
                                  ★ {u.rating ? u.rating.toFixed(1) : '5.0'}
                                </span>
                              </div>
                              <div className="text-[10px] text-ink-secondary truncate">
                                {u.locality || 'Verified Neighbor'} • {u.items_count} gear listed • {u.trust_score}% trust
                              </div>
                            </div>
                          </div>

                          <span className="text-[11px] font-bold text-brand group-hover:underline shrink-0 ml-2">
                            Profile →
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : !isSearchingUsers ? (
                    <div className="px-3 py-2 text-xs text-ink-secondary text-center">
                      No members matching "{searchQuery}"
                    </div>
                  ) : null}
                </div>

                {/* Marketplace Gear Search option */}
                <div className="pt-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      onSearch();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-brand-soft text-left cursor-pointer transition-colors text-xs font-bold text-ink hover:text-brand"
                  >
                    <span className="flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-brand" />
                      <span>Search gear listings for "{searchQuery}"</span>
                    </span>
                    <span className="text-[10px] text-ink-muted">Enter ↵</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Controls & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">

            {/* Dark / Light Mode Toggle Button */}
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-ink-secondary hover:text-ink transition-all cursor-pointer relative"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 rotate-0 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-zinc-600 dark:text-zinc-300 transition-transform hover:-rotate-12" />
              )}
            </button>

            {/* Mobile Search Toggle Button */}
            <button
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              className="lg:hidden p-1.5 sm:p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-ink-secondary hover:text-ink transition-colors cursor-pointer"
              title="Search"
              aria-label="Toggle search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* AUTHENTICATED: Notifications, Chat, Post CTA, User Profile */}
            {isAuthenticated ? (
              <>
                {/* Notification Bell Dropdown */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      if (!showNotifications) fetchNotifications();
                    }}
                    className={`relative p-2 rounded-full transition-colors cursor-pointer hidden md:flex ${
                      showNotifications
                        ? 'bg-brand/10 text-brand'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-ink-secondary hover:text-ink'
                    }`}
                    title="Announcements & Alerts"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-brand text-[10px] font-black text-white flex items-center justify-center leading-none shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface border border-divider rounded-2xl shadow-2xl overflow-hidden z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-4 py-3 border-b border-divider flex items-center justify-between bg-canvas/40">
                        <div className="flex items-center gap-1.5 font-bold text-ink">
                          <Bell className="w-3.5 h-3.5 text-brand" />
                          <span>Announcements & Alerts</span>
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-[11px] text-brand hover:underline font-bold cursor-pointer"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-divider/50">
                        {isLoadingNotifications && notifications.length === 0 ? (
                          <div className="py-8 text-center text-ink-secondary text-xs">
                            Loading updates...
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="py-8 text-center text-ink-secondary text-xs px-4">
                            <p className="font-bold text-ink mb-1">All caught up! 🎉</p>
                            <p className="text-[11px]">When people you follow or neighbors within 5 km post a wish, you'll see alerts here.</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`p-3.5 hover:bg-canvas transition-colors cursor-pointer flex items-start gap-2.5 ${
                                !n.is_read ? 'bg-brand/5 dark:bg-brand/10' : ''
                              }`}
                            >
                              <div className="w-7 h-7 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0 mt-0.5 text-xs">
                                {n.type === 'NEARBY_REQUEST_ANNOUNCEMENT' ? '📍' : n.type === 'NEW_FOLLOWER' ? '🎉' : '⚡'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <span className="font-bold text-ink truncate">{n.title}</span>
                                  {!n.is_read && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                                  )}
                                </div>
                                <p className="text-ink-secondary line-clamp-2 leading-relaxed text-[11px]">{n.body}</p>
                                <span className="text-[10px] text-ink-muted mt-1 block">
                                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Messages Icon (Hidden on small screens, accessible via hamburger) */}
                <button
                  onClick={onOpenChat}
                  className={`p-2 rounded-full transition-colors cursor-pointer hidden md:flex ${
                    activeTab === 'messages'
                      ? 'bg-brand/10 text-brand ring-1 ring-brand/30'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-ink-secondary hover:text-ink'
                  }`}
                  title="Messages & Coordination"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>

                {/* Post Menu Button (+ List Item / + Post Request) */}
                <div className="relative" ref={postMenuRef}>
                  <button
                    id="post-menu-btn"
                    onClick={() => setShowPostMenu(!showPostMenu)}
                    className="btn-primary text-xs px-2.5 sm:px-3.5 py-1.5 sm:py-2 cursor-pointer shadow-pink inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                    <span>Post</span>
                    <ChevronDown className="w-3 h-3 ml-0.5 hidden sm:inline" />
                  </button>

                  {showPostMenu && (
                    <div className="absolute right-0 mt-2 w-60 bg-surface border border-divider rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs text-ink">
                      <button
                        onClick={() => { setShowPostMenu(false); onOpenDropGear(); }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-canvas transition-colors flex items-center gap-2.5 font-bold text-ink cursor-pointer"
                      >
                        <span className="text-base">💸</span>
                        <div>
                          <div>List Gear for Rent</div>
                          <div className="text-[10px] text-ink-secondary font-medium">Turn unused items into income</div>
                        </div>
                      </button>

                      <button
                        onClick={() => { setShowPostMenu(false); onOpenDropWish(); }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-canvas transition-colors flex items-center gap-2.5 font-bold text-ink cursor-pointer mt-1"
                      >
                        <span className="text-base">🎯</span>
                        <div>
                          <div>Post a Request</div>
                          <div className="text-[10px] text-ink-secondary font-medium">Ask community for items you need</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* User Profile Avatar Dropdown */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    id="user-menu-btn"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-1.5 p-1 bg-canvas hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-divider rounded-full transition-all cursor-pointer"
                  >
                    <img
                      src={user?.avatar_url || (user?.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')}
                      alt={user?.name || 'User'}
                      className="w-7 h-7 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                    />
                    <span className="text-xs font-bold text-ink max-w-[80px] truncate hidden md:inline">
                      {user?.name?.split(' ')[0]}
                    </span>
                    <ChevronDown className="w-3 h-3 text-ink-secondary mr-1 hidden sm:inline" />
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-surface border border-divider rounded-2xl shadow-xl p-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100 text-ink">
                      <div className="px-3 py-2 border-b border-divider mb-1">
                        <div className="font-extrabold text-sm text-ink">{user?.name}</div>
                        <div className="text-[11px] text-ink-secondary truncate">{user?.email}</div>
                      </div>

                      <button
                        onClick={() => { setActiveTab('profile'); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-canvas flex items-center gap-2.5 font-bold text-ink cursor-pointer"
                      >
                        <UserIcon className="w-4 h-4 text-ink-secondary" />
                        <span>My Profile & Listings</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('bookings'); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-canvas flex items-center gap-2.5 font-bold text-ink cursor-pointer"
                      >
                        <Calendar className="w-4 h-4 text-ink-secondary" />
                        <span>Bookings</span>
                      </button>

                      {isAuthorizedAdmin(user?.email) && (
                        <button
                          onClick={() => { setActiveTab('hustle'); setShowUserMenu(false); }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-canvas flex items-center gap-2.5 font-bold text-ink cursor-pointer"
                        >
                          <BarChart3 className="w-4 h-4 text-ink-secondary" />
                          <span>Admin Dashboard</span>
                        </button>
                      )}

                      <button
                        onClick={() => { onOpenHelpSupport?.(); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-canvas flex items-center gap-2.5 font-bold text-ink cursor-pointer"
                      >
                        <HelpCircle className="w-4 h-4 text-brand" />
                        <span>Help & Raise Concern</span>
                      </button>

                      {/* Sign Out */}
                      <div className="pt-1.5 border-t border-divider">
                        <button
                          onClick={() => { logout(); setShowUserMenu(false); setActiveTab('explore'); }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-pink-50 text-brand flex items-center gap-2 font-bold cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* UNAUTHENTICATED: Single clean Sign In button */
              <div className="flex items-center">
                <button
                  id="navbar-signin-btn"
                  onClick={onOpenAuth}
                  className="btn-primary text-xs px-3.5 sm:px-4 py-1.5 sm:py-2 cursor-pointer shadow-pink font-bold"
                >
                  <span>Sign In</span>
                </button>
              </div>
            )}

            {/* Mobile Hamburger Menu Toggle Button (Visible on md and below) */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-1.5 rounded-xl hover:bg-canvas text-ink transition-colors cursor-pointer"
              title="Toggle Menu"
              aria-label="Open mobile navigation menu"
            >
              {showMobileMenu ? <X className="w-5 h-5 text-brand" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Search Input Dropdown */}
        {showMobileSearch && (
          <div ref={mobileSearchBoxRef} className="lg:hidden pb-3 pt-1 animate-in slide-in-from-top-2 duration-150 border-t border-divider/40 mt-1 relative">
            <form 
              onSubmit={(e) => { 
                e.preventDefault(); 
                onSearch(); 
                setShowMobileSearch(false);
                setShowUserDropdown(false);
              }}
              className="relative flex items-center bg-canvas border border-divider rounded-full px-3.5 py-1.5 focus-within:border-brand shadow-xs"
            >
              <Search className="w-4 h-4 text-ink-muted mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowUserDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowUserDropdown(true);
                }}
                placeholder="Search community members or gear..."
                className="bg-transparent border-none outline-none text-xs font-semibold text-ink placeholder:text-ink-muted w-full"
                autoFocus
              />
              <button
                type="submit"
                className="ml-2 bg-brand text-white px-3 py-1 rounded-full text-[11px] font-bold shrink-0 shadow-xs cursor-pointer"
              >
                Go
              </button>
            </form>

            {/* Mobile User Search Dropdown */}
            {showUserDropdown && searchQuery.trim().length >= 2 && (
              <div className="mt-2 bg-surface border border-divider rounded-2xl shadow-xl p-2.5 z-50 divide-y divide-divider max-h-72 overflow-y-auto">
                <div className="flex items-center justify-between px-2 py-1 text-[10px] font-black uppercase text-ink-muted">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-brand" />
                    <span>Members ({userSearchResults.length})</span>
                  </span>
                  {isSearchingUsers && <span className="animate-pulse">Searching...</span>}
                </div>

                {userSearchResults.length > 0 ? (
                  <div className="space-y-1 mt-1">
                    {userSearchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (onOpenUserProfile) {
                            onOpenUserProfile(u.id);
                          }
                          setShowUserDropdown(false);
                          setShowMobileSearch(false);
                        }}
                        onClick={() => {
                          if (onOpenUserProfile) {
                            onOpenUserProfile(u.id);
                          }
                          setShowUserDropdown(false);
                          setShowMobileSearch(false);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-canvas text-left cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={u.avatar_url || (u.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')}
                            alt={u.name}
                            className="w-7 h-7 rounded-full object-cover border border-divider shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-ink truncate">{u.name}</div>
                            <div className="text-[10px] text-ink-secondary truncate">
                              ★ {u.rating ? u.rating.toFixed(1) : '5.0'} • {u.locality || 'Nearby'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-brand ml-2 shrink-0">Profile →</span>
                      </button>
                    ))}
                  </div>
                ) : !isSearchingUsers ? (
                  <div className="py-2 text-center text-xs text-ink-muted">
                    No members matching "{searchQuery}"
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Responsive Mobile Navigation Drawer / Dropdown */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-divider/60 bg-surface/95 dark:bg-[#111218]/95 backdrop-blur-md px-3 py-4 space-y-4 animate-in slide-in-from-top-2 duration-150 shadow-xl">

            {/* Navigation Links */}
            <div className="space-y-1">
              <button
                onClick={() => { setActiveTab('explore'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'explore' || activeTab === 'requests' ? 'bg-brand text-white' : 'text-ink hover:bg-canvas'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Marketplace (Items & Requests)</span>
              </button>

              <button
                onClick={() => { setActiveTab('community'); setShowMobileMenu(false); }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'community' ? 'bg-brand text-white' : 'text-ink hover:bg-canvas'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4" />
                  <span>Community & Leaderboard</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                  activeTab === 'community' ? 'bg-white/20 text-white' : 'bg-brand-soft text-brand'
                }`}>
                  Top 10
                </span>
              </button>
            </div>

            {/* Authenticated or Unauthenticated actions in Mobile Menu */}
            {isAuthenticated ? (
              <div className="pt-2 border-t border-divider space-y-1">
                <button
                  onClick={() => { setActiveTab('profile'); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-ink hover:bg-canvas transition-colors cursor-pointer"
                >
                  <UserIcon className="w-4 h-4 text-ink-secondary" />
                  <span>My Profile & Listings</span>
                </button>

                <button
                  onClick={() => { setActiveTab('messages'); setShowMobileMenu(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeTab === 'messages' ? 'bg-brand/10 text-brand' : 'text-ink hover:bg-canvas'
                  }`}
                >
                  <MessageSquare className={`w-4 h-4 ${activeTab === 'messages' ? 'text-brand' : 'text-ink-secondary'}`} />
                  <span>Messages & Coordination</span>
                </button>

                <button
                  onClick={() => { setActiveTab('bookings'); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-ink hover:bg-canvas transition-colors cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-ink-secondary" />
                  <span>Bookings & Activity</span>
                </button>

                <button
                  onClick={() => { onOpenHelpSupport?.(); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-ink hover:bg-canvas transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-brand" />
                  <span>Help & Raise Concern</span>
                </button>

                <button
                  onClick={() => { logout(); setShowMobileMenu(false); setActiveTab('explore'); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-brand hover:bg-pink-50 transition-colors cursor-pointer mt-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-divider">
                <button
                  id="mobile-signin-btn"
                  onClick={() => { onOpenAuth(); setShowMobileMenu(false); }}
                  className="btn-primary w-full py-2.5 text-xs text-center font-bold shadow-pink cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
