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
  Users
} from 'lucide-react';
import { api } from '../lib/api';
import { PublicUserProfile, Item, CommunityRequest } from '../lib/types';
import { ItemCard } from './ItemCard';
import { useAuth } from '../lib/authContext';

interface PublicProfileViewProps {
  userId: string;
  onClose: () => void;
  onSelectItem: (item: Item) => void;
  onClaimRequest?: (request: CommunityRequest) => void;
  onOpenChatWithBooking?: (bookingId: string) => void;
  onOpenChatWithUser?: (userId: string, userName: string) => void;
  onOpenAuth?: () => void;
}

export const PublicProfileView: React.FC<PublicProfileViewProps> = ({
  userId,
  onClose,
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
  const [activeTab, setActiveTab] = useState<'items' | 'requests' | 'reviews' | 'about'>('items');
  const [copiedLink, setCopiedLink] = useState(false);

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
    setIsActionLoading(true);
    try {
      if (isFollowing) {
        const res = await api.unfollowUser(userId);
        setIsFollowing(false);
        setFollowersCount(res?.followers_count ?? Math.max(0, followersCount - 1));
      } else {
        const res = await api.followUser(userId);
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
    if (isBlocked) {
      if (!confirm(`Unblock ${profile?.name}? You will be able to see each other's listings and send messages.`)) return;
      try {
        await api.unblockUser(userId);
        setIsBlocked(false);
        fetchProfile();
      } catch (err: any) {
        alert(err.message || 'Could not unblock user');
      }
    } else {
      if (!confirm(`Block ${profile?.name}? You won't be able to message each other, see each other's requests, or rent items from each other.`)) return;
      try {
        await api.blockUser(userId);
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
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const isOwnProfile = currentUser?.id === userId;

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
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center mx-auto text-2xl">
          ⚠️
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

            {!isOwnProfile && (
              <>
                {/* Follow / Following Button */}
                <button
                  onClick={handleToggleFollow}
                  disabled={isActionLoading || isBlocked}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                    isFollowing
                      ? 'bg-canvas border border-brand text-brand hover:bg-brand/10'
                      : 'bg-brand hover:bg-brand-hover text-white shadow-pink'
                  } disabled:opacity-50`}
                >
                  {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>{isFollowing ? 'Following ✓' : 'Follow'}</span>
                </button>

                {/* Message Button */}
                <button
                  onClick={() => {
                    if (!isAuthenticated && onOpenAuth) {
                      onOpenAuth();
                    } else if (isBlocked) {
                      alert('Communication is unavailable because this user is blocked.');
                    } else if (onOpenChatWithUser) {
                      onOpenChatWithUser(profile.id, profile.name);
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
                  className={`px-2.5 py-1.5 rounded-full border text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                    isBlocked 
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
                  <span>{profile.rating.toFixed(2)} ★ Rating</span>
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
                <h1 className="text-2xl sm:text-3xl font-black text-ink font-display flex items-center gap-2">
                  <span>{profile.name}</span>
                  <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
                </h1>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-secondary font-medium mt-1">
                  <span className="flex items-center gap-1 text-ink">
                    <MapPin className="w-3.5 h-3.5 text-brand" />
                    <span>{profile.locality || 'Bengaluru, India'}</span>
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
                <div className="text-xl sm:text-2xl font-black text-amber-500 font-display">
                  {profile.rating.toFixed(2)} ★
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
            className={`px-4 py-3 border-b-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'items'
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Listed Products</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'items' ? 'bg-brand-soft text-brand' : 'bg-canvas text-ink-secondary'
            }`}>
              {profile.items.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-3 border-b-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'requests'
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Products Requesting</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'requests' ? 'bg-brand-soft text-brand' : 'bg-canvas text-ink-secondary'
            }`}>
              {profile.requests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-3 border-b-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'reviews'
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Reviews & Karma</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'reviews' ? 'bg-brand-soft text-brand' : 'bg-canvas text-ink-secondary'
            }`}>
              {profile.reviews.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`px-4 py-3 border-b-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'about'
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Trust & Verification</span>
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
                <div className="w-14 h-14 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto text-xl">
                  📦
                </div>
                <h4 className="font-extrabold text-ink text-sm sm:text-base">No Gear Listed Yet</h4>
                <p className="text-xs text-ink-secondary">
                  {profile.name} hasn't listed any equipment for rent at the moment.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto text-xl">
                  ✨
                </div>
                <h4 className="font-extrabold text-ink text-sm sm:text-base">No Active Requests</h4>
                <p className="text-xs text-ink-secondary">
                  {profile.name} doesn't have any open gear wishes right now.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {profile.requests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 sm:p-5 bg-surface border border-divider hover:border-brand/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs transition-all"
                  >
                    <div className="flex items-start gap-3.5">
                      {req.image_url ? (
                        <div className="w-14 h-14 rounded-xl bg-canvas border border-divider overflow-hidden shrink-0">
                          <img src={req.image_url} alt={req.item_name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                          <Sparkles className="w-6 h-6" />
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-extrabold text-ink text-sm sm:text-base">{req.item_name}</h4>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-brand-soft text-brand">
                            {req.category || 'Gear'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                            {req.status === 'OPEN' ? '🟢 Open to Rent' : '✓ Fulfilled'}
                          </span>
                        </div>

                        <p className="text-xs text-ink-secondary line-clamp-2 max-w-xl">
                          {req.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-secondary pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-brand" />
                            <span>Needed: {req.start_date || 'Flexible'} {req.start_time ? `(${req.start_time})` : ''}</span>
                          </span>

                          {req.end_date && (
                            <span className="flex items-center gap-1">
                              <span>Return: {req.end_date} {req.end_time ? `(${req.end_time})` : ''}</span>
                            </span>
                          )}

                          <span className="font-bold text-ink">
                            Offered: {Number(req.offered_amount) > 0 ? `₹${req.offered_amount}` : 'Free Borrow / Gift'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isOwnProfile && (
                      <button
                        onClick={() => {
                          if (!isAuthenticated && onOpenAuth) {
                            onOpenAuth();
                          } else if (onClaimRequest) {
                            onClaimRequest(req);
                          } else if (onOpenChatWithUser) {
                            onOpenChatWithUser(profile.id, profile.name);
                          }
                        }}
                        className="btn-primary text-xs px-4 py-2 font-bold shrink-0 shadow-pink cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        <span>Lend This Gear</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REVIEWS & KARMA */}
        {activeTab === 'reviews' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Reviews Summary Header */}
            <div className="bg-surface border border-divider rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-xs">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-amber-500 tracking-wider">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>Peer Verified Reputation</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-ink font-display">
                  Community Reviews for {profile.name}
                </h3>
                <p className="text-xs text-ink-secondary">
                  Every review is posted after a verified gear handover and return inspection.
                </p>
              </div>

              <div className="flex items-center gap-4 bg-canvas p-4 rounded-2xl border border-divider shrink-0">
                <div className="text-center">
                  <div className="text-3xl font-black text-amber-500 font-display">
                    {profile.rating.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-bold text-ink-muted uppercase mt-0.5">
                    Star Rating
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

            {/* List of Reviews */}
            <div className="space-y-3">
              {profile.reviews.map((rev) => (
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
                      <span>{rev.rating} ★</span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed pl-11">
                    "{rev.comment}"
                  </p>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* TAB 4: TRUST & ABOUT */}
        {activeTab === 'about' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-surface border border-divider rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
              
              <div>
                <h3 className="text-lg font-black text-ink font-display">
                  About {profile.name}
                </h3>
                <p className="text-xs text-ink-secondary mt-1">
                  Verified background and neighbor standing in Rentu⁺
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-ink">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Identity Verified</span>
                  </div>
                  <p className="text-[11px] text-ink-secondary">
                    Phone and government/student identification confirmed on Rentu.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-ink">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>100% Punctuality</span>
                  </div>
                  <p className="text-[11px] text-ink-secondary">
                    Always completes scheduled pick up and handoff returns on time.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-ink">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                    <span>Gear Care Guarantee</span>
                  </div>
                  <p className="text-[11px] text-ink-secondary">
                    Maintains pristine cleanliness and equipment safety standards.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-divider space-y-2">
                <h4 className="text-xs font-extrabold text-ink uppercase tracking-wider">Community Bio</h4>
                <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
                  {profile.bio || 'Active peer in our anti-ownership circular network.'}
                </p>
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
};
