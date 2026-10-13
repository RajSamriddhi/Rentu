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
  ArrowUpRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { uploadItemPhoto } from '../lib/supabase';
import { Item, Booking, CommunityRequest } from '../lib/types';
import { ItemCard } from './ItemCard';
import { EditProfileModal } from './EditProfileModal';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [items, reqs, books] = await Promise.all([
        api.getItems({ ownerId: user.id, status: 'ALL' }),
        api.getRequests({ seekerId: user.id, status: 'ALL' }),
        api.getBookings(),
      ]);
      setMyItems(items || []);
      setMyRequests(reqs || []);
      setMyBookings(books || []);
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
  const ratingDisplay = user?.rating ? Number(user.rating).toFixed(1) : '5.0';

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

          {/* Top Left: Locality Pill */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
            <div className="backdrop-blur-md bg-black/50 text-white border border-white/20 px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-md">
              <MapPin className="w-3.5 h-3.5 text-brand" />
              <span>{user?.locality || 'Delhi'}</span>
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
              <span className="inline-flex items-center gap-1 text-ink font-bold bg-canvas px-3 py-1 rounded-full border border-divider">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{ratingDisplay} Rating</span>
              </span>
              
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
              <div className="text-xl sm:text-2xl font-black text-ink font-display">{ratingDisplay}</div>
              <div className="text-[11px] font-bold text-ink-secondary">Trust Rating</div>
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

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex items-center gap-2 pt-8 pb-4 overflow-x-auto scrollbar-none whitespace-nowrap">
        {[
          { key: 'listings', label: 'My Listings', count: myItems.length, icon: Package },
          { key: 'requests', label: 'My Requests', count: myRequests.length, icon: Sparkles },
          { key: 'bookings', label: 'Bookings & Handoffs', count: myBookings.length, icon: Calendar },
          { key: 'reviews', label: 'Reviews & Trust', count: 0, icon: Star },
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
                    onClick={() => {}}
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
                <div key={req.id} className="p-4 sm:p-5 bg-surface border border-divider rounded-2xl flex items-center justify-between shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-ink text-sm sm:text-base">{req.item_name}</h4>
                    <p className="text-xs text-ink-secondary">
                      ₹{Number(req.offered_amount)} proposed budget • Needed by {req.start_date}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-brand/10 text-brand border border-brand/20">
                    {req.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="space-y-3">
            {myBookings.length === 0 ? (
              <div className="py-16 px-6 text-center bg-surface border border-divider rounded-3xl shadow-xs max-w-2xl mx-auto space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto">
                  <Calendar className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold text-ink font-display">No Active Bookings</h3>
                  <p className="text-xs text-ink-secondary max-w-sm mx-auto">
                    Whenever you borrow items or approve requests from neighbors, your active handoffs will appear here.
                  </p>
                </div>
              </div>
            ) : (
              myBookings.map((b) => (
                <div key={b.id} className="p-4 sm:p-5 bg-surface border border-divider rounded-2xl flex items-center justify-between shadow-xs">
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-ink text-sm sm:text-base">{b.item_title}</h4>
                    <p className="text-xs text-ink-secondary">
                      {b.start_date} • ₹{Number(b.total_price)} • Status: <span className="font-bold text-ink">{b.status}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => onOpenChatWithBooking(b.id)}
                    className="btn-secondary text-xs px-4 py-2 font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Open Chat</span>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="bg-surface border border-divider rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs max-w-2xl mx-auto">
            <div className="flex items-center justify-between pb-4 border-b border-divider">
              <div>
                <h3 className="text-base font-extrabold text-ink font-display">Community Trust & Reviews</h3>
                <p className="text-xs text-ink-secondary">Verified feedback from completed rentals and handoffs</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-ink font-display flex items-center gap-1 justify-end">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  <span>{ratingDisplay}</span>
                </div>
                <div className="text-[10px] font-bold text-ink-secondary">Perfect 5.0 Rating</div>
              </div>
            </div>

            <div className="py-8 text-center space-y-2">
              <p className="text-xs font-bold text-ink">No reviews written yet</p>
              <p className="text-xs text-ink-secondary max-w-sm mx-auto">
                Once you complete your first rental return, your neighbor's review and verified trust score will be published here.
              </p>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
