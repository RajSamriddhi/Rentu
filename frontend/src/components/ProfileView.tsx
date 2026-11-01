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
  Mail
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { uploadItemPhoto } from '../lib/supabase';
import { Item, Booking, CommunityRequest, UserReview } from '../lib/types';
import { ItemCard } from './ItemCard';
import { EditProfileModal } from './EditProfileModal';
import { EditItemModal } from './EditItemModal';
import { EditWishModal } from './EditWishModal';
import { ItemDetailModal } from './ItemDetailModal';

interface ProfileViewProps {
  onOpenDropGear: () => void;
  onOpenDropWish: () => void;
  onOpenChatWithBooking: (bookingId: string) => void;
  onOpenAuth?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onOpenDropGear,
  onOpenDropWish,
  onOpenChatWithBooking,
  onOpenAuth,
}) => {
  const { user, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'listings' | 'requests' | 'bookings' | 'reviews'>('listings');
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [myRequests, setMyRequests] = useState<CommunityRequest[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [receivedReviews, setReceivedReviews] = useState<UserReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [previewItem, setPreviewItem] = useState<Item | null>(null);
  const [editingRequest, setEditingRequest] = useState<CommunityRequest | null>(null);

  // Bookings Calendar & Detail Modal state
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Review submission modal state
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string>('');

  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [items, reqs, books, profile] = await Promise.all([
        api.getItems({ ownerId: user.id, status: 'ALL' }),
        api.getRequests({ seekerId: user.id, status: 'ALL' }),
        api.getBookings(),
        api.getUserProfile(user.id).catch(() => null),
      ]);
      setMyItems(items || []);
      setMyRequests(reqs || []);
      setMyBookings(books || []);
      if (profile && Array.isArray(profile.reviews)) {
        setReceivedReviews(profile.reviews);
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
  const ratingDisplay = user?.rating ? Number(user.rating).toFixed(1) : null;

  const bannerSrc = user?.banner_url || 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1600&q=80';
  const avatarSrc = user?.avatar_url || (user?.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu');

  // Format YYYY-MM-DD
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Get calendar events for a specific date
  const getEventsForDate = (dateStr: string) => {
    if (!user) return [];
    const events: Array<{
      booking: Booking;
      type: 'DELIVER' | 'COLLECT' | 'PICKUP' | 'RETURN' | 'ACTIVE';
      label: string;
      role: 'Lender' | 'Borrower';
      badgeColor: string;
    }> = [];

    myBookings.forEach((b) => {
      const isLender = b.lender_id === user.id || (user as any).firebase_uid === b.lender_id;
      const bStart = b.start_date?.slice(0, 10);
      const bEnd = (b.end_date || b.start_date)?.slice(0, 10);

      // Start Date events
      if (bStart === dateStr) {
        if (isLender) {
          if (b.requires_delivery) {
            events.push({
              booking: b,
              type: 'DELIVER',
              label: `🚗 Deliver to ${b.borrower_name || 'renter'}`,
              role: 'Lender',
              badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
            });
          } else {
            events.push({
              booking: b,
              type: 'PICKUP',
              label: `🚶 ${b.borrower_name || 'Renter'} picks up`,
              role: 'Lender',
              badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
            });
          }
        } else {
          if (b.requires_delivery) {
            events.push({
              booking: b,
              type: 'DELIVER',
              label: `🚗 Owner delivers to you`,
              role: 'Borrower',
              badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
            });
          } else {
            events.push({
              booking: b,
              type: 'PICKUP',
              label: `🚶 Pick up from ${b.lender_name || 'owner'}`,
              role: 'Borrower',
              badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
            });
          }
        }
      }

      // End Date events
      if (bEnd === dateStr) {
        if (isLender) {
          if (b.requires_pickup) {
            events.push({
              booking: b,
              type: 'COLLECT',
              label: `🔄 Collect from ${b.borrower_name || 'renter'}`,
              role: 'Lender',
              badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
            });
          } else {
            events.push({
              booking: b,
              type: 'RETURN',
              label: `📥 Receive return`,
              role: 'Lender',
              badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
            });
          }
        } else {
          if (b.requires_pickup) {
            events.push({
              booking: b,
              type: 'COLLECT',
              label: `🔄 Owner collects from you`,
              role: 'Borrower',
              badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
            });
          } else {
            events.push({
              booking: b,
              type: 'RETURN',
              label: `🚶 Return to ${b.lender_name || 'owner'}`,
              role: 'Borrower',
              badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
            });
          }
        }
      }

      // Active intermediate days
      if (bStart && bEnd && dateStr > bStart && dateStr < bEnd) {
        events.push({
          booking: b,
          type: 'ACTIVE',
          label: `🔒 Active: ${b.item_title || 'Item'}`,
          role: isLender ? 'Lender' : 'Borrower',
          badgeColor: 'bg-brand/10 text-brand border-brand/20',
        });
      }
    });

    return events;
  };

  // Generate calendar days for month
  const calendarDays = React.useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = formatYMD(new Date());

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      events: ReturnType<typeof getEventsForDate>;
    }> = [];

    // Empty slots before 1st
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dateStr: '',
        dayNum: 0,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        events: [],
      });
    }

    // Month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = formatYMD(d);
      const events = getEventsForDate(dateStr);
      days.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedCalendarDate,
        events,
      });
    }

    return days;
  }, [calendarMonth, myBookings, selectedCalendarDate, user]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  // Handle Review Submission for completed booking
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingBooking) return;
    setIsSubmittingReview(true);
    setReviewError('');
    try {
      await api.submitReview(reviewingBooking.id, reviewRating, reviewComment.trim());
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      setReviewingBooking(null);
      setReviewComment('');
      setReviewRating(5);
      await loadData();
    } catch (err: any) {
      setReviewError(err.message || 'Failed to submit review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

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

          {/* Top Left: Locality Pill */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
            <div className="backdrop-blur-md bg-black/50 text-white border border-white/20 px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-md">
              <MapPin className="w-3.5 h-3.5 text-brand" />
              <span>{user?.locality || user?.address_text || 'Location not set'}</span>
            </div>
          </div>

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

            {/* Action Buttons (Cleanly positioned on card surface) */}
            <div className="flex items-center gap-2.5 pt-2 sm:pt-4 shrink-0 w-full sm:w-auto justify-center sm:justify-end">
              <button 
                id="edit-profile-btn"
                onClick={() => setIsEditModalOpen(true)}
                className="btn-secondary text-xs px-4 py-2 cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs font-bold hover:border-brand hover:text-brand transition-all flex-1 sm:flex-initial"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
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

          {/* User Name, Verified Badge, Bio & Meta (Completely on card surface with crystal clear contrast) */}
          <div className="mt-3 sm:mt-4 space-y-2 text-center sm:text-left">
            
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-ink tracking-tight font-display select-text">
                {user?.name || user?.email?.split('@')[0] || 'Rentu Member'}
              </h1>
              
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Peer</span>
              </span>
            </div>
            
            {user?.bio ? (
              <p className="text-xs sm:text-sm text-ink-secondary font-medium max-w-2xl leading-relaxed">
                {user.bio}
              </p>
            ) : (
              <p className="text-xs text-ink-secondary/70 italic max-w-2xl">
                No bio added yet. Click <button onClick={() => setIsEditModalOpen(true)} className="font-semibold text-brand hover:underline not-italic cursor-pointer">Edit Profile</button> to introduce yourself to neighbors!
              </p>
            )}

            {/* Metadata Badges */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs font-semibold text-ink-secondary pt-1">
              {ratingDisplay ? (
                <span className="inline-flex items-center gap-1 text-ink font-bold bg-canvas px-3 py-1 rounded-full border border-divider">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{ratingDisplay} Rating</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-canvas px-3 py-1 rounded-full border border-divider font-bold text-ink">
                  <span>New Member</span>
                </span>
              )}
              
              <span className="inline-flex items-center gap-1.5 bg-canvas px-3 py-1 rounded-full border border-divider">
                <Calendar className="w-3.5 h-3.5 text-ink-muted" />
                <span>Member since {memberSince}</span>
              </span>

              <button
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-canvas hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-1 rounded-full border border-divider text-brand font-bold transition-colors cursor-pointer"
                title="Click to update your location"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{user?.locality || user?.address_text || 'Set Your Location'}</span>
              </button>
            </div>

          </div>

        </div>

        {/* Dynamic Stats Row with Premium Badges */}
        <div className="border-t border-divider grid grid-cols-2 md:grid-cols-4 bg-canvas/30 divide-y md:divide-y-0 md:divide-x divide-divider">
          
          <div className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-pink-500/10 text-brand flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-ink font-display">{myItems.length}</div>
              <div className="text-[11px] font-bold text-ink-secondary">Items Listed</div>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-ink font-display">{completedCount}</div>
              <div className="text-[11px] font-bold text-ink-secondary">Completed Rentals</div>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-ink font-display">{myBookings.length}</div>
              <div className="text-[11px] font-bold text-ink-secondary">Total Handoffs</div>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-ink font-display">{ratingDisplay || '—'}</div>
              <div className="text-[11px] font-bold text-ink-secondary">{ratingDisplay ? 'Trust Rating' : 'New Member'}</div>
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
          onOpenAuth={() => {}}
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
      <div className="flex items-center gap-2 pt-8 pb-4 overflow-x-auto scrollbar-none whitespace-nowrap">
        {[
          { key: 'listings', label: 'My Listings', count: myItems.length, icon: Package },
          { key: 'requests', label: 'My Requests', count: myRequests.length, icon: Sparkles },
          { key: 'bookings', label: 'Bookings & Handoffs', count: myBookings.length, icon: Calendar },
          { key: 'reviews', label: 'Reviews & Trust', count: receivedReviews.length, icon: Star },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 sm:px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 shadow-xs ${
                isActive
                  ? 'bg-ink text-canvas shadow-sm scale-[1.02]'
                  : 'bg-surface border border-divider text-ink-secondary hover:text-ink hover:border-zinc-400'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand' : 'text-ink-secondary'}`} />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                isActive ? 'bg-white/20 text-white' : 'bg-canvas text-ink-secondary'
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
              myRequests.map((req) => (
                <div 
                  key={req.id} 
                  onClick={() => setEditingRequest(req)}
                  className="p-4 sm:p-5 bg-surface border border-divider rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs hover:border-brand hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Always display an image container; if no picture was uploaded, show a clean "No image" placeholder */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-canvas border border-divider overflow-hidden shrink-0 flex flex-col items-center justify-center text-ink-secondary">
                      {req.image_url ? (
                        <img 
                          src={req.image_url} 
                          alt={req.item_name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-1 text-center">
                          <Package className="w-5 h-5 text-ink-secondary/60 mb-0.5" />
                          <span className="text-[9px] font-bold text-ink-secondary">No image</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="font-extrabold text-ink text-sm sm:text-base group-hover:text-brand transition-colors">
                          {req.item_name}
                        </h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                          req.status === 'OPEN'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : req.status === 'FULFILLED'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                            : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                        }`}>
                          {req.status}
                        </span>
                        {req.category && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-canvas text-ink-secondary border border-divider">
                            {req.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-secondary flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-ink">₹{Number(req.offered_amount)} proposed budget</span>
                        <span>•</span>
                        <span>Needed by {req.start_date ? new Date(req.start_date).toLocaleDateString() : 'Flexible'}</span>
                        {req.duration_days ? (
                          <>
                            <span>•</span>
                            <span>{req.duration_days} {req.duration_days === 1 ? 'day' : 'days'}</span>
                          </>
                        ) : null}
                        {req.locality ? (
                          <>
                            <span>•</span>
                            <span>{req.locality}</span>
                          </>
                        ) : null}
                      </p>
                      {req.description && (
                        <p className="text-xs text-ink-secondary/80 line-clamp-2 max-w-xl pt-0.5">
                          {req.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="text-xs font-bold text-ink-secondary group-hover:text-brand transition-colors hidden sm:inline">
                      Edit Request
                    </span>
                    <ChevronRight className="w-4 h-4 text-ink-muted group-hover:text-brand group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Bookings & Handoffs Tab: Full Interactive Schedule Calendar & Details */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            
            {/* Calendar Card */}
            <div className="bg-surface border border-divider rounded-3xl p-5 sm:p-6 shadow-xs">
              
              {/* Calendar Month Navigation Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-divider">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-ink font-display">
                      {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                    </h3>
                    <p className="text-xs text-ink-secondary">
                      Ongoing bookings, handoff deadlines, deliveries & returns
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-2 rounded-xl border border-divider hover:bg-canvas text-ink transition-colors cursor-pointer"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarMonth(new Date());
                      setSelectedCalendarDate(formatYMD(new Date()));
                    }}
                    className="px-3 py-1.5 rounded-xl border border-divider hover:bg-canvas text-xs font-bold text-ink transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-2 rounded-xl border border-divider hover:bg-canvas text-ink transition-colors cursor-pointer"
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Event Tags Legend */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-bold text-ink-secondary mb-4 pb-3 border-b border-divider/60">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>🚗 Deliveries</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>🚶 Pickups</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>🔄 Return Collections</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                  <span>🔒 Active Rentals</span>
                </div>
              </div>

              {/* Calendar Weekday Labels */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w, idx) => (
                  <div key={idx} className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-ink-secondary py-1">
                    {w}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {calendarDays.map((d, index) => {
                  if (!d.isCurrentMonth) {
                    return <div key={index} className="min-h-[70px] sm:min-h-[90px] rounded-2xl bg-canvas/40 opacity-30" />;
                  }

                  const hasEvents = d.events.length > 0;

                  return (
                    <div
                      key={d.dateStr}
                      onClick={() => setSelectedCalendarDate(d.dateStr)}
                      className={`min-h-[70px] sm:min-h-[90px] p-1.5 sm:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        d.isSelected
                          ? 'border-brand bg-brand-soft/20 shadow-xs ring-1 ring-brand'
                          : d.isToday
                          ? 'border-ink bg-canvas'
                          : 'border-divider bg-canvas/70 hover:border-zinc-400 dark:hover:border-zinc-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black ${d.isToday ? 'text-brand font-black' : 'text-ink'}`}>
                          {d.dayNum}
                        </span>
                        {d.isToday && (
                          <span className="text-[9px] font-black uppercase text-brand">Today</span>
                        )}
                      </div>

                      {/* Event Chips */}
                      <div className="space-y-1 mt-1 overflow-hidden">
                        {d.events.slice(0, 2).map((ev, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBooking(ev.booking);
                            }}
                            className={`w-full text-left truncate px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border ${ev.badgeColor} hover:brightness-110 cursor-pointer block`}
                            title={ev.label}
                          >
                            {ev.label}
                          </button>
                        ))}
                        {d.events.length > 2 && (
                          <span className="text-[9px] font-extrabold text-brand block">
                            +{d.events.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Selected Date or Upcoming Handoffs List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h4 className="text-sm font-extrabold text-ink font-display flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-brand" />
                    <span>Handoffs for {selectedCalendarDate}</span>
                  </h4>
                  <p className="text-xs text-ink-secondary">
                    Click any booking to view deadlines, counterparty info, and payment status
                  </p>
                </div>
              </div>

              {(() => {
                // Bookings that touch the selected date or active
                const dateBookings = myBookings.filter((b) => {
                  const bStart = b.start_date?.slice(0, 10);
                  const bEnd = (b.end_date || b.start_date)?.slice(0, 10);
                  return bStart && bEnd && selectedCalendarDate >= bStart && selectedCalendarDate <= bEnd;
                });

                const displayBookings = dateBookings.length > 0 ? dateBookings : myBookings;

                if (displayBookings.length === 0) {
                  return (
                    <div className="p-8 text-center bg-surface border border-divider rounded-2xl space-y-2">
                      <p className="text-xs font-bold text-ink">No handoffs scheduled on {selectedCalendarDate}</p>
                      <p className="text-xs text-ink-secondary">
                        When someone rents your gear or you borrow from a neighbor, the schedule will show here.
                      </p>
                    </div>
                  );
                }

                return displayBookings.map((b) => {
                  const isLender = b.lender_id === user.id || (user as any).firebase_uid === b.lender_id;
                  const counterpartyName = isLender ? (b.borrower_name || 'Renter') : (b.lender_name || 'Owner');
                  const counterpartyAvatar = isLender ? b.borrower_avatar : b.lender_avatar;
                  const itemImage = b.item_images?.[0] || '';

                  // Action task summary
                  let taskSummary = '';
                  if (b.status === 'ACCEPTED' || b.status === 'PENDING') {
                    if (isLender) {
                      taskSummary = b.requires_delivery
                        ? `🚗 You will deliver this product to ${counterpartyName}`
                        : `🚶 ${counterpartyName} will come to your locality to pick up`;
                    } else {
                      taskSummary = b.requires_delivery
                        ? `🚗 ${counterpartyName} will deliver this product to you`
                        : `🚶 You will pick up this product from ${counterpartyName}`;
                    }
                  } else if (b.status === 'HANDED_OVER') {
                    if (isLender) {
                      taskSummary = b.requires_pickup
                        ? `🔄 You will collect this product from ${counterpartyName} on return`
                        : `📥 ${counterpartyName} will return this product back to you`;
                    } else {
                      taskSummary = b.requires_pickup
                        ? `🔄 ${counterpartyName} will collect this product from you on return`
                        : `🚶 You must return this product back to ${counterpartyName}`;
                    }
                  } else if (b.status === 'COMPLETED') {
                    taskSummary = '🎉 Completed & returned. Review window open.';
                  }

                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBooking(b)}
                      className="p-4 sm:p-5 bg-surface border border-divider hover:border-brand/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs transition-all cursor-pointer group"
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Item Photo or No Image */}
                        <div className="w-16 h-16 rounded-xl bg-canvas border border-divider overflow-hidden shrink-0 flex flex-col items-center justify-center text-ink-secondary">
                          {itemImage ? (
                            <img src={itemImage} alt={b.item_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <Package className="w-6 h-6 text-ink-secondary/60" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-ink text-sm sm:text-base group-hover:text-brand transition-colors">
                              {b.item_title || 'Rental Item'}
                            </h4>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-brand-soft text-brand border border-brand/20">
                              {b.status}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-canvas text-ink-secondary border border-divider">
                              {isLender ? 'You are Lending' : 'You are Renting'}
                            </span>
                          </div>

                          {/* Counterparty & Dates */}
                          <div className="flex items-center gap-3 text-xs text-ink-secondary flex-wrap">
                            <div className="flex items-center gap-1.5 font-bold text-ink">
                              <img
                                src={counterpartyAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(counterpartyName)}&background=0F172A&color=fff&bold=true`}
                                alt={counterpartyName}
                                className="w-4 h-4 rounded-full object-cover"
                              />
                              <span>{isLender ? `Renter: ${counterpartyName}` : `Owner: ${counterpartyName}`}</span>
                            </div>
                            <span>•</span>
                            <span>{b.start_date} → {b.end_date}</span>
                            <span>•</span>
                            <span className="font-bold text-ink">{b.duration_days} days</span>
                            <span>•</span>
                            <span className="font-bold text-brand">
                              {Number(b.total_price) === 0 ? 'Free Borrowing' : `Paid: ₹${b.total_price}`}
                            </span>
                          </div>

                          {/* Task Highlight Banner */}
                          {taskSummary && (
                            <div className="text-xs font-semibold text-ink pt-0.5 flex items-center gap-1.5">
                              <span>{taskSummary}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBooking(b);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-divider hover:bg-canvas text-xs font-bold text-ink transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenChatWithBooking(b.id);
                          }}
                          className="btn-primary text-xs px-3.5 py-1.5 font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-pink"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

          </div>
        )}

        {/* Reviews & Trust Tab: Leave Reviews within 3-day window & See reviews received */}
        {activeTab === 'reviews' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            
            {/* Header Trust Overview */}
            <div className="bg-surface border border-divider rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-ink font-display">Reviews & Verified Trust</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Verified Peer
                  </span>
                </div>
                <p className="text-xs text-ink-secondary mt-1">
                  Leave feedback for your renters within 3 days after rental completion.
                </p>
              </div>

              <div className="flex items-center gap-6 self-start sm:self-auto">
                <div className="text-right">
                  <div className="text-2xl font-black text-ink font-display flex items-center gap-1 justify-end">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    <span>{ratingDisplay || '5.0'}</span>
                  </div>
                  <div className="text-[10px] font-bold text-ink-secondary">
                    {receivedReviews.length} Community Reviews
                  </div>
                </div>

                <div className="text-right border-l border-divider pl-6">
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display">
                    {user?.trust_score || 98}%
                  </div>
                  <div className="text-[10px] font-bold text-ink-secondary">
                    Trust Score
                  </div>
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
                  const isLender = b.lender_id === user.id || (user as any).firebase_uid === b.lender_id;
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
                                ✨ 3-Day Review Window Open
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-ink-secondary bg-canvas px-2 py-0.5 rounded-full border border-divider">
                                ⏰ 3-Day Window Closed
                              </span>
                            )}
                            {hasReviewed && (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                ✅ Review Submitted
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
                            setReviewRating(b.user_rating || 5);
                            setReviewComment(b.user_comment || '');
                            setReviewError('');
                          }}
                          disabled={!isWithin3Days}
                          className="btn-primary text-xs px-4 py-2 font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-pink disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Star className="w-3.5 h-3.5 fill-white text-white" />
                          <span>{hasReviewed ? 'Edit Review' : 'Write Review ⭐'}</span>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Section 2: Reviews People Have Given Me */}
            <div className="space-y-3 pt-4 border-t border-divider">
              <div className="px-1">
                <h4 className="text-sm font-extrabold text-ink font-display flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span>Reviews Received From Community</span>
                </h4>
                <p className="text-xs text-ink-secondary">
                  What other renters and lenders say about dealing with you
                </p>
              </div>

              {receivedReviews.length === 0 ? (
                <div className="p-8 text-center bg-surface border border-divider rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-ink">No community reviews received yet</p>
                  <p className="text-xs text-ink-secondary max-w-sm mx-auto">
                    Once people rent items from you or receive your returns, their verified reviews will be published here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {receivedReviews.map((rev) => (
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
                              {rev.reviewer_locality || 'Verified Neighbor'} • {new Date(rev.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: Math.round(rev.rating || 5) }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-ink leading-relaxed font-medium">
                        "{rev.comment || 'Smooth rental handover! Very polite and returned on time.'}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* Booking Detail Modal (Shows who booked it, deadline, how long, payment status) */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div
            className="relative bg-surface w-full max-w-lg rounded-3xl border border-divider shadow-2xl overflow-hidden my-auto text-ink"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-surface">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-ink font-display">
                  Booking & Handoff Details
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-brand-soft text-brand border border-brand/20">
                  {selectedBooking.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1.5 rounded-full hover:bg-canvas text-ink transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              
              {/* Product Info */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-canvas border border-divider">
                <div className="w-16 h-16 rounded-xl bg-surface border border-divider overflow-hidden shrink-0 flex flex-col items-center justify-center text-ink-secondary">
                  {selectedBooking.item_images?.[0] ? (
                    <img src={selectedBooking.item_images[0]} alt={selectedBooking.item_title} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-6 h-6 text-ink-secondary/60" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-extrabold text-ink text-sm sm:text-base">{selectedBooking.item_title}</h4>
                  <p className="text-ink-secondary font-medium">Category: {selectedBooking.item_category || 'General Gear'}</p>
                  <p className="text-brand font-bold">Duration: {selectedBooking.duration_days} Days</p>
                </div>
              </div>

              {/* Who Booked It / Counterparty Details */}
              {(() => {
                const isLender = selectedBooking.lender_id === user?.id || (user as any)?.firebase_uid === selectedBooking.lender_id;
                const counterName = isLender ? (selectedBooking.borrower_name || 'Renter') : (selectedBooking.lender_name || 'Owner');
                const counterAvatar = isLender ? selectedBooking.borrower_avatar : selectedBooking.lender_avatar;
                const counterPhone = isLender ? selectedBooking.borrower_phone : selectedBooking.lender_phone;
                const counterEmail = isLender ? selectedBooking.borrower_email : selectedBooking.lender_email;

                return (
                  <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-2">
                    <span className="text-[10px] font-black uppercase text-ink-secondary tracking-wider block">
                      {isLender ? 'Renter (Who Booked It)' : 'Product Owner'}
                    </span>
                    <div className="flex items-center gap-3">
                      <img
                        src={counterAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(counterName)}&background=0F172A&color=fff&bold=true`}
                        alt={counterName}
                        className="w-10 h-10 rounded-full object-cover border border-divider"
                      />
                      <div>
                        <div className="font-extrabold text-ink text-sm">{counterName}</div>
                        <div className="text-[11px] text-ink-secondary">
                          {isLender ? 'Verified Renter' : 'Verified Lender'}
                        </div>
                      </div>
                    </div>

                    {(counterPhone || counterEmail) && (
                      <div className="pt-2 border-t border-divider/60 flex flex-wrap gap-3 text-[11px] text-ink-secondary">
                        {counterPhone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-brand" />
                            <span>{counterPhone}</span>
                          </div>
                        )}
                        {counterEmail && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-brand" />
                            <span>{counterEmail}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Schedule & Return Deadline */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-2">
                <span className="text-[10px] font-black uppercase text-ink-secondary tracking-wider block">
                  Rental Schedule & Deadline
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-surface border border-divider">
                    <div className="text-[10px] text-ink-secondary font-bold uppercase">Pickup / Start</div>
                    <div className="font-extrabold text-ink mt-0.5">{selectedBooking.start_date}</div>
                    <div className="text-[11px] text-brand font-bold mt-0.5">{selectedBooking.start_time || '10:00 AM'}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface border border-divider">
                    <div className="text-[10px] text-ink-secondary font-bold uppercase">Return Deadline</div>
                    <div className="font-extrabold text-ink mt-0.5">{selectedBooking.end_date || selectedBooking.start_date}</div>
                    <div className="text-[11px] text-brand font-bold mt-0.5">{selectedBooking.end_time || '06:00 PM'}</div>
                  </div>
                </div>
              </div>

              {/* What You Need to Do (Action Task) */}
              <div className="p-3.5 rounded-2xl bg-brand-soft/30 border border-brand/20 space-y-1">
                <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-brand" />
                  <span>What You Need To Do:</span>
                </div>
                <p className="text-[11px] text-ink-secondary leading-relaxed">
                  {(() => {
                    const isLender = selectedBooking.lender_id === user?.id || (user as any)?.firebase_uid === selectedBooking.lender_id;
                    if (selectedBooking.status === 'ACCEPTED' || selectedBooking.status === 'PENDING') {
                      if (isLender) {
                        return selectedBooking.requires_delivery
                          ? `🚗 Deliver the product to the renter's address (${selectedBooking.pickup_locality || 'Renter Address'}) on ${selectedBooking.start_date}.`
                          : `🚶 The renter will come to your locality (${selectedBooking.pickup_locality || 'Your Locality'}) to pick up the product.`;
                      } else {
                        return selectedBooking.requires_delivery
                          ? `🚗 The owner will deliver the product to your address (${selectedBooking.pickup_locality}) on ${selectedBooking.start_date}.`
                          : `🚶 Go to the owner's locality (${selectedBooking.pickup_locality}) to collect the product.`;
                      }
                    } else if (selectedBooking.status === 'HANDED_OVER') {
                      if (isLender) {
                        return selectedBooking.requires_pickup
                          ? `🔄 On return deadline (${selectedBooking.end_date}), you must collect the gear from the renter (${selectedBooking.return_locality}).`
                          : `📥 On return deadline (${selectedBooking.end_date}), the renter will bring the gear back to you.`;
                      } else {
                        return selectedBooking.requires_pickup
                          ? `🔄 On return deadline (${selectedBooking.end_date}), the owner will collect the gear from your location (${selectedBooking.return_locality}).`
                          : `🚶 On return deadline (${selectedBooking.end_date}), return the product back to the owner.`;
                      }
                    } else {
                      return 'Rental completed. Please exchange reviews.';
                    }
                  })()}
                </p>
              </div>

              {/* Payment Status & Total */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-2">
                <span className="text-[10px] font-black uppercase text-ink-secondary tracking-wider block">
                  Payment Status
                </span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-ink">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    <span>{Number(selectedBooking.total_price) === 0 ? 'Free Community Borrowing' : 'Paid & Secured in Escrow'}</span>
                  </div>
                  <span className="text-sm font-black text-ink font-display">
                    {Number(selectedBooking.total_price) === 0 ? '₹0' : `₹${selectedBooking.total_price}`}
                  </span>
                </div>
                {Number(selectedBooking.delivery_fee) > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                    <span>Delivery Fee:</span>
                    <span>₹{selectedBooking.delivery_fee}</span>
                  </div>
                )}
                {Number(selectedBooking.pickup_fee) > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                    <span>Return Collection Fee:</span>
                    <span>₹{selectedBooking.pickup_fee}</span>
                  </div>
                )}
              </div>

              {/* Security Exchange Code */}
              {(selectedBooking.pickup_code || selectedBooking.return_code) && (
                <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-1">
                  <span className="text-[10px] font-black uppercase text-ink-secondary tracking-wider block">
                    Security Exchange Code
                  </span>
                  <div className="text-base font-black tracking-widest text-brand font-display">
                    {selectedBooking.status === 'ACCEPTED' ? selectedBooking.pickup_code : selectedBooking.return_code}
                  </div>
                  <p className="text-[10px] text-ink-secondary">
                    Share this 6-digit code only upon physical gear inspection.
                  </p>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedBooking(null);
                  onOpenChatWithBooking(selectedBooking.id);
                }}
                className="btn-primary w-full py-3 text-xs font-extrabold cursor-pointer shadow-pink flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Open Coordination Chat 💬</span>
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Write Review Modal */}
      {reviewingBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div
            className="relative bg-surface w-full max-w-md rounded-3xl border border-divider shadow-2xl overflow-hidden my-auto text-ink"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-surface">
              <h3 className="text-base font-extrabold text-ink font-display">
                Write Rental Review
              </h3>
              <button
                onClick={() => setReviewingBooking(null)}
                className="p-1.5 rounded-full hover:bg-canvas text-ink transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="p-6 space-y-4 text-xs">
              {reviewError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 font-bold">
                  {reviewError}
                </div>
              )}

              <div className="space-y-1">
                <span className="font-bold text-ink">Rating (1 to 5 Stars)</span>
                <div className="flex items-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 cursor-pointer transition-transform hover:scale-125"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= reviewRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-zinc-400 dark:text-zinc-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="font-extrabold text-sm text-ink ml-2">{reviewRating}.0</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink block">Your Review & Feedback</label>
                <textarea
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="How was your experience? (e.g. Gear was in immaculate condition, polite communication, returned right on time!)"
                  className="w-full bg-canvas border border-divider rounded-xl p-3 text-xs font-semibold text-ink outline-none focus:border-brand"
                  required
                />
              </div>

              <p className="text-[11px] text-ink-secondary">
                Your feedback directly impacts your neighbor's trust score and public rating.
              </p>

              <button
                type="submit"
                disabled={isSubmittingReview}
                className="btn-primary w-full py-3 text-xs font-extrabold cursor-pointer shadow-pink flex items-center justify-center gap-1.5"
              >
                {isSubmittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4 fill-white" />}
                <span>{isSubmittingReview ? 'Submitting...' : 'Submit Review'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
