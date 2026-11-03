import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MapPin,
  Star,
  ShieldCheck,
  Calendar,
  MessageSquare,
  Share2,
  Package,
  Sparkles,
  Clock,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Heart,
  ExternalLink,
  Award,
  Zap,
  Gift,
  UserPlus,
  UserCheck,
  Ban,
  Lock,
  Users,
  AlertCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { PublicUserProfile, Item, CommunityRequest } from '../lib/types';
import { ItemCard } from './ItemCard';
import { RequestCard } from './RequestCard';
import { useAuth } from '../lib/authContext';
import { formatFullAddress } from '../lib/location';

interface PublicProfileViewProps {
  userId: string;
  onClose: () => void;
  onOpenMyAccount?: () => void;
  onSelectItem: (item: Item) => void;
  onClaimRequest?: (request: CommunityRequest) => void;
  onOpenChatWithBooking?: (bookingId: string) => void;
  onOpenChatWithUser?: (userId: string, userName: string, avatarUrl?: string) => void;
  onOpenAuth?: () => void;
}

export const PublicProfileView: React.FC<PublicProfileViewProps> = ({
  userId,
  onClose,
  onOpenMyAccount,
  onSelectItem,
  onClaimRequest,
  onOpenChatWithBooking,
  onOpenChatWithUser,
  onOpenAuth,
}) => {
  const { user: currentUser, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'items' | 'requests' | 'reviews'>('items');
  const [copiedLink, setCopiedLink] = useState(false);
  const [reviewTypeFilter, setReviewTypeFilter] = useState<'ALL' | 'OWNER_RENTAL' | 'RENTER' | 'COMMUNITY_LENDER'>('ALL');

  // Relationship states
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedBy, setIsBlockedBy] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [userId]);

  const fetchProfile = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getUserProfile(userId);
      setProfile(data);
      if (data && data.username) {
        const cleanHandle = data.username.toLowerCase();
        const expectedPath = `/${cleanHandle}`;
        if (window.location.pathname.toLowerCase() !== expectedPath) {
          window.history.replaceState(null, '', expectedPath);
        }
      }
      setIsFollowing(!!data.is_following);
      setFollowersCount(data.followers_count || 0);
      setFollowingCount(data.following_count || 0);
      setIsBlocked(!!data.is_blocked);
      setIsBlockedBy(!!data.is_blocked_by);
    } catch (err: any) {
      console.error('Failed to load user profile:', err);
      setError(err.message || 'Could not load community profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!isAuthenticated) {
      onOpenAuth?.();
      return;
    }
    if (isActionLoading || isBlocked) return;
    const targetId = profile?.id || userId;
    setIsActionLoading(true);
    try {
      if (isFollowing) {
        const res = await api.unfollowUser(targetId);
        setIsFollowing(false);
        setFollowersCount(res?.followers_count ?? Math.max(0, followersCount - 1));
      } else {
        const res = await api.followUser(targetId);
        setIsFollowing(true);
        setFollowersCount(res?.followers_count ?? (followersCount + 1));
      }
    } catch (err: any) {
      alert(err.message || 'Could not update follow status');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!isAuthenticated) {
      onOpenAuth?.();
      return;
    }
    const targetId = profile?.id || userId;
    if (isBlocked) {
      if (!confirm(`Unblock ${profile?.name}? You will be able to see each other's listings and send messages.`)) return;
      try {
        await api.unblockUser(targetId);
        setIsBlocked(false);
        fetchProfile();
      } catch (err: any) {
        alert(err.message || 'Could not unblock user');
      }
    } else {
      if (!confirm(`Block ${profile?.name}? You won't be able to message each other, see each other's requests, or rent items from each other.`)) return;
      try {
        await api.blockUser(targetId);
        setIsBlocked(true);
        setIsFollowing(false);
        setFollowersCount(Math.max(0, followersCount - 1));
        fetchProfile();
      } catch (err: any) {
        alert(err.message || 'Could not block user');
      }
    }
  };

  const handleShare = () => {
    const shareUrl = profile?.username
      ? `${window.location.origin}/${profile.username}`
      : (window.location.href || `${window.location.origin}/user/${userId}`);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const isOwnProfile = Boolean(
    currentUser && (
      currentUser.id === userId ||
      (profile && currentUser.id === profile.id) ||
      (currentUser.username && (
        (profile?.username && currentUser.username.toLowerCase() === profile.username.toLowerCase()) ||
        currentUser.username.toLowerCase() === userId.toLowerCase()
      )) ||
      (currentUser.email && (
        (profile?.email && currentUser.email.toLowerCase() === profile.email.toLowerCase()) ||
        currentUser.email.split('@')[0].toLowerCase() === userId.toLowerCase()
      ))
    )
  );

  // If viewing own profile URL, automatically switch to own account
  useEffect(() => {
    if (isOwnProfile && onOpenMyAccount) {
      onOpenMyAccount();
    }
  }, [isOwnProfile, onOpenMyAccount]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="w-10 h-10 text-brand animate-spin" />
        <p className="text-xs sm:text-sm font-bold text-ink-secondary">
          Loading neighbor profile...
        </p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-ink font-display">Profile Not Found</h2>
        <p className="text-xs text-ink-secondary">{error || 'This member profile is unavailable.'}</p>
        <button
          onClick={onClose}
          className="btn-primary text-xs px-6 py-2.5 shadow-pink cursor-pointer inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Gear</span>
        </button>
      </div>
    );
  }

  const avatarSrc = profile.avatar_url && profile.avatar_url.trim() !== ''
    ? profile.avatar_url
    : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(profile.name || 'user')}`;

  const bannerSrc = profile.banner_url || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1600&q=80';

  return (
    <div className="min-h-screen bg-canvas text-ink pb-20 animate-in fade-in duration-300">

      {/* Top Back Navigation Bar */}
      <div className="sticky top-16 z-30 bg-surface/80 backdrop-blur-md border-b border-divider px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 text-xs font-bold text-ink-secondary hover:text-ink transition-colors cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-full bg-canvas border border-divider flex items-center justify-center group-hover:scale-105 transition-transform">
              <ArrowLeft className="w-3.5 h-3.5 text-ink" />
            </div>
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="px-3 py-1.5 rounded-full border border-divider bg-canvas hover:bg-surface text-xs font-bold text-ink-secondary hover:text-ink inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedLink ? 'Link Copied!' : 'Share Profile'}</span>
            </button>

            {isOwnProfile ? (
              <button
                onClick={() => {
                  if (onOpenMyAccount) {
                    onOpenMyAccount();
                  } else {
                    onClose();
                  }
                }}
                className="btn-primary text-xs px-4 py-1.5 shadow-pink font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>My Profile & Listings</span>
              </button>
            ) : (
              <>
                {/* Follow / Following Button */}
                <button
                  onClick={handleToggleFollow}
                  disabled={isActionLoading || isBlocked}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${isFollowing
                    ? 'bg-canvas border border-brand text-brand hover:bg-brand/10'
                    : 'bg-brand hover:bg-brand-hover text-white shadow-pink'
                    } disabled:opacity-50`}
                >
                  {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>{isFollowing ? 'Following' : 'Follow'}</span>
                </button>

                {/* Message Button */}
                <button
                  onClick={() => {
                    if (!isAuthenticated && onOpenAuth) {
                      onOpenAuth();
                    } else if (isBlocked) {
                      alert('Communication is unavailable because this user is blocked.');
                    } else if (onOpenChatWithUser) {
                      onOpenChatWithUser(profile.id, profile.name, profile.avatar_url);
                    }
                  }}
                  disabled={isBlocked}
                  className="btn-primary text-xs px-4 py-1.5 shadow-pink font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Message</span>
                </button>

                {/* Block / Unblock Button */}
                <button
                  onClick={handleToggleBlock}
                  className={`px-2.5 py-1.5 rounded-full border text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer ${isBlocked
                    ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20'
                    : 'border-divider bg-canvas hover:bg-surface text-ink-muted hover:text-red-500 hover:border-red-500/30'
                    }`}
                  title={isBlocked ? 'Unblock user' : 'Block user'}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isBlocked ? 'Blocked' : 'Block'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-6">

        {/* Profile Header Hero Card */}
        <div className="bg-surface border border-divider rounded-3xl overflow-hidden shadow-lg relative">

          {/* Cover Banner */}
          <div className="h-40 sm:h-52 w-full overflow-hidden relative bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-brand/20">
            <img
              src={bannerSrc}
              alt={`${profile.name} banner`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-black/20" />
          </div>

          {/* Profile Identity Details */}
          <div className="px-6 sm:px-8 pb-8 pt-0 relative">

            {/* Avatar & Floating Badges */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-5">
              <div className="relative inline-block">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border-4 border-surface shadow-xl bg-canvas">
                  <img
                    src={avatarSrc}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md border-2 border-surface"
                  title="100% Verified Community Neighbor"
                >
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>

              {/* Reputation Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs font-black flex items-center gap-1.5 shadow-xs">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{(profile.reviews.length > 0 ? profile.rating : 0.0).toFixed(2)} Rating</span>
                </div>

                <div className="px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-black flex items-center gap-1.5 shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>{profile.trust_score}% Trust Score</span>
                </div>

                <div className="px-3.5 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-purple-800 dark:text-purple-300 text-xs font-black flex items-center gap-1.5 shadow-xs">
                  <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Verified Neighbor</span>
                </div>
              </div>
            </div>

            {/* Name, Bio, and Locality */}
            <div className="space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-ink font-display flex items-center gap-2">
                    <span>{profile.name}</span>
                    <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
                  </h1>
                  {profile.username && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-brand bg-brand-soft border border-brand/20 px-2.5 py-0.5 rounded-full font-mono">
                        @{profile.username}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-secondary font-medium mt-1">
                  <span className="flex items-center gap-1 text-ink">
                    <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>
                      {formatFullAddress(profile) || (profile.locality && profile.locality.toLowerCase() !== 'bengaluru' ? profile.locality : 'Location Not Set')}
                    </span>
                  </span>
                  <span className="text-divider">•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Member since 2024</span>
                  </span>
                  <span className="text-divider">•</span>
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{profile.reviews.length} Verified Reviews</span>
                  </span>
                  <span className="text-divider">•</span>
                  <span className="flex items-center gap-1 text-ink">
                    <Users className="w-3.5 h-3.5 text-brand" />
                    <span><strong className="text-ink">{followersCount}</strong> Followers</span>
                  </span>
                  <span className="text-divider">•</span>
                  <span className="flex items-center gap-1 text-ink">
                    <span><strong className="text-ink">{followingCount}</strong> Following</span>
                  </span>
                </div>
              </div>

              {/* Blocked Notices */}
              {isBlocked && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-between gap-3 text-xs text-red-500">
                  <div className="flex items-center gap-2">
                    <Ban className="w-4 h-4 shrink-0" />
                    <span>You have blocked <strong>{profile.name}</strong>. You cannot message each other, see each other's requests, or rent items.</span>
                  </div>
                  <button
                    onClick={handleToggleBlock}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs cursor-pointer shrink-0"
                  >
                    Unblock
                  </button>
                </div>
              )}

              {isBlockedBy && !isBlocked && (
                <div className="p-3.5 rounded-2xl bg-canvas border border-divider text-xs text-ink-secondary flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>This neighbor's gear and requests are not available.</span>
                </div>
              )}

              {/* Bio / About */}
              <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed max-w-3xl">
                {profile.bio || 'Rentu neighbor passionate about the anti-ownership gear sharing network. Let’s share and make gear accessible to everyone!'}
              </p>
            </div>

            {/* Quick Metrics Strip */}
            <div className="mt-6 pt-6 border-t border-divider grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-canvas border border-divider">
                <div className="text-xl sm:text-2xl font-black text-brand font-display">
                  {profile.items.length}
                </div>
                <div className="text-[10px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5">
                  Gear Listed
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-canvas border border-divider">
                <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 font-display">
                  {profile.requests.length}
                </div>
                <div className="text-[10px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5">
                  Wishes & Requests
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-canvas border border-divider">
                <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display">
                  {profile.stats.completed_lent + profile.stats.completed_borrowed}
                </div>
                <div className="text-[10px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5">
                  Completed Handovers
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-canvas border border-divider">
                <div className="text-xl sm:text-2xl font-black text-amber-500 font-display flex items-center justify-center gap-1">
                  {(profile.reviews.length > 0 ? profile.rating : 0.0).toFixed(2)}
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                </div>
                <div className="text-[10px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5">
                  Neighbor Score
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Tab Navigation: Products Listed, Products Requesting, Reviews, About */}
        <div className="flex items-center gap-2 border-b border-divider overflow-x-auto pb-px">

          <button
            onClick={() => setActiveTab('items')}
            className={`px-4 py-3 border-b-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${activeTab === 'items'
              ? 'border-brand text-brand'
              : 'border-transparent text-ink-secondary hover:text-ink'
              }`}
          >
            <Package className="w-4 h-4" />
            <span>Listed Products</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'items' ? 'bg-brand-soft text-brand' : 'bg-canvas text-ink-secondary'
              }`}>
              {profile.items.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-3 border-b-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${activeTab === 'requests'
              ? 'border-brand text-brand'
              : 'border-transparent text-ink-secondary hover:text-ink'
              }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Products Requesting</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'requests' ? 'bg-brand-soft text-brand' : 'bg-canvas text-ink-secondary'
              }`}>
              {profile.requests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-3 border-b-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${activeTab === 'reviews'
              ? 'border-brand text-brand'
              : 'border-transparent text-ink-secondary hover:text-ink'
              }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Reviews & Trust</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'reviews' ? 'bg-brand-soft text-brand' : 'bg-canvas text-ink-secondary'
              }`}>
              {profile.reviews.length}
            </span>
          </button>
        </div>

        {/* TAB 1: LISTED PRODUCTS */}
        {activeTab === 'items' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-ink font-display">
                  Gear Closet by {profile.name}
                </h3>
                <p className="text-xs text-ink-secondary">
                  Available equipment ready to rent or borrow locally
                </p>
              </div>
            </div>

            {profile.items.length === 0 ? (
              <div className="bg-surface border border-divider rounded-3xl p-10 text-center space-y-3 max-w-md mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
                  <Package className="w-7 h-7 text-brand" />
                </div>
                <h4 className="font-extrabold text-ink text-sm sm:text-base">No Gear Listed Yet</h4>
                <p className="text-xs text-ink-secondary">
                  {profile.name} hasn't listed any equipment for rent at the moment.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {profile.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onClick={() => onSelectItem(item)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PRODUCTS REQUESTING */}
        {activeTab === 'requests' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="text-base font-extrabold text-ink font-display">
                Gear Wishes & Requests by {profile.name}
              </h3>
              <p className="text-xs text-ink-secondary">
                Items this neighbor is currently searching for in the community
              </p>
            </div>

            {profile.requests.length === 0 ? (
              <div className="bg-surface border border-divider rounded-3xl p-10 text-center space-y-3 max-w-md mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto">
                  <Sparkles className="w-7 h-7 text-purple-600" />
                </div>
                <h4 className="font-extrabold text-ink text-sm sm:text-base">No Active Requests</h4>
                <p className="text-xs text-ink-secondary">
                  {profile.name} doesn't have any open gear wishes right now.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {profile.requests.map((req) => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    onClick={() => {
                      if (!isAuthenticated && onOpenAuth) {
                        onOpenAuth();
                      } else if (onClaimRequest) {
                        onClaimRequest(req);
                      }
                    }}
                    onClaim={onClaimRequest}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REVIEWS & TRUST VERIFICATION */}
        {activeTab === 'reviews' && (
          <div className="space-y-6 animate-in fade-in duration-200">

            {/* Reviews & Trust Summary Header */}
            <div className="bg-surface border border-divider rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-xs">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-amber-500 tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Peer Verified Reputation & Trust</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-ink font-display">
                  Reviews & Trust Standing for {profile.name}
                </h3>
                <p className="text-xs text-ink-secondary">
                  Community verification, trust score, and peer ratings across Gear Owner, Renter, and Free Community Lender roles.
                </p>
              </div>

              <div className="flex items-center gap-4 bg-canvas p-4 rounded-2xl border border-divider shrink-0">
                <div className="text-center">
                  <div className="text-3xl font-black text-amber-500 font-display">
                    {(profile.trust_rating || profile.rating).toFixed(2)}
                  </div>
                  <div className="text-[10px] font-bold text-ink-muted uppercase mt-0.5">
                    Trust Rating
                  </div>
                </div>

                <div className="w-px h-10 bg-divider" />

                <div className="text-center">
                  <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-display">
                    {profile.trust_score}%
                  </div>
                  <div className="text-[10px] font-bold text-ink-muted uppercase mt-0.5">
                    Trust Score
                  </div>
                </div>
              </div>
            </div>

            {/* Trust & Safety Verification Badges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-surface border border-divider space-y-1 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-extrabold text-ink">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Identity Verified</span>
                </div>
                <p className="text-[11px] text-ink-secondary">
                  Phone and verified community neighbor confirmed on Rentu⁺.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-divider space-y-1 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-extrabold text-ink">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span>100% Punctuality</span>
                </div>
                <p className="text-[11px] text-ink-secondary">
                  Always completes scheduled pick up and handoff returns on time.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-divider space-y-1 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-extrabold text-ink">
                  <ShieldCheck className="w-4 h-4 text-purple-500" />
                  <span>Gear Care Guarantee</span>
                </div>
                <p className="text-[11px] text-ink-secondary">
                  Maintains pristine cleanliness and equipment safety standards.
                </p>
              </div>
            </div>

            {/* Three Distinct Review Ratings Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Type 1: Gear Owner Rating */}
              <div className="bg-surface border border-divider rounded-2xl p-4 sm:p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase">
                    Gear Owner
                  </span>
                </div>
                <div>
                  <div className="text-xl font-black text-ink font-display flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{(Number(profile.owner_reviews_count || profile.reviews.filter(r => r.review_type === 'OWNER_RENTAL').length) > 0 ? (profile.owner_rating || 0.0) : 0.0).toFixed(2)}</span>
                    <span className="text-xs text-ink-secondary font-normal">
                      ({profile.owner_reviews_count || profile.reviews.filter(r => r.review_type === 'OWNER_RENTAL').length})
                    </span>
                  </div>
                  <div className="text-xs font-bold text-ink mt-0.5">Gear Owner Rating</div>
                  <p className="text-[11px] text-ink-secondary mt-1">
                    From neighbors renting gear from their closet
                  </p>
                </div>
              </div>

              {/* Type 2: Renter Rating */}
              <div className="bg-surface border border-divider rounded-2xl p-4 sm:p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
                    Renter
                  </span>
                </div>
                <div>
                  <div className="text-xl font-black text-ink font-display flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{(Number(profile.renter_reviews_count || profile.reviews.filter(r => r.review_type === 'RENTER').length) > 0 ? (profile.renter_rating || 0.0) : 0.0).toFixed(2)}</span>
                    <span className="text-xs text-ink-secondary font-normal">
                      ({profile.renter_reviews_count || profile.reviews.filter(r => r.review_type === 'RENTER').length})
                    </span>
                  </div>
                  <div className="text-xs font-bold text-ink mt-0.5">Renter Rating</div>
                  <p className="text-[11px] text-ink-secondary mt-1">
                    From gear owners for care, respect & timely returns
                  </p>
                </div>
              </div>

              {/* Type 3: Free Community Lender Rating */}
              <div className="bg-surface border border-divider rounded-2xl p-4 sm:p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-brand flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-pink-500/10 text-brand border border-pink-500/20 uppercase">
                    Free Lender
                  </span>
                </div>
                <div>
                  <div className="text-xl font-black text-ink font-display flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{(Number(profile.community_lender_reviews_count || profile.reviews.filter(r => r.review_type === 'COMMUNITY_LENDER').length) > 0 ? (profile.community_lender_rating || 0.0) : 0.0).toFixed(2)}</span>
                    <span className="text-xs text-ink-secondary font-normal">
                      ({profile.community_lender_reviews_count || profile.reviews.filter(r => r.review_type === 'COMMUNITY_LENDER').length})
                    </span>
                  </div>
                  <div className="text-xs font-bold text-ink mt-0.5">Free Lender Rating</div>
                  <p className="text-[11px] text-ink-secondary mt-1">
                    From borrowers for sharing gear completely free (₹0)
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Tabs by Review Type */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { key: 'ALL', label: 'All Reviews', count: profile.reviews.length },
                { key: 'OWNER_RENTAL', label: 'As Gear Owner', count: profile.reviews.filter(r => r.review_type === 'OWNER_RENTAL').length },
                { key: 'RENTER', label: 'As Renter', count: profile.reviews.filter(r => r.review_type === 'RENTER').length },
                { key: 'COMMUNITY_LENDER', label: 'Free Lending', count: profile.reviews.filter(r => r.review_type === 'COMMUNITY_LENDER').length },
              ].map((filterTab) => (
                <button
                  key={filterTab.key}
                  onClick={() => setReviewTypeFilter(filterTab.key as any)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${reviewTypeFilter === filterTab.key
                    ? 'bg-ink text-canvas shadow-xs'
                    : 'bg-surface border border-divider text-ink-secondary hover:text-ink'
                    }`}
                >
                  {filterTab.label} ({filterTab.count})
                </button>
              ))}
            </div>

            {/* List of Reviews */}
            {(() => {
              const displayedReviews = profile.reviews.filter(r => {
                if (reviewTypeFilter === 'ALL') return true;
                return r.review_type === reviewTypeFilter;
              });

              if (displayedReviews.length === 0) {
                return (
                  <div className="p-8 text-center bg-surface border border-divider rounded-2xl space-y-1">
                    <p className="text-xs font-bold text-ink">No reviews in this category yet</p>
                    <p className="text-xs text-ink-secondary">
                      Reviews appear here once community members complete rentals in this role.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {displayedReviews.map((rev) => {
                    const rType = rev.review_type || 'OWNER_RENTAL';
                    return (
                      <div
                        key={rev.id}
                        className="p-5 bg-surface border border-divider rounded-2xl space-y-2.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-canvas border border-divider">
                              <img
                                src={rev.reviewer_avatar || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(rev.reviewer_name)}`}
                                alt={rev.reviewer_name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="text-xs font-extrabold text-ink flex items-center gap-1.5">
                                <span>{rev.reviewer_name}</span>
                                <span className="text-[10px] font-medium text-ink-muted">• {rev.reviewer_locality || 'Bengaluru'}</span>
                              </div>
                              <div className="text-[10px] text-ink-secondary">
                                {rev.created_at}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-black">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span>{rev.rating}</span>
                          </div>
                        </div>

                        {/* Role Badge */}
                        <div className="pt-0.5">
                          {rType === 'OWNER_RENTAL' && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              <Package className="w-3 h-3" /> Gear Owner Review
                            </span>
                          )}
                          {rType === 'RENTER' && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <UserCheck className="w-3 h-3" /> Renter Review
                            </span>
                          )}
                          {rType === 'COMMUNITY_LENDER' && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-brand border border-pink-500/20">
                              <Sparkles className="w-3 h-3" /> Community Lender Review
                            </span>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed pl-1">
                          "{rev.comment}"
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

          </div>
        )}

      </div>

    </div>
  );
};
