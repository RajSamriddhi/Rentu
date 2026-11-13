import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  Calendar,
  Check,
  X,
  Package,
  CheckCircle2,
  Clock,
  User as UserIcon,
  Star,
  Sparkles,
  ChevronDown,
  ArrowRight,
  Inbox,
  Filter,
  Compass,
  Target
} from 'lucide-react';
import { AppNotification } from '../lib/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { TabType } from '../App';

interface NotificationsViewProps {
  onNavigateNotification: (target: {
    tab: TabType;
    bookingSubTab?: 'ongoing' | 'requests' | 'finished' | 'cancelled';
    bookingId?: string;
    userId?: string;
  }) => void;
  onOpenChatWithUser?: (targetUserId: string, targetUserName?: string, avatarUrl?: string) => void;
  onOpenUserProfile?: (userId: string) => void;
  onNavigateTab: (tab: TabType) => void;
  onOpenAuth?: () => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  onNavigateNotification,
  onOpenChatWithUser,
  onOpenUserProfile,
  onNavigateTab,
  onOpenAuth,
}) => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [serverUnreadCount, setServerUnreadCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = useCallback(async (isInitial = false) => {
    if (!isAuthenticated || !user?.id) return;
    if (isInitial) setIsLoading(true);
    try {
      const res = await api.getNotifications({ limit: 30, offset: 0 });
      if (res && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
        if (typeof res.unread_count === 'number') {
          setServerUnreadCount(res.unread_count);
        }
        if (typeof res.total_count === 'number') {
          setTotalCount(res.total_count);
        }
        setHasMore(Boolean(res.has_more));
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    fetchNotifications(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchNotifications]);

  // Listen for real-time notification events
  useEffect(() => {
    const handleUpdate = () => fetchNotifications(false);
    window.addEventListener('rentu:notifications-updated', handleUpdate);
    return () => window.removeEventListener('rentu:notifications-updated', handleUpdate);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_read: true,
          read_at: n.read_at || new Date().toISOString(),
        }))
      );
      setServerUnreadCount(0);
      window.dispatchEvent(new CustomEvent('rentu:notifications-updated'));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleShowMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await api.getNotifications({
        limit: 30,
        offset: notifications.length,
      });
      if (res && Array.isArray(res.notifications)) {
        setNotifications((prev) => [...prev, ...res.notifications]);
        setHasMore(Boolean(res.has_more));
        if (typeof res.total_count === 'number') setTotalCount(res.total_count);
      }
    } catch (err) {
      console.error('Failed to load more notifications:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    // Optimistically mark as read
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setServerUnreadCount((c) => Math.max(0, c - 1));
      try {
        await api.markNotificationRead(notif.id);
        window.dispatchEvent(new CustomEvent('rentu:notifications-updated'));
      } catch (err) {
        console.error('Failed to mark notification read:', err);
      }
    }

    const nType = (notif.type || '').toUpperCase();
    const isRentalRequest =
      nType === 'BOOKING_PROPOSAL' ||
      nType === 'BOOKING_CREATED' ||
      nType.includes('PROPOSAL');
    const isOngoing =
      nType === 'BOOKING_ACCEPTED' ||
      nType === 'BOOKING_HANDED_OVER' ||
      nType === 'BOOKING_RECEIVED' ||
      nType === 'REMINDER_PICKUP' ||
      nType === 'REMINDER_RETURN';
    const isFinished =
      nType === 'BOOKING_COMPLETED' ||
      nType === 'BOOKING_RETURNED' ||
      nType === 'BOOKING_REJECTED' ||
      nType === 'BOOKING_REVIEW';
    const bookingId = notif.reference_id || notif.booking_id;

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
    } else if (
      notif.reference_type === 'MESSAGE' ||
      nType.includes('MESSAGE') ||
      nType === 'CHAT'
    ) {
      if (notif.sender_id && onOpenChatWithUser) {
        onOpenChatWithUser(
          notif.sender_id,
          notif.sender_name,
          notif.sender_avatar
        );
      } else {
        onNavigateTab('messages');
      }
    } else if (
      nType === 'REQUEST_FOLLOWER_ANNOUNCEMENT' ||
      nType === 'NEARBY_REQUEST_ANNOUNCEMENT' ||
      notif.reference_type === 'REQUEST'
    ) {
      onNavigateNotification({ tab: 'requests' });
    } else if (nType === 'NEW_FOLLOWER' && notif.sender_id && onOpenUserProfile) {
      onOpenUserProfile(notif.sender_id);
    } else if (notif.reference_type === 'ITEM' || nType.startsWith('ITEM_')) {
      onNavigateNotification({ tab: 'explore' });
    } else if (notif.sender_id && onOpenUserProfile) {
      onOpenUserProfile(notif.sender_id);
    } else {
      onNavigateTab('bookings');
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getMicroBadge = (type: string) => {
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
      case 'BOOKING_REVIEW':
      case 'BOOKING_REVIEW_UPDATED':
        return { Icon: Star, bg: 'bg-amber-400 text-white' };
      default:
        return { Icon: Sparkles, bg: 'bg-brand text-white' };
    }
  };

  const renderContent = (n: AppNotification) => {
    const sender = n.sender_name || 'A neighbor';
    const item = n.item_title ? `"${n.item_title}"` : null;

    if (n.type === 'BOOKING_PROPOSAL') {
      return (
        <span>
          <strong className="font-bold text-ink">{sender}</strong> requested to rent {item ? <strong className="font-bold text-ink">{item}</strong> : 'your gear'}.
        </span>
      );
    }
    if (n.type === 'BOOKING_ACCEPTED') {
      return (
        <span>
          <strong className="font-bold text-ink">{sender}</strong> accepted your request for {item ? <strong className="font-bold text-ink">{item}</strong> : 'gear'}.
        </span>
      );
    }
    if (n.type === 'BOOKING_REJECTED') {
      return (
        <span>
          <strong className="font-bold text-ink">{sender}</strong> declined your request for {item ? <strong className="font-bold text-ink">{item}</strong> : 'gear'}.
        </span>
      );
    }
    if (n.type === 'BOOKING_RECEIVED' || n.type === 'BOOKING_HANDED_OVER') {
      return (
        <span>
          Handover verified for {item ? <strong className="font-bold text-ink">{item}</strong> : 'gear'} with <strong className="font-bold text-ink">{sender}</strong>.
        </span>
      );
    }
    if (n.type === 'BOOKING_COMPLETED' || n.type === 'BOOKING_RETURNED') {
      return (
        <span>
          <strong className="font-bold text-ink">{sender}</strong> confirmed return of {item ? <strong className="font-bold text-ink">{item}</strong> : 'gear'}.
        </span>
      );
    }
    if (n.type === 'REMINDER_PICKUP') {
      return (
        <span>
          Pickup reminder: handover for {item ? <strong className="font-bold text-ink">{item}</strong> : 'gear'} with <strong className="font-bold text-ink">{sender}</strong> is scheduled.
        </span>
      );
    }
    if (n.type === 'REMINDER_RETURN') {
      return (
        <span>
          Return reminder: {item ? <strong className="font-bold text-ink">{item}</strong> : 'gear'} return with <strong className="font-bold text-ink">{sender}</strong> is due soon.
        </span>
      );
    }
    if (n.type === 'NEW_FOLLOWER') {
      return (
        <span>
          <strong className="font-bold text-ink">{sender}</strong> started following your gear listings.
        </span>
      );
    }
    if (n.type === 'NEARBY_REQUEST_ANNOUNCEMENT') {
      return (
        <span>
          <strong className="font-bold text-ink">{sender}</strong> posted a new wish nearby: {n.body}.
        </span>
      );
    }

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

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'unread') {
      return notifications.filter((n) => !n.is_read && !n.read_at);
    }
    return notifications;
  }, [notifications, activeFilter]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read && !n.read_at).length;
  }, [notifications]);

  const dayGroups = useMemo(() => {
    const groups: { key: string; label: string; items: AppNotification[] }[] = [];
    const map = new Map<string, AppNotification[]>();

    for (const n of filteredNotifications) {
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
        items,
      });
    }

    return groups;
  }, [filteredNotifications]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-3xl bg-brand/10 text-brand flex items-center justify-center mx-auto mb-4">
          <Bell className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-ink font-display mb-2">Sign In to See Notifications</h2>
        <p className="text-xs text-ink-secondary mb-6 leading-relaxed">
          Get real-time updates when neighbors request your gear, send messages, or confirm handoffs.
        </p>
        {onOpenAuth && (
          <button
            onClick={onOpenAuth}
            className="btn-primary text-xs px-6 py-2.5 shadow-pink font-bold cursor-pointer"
          >
            Sign In to Continue
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-surface border border-divider rounded-3xl p-5 sm:p-6 mb-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-ink font-display tracking-tight">
                    Notifications
                  </h1>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand text-white shadow-xs animate-in zoom-in-75 duration-150">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Rental requests, handoff updates, reviews, and community alerts
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="btn-secondary text-xs px-3.5 py-2 font-bold cursor-pointer flex items-center gap-1.5 hover:border-brand hover:text-brand transition-colors"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-divider">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-ink text-surface dark:bg-white dark:text-zinc-950 shadow-xs'
                : 'bg-canvas text-ink-secondary hover:text-ink'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setActiveFilter('unread')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'unread'
                ? 'bg-brand text-white shadow-xs'
                : 'bg-canvas text-ink-secondary hover:text-ink'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeFilter === 'unread' ? 'bg-white text-brand' : 'bg-brand/10 text-brand'
              }`}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notifications List Body */}
      {isLoading ? (
        <div className="bg-surface border border-divider rounded-3xl p-12 text-center text-ink-secondary space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-full border-2 border-brand border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-medium">Loading your activity...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-surface border border-divider rounded-3xl p-10 sm:p-14 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-brand-soft/60 text-brand flex items-center justify-center mx-auto shadow-inner">
            <Bell className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink">
              {activeFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-xs text-ink-secondary max-w-sm mx-auto mt-1 leading-relaxed">
              {activeFilter === 'unread'
                ? "You're all caught up! Check the All tab to review past rental updates."
                : 'When neighbors request, accept, or update gear rentals with you, notifications will show up right here.'}
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => onNavigateTab('explore')}
              className="btn-primary text-xs px-4 py-2 font-bold flex items-center gap-1.5 cursor-pointer shadow-pink"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explore Gear</span>
            </button>
            <button
              onClick={() => onNavigateTab('requests')}
              className="btn-secondary text-xs px-4 py-2 font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Target className="w-3.5 h-3.5 text-brand" />
              <span>Community Wishes</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {dayGroups.map((group) => (
            <div key={group.key} className="space-y-2">
              {/* Day Header */}
              <div className="flex items-center justify-between px-2 text-xs font-bold text-ink-secondary">
                <span className="font-display uppercase tracking-wider text-[11px] font-black text-ink">
                  {group.label}
                </span>
                <span className="text-[10px] text-ink-muted">
                  {group.items.length} {group.items.length === 1 ? 'alert' : 'alerts'}
                </span>
              </div>

              {/* Day Items Container */}
              <div className="bg-surface border border-divider rounded-3xl overflow-hidden shadow-xs divide-y divide-divider/50">
                {group.items.map((n) => {
                  const isUnread = !n.is_read && !n.read_at;
                  const micro = getMicroBadge(n.type);
                  const sender = n.sender_name || 'Neighbor';
                  const initial = sender.charAt(0).toUpperCase();

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-4 sm:p-4.5 hover:bg-canvas/80 transition-all cursor-pointer flex items-center gap-3.5 relative group ${
                        isUnread ? 'bg-brand/[0.04]' : ''
                      }`}
                    >
                      {/* Avatar with micro badge */}
                      <div className="relative shrink-0">
                        {n.sender_avatar ? (
                          <img
                            src={n.sender_avatar}
                            alt={sender}
                            className="w-11 h-11 rounded-full object-cover ring-2 ring-divider/70"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-zinc-800 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                            {initial}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center font-bold ring-2 ring-surface shadow-xs ${micro.bg}`}
                        >
                          <micro.Icon className="w-3 h-3 stroke-[2.5]" />
                        </span>
                      </div>

                      {/* Notification text and timestamp */}
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs sm:text-[13px] text-ink leading-relaxed">
                          {renderContent(n)}
                        </p>
                        <p className="text-[11px] text-ink-muted mt-1 font-medium flex items-center gap-1.5">
                          <span>{formatRelativeTime(n.created_at)}</span>
                          {isUnread && (
                            <>
                              <span>•</span>
                              <span className="text-brand font-bold">Unread</span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Right: Gear thumbnail or unread dot */}
                      {n.item_image ? (
                        <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-divider bg-canvas flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                          <img
                            src={n.item_image}
                            alt="Gear"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : isUnread ? (
                        <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-brand shadow-xs" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Show More Button */}
          {hasMore && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleShowMore}
                disabled={isLoadingMore}
                className="btn-secondary px-6 py-2.5 text-xs font-bold rounded-2xl cursor-pointer hover:border-brand hover:text-brand transition-all inline-flex items-center gap-2 shadow-xs"
              >
                {isLoadingMore ? (
                  <span>Loading older notifications...</span>
                ) : (
                  <>
                    <span>Load Older Notifications</span>
                    <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
