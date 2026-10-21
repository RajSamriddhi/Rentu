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
  Sparkles,
  Navigation,
  Loader2,
  Calendar,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Item } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { detectCurrentLocation } from '../lib/location';

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
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [endTime, setEndTime] = useState('18:00');

  // Logistics states
  const [pickupType, setPickupType] = useState<'LENDER_LOCATION' | 'MY_LOCATION' | 'CUSTOM_LOCATION'>('LENDER_LOCATION');
  const [pickupLocality, setPickupLocality] = useState('');
  const [borrowerLocality, setBorrowerLocality] = useState(user?.locality || '');

  const [returnType, setReturnType] = useState<'LENDER_LOCATION' | 'MY_LOCATION' | 'CUSTOM_LOCATION'>('LENDER_LOCATION');
  const [returnLocality, setReturnLocality] = useState('');

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isDetectingPickupLoc, setIsDetectingPickupLoc] = useState(false);
  const [isDetectingReturnLoc, setIsDetectingReturnLoc] = useState(false);

  const [proposalMessage, setProposalMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedBookingId, setSubmittedBookingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Automatically calculate duration from calendar dates
  const durationDays = React.useMemo(() => {
    if (!startDate || !endDate) return 1;
    try {
      const [sY, sM, sD] = startDate.split('-').map(Number);
      const [eY, eM, eD] = endDate.split('-').map(Number);
      if (!sY || !sM || !sD || !eY || !eM || !eD) return 1;
      const sUtc = Date.UTC(sY, sM - 1, sD);
      const eUtc = Date.UTC(eY, eM - 1, eD);
      const diffDays = Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24));
      return Math.max(1, diffDays);
    } catch {
      return 1;
    }
  }, [startDate, endDate]);

  const handleDetectLocation = async (target: 'main' | 'pickup' | 'return' = 'main') => {
    if (target === 'return') setIsDetectingReturnLoc(true);
    else if (target === 'pickup') setIsDetectingPickupLoc(true);
    else setIsDetectingLocation(true);
    setErrorMsg('');

    try {
      const loc = await detectCurrentLocation();
      if (target === 'return') {
        setReturnLocality(loc.locality);
      } else if (target === 'pickup') {
        setPickupLocality(loc.locality);
      } else {
        setBorrowerLocality(loc.locality);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not detect GPS location.');
    } finally {
      if (target === 'return') setIsDetectingReturnLoc(false);
      else if (target === 'pickup') setIsDetectingPickupLoc(false);
      else setIsDetectingLocation(false);
    }
  };

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

    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg('Return date cannot be earlier than start date.');
      return;
    }

    if (pickupType === 'CUSTOM_LOCATION' && !pickupLocality.trim()) {
      setErrorMsg('Please specify the custom pickup meetup spot or landmark.');
      return;
    }

    if (pickupType === 'MY_LOCATION' && !borrowerLocality.trim()) {
      setErrorMsg('Please specify your current delivery address.');
      return;
    }

    if (returnType === 'CUSTOM_LOCATION' && !returnLocality.trim()) {
      setErrorMsg('Please specify the return meetup spot or landmark.');
      return;
    }

    if (returnType === 'MY_LOCATION' && !returnLocality.trim() && !borrowerLocality.trim()) {
      setErrorMsg('Please specify your return collection address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const finalPickupLoc = pickupType === 'MY_LOCATION'
        ? borrowerLocality.trim()
        : pickupType === 'CUSTOM_LOCATION'
        ? pickupLocality.trim()
        : (item.locality || 'Lender Location');

      const finalReturnLoc = returnType === 'MY_LOCATION'
        ? (returnLocality.trim() || borrowerLocality.trim())
        : returnType === 'CUSTOM_LOCATION'
        ? returnLocality.trim()
        : (item.locality || 'Lender Location');

      const booking = await api.createBooking({
        item_id: item.id,
        start_date: startDate,
        start_time: startTime,
        end_date: endDate,
        end_time: endTime,
        duration_days: durationDays,
        total_price: totalCost,
        pickup_type: pickupType,
        pickup_locality: finalPickupLoc,
        return_type: returnType,
        return_locality: finalReturnLoc,
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
                    {item.owner_rating ? (
                      <>
                        <div className="flex items-center gap-1 text-ink">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{Number(item.owner_rating).toFixed(1)} Lender Rating</span>
                        </div>
                        <span>•</span>
                      </>
                    ) : null}
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
                    
                    {/* Calendar Dates & Times */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-brand" />
                          <span>Rental Dates & Times</span>
                        </label>
                        <span className="text-[11px] font-extrabold text-brand bg-brand-soft px-2.5 py-0.5 rounded-full border border-brand/20">
                          {durationDays} {durationDays === 1 ? 'Day' : 'Days'}
                        </span>
                      </div>

                      {/* Start Date & Time */}
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-7">
                          <label className="block text-[10px] font-extrabold uppercase text-ink-secondary mb-1">Start Date *</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-surface border border-divider rounded-xl px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                            required
                          />
                        </div>
                        <div className="col-span-5">
                          <label className="block text-[10px] font-extrabold uppercase text-ink-secondary mb-1">Start Time</label>
                          <input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full bg-surface border border-divider rounded-xl px-2 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                          />
                        </div>
                      </div>

                      {/* End Date & Time */}
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-7">
                          <label className="block text-[10px] font-extrabold uppercase text-ink-secondary mb-1">End / Return Date *</label>
                          <input
                            type="date"
                            min={startDate}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-surface border border-divider rounded-xl px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                            required
                          />
                        </div>
                        <div className="col-span-5">
                          <label className="block text-[10px] font-extrabold uppercase text-ink-secondary mb-1">End Time</label>
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full bg-surface border border-divider rounded-xl px-2 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section: Pickup Logistics */}
                    <div className="space-y-2 pt-2 border-t border-divider">
                      <label className="block text-xs font-extrabold text-ink uppercase tracking-wider">
                        Pickup Handover: Where will you receive it?
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setPickupType('LENDER_LOCATION')}
                          className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                            pickupType === 'LENDER_LOCATION'
                              ? 'border-brand bg-brand-soft/40 text-brand ring-1 ring-brand shadow-xs'
                              : 'border-divider bg-surface text-ink-secondary hover:text-ink'
                          }`}
                        >
                          <div className="font-black text-ink text-xs">🚶 To Lender</div>
                          <div className="text-[10px] text-ink-secondary font-normal mt-0.5 leading-tight">
                            Pick up at owner's place
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPickupType('MY_LOCATION');
                            if (!borrowerLocality && user?.locality) setBorrowerLocality(user.locality);
                          }}
                          className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                            pickupType === 'MY_LOCATION'
                              ? 'border-brand bg-brand-soft/40 text-brand ring-1 ring-brand shadow-xs'
                              : 'border-divider bg-surface text-ink-secondary hover:text-ink'
                          }`}
                        >
                          <div className="font-black text-ink text-xs">📍 My Location</div>
                          <div className="text-[10px] text-ink-secondary font-normal mt-0.5 leading-tight">
                            Deliver to your live spot
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPickupType('CUSTOM_LOCATION')}
                          className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                            pickupType === 'CUSTOM_LOCATION'
                              ? 'border-brand bg-brand-soft/40 text-brand ring-1 ring-brand shadow-xs'
                              : 'border-divider bg-surface text-ink-secondary hover:text-ink'
                          }`}
                        >
                          <div className="font-black text-ink text-xs">🤝 Custom Spot</div>
                          <div className="text-[10px] text-ink-secondary font-normal mt-0.5 leading-tight">
                            Mutual station or spot
                          </div>
                        </button>
                      </div>

                      {/* Pickup conditional inputs */}
                      {pickupType === 'CUSTOM_LOCATION' && (
                        <div className="p-2.5 rounded-xl bg-surface border border-divider space-y-1.5 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-ink">
                              Custom Pickup Meetup Spot *
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDetectLocation('pickup')}
                              disabled={isDetectingPickupLoc}
                              className="text-[10px] font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Navigation className="w-2.5 h-2.5 text-brand" />
                              <span>{isDetectingPickupLoc ? '...' : 'GPS'}</span>
                            </button>
                          </div>
                          <input
                            type="text"
                            value={pickupLocality}
                            onChange={(e) => setPickupLocality(e.target.value)}
                            placeholder="e.g. Indiranagar Metro Station Gate 1"
                            className="w-full bg-canvas border border-divider rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-brand"
                            required
                          />
                        </div>
                      )}

                      {pickupType === 'MY_LOCATION' && (
                        <div className="p-2.5 rounded-xl bg-surface border border-divider space-y-1.5 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-ink">
                              Your Current Delivery Address *
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDetectLocation('main')}
                              disabled={isDetectingLocation}
                              className="text-[10px] font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Navigation className="w-2.5 h-2.5 text-brand" />
                              <span>{isDetectingLocation ? '...' : 'Use Current GPS 📍'}</span>
                            </button>
                          </div>
                          <input
                            type="text"
                            value={borrowerLocality}
                            onChange={(e) => setBorrowerLocality(e.target.value)}
                            placeholder="e.g. Room 402 or Flat address"
                            className="w-full bg-canvas border border-divider rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-brand"
                            required
                          />
                        </div>
                      )}
                    </div>

                    {/* Section: Return Logistics */}
                    <div className="space-y-2 pt-2 border-t border-divider">
                      <label className="block text-xs font-extrabold text-ink uppercase tracking-wider">
                        Return Handover: How will you return it?
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setReturnType('LENDER_LOCATION')}
                          className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                            returnType === 'LENDER_LOCATION'
                              ? 'border-brand bg-brand-soft/40 text-brand ring-1 ring-brand shadow-xs'
                              : 'border-divider bg-surface text-ink-secondary hover:text-ink'
                          }`}
                        >
                          <div className="font-black text-ink text-xs">🚶 To Lender</div>
                          <div className="text-[10px] text-ink-secondary font-normal mt-0.5 leading-tight">
                            Return back to lender
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setReturnType('MY_LOCATION');
                            if (!returnLocality && borrowerLocality) setReturnLocality(borrowerLocality);
                          }}
                          className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                            returnType === 'MY_LOCATION'
                              ? 'border-brand bg-brand-soft/40 text-brand ring-1 ring-brand shadow-xs'
                              : 'border-divider bg-surface text-ink-secondary hover:text-ink'
                          }`}
                        >
                          <div className="font-black text-ink text-xs">🏠 Collect at Mine</div>
                          <div className="text-[10px] text-ink-secondary font-normal mt-0.5 leading-tight">
                            Lender collects from you
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setReturnType('CUSTOM_LOCATION')}
                          className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                            returnType === 'CUSTOM_LOCATION'
                              ? 'border-brand bg-brand-soft/40 text-brand ring-1 ring-brand shadow-xs'
                              : 'border-divider bg-surface text-ink-secondary hover:text-ink'
                          }`}
                        >
                          <div className="font-black text-ink text-xs">🤝 Custom Spot</div>
                          <div className="text-[10px] text-ink-secondary font-normal mt-0.5 leading-tight">
                            Mutual station or spot
                          </div>
                        </button>
                      </div>

                      {/* Return conditional inputs */}
                      {(returnType === 'CUSTOM_LOCATION' || returnType === 'MY_LOCATION') && (
                        <div className="p-2.5 rounded-xl bg-surface border border-divider space-y-1.5 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-ink">
                              {returnType === 'CUSTOM_LOCATION' ? 'Return Meetup Landmark *' : 'Collection Address *'}
                            </label>
                            <div className="flex items-center gap-2">
                              {((pickupType === 'CUSTOM_LOCATION' && pickupLocality) || borrowerLocality) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (returnType === 'CUSTOM_LOCATION' && pickupType === 'CUSTOM_LOCATION' && pickupLocality) {
                                      setReturnLocality(pickupLocality);
                                    } else if (borrowerLocality) {
                                      setReturnLocality(borrowerLocality);
                                    }
                                  }}
                                  className="text-[10px] font-bold text-brand hover:underline cursor-pointer"
                                >
                                  Same as pickup
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDetectLocation('return')}
                                disabled={isDetectingReturnLoc}
                                className="text-[10px] font-bold text-brand hover:underline cursor-pointer"
                              >
                                {isDetectingReturnLoc ? '...' : 'GPS'}
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={returnLocality}
                            onChange={(e) => setReturnLocality(e.target.value)}
                            placeholder={returnType === 'CUSTOM_LOCATION' ? 'e.g. Indiranagar Metro Station Gate 1' : 'e.g. Room 402 or your address'}
                            className="w-full bg-canvas border border-divider rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-brand"
                            required
                          />
                        </div>
                      )}
                    </div>

                    {/* Note message */}
                    <div>
                      <label className="block text-[11px] font-bold text-ink-secondary mb-1">Quick Note to Owner</label>
                      <input
                        type="text"
                        value={proposalMessage}
                        onChange={(e) => setProposalMessage(e.target.value)}
                        placeholder="e.g. Shooting a college project this weekend..."
                        className="w-full bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none"
                      />
                    </div>

                    {/* Total cost & info box */}
                    <div className="pt-2 border-t border-divider">
                      <div className="flex items-center justify-between text-sm font-extrabold text-ink mb-1">
                        <span>Total cost ({durationDays} {durationDays === 1 ? 'day' : 'days'})</span>
                        <span className="text-lg font-black text-ink font-display">
                          {rentType === 'Borrow' ? 'Free (Borrow)' : `₹${totalCost}`}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-secondary leading-snug">
                        {rentType === 'Borrow'
                          ? 'Zero rental fee proposal. The owner will review and coordinate handover directly.'
                          : `Estimated at ₹${item.price_per_day}/day for ${durationDays} days. Coordinate directly with the owner.`}
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
                      <span>
                        {isSubmitting
                          ? 'Sending Request...'
                          : rentType === 'Borrow'
                          ? 'Request to Borrow (Free)'
                          : `Request to Rent (₹${totalCost})`}
                      </span>
                    </button>

                    {/* Trust Perks */}
                    <div className="pt-4 border-t border-divider space-y-2 text-xs text-ink-secondary font-medium">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-brand shrink-0" />
                        <span>{durationDays} {durationDays === 1 ? 'day' : 'days'} custom duration requested</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Pickup: {pickupType === 'MY_LOCATION' ? 'Delivered to you' : pickupType === 'CUSTOM_LOCATION' ? (pickupLocality || 'Custom Meetup') : `Lender's Area (${item.locality || 'Nearby'})`}</span>
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
