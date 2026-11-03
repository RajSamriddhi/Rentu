import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  HelpCircle,
  Settings,
  Check,
  CheckCircle2,
  Clock,
  Package
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useTheme } from '../lib/themeContext';
import { api } from '../lib/api';
import { UserSearchResult, isAuthorizedAdmin, AppNotification } from '../lib/types';

interface NavbarProps {
  activeTab: 'home' | 'explore' | 'requests' | 'bookings' | 'hustle' | 'profile' | 'messages' | 'community';
  setActiveTab: (tab: 'home' | 'explore' | 'requests' | 'bookings' | 'hustle' | 'profile' | 'messages' | 'community') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearch: () => void;
  onOpenDropGear: () => void;
  onOpenDropWish: () => void;
  onOpenAuth: (mode?: 'login' | 'signup') => void;
  onOpenChat: () => void;
  onOpenHowItWorks?: () => void;
  onOpenUserProfile?: (userId: string) => void;
  onOpenHelpSupport?: () => void;
  onOpenSettings?: () => void;
  onNavigateNotification?: (target: {
    tab: 'home' | 'explore' | 'requests' | 'bookings' | 'hustle' | 'profile' | 'messages' | 'community';
    bookingSubTab?: 'ongoing' | 'requests' | 'finished';
    bookingId?: string;
    userId?: string;
  }) => void;
  onOpenChatWithUser?: (partnerId: string, partnerName?: string, partnerAvatar?: string) => void;
  unreadMessagesCount?: number;
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
  onOpenSettings,
  onNavigateNotification,
  onOpenChatWithUser,
  unreadMessagesCount: propUnreadMessagesCount,
}) => {
  const { user, firebaseUser, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  
  const currentUserEmail = (user?.email || firebaseUser?.email || '').trim().toLowerCase();
  const isUserAdmin = isAuthorizedAdmin(currentUserEmail);
  
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Live User Search State
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Live Notifications & Unread Messages State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(10);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [latestToast, setLatestToast] = useState<AppNotification | null>(null);

  // Unread messages count (falls back to local state if not passed from parent)
  const [localUnreadMessages, setLocalUnreadMessages] = useState<number>(0);
  const unreadMessagesCount = propUnreadMessagesCount !== undefined ? propUnreadMessagesCount : localUnreadMessages;

  const postMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const mobileSearchBoxRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchUnreadMessages = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.getUnreadMessagesCount();
      if (res && typeof res.unread_count === 'number') {
        setLocalUnreadMessages(res.unread_count);
      }
    } catch {
      // ignore
    }
  };

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      const data: any = await api.getNotifications();
      const list: AppNotification[] = Array.isArray(data)
        ? data
        : (data?.notifications || []);

      if (data && typeof data.unread_messages_count === 'number') {
        setLocalUnreadMessages(data.unread_messages_count);
      }

      setNotifications((prev) => {
        if (prev.length > 0 && list.length > 0) {
          const newest = list[0];
          const prevIds = new Set(prev.map((p) => p.id));
          if (!prevIds.has(newest.id) && !newest.is_read && !newest.read_at) {
            setLatestToast(newest);
            setTimeout(() => setLatestToast(null), 6000);
          }
        }
        return list;
      });
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      fetchUnreadMessages();
      const interval = setInterval(() => {
        fetchNotifications();
        fetchUnreadMessages();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Listen for real-time notification and message update events triggered anywhere in app
  useEffect(() => {
    const handleUpdate = () => {
      fetchNotifications();
      fetchUnreadMessages();
    };
    window.addEventListener('rentu:notifications-updated', handleUpdate);
    window.addEventListener('rentu:messages-updated', handleUpdate);
    return () => {
      window.removeEventListener('rentu:notifications-updated', handleUpdate);
      window.removeEventListener('rentu:messages-updated', handleUpdate);
    };
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

  const unreadCount = notifications.filter((n) => !n.is_read && !n.read_at).length;

  const formatInstaTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (diffSec < 60) return 'now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getInstaMicroBadge = (type: string) => {
    switch (type) {
      case 'BOOKING_PROPOSAL':
        return { Icon: Calendar, bg: 'bg-amber-500 text-white' };
      case 'BOOKING_ACCEPTED':
        return { Icon: Check, bg: 'bg-blue-500 text-white' };
      case 'BOOKING_REJECTED':
        return { Icon: X, bg: 'bg-rose-500 text-white' };
      case 'BOOKING_RECEIVED':
      case 'BOOKING_HANDED_OVER':
        return { Icon: Package, bg: 'bg-emerald-500 text-white' };
      case 'BOOKING_COMPLETED':
      case 'BOOKING_RETURNED':
        return { Icon: CheckCircle2, bg: 'bg-purple-500 text-white' };
      case 'REMINDER_PICKUP':
      case 'REMINDER_RETURN':
        return { Icon: Clock, bg: 'bg-orange-500 text-white' };
      case 'NEW_FOLLOWER':
        return { Icon: UserIcon, bg: 'bg-indigo-500 text-white' };
      default:
        return { Icon: Sparkles, bg: 'bg-brand text-white' };
    }
  };

  const renderInstaContent = (n: AppNotification) => {
    const sender = n.sender_name || 'A neighbor';
    const item = n.item_title ? `"${n.item_title}"` : null;

    if (n.type === 'BOOKING_PROPOSAL') {
      return (
        <>
          <span className="font-bold text-ink">{sender}</span> requested to rent {item ? <span className="font-bold text-ink">{item}</span> : 'your gear'}.
        </>
      );
    }
    if (n.type === 'BOOKING_ACCEPTED') {
      return (
        <>
          <span className="font-bold text-ink">{sender}</span> accepted your request for {item ? <span className="font-bold text-ink">{item}</span> : 'gear'}.
        </>
      );
    }
    if (n.type === 'BOOKING_REJECTED') {
      return (
        <>
          <span className="font-bold text-ink">{sender}</span> declined your request for {item ? <span className="font-bold text-ink">{item}</span> : 'gear'}.
        </>
      );
    }
    if (n.type === 'BOOKING_RECEIVED' || n.type === 'BOOKING_HANDED_OVER') {
      return (
        <>
          Handover verified for {item ? <span className="font-bold text-ink">{item}</span> : 'gear'} with <span className="font-bold text-ink">{sender}</span>.
        </>
      );
    }
    if (n.type === 'BOOKING_COMPLETED' || n.type === 'BOOKING_RETURNED') {
      return (
        <>
          <span className="font-bold text-ink">{sender}</span> confirmed return of {item ? <span className="font-bold text-ink">{item}</span> : 'gear'}.
        </>
      );
    }
    if (n.type === 'REMINDER_PICKUP') {
      return (
        <>
          Pickup reminder: handover for {item ? <span className="font-bold text-ink">{item}</span> : 'gear'} with <span className="font-bold text-ink">{sender}</span> is scheduled.
        </>
      );
    }
    if (n.type === 'REMINDER_RETURN') {
      return (
        <>
          Return reminder: {item ? <span className="font-bold text-ink">{item}</span> : 'gear'} return with <span className="font-bold text-ink">{sender}</span> is due soon.
        </>
      );
    }
    if (n.type === 'NEW_FOLLOWER') {
      return (
        <>
          <span className="font-bold text-ink">{sender}</span> started following your gear listings.
        </>
      );
    }
    if (n.type === 'NEARBY_REQUEST_ANNOUNCEMENT') {
      return (
        <>
          <span className="font-bold text-ink">{sender}</span> posted a new wish nearby: {n.body}.
        </>
      );
    }

    // Clean fallback stripping emojis
    const cleanBody = (n.body || n.title || '').replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
    return <span>{cleanBody}</span>;
  };

  const getDayMeta = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.round((nowMid - dMid) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { key: 'today', label: 'Today' };
    if (diffDays === 1) return { key: 'yesterday', label: 'Yesterday' };
    return {
      key: `date-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
      label: d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      }),
    };
  };

  // Group notifications into daily sections respecting visibleLimit
  const dayGroups = useMemo(() => {
    const dayTotals: Record<string, number> = {};
    for (const n of notifications) {
      const { label } = getDayMeta(n.created_at);
      dayTotals[label] = (dayTotals[label] || 0) + 1;
    }

    const visibleItems = notifications.slice(0, visibleLimit);
    const groups: { key: string; label: string; totalCount: number; items: AppNotification[] }[] = [];
    const map = new Map<string, AppNotification[]>();

    for (const n of visibleItems) {
      const { label } = getDayMeta(n.created_at);
      if (!map.has(label)) {
        map.set(label, []);
      }
      map.get(label)!.push(n);
    }

    for (const [label, items] of map.entries()) {
      groups.push({
        key: label,
        label,
        totalCount: dayTotals[label] || items.length,
        items,
      });
    }

    return groups;
  }, [notifications, visibleLimit]);

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.is_read && !notif.read_at) {
      await api.markNotificationRead(notif.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
    }
    setShowNotifications(false);
    setLatestToast(null);

    const bookingId = notif.booking_id || notif.reference_id || undefined;
    const nType = (notif.type || '').toUpperCase();
    const nBody = (notif.body || '').toLowerCase();

    // 1. Rental Request Notifications -> Takes you directly to 'requests' section of Bookings!
    const isRentalRequest = 
      nType === 'BOOKING_PROPOSAL' || 
      nType === 'NEW_PROPOSAL' || 
      nType.includes('PROPOSAL') ||
      nBody.includes('requested to rent');

    // 2. Active / Ongoing Handoff Notifications -> Takes you to 'ongoing' section of Bookings!
    const isOngoing =
      nType === 'BOOKING_ACCEPTED' ||
      nType === 'BOOKING_STARTED' ||
      nType.startsWith('REMINDER_') ||
      nType.includes('HANDED_OVER') ||
      nType.includes('PICKUP');

    // 3. Finished / Returned / Reviews -> Takes you to 'finished' section of Bookings!
    const isFinished =
      nType === 'BOOKING_COMPLETED' ||
      nType === 'RETURN_CONFIRMED' ||
      nType.includes('COMPLETED') ||
      nType.includes('REVIEW_REMINDER');

    if (onNavigateNotification) {
      if (isRentalRequest) {
        onNavigateNotification({
          tab: 'bookings',
          bookingSubTab: 'requests',
          bookingId,
        });
      } else if (isOngoing) {
        onNavigateNotification({
          tab: 'bookings',
          bookingSubTab: 'ongoing',
          bookingId,
        });
      } else if (isFinished) {
        onNavigateNotification({
          tab: 'bookings',
          bookingSubTab: 'finished',
          bookingId,
        });
      } else if (notif.reference_type === 'MESSAGE' || nType.includes('MESSAGE') || nType === 'CHAT') {
        if (notif.sender_id && onOpenChatWithUser) {
          onOpenChatWithUser(notif.sender_id, notif.sender_name, notif.sender_avatar);
        } else {
          setActiveTab('messages');
        }
      } else if (notif.reference_type === 'REQUEST' || nType.includes('REQUEST')) {
        onNavigateNotification({ tab: 'requests' });
      } else if (nType === 'NEW_FOLLOWER' && notif.sender_id && onOpenUserProfile) {
        onOpenUserProfile(notif.sender_id);
      } else if (notif.reference_type === 'ITEM' || nType.startsWith('ITEM_')) {
        onNavigateNotification({ tab: 'explore' });
      } else if (notif.sender_id && onOpenUserProfile) {
        onOpenUserProfile(notif.sender_id);
      } else {
        setActiveTab('bookings');
      }
    } else {
      if (isRentalRequest) {
        setActiveTab('bookings');
      } else {
        setActiveTab('bookings');
      }
    }
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
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
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#171821] border border-zinc-200/90 dark:border-zinc-800 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.15)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.6)] p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-zinc-100 dark:divide-zinc-800/80">
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
                              onOpenUserProfile(u.username || u.id);
                            }
                            setShowUserDropdown(false);
                          }}
                          onClick={() => {
                            if (onOpenUserProfile) {
                              onOpenUserProfile(u.username || u.id);
                            }
                            setShowUserDropdown(false);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/70 text-left cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={u.avatar_url || (u.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')}
                              alt={u.name}
                              className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 group-hover:border-brand shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-ink group-hover:text-brand truncate">{u.name}</span>
                                {u.username && (
                                  <span className="text-[10px] font-bold text-brand font-mono">@{u.username}</span>
                                )}
                                <span className="inline-flex items-center text-[10px] font-black text-amber-500">
                                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 mr-0.5 shrink-0" />
                                  <span>{Number(u.rating) > 0 ? u.rating.toFixed(1) : '0.0'}</span>
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
                      const next = !showNotifications;
                      setShowNotifications(next);
                      if (next) {
                        setVisibleLimit(10);
                        fetchNotifications();
                      }
                    }}
                    className={`relative p-2 rounded-full transition-colors cursor-pointer flex ${
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
                    <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full mt-2 w-[calc(100vw-1rem)] sm:w-96 max-w-sm sm:max-w-md bg-surface border border-divider rounded-2xl shadow-2xl overflow-hidden z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-4 py-3 border-b border-divider flex items-center justify-between bg-canvas/40">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink text-sm">Notifications</span>
                          {notifications.length > 0 && (
                            <span className="text-[10px] font-black text-brand bg-brand-soft px-2 py-0.5 rounded-full border border-brand/20">
                              {notifications.length}
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-xs text-brand hover:underline font-semibold cursor-pointer"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>

                      <div className="max-h-[28rem] overflow-y-auto">
                        {isLoadingNotifications && notifications.length === 0 ? (
                          <div className="py-8 text-center text-ink-secondary text-xs">
                            Loading notifications...
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="py-10 text-center text-ink-secondary text-xs px-6">
                            <div className="w-12 h-12 rounded-full bg-brand-soft/50 text-brand flex items-center justify-center mx-auto mb-2.5">
                              <Bell className="w-5 h-5" />
                            </div>
                            <p className="font-semibold text-ink text-sm mb-1">No notifications yet</p>
                            <p className="text-ink-secondary text-xs leading-relaxed">
                              When neighbors request, accept, or update rentals with you, you'll see them here.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {dayGroups.map((group) => (
                              <div key={group.key} className="space-y-0.5">
                                {/* Group Day Header: Displays date & count of notifications for that day */}
                                <div className="sticky top-0 z-10 px-4 py-2 bg-surface/95 backdrop-blur-md border-y border-divider/60 flex items-center justify-between text-[11px] font-black tracking-wide text-ink font-display shadow-2xs">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-brand" />
                                    <span>{group.label}</span>
                                  </div>
                                  <span className="text-[10px] font-extrabold text-ink-secondary bg-canvas px-2.5 py-0.5 rounded-full border border-divider/60">
                                    {group.totalCount} {group.totalCount === 1 ? 'notification' : 'notifications'}
                                  </span>
                                </div>

                                {/* Notifications in this day group */}
                                <div className="divide-y divide-divider/30">
                                  {group.items.map((n) => {
                                    const isUnread = !n.is_read && !n.read_at;
                                    const micro = getInstaMicroBadge(n.type);
                                    const sender = n.sender_name || 'Neighbor';
                                    const initial = sender.charAt(0).toUpperCase();

                                    return (
                                      <div
                                        key={n.id}
                                        onClick={() => handleNotificationClick(n)}
                                        className={`px-4 py-3 hover:bg-canvas/70 transition-colors cursor-pointer flex items-center gap-3 relative ${
                                          isUnread ? 'bg-brand/[0.04]' : ''
                                        }`}
                                      >
                                        {/* Circular Avatar with micro-badge */}
                                        <div className="relative shrink-0">
                                          {n.sender_avatar ? (
                                            <img
                                              src={n.sender_avatar}
                                              alt={sender}
                                              className="w-10 h-10 rounded-full object-cover ring-1 ring-divider"
                                            />
                                          ) : (
                                            <div className="w-10 h-10 rounded-full bg-zinc-800 text-white font-bold flex items-center justify-center text-sm">
                                              {initial}
                                            </div>
                                          )}
                                          <span
                                            className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center font-bold ring-2 ring-surface ${micro.bg}`}
                                          >
                                            <micro.Icon className="w-2.5 h-2.5 stroke-[2.5]" />
                                          </span>
                                        </div>

                                        {/* Fluid sentence */}
                                        <div className="flex-1 min-w-0 pr-1">
                                          <p className="text-xs text-ink leading-snug">
                                            {renderInstaContent(n)}
                                            <span className="text-ink-muted text-[11px] ml-1.5 font-normal">
                                              {formatInstaTime(n.created_at)}
                                            </span>
                                          </p>
                                        </div>

                                        {/* Right: Gear image thumbnail or unread dot */}
                                        {n.item_image ? (
                                          <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-divider bg-canvas flex items-center justify-center">
                                            <img
                                              src={n.item_image}
                                              alt="gear"
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                        ) : isUnread ? (
                                          <div className="shrink-0 w-2 h-2 rounded-full bg-brand" />
                                        ) : null}

                                        {n.item_image && isUnread && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}

                            {/* Show More Notifications Button (displayed when total notifications > visibleLimit) */}
                            {notifications.length > visibleLimit && (
                              <div className="p-3 text-center bg-canvas/40 border-t border-divider">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVisibleLimit((prev) => prev + 10);
                                  }}
                                  className="btn-secondary w-full py-2.5 text-xs font-bold rounded-xl text-ink hover:text-brand hover:border-brand/40 cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                  <span>Show More Notifications</span>
                                  <span className="text-[10px] text-ink-secondary">
                                    ({notifications.length - visibleLimit} remaining)
                                  </span>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Messages Icon (Hidden on small screens, accessible via hamburger) */}
                <button
                  onClick={onOpenChat}
                  className={`relative p-2 rounded-full transition-colors cursor-pointer hidden md:flex ${
                    activeTab === 'messages'
                      ? 'bg-brand/10 text-brand ring-1 ring-brand/30'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-ink-secondary hover:text-ink'
                  }`}
                  title="Messages & Coordination"
                >
                  <MessageSquare className="w-4 h-4" />
                  {unreadMessagesCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-brand text-[10px] font-black text-white flex items-center justify-center leading-none shadow-sm animate-in zoom-in-75 duration-200">
                      {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                    </span>
                  )}
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
                        <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-brand flex items-center justify-center shrink-0">
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div>
                          <div>List Gear for Rent</div>
                          <div className="text-[10px] text-ink-secondary font-medium">Turn unused items into income</div>
                        </div>
                      </button>

                      <button
                        onClick={() => { setShowPostMenu(false); onOpenDropWish(); }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-canvas transition-colors flex items-center gap-2.5 font-bold text-ink cursor-pointer mt-1"
                      >
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
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

                      {isUserAdmin && (
                        <button
                          onClick={() => { setActiveTab('hustle'); setShowUserMenu(false); }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-canvas flex items-center gap-2.5 font-bold text-ink cursor-pointer"
                        >
                          <BarChart3 className="w-4 h-4 text-ink-secondary" />
                          <span>Admin Dashboard</span>
                        </button>
                      )}

                      <button
                        onClick={() => { onOpenSettings?.(); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-canvas flex items-center gap-2.5 font-bold text-ink cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-ink-secondary" />
                        <span>Settings</span>
                      </button>

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
              /* UNAUTHENTICATED: Distinct Log In and Sign Up buttons */
              <div className="flex items-center gap-2">
                <button
                  id="navbar-login-btn"
                  onClick={() => onOpenAuth('login')}
                  className="px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-ink hover:text-brand transition-colors cursor-pointer rounded-full hover:bg-canvas"
                >
                  Log In
                </button>
                <button
                  id="navbar-signup-btn"
                  onClick={() => onOpenAuth('signup')}
                  className="btn-primary text-xs px-3.5 sm:px-4 py-1.5 sm:py-2 cursor-pointer shadow-pink font-bold"
                >
                  Sign Up
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
              <div className="mt-2 bg-white dark:bg-[#171821] border border-zinc-200/90 dark:border-zinc-800 rounded-2xl shadow-xl p-2.5 z-50 divide-y divide-zinc-100 dark:divide-zinc-800 max-h-72 overflow-y-auto">
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
                            onOpenUserProfile(u.username || u.id);
                          }
                          setShowUserDropdown(false);
                          setShowMobileSearch(false);
                        }}
                        onClick={() => {
                          if (onOpenUserProfile) {
                            onOpenUserProfile(u.username || u.id);
                          }
                          setShowUserDropdown(false);
                          setShowMobileSearch(false);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/70 text-left cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={u.avatar_url || (u.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')}
                            alt={u.name}
                            className="w-7 h-7 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-ink truncate">{u.name}</span>
                              {u.username && (
                                <span className="text-[10px] font-bold text-brand font-mono">@{u.username}</span>
                              )}
                            </div>
                            <div className="text-[10px] text-ink-secondary truncate flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
                              <span>{Number(u.rating) > 0 ? u.rating.toFixed(1) : '0.0'} • {u.locality || 'Nearby'}</span>
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
          <div className="md:hidden border-t border-divider/60 bg-white dark:bg-[#111218] px-3 py-4 space-y-4 animate-in slide-in-from-top-2 duration-150 shadow-xl">

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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeTab === 'messages' ? 'bg-brand/10 text-brand' : 'text-ink hover:bg-canvas'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className={`w-4 h-4 ${activeTab === 'messages' ? 'text-brand' : 'text-ink-secondary'}`} />
                    <span>Messages & Coordination</span>
                  </div>
                  {unreadMessagesCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand text-white shadow-sm">
                      {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount} new
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { setShowNotifications(true); setShowMobileMenu(false); }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-ink hover:bg-canvas transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-brand" />
                    <span>Notifications & Alerts</span>
                  </div>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand text-white shadow-sm">
                      {unreadCount} new
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { setActiveTab('bookings'); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-ink hover:bg-canvas transition-colors cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-ink-secondary" />
                  <span>Bookings & Activity</span>
                </button>

                <button
                  onClick={() => { onOpenSettings?.(); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-ink hover:bg-canvas transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-ink-secondary" />
                  <span>Settings</span>
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
              <div className="pt-2 border-t border-divider grid grid-cols-2 gap-2">
                <button
                  id="mobile-login-btn"
                  onClick={() => { onOpenAuth('login'); setShowMobileMenu(false); }}
                  className="btn-secondary w-full py-2.5 text-xs text-center font-bold cursor-pointer"
                >
                  Log In
                </button>
                <button
                  id="mobile-signup-btn"
                  onClick={() => { onOpenAuth('signup'); setShowMobileMenu(false); }}
                  className="btn-primary w-full py-2.5 text-xs text-center font-bold shadow-pink cursor-pointer"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Real-Time Floating Notification Toast (Instagram Style) */}
      {latestToast && (
        <div 
          onClick={() => handleNotificationClick(latestToast)}
          className="fixed top-20 right-4 sm:right-8 z-50 max-w-sm w-full bg-surface/95 backdrop-blur-md border border-divider shadow-2xl rounded-2xl p-3 flex items-center gap-3 cursor-pointer animate-in slide-in-from-top-4 duration-200 hover:scale-[1.01] transition-transform"
        >
          <div className="relative shrink-0">
            {latestToast.sender_avatar ? (
              <img
                src={latestToast.sender_avatar}
                alt={latestToast.sender_name || 'User'}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-divider"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-800 text-white font-bold flex items-center justify-center text-sm">
                {(latestToast.sender_name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            {(() => {
              const badge = getInstaMicroBadge(latestToast.type);
              const BadgeIcon = badge.Icon;
              return (
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-surface ${badge.bg}`}
                >
                  <BadgeIcon className="w-2.5 h-2.5 stroke-[2.5]" />
                </span>
              );
            })()}
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <p className="text-xs text-ink leading-snug">
              {renderInstaContent(latestToast)}
              <span className="text-ink-muted text-[11px] ml-1.5 font-normal">
                {formatInstaTime(latestToast.created_at)}
              </span>
            </p>
          </div>

          {latestToast.item_image && (
            <div className="shrink-0 w-9 h-9 rounded-lg overflow-hidden border border-divider bg-canvas flex items-center justify-center">
              <img
                src={latestToast.item_image}
                alt="gear"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <button 
            onClick={(e) => { e.stopPropagation(); setLatestToast(null); }}
            className="text-ink-muted hover:text-ink text-xs p-1 cursor-pointer leading-none shrink-0"
            aria-label="Dismiss toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
};
