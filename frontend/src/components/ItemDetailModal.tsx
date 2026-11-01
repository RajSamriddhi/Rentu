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
  Clock,
  Edit3,
  Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Item } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { detectCurrentLocation } from '../lib/location';
import { RentalCalendar } from './RentalCalendar';
import { getReachDistance } from '../lib/distance';

interface ItemDetailModalProps {
  item: Item | null;
  onClose: () => void;
  onBookingSuccess: () => void;
  onOpenAuth: () => void;
  onOpenChatWithBooking?: (bookingId: string) => void;
  onOpenUserProfile?: (userId: string) => void;
  onEditItem?: (item: Item) => void;
  onDeleteItem?: (itemId: string) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  onClose,
  onBookingSuccess,
  onOpenAuth,
  onOpenChatWithBooking,
  onOpenUserProfile,
  onEditItem,
  onDeleteItem,
}) => {
  const { user, isAuthenticated } = useAuth();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [rentType, setRentType] = useState<'Rent' | 'Borrow'>('Rent');
  const [isLiked, setIsLiked] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Available for borrowing status (set by owner during listing/editing)
  const isAvailableForBorrowing = Boolean(item?.available_for_borrowing);
  const reachDistanceText = item ? getReachDistance(item, user) : 'Nearby';

  // Owner detection: checks user id or firebase_uid against item.owner_id
  const isOwner = Boolean(
    user?.id && item?.owner_id && (user.id === item.owner_id || (user as any).firebase_uid === item.owner_id)
  );

  const handleDeleteListing = async () => {
    if (!item) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${item.title}"? This cannot be undone.`)) {
      return;
    }
    setIsDeleting(true);
    setErrorMsg('');
    try {
      await api.deleteItem(item.id);
      if (onDeleteItem) {
        onDeleteItem(item.id);
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete listing.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Booked Calendar Dates state
  const [bookedDates, setBookedDates] = useState<any[]>(item?.booked_dates || []);

  React.useEffect(() => {
    if (item) {
      if (!item.available_for_borrowing) {
        setRentType('Rent');
      }
      if (item.booked_dates && item.booked_dates.length > 0) {
        setBookedDates(item.booked_dates);
      } else {
        api.getItemAvailability(item.id).then((dates) => {
          if (Array.isArray(dates)) setBookedDates(dates);
        }).catch(() => {});
      }
    }
  }, [item]);

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

  // Delivery & Return Collection options based on lender listing
  const [optForDelivery, setOptForDelivery] = useState(false);
  const [optForPickup, setOptForPickup] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(user?.locality || '');
  const [pickupAddress, setPickupAddress] = useState(user?.locality || '');
  const [isDetectingDeliveryLoc, setIsDetectingDeliveryLoc] = useState(false);
  const [isDetectingPickupLoc, setIsDetectingPickupLoc] = useState(false);

  React.useEffect(() => {
    if (user?.locality) {
      if (!deliveryAddress) setDeliveryAddress(user.locality);
      if (!pickupAddress) setPickupAddress(user.locality);
    }
  }, [user]);

  const handleDetectDeliveryAddress = async () => {
    setIsDetectingDeliveryLoc(true);
    try {
      const loc = await detectCurrentLocation();
      if (loc?.locality) {
        setDeliveryAddress(loc.locality);
      }
    } catch (err) {
      console.warn('GPS detection failed:', err);
    } finally {
      setIsDetectingDeliveryLoc(false);
    }
  };

  const handleDetectPickupAddress = async () => {
    setIsDetectingPickupLoc(true);
    try {
      const loc = await detectCurrentLocation();
      if (loc?.locality) {
        setPickupAddress(loc.locality);
      }
    } catch (err) {
      console.warn('GPS detection failed:', err);
    } finally {
      setIsDetectingPickupLoc(false);
    }
  };

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

  if (!item) return null;

  // Only use real images provided by the item; fall back to 1 clean placeholder if empty
  const images = Array.isArray(item.image_urls) && item.image_urls.filter(Boolean).length > 0
    ? item.image_urls.filter(Boolean)
    : ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=80'];

  const baseCost = rentType === 'Borrow' ? 0 : Number(item.price_per_day) * durationDays;
  const deliveryCost = (item.offers_delivery && optForDelivery) ? Number(item.delivery_fee || 0) : 0;
  const pickupCost = (item.offers_pickup && optForPickup) ? Number(item.pickup_fee || 0) : 0;
  const totalCost = baseCost + deliveryCost + pickupCost;

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

    // CALENDAR CHECK: Ensure selected dates do not overlap with booked dates
    const hasOverlap = bookedDates.some((b: any) => {
      const bStart = b.start_date?.slice(0, 10);
      const bEnd = (b.end_date || b.start_date)?.slice(0, 10);
      return bStart && bEnd && bStart <= endDate && bEnd >= startDate;
    });

    if (hasOverlap) {
      setErrorMsg('This product is unavailable during the selected dates because it is already rented. Please pick different dates on the calendar.');
      return;
    }

    if (rentType === 'Borrow' && !isAvailableForBorrowing) {
      setErrorMsg('This product is not enabled for free borrowing. Please choose Rent.');
      return;
    }

    if (item.offers_delivery && optForDelivery && !deliveryAddress.trim()) {
      setErrorMsg('Please enter your delivery location/address where the owner should deliver the product.');
      return;
    }

    if (item.offers_pickup && optForPickup && !pickupAddress.trim()) {
      setErrorMsg('Please enter your return pickup location/address where the owner should collect the product.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const isDeliveredByLender = Boolean(item.offers_delivery && optForDelivery);
      const isCollectedByLender = Boolean(item.offers_pickup && optForPickup);

      const booking = await api.createBooking({
        item_id: item.id,
        start_date: startDate,
        start_time: startTime,
        end_date: endDate,
        end_time: endTime,
        duration_days: durationDays,
        total_price: totalCost,
        requires_delivery: isDeliveredByLender,
        delivery_fee: deliveryCost,
        requires_pickup: isCollectedByLender,
        pickup_fee: pickupCost,
        pickup_type: isDeliveredByLender ? 'MY_LOCATION' : 'LENDER_LOCATION',
        pickup_locality: isDeliveredByLender ? deliveryAddress.trim() : (item.locality || 'Lender Locality'),
        return_type: isCollectedByLender ? 'MY_LOCATION' : 'LENDER_LOCATION',
        return_locality: isCollectedByLender ? pickupAddress.trim() : (item.locality || 'Lender Locality'),
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
            {isOwner && (
              <span className="ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-soft text-brand border border-brand/20">
                Owner Preview
              </span>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => onEditItem?.(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-canvas hover:bg-brand-soft hover:text-brand border border-divider hover:border-brand/40 text-ink transition-colors cursor-pointer shadow-xs"
                  title="Edit listing details"
                >
                  <Edit3 className="w-3.5 h-3.5 text-brand" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteListing}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 transition-colors cursor-pointer shadow-xs"
                  title="Delete listing permanently"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Delete</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-canvas text-ink transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left gallery + details, Right booking card */}
        <div className="p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left 7 Columns: Gallery + Item Details */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Gallery Layout */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
                {/* Thumbnails only if multiple real photos exist */}
                {images.length > 1 && (
                  <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-visible shrink-0 pb-1 sm:pb-0 scrollbar-none">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                          activeImageIndex === idx ? 'border-brand ring-2 ring-brand/30' : 'border-divider hover:border-brand/40'
                        }`}
                      >
                        <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Large Main Photo */}
                <div className="flex-1 aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-900 border border-divider relative">
                  <img
                    src={images[activeImageIndex] || images[0]}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Title & Share / Heart row */}
              <div className="flex items-start justify-between gap-4 pt-1">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
                    {item.title}
                  </h1>

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="text-xl sm:text-2xl font-black text-ink font-display">
                      ₹{Number(item.price_per_day)} <span className="text-xs font-normal text-ink-secondary">/ day</span>
                    </span>

                    {isAvailableForBorrowing && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        🤝 Free Borrowing
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-2.5 text-xs font-medium text-ink-secondary">
                    {item.owner_rating ? (
                      <>
                        <div className="flex items-center gap-1 text-ink font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{Number(item.owner_rating).toFixed(1)}</span>
                        </div>
                        <span>•</span>
                      </>
                    ) : null}
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>{reachDistanceText}</span>
                    </div>
                    <span>•</span>
                    <span>{item.category}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigator.clipboard?.writeText(window.location.href)}
                    className="w-9 h-9 rounded-full border border-divider hover:bg-canvas flex items-center justify-center text-ink transition-colors cursor-pointer"
                    title="Share item"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsLiked(!isLiked)}
                    className="w-9 h-9 rounded-full border border-divider hover:bg-canvas flex items-center justify-center text-ink transition-colors cursor-pointer"
                    title="Save to favorites"
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-brand text-brand' : 'text-zinc-500'}`} />
                  </button>
                </div>
              </div>

              {/* Owner Profile Card matching Screen 3 */}
              <div 
                onClick={() => {
                  if (onOpenUserProfile && item.owner_id) {
                    onClose();
                    onOpenUserProfile(item.owner_id);
                  }
                }}
                className="bg-canvas border border-divider hover:border-brand/40 rounded-2xl p-4 flex items-center justify-between gap-4 cursor-pointer transition-colors group"
                title={`View ${item.owner_name || 'Owner'}'s community profile`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={item.owner_avatar || (item.owner_name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(item.owner_name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')}
                    alt={item.owner_name || 'Owner'}
                    className="w-12 h-12 rounded-full object-cover border border-zinc-200 group-hover:scale-105 transition-transform"
                  />
                  <div>
                    <h4 className="text-sm font-extrabold text-ink group-hover:text-brand transition-colors">{item.owner_name || 'Verified Owner'}</h4>
                    <p className="text-xs text-ink-secondary font-medium">Verified Lender • Click to view profile</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenUserProfile && item.owner_id) {
                      onClose();
                      onOpenUserProfile(item.owner_id);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-full border border-divider bg-surface hover:bg-brand-soft hover:text-brand hover:border-brand/40 text-xs font-bold text-ink transition-colors cursor-pointer shadow-xs"
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
                    className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-ink-secondary text-xs font-semibold rounded-full border border-zinc-200 dark:border-zinc-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Dedicated Visible Product Calendar Section */}
              <div className="pt-4 border-t border-divider space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-extrabold text-ink uppercase tracking-wider flex items-center gap-1.5 font-display">
                      <Calendar className="w-4 h-4 text-brand" />
                      <span>Product Calendar & Availability</span>
                    </h3>
                    <p className="text-xs text-ink-secondary">
                      {item.created_at 
                        ? `Listed on ${new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` 
                        : 'Active listing'} • Choose days directly from this calendar to rent
                    </p>
                  </div>

                  <span className="text-[11px] font-bold text-ink-secondary bg-surface px-2.5 py-1 rounded-full border border-divider">
                    Pick dates on calendar
                  </span>
                </div>

                <RentalCalendar
                  bookedDates={bookedDates}
                  startDate={startDate}
                  endDate={endDate}
                  startTime={startTime}
                  endTime={endTime}
                  onSelectRange={(start, end) => {
                    setStartDate(start);
                    setEndDate(end);
                    setErrorMsg('');
                  }}
                  onSelectStartTime={(t) => setStartTime(t)}
                  onSelectEndTime={(t) => setEndTime(t)}
                />
              </div>

            </div>

            {/* Right 5 Columns: "Rent this item" Sidebar Card from Screen 3 */}
            <div className="lg:col-span-5">
              <div className="bg-canvas border border-divider rounded-3xl p-6 shadow-md sticky top-6">
                
                <h3 className="text-lg font-extrabold text-ink mb-4 font-display">
                  {rentType === 'Borrow' ? 'Borrow this item' : 'Rent this item'}
                </h3>

                {/* If available for borrowing, show Rent / Borrow choice. If NOT available for borrowing, hide borrow completely! */}
                {isAvailableForBorrowing && (
                  <div className="grid grid-cols-2 p-1 bg-surface rounded-full border border-divider mb-5">
                    <button
                      type="button"
                      onClick={() => {
                        setRentType('Rent');
                        setErrorMsg('');
                      }}
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
                      onClick={() => {
                        setRentType('Borrow');
                        setErrorMsg('');
                      }}
                      className={`py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        rentType === 'Borrow'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-ink-secondary hover:text-ink'
                      }`}
                    >
                      <span>🤝 Borrow (Free)</span>
                    </button>
                  </div>
                )}

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
                    
                    {/* Chosen Rental Schedule (synced live from the calendar & time selectors on the left) */}
                    <div className="p-3 rounded-2xl bg-surface border border-divider flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-ink flex items-center gap-1.5 truncate">
                            <span>{startDate}</span>
                            <span className="text-brand font-bold text-[11px]">{startTime}</span>
                            <span className="text-ink-secondary font-normal">→</span>
                            <span>{endDate}</span>
                            <span className="text-brand font-bold text-[11px]">{endTime}</span>
                          </div>
                          <div className="text-[10px] text-ink-secondary">Selected on calendar</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold text-brand bg-brand-soft px-2.5 py-1 rounded-full border border-brand/20 shrink-0">
                        {durationDays} {durationDays === 1 ? 'day' : 'days'}
                      </span>
                    </div>

                    {/* Section: Handover & Delivery Options */}
                    {(item.offers_delivery || item.offers_pickup) ? (
                      <div className="space-y-2 pt-2 border-t border-divider">
                        <label className="block text-[11px] font-extrabold text-ink-secondary uppercase tracking-wider">
                          Handover Preferences
                        </label>

                        {/* Drop-off / Delivery toggle */}
                        {item.offers_delivery && (
                          <div className="p-3 rounded-2xl bg-surface border border-divider space-y-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <span className="text-base">🚗</span>
                                <div>
                                  <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                                    <span>Owner Delivery</span>
                                    <span className="text-[10px] font-extrabold text-brand bg-brand-soft px-2 py-0.5 rounded-full border border-brand/20">
                                      {Number(item.delivery_fee) > 0 ? `+₹${Number(item.delivery_fee)}` : 'FREE'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-ink-secondary">
                                    {optForDelivery ? 'Owner delivers to your location' : `You pick up from owner (${reachDistanceText})`}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setOptForDelivery(!optForDelivery)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  optForDelivery ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-700'
                                }`}
                                role="switch"
                                aria-checked={optForDelivery}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                    optForDelivery ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            {optForDelivery && (
                              <div className="pt-2 border-t border-divider/60 space-y-1 animate-in fade-in">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-secondary">
                                    Delivery Address <span className="text-brand">*</span>
                                  </label>
                                  <button
                                    type="button"
                                    onClick={handleDetectDeliveryAddress}
                                    disabled={isDetectingDeliveryLoc}
                                    className="text-[10px] font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Navigation className="w-2.5 h-2.5" />
                                    <span>{isDetectingDeliveryLoc ? 'Detecting...' : 'Detect GPS'}</span>
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={deliveryAddress}
                                  onChange={(e) => setDeliveryAddress(e.target.value)}
                                  placeholder="Enter where the owner should deliver to you..."
                                  className="w-full bg-canvas border border-divider rounded-xl px-3 py-1.5 text-xs font-semibold text-ink outline-none focus:border-brand"
                                  required
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Collection / Pickup toggle */}
                        {item.offers_pickup && (
                          <div className="p-3 rounded-2xl bg-surface border border-divider space-y-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <span className="text-base">🔄</span>
                                <div>
                                  <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                                    <span>Return Pickup by Owner</span>
                                    <span className="text-[10px] font-extrabold text-brand bg-brand-soft px-2 py-0.5 rounded-full border border-brand/20">
                                      {Number(item.pickup_fee) > 0 ? `+₹${Number(item.pickup_fee)}` : 'FREE'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-ink-secondary">
                                    {optForPickup ? 'Owner collects from you on return' : `You return to owner (${reachDistanceText})`}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setOptForPickup(!optForPickup)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  optForPickup ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-700'
                                }`}
                                role="switch"
                                aria-checked={optForPickup}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                    optForPickup ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            {optForPickup && (
                              <div className="pt-2 border-t border-divider/60 space-y-1 animate-in fade-in">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-secondary">
                                    Return Collection Address <span className="text-brand">*</span>
                                  </label>
                                  <div className="flex items-center gap-2">
                                    {optForDelivery && deliveryAddress && (
                                      <button
                                        type="button"
                                        onClick={() => setPickupAddress(deliveryAddress)}
                                        className="text-[10px] font-bold text-ink-secondary hover:text-ink hover:underline cursor-pointer"
                                      >
                                        Same as delivery
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={handleDetectPickupAddress}
                                      disabled={isDetectingPickupLoc}
                                      className="text-[10px] font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <Navigation className="w-2.5 h-2.5" />
                                      <span>{isDetectingPickupLoc ? 'Detecting...' : 'Detect GPS'}</span>
                                    </button>
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  value={pickupAddress}
                                  onChange={(e) => setPickupAddress(e.target.value)}
                                  placeholder="Enter where the owner should collect on return..."
                                  className="w-full bg-canvas border border-divider rounded-xl px-3 py-1.5 text-xs font-semibold text-ink outline-none focus:border-brand"
                                  required
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-divider flex items-center gap-2 text-xs text-ink-secondary">
                        <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span>Self pickup & return ({reachDistanceText})</span>
                      </div>
                    )}

                    {/* Note message */}
                    <div>
                      <label className="block text-[11px] font-bold text-ink-secondary mb-1">Quick Note to Owner</label>
                      <input
                        type="text"
                        value={proposalMessage}
                        onChange={(e) => setProposalMessage(e.target.value)}
                        placeholder="e.g. Shooting a college project this weekend..."
                        className="w-full bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-medium text-ink outline-none focus:border-brand"
                      />
                    </div>

                    {/* Total cost & breakdown info box */}
                    <div className="pt-2 border-t border-divider space-y-1">
                      <div className="flex items-center justify-between text-xs text-ink-secondary font-medium">
                        <span>Rental ({durationDays} {durationDays === 1 ? 'day' : 'days'})</span>
                        <span>{rentType === 'Borrow' ? 'Free (Borrow)' : `₹${baseCost}`}</span>
                      </div>
                      {item.offers_delivery && optForDelivery && Number(item.delivery_fee) > 0 && (
                        <div className="flex items-center justify-between text-xs text-ink-secondary font-medium">
                          <span>Delivery Fee (Lender Drop-off)</span>
                          <span>+₹{Number(item.delivery_fee)}</span>
                        </div>
                      )}
                      {item.offers_pickup && optForPickup && Number(item.pickup_fee) > 0 && (
                        <div className="flex items-center justify-between text-xs text-ink-secondary font-medium">
                          <span>Collection Fee (Lender Pickup)</span>
                          <span>+₹{Number(item.pickup_fee)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm font-extrabold text-ink pt-1.5 border-t border-divider/60">
                        <span>Total cost</span>
                        <span className="text-xl font-black text-ink font-display">
                          {totalCost === 0 ? 'Free' : `₹${totalCost}`}
                        </span>
                      </div>
                    </div>

                    {errorMsg && (
                      <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold">
                        {errorMsg}
                      </div>
                    )}

                    {/* Hot Pink CTA Button for Renters / Action Buttons for Owner */}
                    {isOwner ? (
                      <div className="space-y-2 mt-3 pt-3 border-t border-divider">
                        <div className="p-3 rounded-2xl bg-brand-soft/40 border border-brand/20 text-center">
                          <div className="text-xs font-bold text-ink">👀 Product Preview Mode</div>
                          <p className="text-[11px] text-ink-secondary mt-0.5">
                            This preview matches exactly what other users see when viewing your listed gear.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => onEditItem?.(item)}
                            className="w-full py-2.5 rounded-xl text-xs font-extrabold bg-canvas hover:bg-surface border border-divider hover:border-brand/40 text-ink hover:text-brand transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-brand" />
                            <span>Edit Listing</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteListing}
                            disabled={isDeleting}
                            className="w-full py-2.5 rounded-xl text-xs font-extrabold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            <span>Delete Listing</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-primary w-full py-3 text-xs sm:text-sm font-extrabold mt-2 cursor-pointer shadow-pink"
                      >
                        <span>
                          {isSubmitting
                            ? 'Sending Request...'
                            : rentType === 'Borrow'
                            ? 'Request to Borrow (Free)'
                            : `Request to Rent (₹${totalCost})`}
                        </span>
                      </button>
                    )}

                    {/* Trust Perk */}
                    <div className="pt-3 border-t border-divider flex items-center justify-center gap-1.5 text-[11px] text-ink-secondary">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>Verified handover with secure 6-digit codes</span>
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
