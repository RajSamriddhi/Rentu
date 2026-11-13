import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Star,
  Package,
  MessageSquare,
  ShieldCheck,
  Edit3,
  Plus,
  CheckCircle2,
  Calendar,
  Sparkles,
  Camera,
  Loader2,
  TrendingUp,
  Award,
  ChevronRight,
  ArrowUpRight,
  ChevronLeft,
  Clock,
  Check,
  X,
  CreditCard,
  Send,
  Car,
  RotateCcw,
  UserCheck,
  AlertCircle,
  Lock,
  Phone,
  HelpCircle,
  Mail,
  AtSign,
  Copy,
  Share2,
  Users
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { formatFullAddress } from '../lib/location';
import { api } from '../lib/api';
import { uploadItemPhoto } from '../lib/supabase';
import { Item, Booking, CommunityRequest, UserReview } from '../lib/types';
import { ItemCard } from './ItemCard';
import { RequestCard } from './RequestCard';
import { EditProfileModal } from './EditProfileModal';
import { HelpSupportModal } from './HelpSupportModal';
import { EditItemModal } from './EditItemModal';
import { EditWishModal } from './EditWishModal';
import { ItemDetailModal } from './ItemDetailModal';
import { ReviewModal } from './ReviewModal';
import { getReachDistance } from '../lib/distance';
import { checkIsLender } from '../lib/logistics';
import { FollowListModal } from './FollowListModal';

