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
  Upload,
  Loader2,
  ImageIcon
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
      <div className="max-w-md mx-auto px-4 py-20 text-center animate-in fade-in">
        <div className="bg-surface border border-divider rounded-3xl p-8 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-brand-soft text-brand flex items-center justify-center mx-auto text-2xl font-black">
            👤
          </div>
          <h2 className="text-xl font-black text-ink font-display">Sign in to view your Profile</h2>
          <p className="text-xs text-ink-secondary">Manage your gear listings, track rental requests, and view community earnings.</p>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-150">
      
      {/* Profile Banner & Header */}
      <div className="bg-surface border border-divider rounded-3xl overflow-hidden shadow-sm">
        
        {/* Banner Image */}
        <div className="h-48 sm:h-64 w-full relative bg-zinc-200 dark:bg-zinc-800 group overflow-hidden">
          <img
            src={bannerSrc}
            alt="Profile Banner"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />

          {/* Direct Cover Banner Upload Button */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
            <button
              onClick={() => bannerFileInputRef.current?.click()}
              disabled={isUploadingBanner}
              className="backdrop-blur-md bg-black/60 hover:bg-black/80 text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-lg hover:scale-105 active:scale-95"
              title="Change Background Picture"
            >
              {isUploadingBanner ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
                  <span>Uploading Cover...</span>
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

        {/* User Card with Overlapping Avatar */}
        <div className="px-6 pb-6 pt-0 relative flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 text-center sm:text-left">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
            
            {/* Avatar with Camera Overlay Button */}
            <div className="relative group shrink-0">
              <img
                src={avatarSrc}
                alt={user?.name || 'User'}
                className="w-28 h-28 rounded-full object-cover border-4 border-surface shadow-md bg-surface shrink-0"
              />
              <button
                onClick={() => avatarFileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute bottom-1 right-1 bg-brand hover:bg-brand-hover text-white p-2 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-transform cursor-pointer border-2 border-surface"
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

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-ink tracking-tight font-display">
                {user?.name || user?.email?.split('@')[0] || 'Rentu Member'}
              </h2>
              
              {user?.bio ? (
                <p className="text-xs text-ink-secondary font-medium max-w-xl">
                  {user.bio}
                </p>
              ) : (
                <p className="text-xs text-ink-secondary/70 italic max-w-xl">
                  No bio added yet. Click Edit Profile to tell neighbors about yourself!
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-ink-secondary pt-0.5">
                <span className="flex items-center gap-1 text-ink">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {ratingDisplay} ({user?.trust_score ? `${user.trust_score}% Trust Score` : 'Verified Peer'})
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Member since {memberSince}
                </span>
                <span>•</span>
                <span className="flex items-center gap-0.5 text-brand">
                  <MapPin className="w-3.5 h-3.5" />
                  {user?.locality || 'Location not set'}
                </span>
              </div>
            </div>
          </div>

          <button 
            id="edit-profile-btn"
            onClick={() => setIsEditModalOpen(true)}
            className="btn-secondary text-xs px-4 py-2 shrink-0 cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs w-full sm:w-auto"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>

        {/* Real Dynamic Stats Row (Zero Fake Data) - Mobile Responsive */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 sm:gap-y-0 border-t border-divider divide-y sm:divide-y-0 sm:divide-x divide-divider text-center py-3 sm:py-4 bg-canvas/40">
          <div className="py-1 sm:py-0">
            <div className="text-lg sm:text-xl font-black text-ink font-display">{myItems.length}</div>
            <div className="text-[10px] sm:text-[11px] font-bold text-ink-secondary">Listings</div>
          </div>
          <div className="py-1 sm:py-0">
            <div className="text-lg sm:text-xl font-black text-ink font-display">{myBookings.length}</div>
            <div className="text-[10px] sm:text-[11px] font-bold text-ink-secondary">Total Rents</div>
          </div>
          <div className="py-1 sm:py-0">
            <div className="text-lg sm:text-xl font-black text-ink font-display">{completedCount}</div>
            <div className="text-[10px] sm:text-[11px] font-bold text-ink-secondary">Completed</div>
          </div>
          <div className="py-1 sm:py-0">
            <div className="text-lg sm:text-xl font-black text-ink font-display">{ratingDisplay}</div>
            <div className="text-[10px] sm:text-[11px] font-bold text-ink-secondary">Community Rating</div>
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

      {/* Profile Tabs - Swipeable on mobile */}
      <div className="flex items-center gap-2 pt-6 sm:pt-8 pb-3 sm:pb-4 overflow-x-auto scrollbar-none whitespace-nowrap">
        {[
          { key: 'listings', label: `My Listings (${myItems.length})` },
          { key: 'requests', label: `My Requests (${myRequests.length})` },
          { key: 'bookings', label: `Bookings (${myBookings.length})` },
          { key: 'reviews', label: 'Reviews (0)' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === tab.key
                ? 'bg-ink text-canvas shadow-xs'
                : 'bg-surface border border-divider text-ink-secondary hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'listings' && (
          <div>
            {myItems.length === 0 ? (
              <div className="py-16 text-center bg-surface border border-divider rounded-2xl p-6">
                <p className="text-sm font-bold text-ink">You haven't listed any gear yet.</p>
                <p className="text-xs text-ink-secondary mt-1">Start monetizing your unused cameras, tents, or tools!</p>
                <button
                  onClick={onOpenDropGear}
                  className="mt-4 btn-primary text-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> List Your Gear
                </button>
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

        {activeTab === 'requests' && (
          <div className="space-y-3">
            {myRequests.length === 0 ? (
              <div className="py-16 text-center bg-surface border border-divider rounded-2xl p-6">
                <p className="text-sm font-bold text-ink">No requests posted yet.</p>
                <button
                  onClick={onOpenDropWish}
                  className="mt-4 btn-primary text-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Post a Request
                </button>
              </div>
            ) : (
              myRequests.map((req) => (
                <div key={req.id} className="p-4 bg-surface border border-divider rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-ink text-sm">{req.item_name}</h4>
                    <p className="text-xs text-ink-secondary">₹{Number(req.offered_amount)} budget • {req.start_date}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-canvas border border-divider text-ink">
                    {req.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="space-y-3">
            {myBookings.length === 0 ? (
              <div className="py-16 text-center bg-surface border border-divider rounded-2xl p-6">
                <p className="text-sm font-bold text-ink">No bookings yet.</p>
                <p className="text-xs text-ink-secondary mt-1">Rent gear or accept borrower reservations to see them here.</p>
              </div>
            ) : (
              myBookings.map((b) => (
                <div key={b.id} className="p-4 bg-surface border border-divider rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-ink text-sm">{b.item_title}</h4>
                    <p className="text-xs text-ink-secondary">{b.start_date} • ₹{Number(b.total_price)}</p>
                  </div>
                  <button
                    onClick={() => onOpenChatWithBooking(b.id)}
                    className="btn-secondary text-xs"
                  >
                    Open Chat
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="bg-surface border border-divider rounded-2xl p-6 space-y-4">
            <h4 className="text-sm font-extrabold text-ink">Community Reviews (0)</h4>
            <div className="py-14 text-center">
              <p className="text-sm font-bold text-ink">No community reviews yet.</p>
              <p className="text-xs text-ink-secondary mt-1 max-w-sm mx-auto">
                Complete your first rental or borrow to receive verified peer reviews.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
