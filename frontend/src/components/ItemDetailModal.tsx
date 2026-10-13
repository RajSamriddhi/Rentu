import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  Heart, 
  Star, 
  ShieldCheck, 
  Package, 
  MapPin, 
  Lock, 
  Check, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Item } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';

interface ItemDetailModalProps {
  item: Item | null;
  onClose: () => void;
  onBookingSuccess: () => void;
  onOpenAuth: () => void;
  onOpenChatWithBooking?: (bookingId: string) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  onClose,
  onBookingSuccess,
  onOpenAuth,
  onOpenChatWithBooking,
}) => {
  const { user, isAuthenticated } = useAuth();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [rentType, setRentType] = useState<'Rent' | 'Borrow'>('Rent');
  const [isLiked, setIsLiked] = useState(false);

  // Booking Form State
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultStartDate = tomorrow.toISOString().split('T')[0];

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 3);
  const defaultEndDate = dayAfter.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [endTime, setEndTime] = useState('10:00 AM');
  const [durationDays, setDurationDays] = useState(2);
  const [proposalMessage, setProposalMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedBookingId, setSubmittedBookingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!item) return null;

  const rawImages = Array.isArray(item.image_urls) && item.image_urls.length > 0
    ? item.image_urls
    : ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=80'];

  // Add dummy secondary angles if only 1 photo exists to match Screen 3 vertical gallery
  const images = rawImages.length >= 3 ? rawImages : [
    rawImages[0],
    'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1508873696983-2df5293cb395?auto=format&fit=crop&w=600&q=80',
  ];

  const pricePerDay = rentType === 'Borrow' ? 0 : Number(item.price_per_day);
  const totalCost = pricePerDay * durationDays;

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const booking = await api.createBooking({
        item_id: item.id,
        start_date: startDate,
        start_time: startTime,
        duration_days: durationDays,
        message: proposalMessage || `Hey! I'd love to ${rentType.toLowerCase()} your ${item.title} for ${durationDays} days.`,
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      setSubmittedBookingId(booking.id);
      onBookingSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit rental request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-surface border border-divider rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden my-4 text-ink">
        
        {/* Top Header / Breadcrumb bar matching Screen 3 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-surface">
          <nav className="flex items-center gap-1.5 text-xs text-ink-secondary truncate">
            <span>Explore</span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            <span>{item.category}</span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-bold text-ink truncate">{item.title}</span>
          </nav>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-canvas text-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left gallery + details, Right booking card */}
        <div className="p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left 7 Columns: Gallery + Item Details */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Gallery Layout from Screen 3 */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
                {/* Thumbnails */}
                <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-visible shrink-0 pb-1 sm:pb-0 scrollbar-none">
                  {images.slice(0, 4).map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                        activeImageIndex === idx ? 'border-brand ring-2 ring-brand/30' : 'border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>

                {/* Large Main Photo */}
                <div className="flex-1 aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200 relative">
                  <img
                    src={images[activeImageIndex]}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Title & Share / Heart row */}
              <div className="flex items-start justify-between gap-4 pt-2">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
                    {item.title}
                  </h1>

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="text-xl sm:text-2xl font-black text-ink font-display">
                      ₹{Number(item.price_per_day)} <span className="text-xs font-normal text-ink-secondary">/ day</span>
                    </span>

                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-secondary bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200">
                      ✨ Also available to borrow if owner agrees
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-3 text-xs font-semibold text-ink-secondary">
                    <div className="flex items-center gap-1 text-ink">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>4.8 (24 reviews)</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-brand" />
                      <span>{item.distance_meters ? `${(item.distance_meters / 1000).toFixed(1)} km away` : 'Nearby'}</span>
                    </div>
                    <span>•</span>
                    <span>{item.category}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigator.clipboard?.writeText(window.location.href)}
                    className="w-9 h-9 rounded-full border border-divider hover:bg-zinc-50 flex items-center justify-center text-ink transition-colors cursor-pointer"
                    title="Share item"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsLiked(!isLiked)}
                    className="w-9 h-9 rounded-full border border-divider hover:bg-zinc-50 flex items-center justify-center text-ink transition-colors cursor-pointer"
                    title="Save to favorites"
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-brand text-brand' : 'text-zinc-500'}`} />
                  </button>
                </div>
              </div>

              {/* Owner Profile Card matching Screen 3 */}
              <div className="bg-canvas border border-divider rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={item.owner_avatar || (item.owner_name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(item.owner_name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')}
                    alt={item.owner_name || 'Owner'}
                    className="w-12 h-12 rounded-full object-cover border border-zinc-200"
                  />
                  <div>
                    <h4 className="text-sm font-extrabold text-ink">{item.owner_name || 'Verified Owner'}</h4>
                    <p className="text-xs text-ink-secondary font-medium">Verified Lender</p>
                  </div>
                </div>

                <button
                  className="px-3.5 py-1.5 rounded-full border border-divider bg-canvas hover:bg-surface-hover text-xs font-bold text-ink transition-colors cursor-pointer shadow-xs"
                >
                  View profile
                </button>
              </div>

              {/* About this item description */}
              <div>
                <h3 className="text-sm font-extrabold text-ink uppercase tracking-wider mb-2">About this item</h3>
                <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed font-medium">
                  {item.description || "Perfect for beginners and hobbyists. Comes with 18-55mm lens, charger, 32GB SD card and camera bag. Great for travel, events or college projects."}
                </p>
              </div>

              {/* Tags Pills matching Screen 3 */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {['Camera', 'DSLR', '18-55mm', 'With accessories', 'Good condition'].map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-zinc-100 text-ink-secondary text-xs font-semibold rounded-full border border-zinc-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>

            </div>

            {/* Right 5 Columns: "Rent this item" Sidebar Card from Screen 3 */}
            <div className="lg:col-span-5">
              <div className="bg-canvas border border-divider rounded-3xl p-6 shadow-md sticky top-6">
                
                <h3 className="text-lg font-extrabold text-ink mb-4 font-display">
                  Rent this item
                </h3>

                {/* Rent | Borrow toggle */}
                <div className="grid grid-cols-2 p-1 bg-surface rounded-full border border-divider mb-5">
                  <button
                    type="button"
                    onClick={() => setRentType('Rent')}
                    className={`py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                      rentType === 'Rent'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-ink-secondary hover:text-ink'
                    }`}
                  >
                    Rent
                  </button>
                  <button
                    type="button"
                    onClick={() => setRentType('Borrow')}
                    className={`py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                      rentType === 'Borrow'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-ink-secondary hover:text-ink'
                    }`}
                  >
                    Borrow (Free)
                  </button>
                </div>

                {submittedBookingId ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-8 h-8 stroke-[3]" />
                    </div>
                    <h4 className="text-lg font-extrabold text-ink">Request Sent!</h4>
                    <p className="text-xs text-ink-secondary max-w-xs mx-auto">
                      {item.owner_name} has received your rental proposal. Check your coordination chat for updates!
                    </p>
                    <button
                      onClick={() => {
                        onClose();
                        if (onOpenChatWithBooking) onOpenChatWithBooking(submittedBookingId);
                      }}
                      className="btn-primary text-xs w-full py-2.5 cursor-pointer"
                    >
                      Open Coordination Chat 💬
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleBookingSubmit} className="space-y-4">
                    
                    {/* Start Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-ink-secondary mb-1">Start date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-ink-secondary mb-1">Start time</label>
                        <input
                          type="text"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none"
                        />
                      </div>
                    </div>

                    {/* End Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-ink-secondary mb-1">End date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-ink-secondary mb-1">End time</label>
                        <input
                          type="text"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none"
                        />
                      </div>
                    </div>

                    {/* Duration selector */}
                    <div>
                      <label className="block text-[11px] font-bold text-ink-secondary mb-1">Duration</label>
                      <select
                        value={durationDays}
                        onChange={(e) => setDurationDays(Number(e.target.value))}
                        className="w-full bg-canvas border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none cursor-pointer"
                      >
                        <option value={1}>1 day</option>
                        <option value={2}>2 days</option>
                        <option value={3}>3 days</option>
                        <option value={5}>5 days</option>
                        <option value={7}>7 days (1 week)</option>
                      </select>
                    </div>

                    {/* Note message */}
                    <div>
                      <label className="block text-[11px] font-bold text-ink-secondary mb-1">Quick Note to Owner</label>
                      <input
                        type="text"
                        value={proposalMessage}
                        onChange={(e) => setProposalMessage(e.target.value)}
                        placeholder="e.g. Shooting a college video this weekend..."
                        className="w-full bg-canvas border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none"
                      />
                    </div>

                    {/* Total cost & info box */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-sm font-extrabold text-ink mb-1">
                        <span>Total cost</span>
                        <span className="text-lg font-black text-ink font-display">₹{totalCost}</span>
                      </div>
                      <p className="text-[11px] text-ink-secondary leading-snug">
                        This is an estimated rental cost. No payment is processed on Rentu. You'll coordinate directly with the owner.
                      </p>
                    </div>

                    {errorMsg && (
                      <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-bold">
                        {errorMsg}
                      </div>
                    )}

                    {/* Hot Pink CTA Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary w-full py-3.5 text-xs sm:text-sm font-extrabold mt-2 cursor-pointer shadow-pink"
                    >
                      <span>{isSubmitting ? 'Sending Request...' : 'Request to Rent'}</span>
                    </button>

                    {/* Trust Perks from Screen 3 */}
                    <div className="pt-4 border-t border-divider space-y-2 text-xs text-ink-secondary font-medium">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Up to 5 days max</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-zinc-500 shrink-0" />
                        <span>Delivery not available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-brand shrink-0" />
                        <span>Self pickup ({item.distance_meters ? `${(item.distance_meters / 1000).toFixed(1)} km away` : 'Nearby'})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Security deposit not required</span>
                      </div>
                    </div>

                  </form>
                )}

              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