interface ProfileViewProps {
  onOpenDropGear: () => void;
  onOpenDropWish: () => void;
  onOpenChatWithBooking?: (bookingId: string) => void;
  onOpenAuth?: () => void;
  initialTab?: 'listings' | 'requests' | 'reviews';
  onOpenUserProfile?: (userId: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onOpenDropGear,
  onOpenDropWish,
  onOpenChatWithBooking,
  onOpenAuth,
  initialTab,
  onOpenUserProfile,
}) => {
  const { user, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'listings' | 'requests' | 'reviews'>(
    initialTab && (initialTab as any) !== 'bookings' ? initialTab : 'listings'
  );

  useEffect(() => {
    if (initialTab && (initialTab as any) !== 'bookings') {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [myRequests, setMyRequests] = useState<CommunityRequest[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [receivedReviews, setReceivedReviews] = useState<UserReview[]>([]);
  const [reviewTypeFilter, setReviewTypeFilter] = useState<'ALL' | 'OWNER_RENTAL' | 'RENTER' | 'COMMUNITY_LENDER'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [previewItem, setPreviewItem] = useState<Item | null>(null);
  const [editingRequest, setEditingRequest] = useState<CommunityRequest | null>(null);

  // Review submission modal state
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);

  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [copiedProfileLink, setCopiedProfileLink] = useState(false);
  const [followersCount, setFollowersCount] = useState<number>(user?.followers_count || 0);
  const [followingCount, setFollowingCount] = useState<number>(user?.following_count || 0);
  const [followModalState, setFollowModalState] = useState<{
    isOpen: boolean;
    type: 'followers' | 'following';
  }>({
    isOpen: false,
    type: 'followers',
  });
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const handleShareProfile = async () => {
    const handle = user?.username || user?.email?.split('@')[0] || user?.id;
    const url = `https://rentu.site/${handle}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${user?.name || 'User'}'s Profile on Rentu`,
          text: `Check out ${user?.name || 'this'}'s gear closet and rental profile on Rentu!`,
          url,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedProfileLink(true);
      setTimeout(() => setCopiedProfileLink(false), 2000);
    } catch {}
  };

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [items, reqs, books, profile] = await Promise.all([
        api.getItems({ ownerId: user.id, status: 'ALL' }),
        api.getRequests({ seekerId: user.id, status: 'OPEN' }),
        api.getBookings(),
        api.getUserProfile(user.id).catch(() => null),
      ]);
      const effectiveItems = ((items && items.length > 0) ? items : (profile?.items || [])).filter(
        (it) => it.status !== 'UNAVAILABLE' && !Boolean((it as any).is_deleted)
      );
      const effectiveReqs = ((reqs && reqs.length > 0) ? reqs : (profile?.requests || [])).filter(
        (rq) => rq.status === 'OPEN'
      );
      setMyItems(effectiveItems);
      setMyRequests(effectiveReqs);
      setMyBookings(books || []);
      if (profile && Array.isArray(profile.reviews)) {
        setReceivedReviews(profile.reviews);
      }
      if (typeof user.followers_count === 'number') {
        setFollowersCount(user.followers_count);
      } else {
        api.getFollowers(user.id).then((f) => setFollowersCount(Array.isArray(f) ? f.length : 0)).catch(() => {});
      }
      if (typeof user.following_count === 'number') {
        setFollowingCount(user.following_count);
      } else {
        api.getFollowing(user.id).then((f) => setFollowingCount(Array.isArray(f) ? f.length : 0)).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleDirectBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBanner(true);
    try {
      const publicUrl = await uploadItemPhoto(file, 'banners');
      await api.updateProfile({ banner_url: publicUrl });
      await refreshUser();
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.3 } });
    } catch (err: any) {
      console.error('Failed to upload banner:', err);
      alert('Failed to update cover photo: ' + (err.message || 'Check storage permissions'));
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleDirectAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const publicUrl = await uploadItemPhoto(file, 'avatars');
      await api.updateProfile({ avatar_url: publicUrl });
      await refreshUser();
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
    } catch (err: any) {
      console.error('Failed to upload avatar:', err);
      alert('Failed to update profile photo: ' + (err.message || 'Check storage permissions'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recent';

  const completedCount = myBookings.filter(b => b.status === 'COMPLETED').length;
  const hasReviews = Boolean((user?.reviews_count && Number(user.reviews_count) > 0) || receivedReviews.length > 0);
  const ratingDisplay = hasReviews ? Number(user?.trust_rating || user?.rating || 0).toFixed(1) : null;

  const bannerSrc = user?.banner_url || 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1600&q=80';
  const avatarSrc = user?.avatar_url || (user?.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu');

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center animate-in fade-in">
        <div className="bg-surface border border-divider rounded-3xl p-10 shadow-sm max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-ink font-display">Sign In to View Profile</h2>
          <p className="text-xs text-ink-secondary">
            Manage your gear listings, rental requests, bookings, and verified badges.
          </p>
          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="btn-primary text-xs px-6 py-2.5 shadow-pink cursor-pointer mt-2"
            >
              Sign In to Continue
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-in fade-in duration-200">

      {/* Profile Header & Hero Card */}
      <div className="bg-surface border border-divider rounded-3xl overflow-hidden shadow-sm transition-all">

        {/* Panoramic Banner Area */}
        <div className="h-48 sm:h-64 lg:h-72 w-full relative bg-zinc-900 group overflow-hidden">
          <img
            src={bannerSrc}
            alt="Profile Banner"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

          {/* Top Right: Change Cover Button */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
            <button
              onClick={() => bannerFileInputRef.current?.click()}
              disabled={isUploadingBanner}
              className="backdrop-blur-md bg-black/60 hover:bg-black/85 text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-lg hover:scale-105 active:scale-95"
              title="Change Background Picture"
            >
              {isUploadingBanner ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5 text-brand" />
                  <span>Change Cover</span>
                </>
              )}
            </button>
            <input
              ref={bannerFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleDirectBannerUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* User Identity Block */}
        <div className="px-5 sm:px-8 pb-6 sm:pb-8 pt-0 relative">

          {/* Top Bar: Overlapping Avatar on Left, Action Buttons on Right */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">

            {/* Avatar (ONLY the avatar has negative margin to overlap cover) */}
            <div className="relative group shrink-0 -mt-14 sm:-mt-20">
              <img
                src={avatarSrc}
                alt={user?.name || 'User'}
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-surface shadow-2xl bg-surface shrink-0 ring-4 ring-black/5 dark:ring-white/5"
              />
              <button
                onClick={() => avatarFileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute bottom-1 right-1 bg-brand hover:bg-brand-hover text-white p-2 sm:p-2.5 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-transform cursor-pointer border-2 border-surface"
                title="Change Profile Picture"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                ref={avatarFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleDirectAvatarUpload}
                className="hidden"
              />
            </div>

            {/* Action Buttons (Clean, minimal, professional) */}
            <div className="flex items-center gap-2 pt-2 sm:pt-4 shrink-0 w-full sm:w-auto justify-center sm:justify-end flex-wrap">
              <button
                id="edit-profile-btn"
                onClick={() => setIsEditModalOpen(true)}
                className="btn-secondary text-xs px-3.5 py-2 cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs font-bold hover:border-brand hover:text-brand transition-all flex-1 sm:flex-initial"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>

              <button
                type="button"
                onClick={handleShareProfile}
                className="btn-secondary text-xs px-3.5 py-2 cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs font-bold hover:border-brand hover:text-brand transition-all flex-1 sm:flex-initial"
                title="Share Profile Link"
              >
                {copiedProfileLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500 font-bold">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </>
                )}
              </button>

              <button
                onClick={onOpenDropGear}
                className="btn-primary text-xs px-4 py-2 cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-pink font-bold flex-1 sm:flex-initial"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>List Gear</span>
              </button>
            </div>

          </div>

          {/* User Name, Verified Badge, Bio & Meta */}
          <div className="mt-3 sm:mt-4 space-y-2 text-center sm:text-left">

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-ink tracking-tight font-display select-text">
                {user?.name || user?.email?.split('@')[0] || 'Rentu Member'}
              </h1>

              {user?.is_verified && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Peer</span>
                </span>
              )}
            </div>

            {/* Username */}
            <div className="flex items-center justify-center sm:justify-start gap-1.5">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="font-mono text-xs sm:text-sm font-bold text-brand hover:underline cursor-pointer"
                title="Click to edit username"
              >
                @{user?.username || user?.email?.split('@')[0] || 'member'}
              </button>
            </div>

            {user?.bio ? (
              <p className="text-xs sm:text-sm text-ink-secondary font-medium max-w-2xl leading-relaxed pt-0.5">
                {user.bio}
              </p>
            ) : (
              <p className="text-xs text-ink-secondary/70 italic max-w-2xl pt-0.5">
                No bio added yet. Click <button onClick={() => setIsEditModalOpen(true)} className="font-semibold text-brand hover:underline not-italic cursor-pointer">Edit Profile</button> to introduce yourself to neighbors.
              </p>
            )}

            {/* Clean Minimalist Meta Line (Location, Joined date, Rating) */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1.5 text-xs text-ink-secondary pt-1.5">
              {formatFullAddress(user) ? (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="inline-flex items-center gap-1.5 hover:text-brand transition-colors cursor-pointer text-ink font-semibold"
                  title="Click to update your location"
                >
                  <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                  <span className="truncate max-w-[280px]">{formatFullAddress(user)}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-amber-500 hover:underline font-bold cursor-pointer"
                  title="Location not set — click to add your location"
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>Set Location</span>
                </button>
              )}

              <span className="text-divider">•</span>

              <span className="inline-flex items-center gap-1.5 text-ink-secondary">
                <Calendar className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                <span>Member since {memberSince}</span>
              </span>

              {ratingDisplay && (
                <>
                  <span className="text-divider">•</span>
                  <span className="inline-flex items-center gap-1 font-bold text-ink">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    <span>{ratingDisplay} Rating</span>
                  </span>
                </>
              )}

              <span className="text-divider">•</span>

              <button
                type="button"
                onClick={() => setFollowModalState({ isOpen: true, type: 'followers' })}
                className="inline-flex items-center gap-1 hover:text-brand transition-colors cursor-pointer text-ink font-semibold"
              >
                <Users className="w-3.5 h-3.5 text-brand shrink-0" />
                <span><strong className="text-ink">{followersCount}</strong> Followers</span>
              </button>

              <span className="text-divider">•</span>

              <button
                type="button"
                onClick={() => setFollowModalState({ isOpen: true, type: 'following' })}
                className="inline-flex items-center gap-1 hover:text-brand transition-colors cursor-pointer text-ink font-semibold"
              >
                <span><strong className="text-ink">{followingCount}</strong> Following</span>
              </button>
            </div>

          </div>

        </div>

        {/* Minimalist Professional Stats Bar */}
        <div className="border-t border-divider grid grid-cols-2 sm:grid-cols-4 bg-canvas/30 divide-y sm:divide-y-0 sm:divide-x divide-divider">
          <div className="p-4 sm:p-5 text-center sm:text-left">
            <div className="text-xl sm:text-2xl font-black text-ink font-display">{myItems.length}</div>
            <div className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5">Gear Listed</div>
          </div>

          <div className="p-4 sm:p-5 text-center sm:text-left">
            <div className="text-xl sm:text-2xl font-black text-ink font-display">{completedCount}</div>
            <div className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5">Completed Handouts</div>
          </div>

          <div className="p-4 sm:p-5 text-center sm:text-left">
            <div className="text-xl sm:text-2xl font-black text-ink font-display">{myRequests.length}</div>
            <div className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5">Active Requests</div>
          </div>

          <div className="p-4 sm:p-5 text-center sm:text-left">
            <div className="text-xl sm:text-2xl font-black text-ink font-display">
              {ratingDisplay ? `${ratingDisplay} ★` : (user?.trust_score && user.trust_score > 0 ? `${user.trust_score}%` : '—')}
            </div>
            <div className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5">
              {ratingDisplay ? 'Trust Rating' : (user?.trust_score && user.trust_score > 0 ? 'Trust Score' : 'Status')}
            </div>
          </div>
        </div>

      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          refreshUser();
          loadData();
        }}
      />

      {/* Product Detail Preview Modal (Owner Preview as seen by other users) */}
      {previewItem && (
        <ItemDetailModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onBookingSuccess={() => loadData()}
          onOpenAuth={() => { }}
          onEditItem={(itemToEdit) => {
            setPreviewItem(null);
            setEditingItem(itemToEdit);
          }}
          onDeleteItem={async () => {
            setPreviewItem(null);
            await loadData();
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
          loadData();
        }}
      />

      {/* Edit Wish/Request Modal */}
      <EditWishModal
        request={editingRequest}
        isOpen={!!editingRequest}
        onClose={() => setEditingRequest(null)}
        onSuccess={() => {
          setEditingRequest(null);
          loadData();
        }}
      />

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 pt-8 pb-4">
        {[
          { key: 'listings', label: 'My Listings', count: myItems.length, icon: Package },
          { key: 'requests', label: 'My Requests', count: myRequests.length, icon: Sparkles },
          { key: 'reviews', label: 'Reviews & Trust', count: receivedReviews.length, icon: Star },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 sm:px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 shadow-xs whitespace-nowrap ${isActive
                ? 'bg-ink text-canvas shadow-sm scale-[1.02]'
                : 'bg-surface border border-divider text-ink-secondary hover:text-ink hover:border-zinc-400'
                }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand' : 'text-ink-secondary'}`} />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${isActive ? 'bg-white/20 text-white' : 'bg-canvas text-ink-secondary'
                }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Display */}
      <div className="mt-2">

        {/* Listings Tab */}
        {activeTab === 'listings' && (
          <div>
            {myItems.length === 0 ? (
              <div className="py-16 px-6 text-center bg-surface border border-divider rounded-3xl shadow-xs max-w-2xl mx-auto space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand/20 via-pink-500/10 to-purple-500/10 text-brand flex items-center justify-center mx-auto shadow-inner">
                  <Package className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-extrabold text-ink font-display">
                    Your Gear Closet is Empty
                  </h3>
                  <p className="text-xs text-ink-secondary max-w-md mx-auto">
                    Turn your camera lenses, camping tents, PlayStation, or tools into steady passive income in your neighborhood.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={onOpenDropGear}
                    className="btn-primary text-xs px-6 py-2.5 shadow-pink cursor-pointer inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>List Your First Item</span>
                  </button>
                </div>

                {/* 3 Perks Pill Tags */}
                <div className="pt-6 border-t border-divider grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] font-bold text-ink-secondary">
                  <div className="flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Verified Neighbors</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-brand shrink-0" />
                    <span>Set Your Own Daily Price</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Keep 100% of Earnings</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {myItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onClick={() => setPreviewItem(item)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div className="space-y-3">
            {myRequests.length === 0 ? (
              <div className="py-16 px-6 text-center bg-surface border border-divider rounded-3xl shadow-xs max-w-2xl mx-auto space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold text-ink font-display">No Requests Posted Yet</h3>
                  <p className="text-xs text-ink-secondary max-w-sm mx-auto">
                    Looking for a specific item? Post a request and nearby locals will offer to rent it to you.
                  </p>
                </div>
                <button
                  onClick={onOpenDropWish}
                  className="btn-primary text-xs px-6 py-2.5 shadow-pink cursor-pointer inline-flex items-center gap-2 mt-2"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Post a Gear Request</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {myRequests.map((req) => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    onClick={() => setEditingRequest(req)}
                    onEdit={(r) => setEditingRequest(r)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reviews & Trust Tab: Leave Reviews within 3-day window & See reviews received */}
        {activeTab === 'reviews' && (
          <div className="space-y-6 max-w-4xl mx-auto">

            {/* Header Trust Overview */}
            <div className="bg-surface border border-divider rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-ink font-display">Reviews & Community Trust</h3>
                  {user?.is_verified && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Verified Peer
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-secondary mt-1">
                  Overall Trust Rating is the combined average across all 3 community roles: Gear Owner, Renter, and Free Community Lender.
                </p>
              </div>

              <div className="flex items-center gap-6 self-start sm:self-auto">
                <div className="text-right">
                  <div className="text-2xl font-black text-ink font-display flex items-center gap-1 justify-end">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    <span>{receivedReviews.length > 0 && user?.trust_rating ? Number(user.trust_rating).toFixed(2) : (receivedReviews.length > 0 ? (ratingDisplay || '—') : '—')}</span>
                  </div>
                  <div className="text-[10px] font-bold text-ink-secondary">
                    {receivedReviews.length > 0 ? `Trust Rating (${receivedReviews.length} reviews)` : 'No reviews yet'}
                  </div>
                </div>

                <div className="text-right border-l border-divider pl-6">
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display">
                    {user?.trust_score && user.trust_score > 0 && (receivedReviews.length > 0 || completedCount > 0) ? `${user.trust_score}%` : '—'}
                  </div>
                  <div className="text-[10px] font-bold text-ink-secondary">
                    {user?.trust_score && user.trust_score > 0 && (receivedReviews.length > 0 || completedCount > 0) ? 'Reputation Score' : 'Unrated'}
                  </div>
                </div>
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
                    <span>{Number(user?.owner_reviews_count || receivedReviews.filter(r => r.review_type === 'OWNER_RENTAL').length) > 0 && user?.owner_rating ? Number(user.owner_rating).toFixed(2) : '0.00'}</span>
                    <span className="text-xs text-ink-secondary font-normal">
                      ({user?.owner_reviews_count || receivedReviews.filter(r => r.review_type === 'OWNER_RENTAL').length})
                    </span>
                  </div>
                  <div className="text-xs font-bold text-ink mt-0.5">Gear Owner Rating</div>
                  <p className="text-[11px] text-ink-secondary mt-1">
                    From neighbors renting gear from your closet
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
                    <span>{Number(user?.renter_reviews_count || receivedReviews.filter(r => r.review_type === 'RENTER').length) > 0 && user?.renter_rating ? Number(user.renter_rating).toFixed(2) : '0.00'}</span>
                    <span className="text-xs text-ink-secondary font-normal">
                      ({user?.renter_reviews_count || receivedReviews.filter(r => r.review_type === 'RENTER').length})
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
                    <span>{Number(user?.community_lender_reviews_count || receivedReviews.filter(r => r.review_type === 'COMMUNITY_LENDER').length) > 0 && user?.community_lender_rating ? Number(user.community_lender_rating).toFixed(2) : '0.00'}</span>
                    <span className="text-xs text-ink-secondary font-normal">
                      ({user?.community_lender_reviews_count || receivedReviews.filter(r => r.review_type === 'COMMUNITY_LENDER').length})
                    </span>
                  </div>
                  <div className="text-xs font-bold text-ink mt-0.5">Free Lender Rating</div>
                  <p className="text-[11px] text-ink-secondary mt-1">
                    From borrowers for sharing gear for free (₹0)
                  </p>
                </div>
              </div>
            </div>

            {/* Section 1: Completed Rentals Eligible for Review (3-day window) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h4 className="text-sm font-extrabold text-ink font-display flex items-center gap-2">
                    <Award className="w-4 h-4 text-brand" />
                    <span>Rate Completed Rentals (3-Day Window)</span>
                  </h4>
                  <p className="text-xs text-ink-secondary">
                    Review neighbors you have rented to or borrowed from after the rental deadline
                  </p>
                </div>
              </div>

              {(() => {
                const completedBookings = myBookings.filter((b) => b.status === 'COMPLETED');
                if (completedBookings.length === 0) {
                  return (
                    <div className="p-6 bg-surface border border-divider rounded-2xl text-center space-y-1">
                      <p className="text-xs font-bold text-ink">No completed rentals to review</p>
                      <p className="text-xs text-ink-secondary">
                        Once a rental return is verified, you have 3 days to exchange reviews with each other.
                      </p>
                    </div>
                  );
                }

                return completedBookings.map((b) => {
                  const isLender = checkIsLender(b, user);
                  const counterpartyName = isLender ? (b.borrower_name || 'Renter') : (b.lender_name || 'Owner');
                  const counterpartyAvatar = isLender ? b.borrower_avatar : b.lender_avatar;
                  const completedDate = new Date(b.completed_at || b.created_at);
                  const diffMs = Date.now() - completedDate.getTime();
                  const isWithin3Days = diffMs <= 3 * 24 * 60 * 60 * 1000;
                  const hasReviewed = Boolean(b.user_review_id || b.user_reviewed_at);

                  return (
                    <div
                      key={b.id}
                      className="p-4 sm:p-5 bg-surface border border-divider rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                    >
                      <div className="flex items-center gap-3.5">
                        <img
                          src={counterpartyAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(counterpartyName)}&background=0F172A&color=fff&bold=true`}
                          alt={counterpartyName}
                          className="w-12 h-12 rounded-full object-cover border border-divider"
                        />
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-extrabold text-ink">
                            {b.item_title || 'Rental Item'}
                          </h4>
                          <p className="text-xs text-ink-secondary">
                            {isLender ? `Rented to ${counterpartyName}` : `Borrowed from ${counterpartyName}`} • Completed on {completedDate.toLocaleDateString()}
                          </p>
                          <div className="pt-1 flex items-center gap-2">
                            {isWithin3Days ? (
                              <span className="text-[10px] font-black uppercase text-brand bg-brand-soft px-2 py-0.5 rounded-full border border-brand/20">
                                3-Day Review Window Open
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-ink-secondary bg-canvas px-2 py-0.5 rounded-full border border-divider">
                                Review Window Closed
                              </span>
                            )}
                            {hasReviewed && (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                Review Submitted
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setReviewingBooking(b);
                          }}
                          disabled={!isWithin3Days}
                          className="btn-primary text-xs px-4 py-2 font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-pink disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Star className="w-3.5 h-3.5 fill-white text-white" />
                          <span>{hasReviewed ? 'Edit Review' : 'Write Review'}</span>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Section 2: Reviews People Have Given Me */}
            <div className="space-y-4 pt-4 border-t border-divider">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div>
                  <h4 className="text-sm font-extrabold text-ink font-display flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" />
                    <span>Reviews Received From Community</span>
                  </h4>
                  <p className="text-xs text-ink-secondary">
                    What neighbors say about your gear, handoffs, and care
                  </p>
                </div>

                {/* Filter Tabs by Review Type */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { key: 'ALL', label: 'All Reviews', count: receivedReviews.length },
                    { key: 'OWNER_RENTAL', label: 'As Gear Owner', count: receivedReviews.filter(r => r.review_type === 'OWNER_RENTAL').length },
                    { key: 'RENTER', label: 'As Renter', count: receivedReviews.filter(r => r.review_type === 'RENTER').length },
                    { key: 'COMMUNITY_LENDER', label: 'Free Lending', count: receivedReviews.filter(r => r.review_type === 'COMMUNITY_LENDER').length },
                  ].map((filterTab) => (
                    <button
                      key={filterTab.key}
                      onClick={() => setReviewTypeFilter(filterTab.key as any)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${reviewTypeFilter === filterTab.key
                        ? 'bg-ink text-canvas shadow-xs'
                        : 'bg-canvas border border-divider text-ink-secondary hover:text-ink'
                        }`}
                    >
                      {filterTab.label} ({filterTab.count})
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const displayedReviews = receivedReviews.filter(r => {
                  if (reviewTypeFilter === 'ALL') return true;
                  return r.review_type === reviewTypeFilter;
                });

                if (displayedReviews.length === 0) {
                  return (
                    <div className="p-8 text-center bg-surface border border-divider rounded-2xl space-y-2">
                      <p className="text-xs font-bold text-ink">
                        {reviewTypeFilter === 'ALL'
                          ? 'No community reviews received yet'
                          : `No reviews found for this role category`}
                      </p>
                      <p className="text-xs text-ink-secondary max-w-sm mx-auto">
                        Once neighbors rent items from you or receive returns, their verified reviews will be published here.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayedReviews.map((rev) => {
                      const rType = rev.review_type || 'OWNER_RENTAL';
                      return (
                        <div
                          key={rev.id}
                          className="p-4 sm:p-5 bg-surface border border-divider rounded-2xl space-y-2 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={rev.reviewer_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(rev.reviewer_name)}&background=0F172A&color=fff&bold=true`}
                                alt={rev.reviewer_name}
                                className="w-8 h-8 rounded-full object-cover border border-divider"
                              />
                              <div>
                                <div className="text-xs font-extrabold text-ink">{rev.reviewer_name}</div>
                                <div className="text-[10px] text-ink-secondary">
                                  Verified Neighbor • {new Date(rev.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-amber-500">
                              {Array.from({ length: Math.round(rev.rating || 5) }).map((_, i) => (
                                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              ))}
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

                          <p className="text-xs text-ink leading-relaxed font-medium">
                            "{rev.comment || 'Smooth rental handover! Very polite and returned on time.'}"
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

          </div>
        )}

      </div>

      {/* Write Review Modal */}
      <ReviewModal
        booking={reviewingBooking}
        isOpen={Boolean(reviewingBooking)}
        onClose={() => setReviewingBooking(null)}
        onSuccess={() => {
          setReviewingBooking(null);
          loadData();
          refreshUser();
        }}
      />

      {/* Followers & Following Modal */}
      {user && (
        <FollowListModal
          isOpen={followModalState.isOpen}
          onClose={() => setFollowModalState((prev) => ({ ...prev, isOpen: false }))}
          userId={user.id}
          userName={user.name}
          type={followModalState.type}
          onOpenUserProfile={(targetId) => {
            setFollowModalState((prev) => ({ ...prev, isOpen: false }));
            onOpenUserProfile?.(targetId);
          }}
        />
      )}

    </div>
  );
};
