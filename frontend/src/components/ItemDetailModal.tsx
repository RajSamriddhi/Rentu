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
  ChevronLeft,
  Maximize2,
  Sparkles,
  Navigation,
  Loader2,
  Calendar,
  Clock,
  Edit3,
  Trash2,
  Truck,
  RotateCcw,
  Eye,
  AlertCircle,
  Plus
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Item } from '../lib/types';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { getEffectiveSavedLocations, formatSavedLocationFull, formatFullAddress } from '../lib/location';
import { RentalCalendar, formatTime12 } from './RentalCalendar';
import { formatCleanTitle } from '../lib/formatters';
import { getReachDistance } from '../lib/distance';
import { AddLocationModal } from './AddLocationModal';

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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const isFreeListing = Boolean(
    item && (
      Number(item.price_per_day) <= 0 ||
      item.price_per_day === 0 ||
      item.price_per_day === '0' ||
      item.price_per_day === '0.00' ||
      !item.price_per_day ||
      (item.available_for_borrowing && (Number(item.price_per_day) <= 0 || !item.price_per_day))
    )
  );
  const isAvailableForBorrowing = Boolean(item?.available_for_borrowing || isFreeListing);
  const [rentType, setRentType] = useState<'Rent' | 'Borrow'>(isFreeListing ? 'Borrow' : 'Rent');
  const [isLiked, setIsLiked] = useState(() => {
    try {
      const favs = JSON.parse(localStorage.getItem('rentu_favorites') || '[]');
      return Array.isArray(favs) && Boolean(item?.id && favs.includes(item.id));
    } catch {
      return false;
    }
  });
  const [isDeleting, setIsDeleting] = useState(false);

  React.useEffect(() => {
    if (isFreeListing) {
      setRentType('Borrow');
    } else if (!isAvailableForBorrowing) {
      setRentType('Rent');
    }
  }, [isFreeListing, isAvailableForBorrowing, item?.id]);

  React.useEffect(() => {
    if (!item?.id) return;
    try {
      const favs = JSON.parse(localStorage.getItem('rentu_favorites') || '[]');
      setIsLiked(Array.isArray(favs) && favs.includes(item.id));
    } catch {}
  }, [item?.id]);

  const toggleFavorite = () => {
    if (!item?.id) return;
    try {
      const favs: string[] = JSON.parse(localStorage.getItem('rentu_favorites') || '[]');
      const updated = favs.includes(item.id)
        ? favs.filter((id) => id !== item.id)
        : [...favs, item.id];
      localStorage.setItem('rentu_favorites', JSON.stringify(updated));
      setIsLiked(updated.includes(item.id));
      window.dispatchEvent(new Event('rentu_favorites_updated'));
    } catch {
      setIsLiked(!isLiked);
    }
  };
  const reachDistanceText = item ? getReachDistance(item, user) : 'Nearby';

  // Owner detection: checks user id or firebase_uid against item.owner_id
  const isOwner = Boolean(
    user?.id && item?.owner_id && (user.id === item.owner_id || (user as any).firebase_uid === item.owner_id)
  );

  // Privacy protection: only reveal full exact address if viewer is owner or has an accepted rental booking
  const [hasAcceptedBooking, setHasAcceptedBooking] = useState(Boolean((item as any)?.can_view_address));

  React.useEffect(() => {
    if ((item as any)?.can_view_address) {
      setHasAcceptedBooking(true);
      return;
    }
    if (user?.id && item?.id && !isOwner) {
      api.getBookings('borrower').then((bookings) => {
        const hasAccepted = (bookings || []).some(
          (b) => b.item_id === item.id && ['ACCEPTED', 'HANDED_OVER', 'COMPLETED'].includes(b.status)
        );
        if (hasAccepted) {
          setHasAcceptedBooking(true);
        }
      }).catch(() => {});
    }
  }, [user?.id, item?.id, isOwner]);

  const canViewAddress = isOwner || hasAcceptedBooking || Boolean((item as any)?.can_view_address);

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
      if (item.booked_dates && item.booked_dates.length > 0) {
        setBookedDates(item.booked_dates);
      } else {
        api.getItemAvailability(item.id).then((dates) => {
          if (Array.isArray(dates)) setBookedDates(dates);
        }).catch(() => {});
      }
    }
  }, [item?.id]);

  // Booking Form State
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultStartDate = tomorrow.toISOString().split('T')[0];

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 3);
  const defaultEndDate = dayAfter.toISOString().split('T')[0];

  const getUpcomingStartTime = (): string => {
    const now = new Date();
    const m = now.getMinutes();
    if (m < 30) {
      now.setMinutes(30, 0, 0);
    } else {
      now.setHours(now.getHours() + 1, 0, 0, 0);
    }
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  };

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [startTime, setStartTime] = useState(getUpcomingStartTime);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [endTime, setEndTime] = useState('18:00');

  // If today is selected, ensure start time is an upcoming time slot rather than in the past
  React.useEffect(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (startDate === todayStr && startTime <= currentHStr) {
      setStartTime(getUpcomingStartTime());
    }
  }, [startDate, startTime]);

  // Delivery & Return Collection options based on lender listing
  const savedLocations = getEffectiveSavedLocations(user);
  const validSavedLocations = savedLocations.filter(loc =>
    Boolean((loc.building_flat_house && loc.building_flat_house.trim()) || (loc.street_road_landmark && loc.street_road_landmark.trim()))
  );
  const hasUserAddress = Boolean(
    (user?.address_text && user.address_text.trim() && user.address_text.trim() !== 'Bengaluru, India') ||
    validSavedLocations.length > 0
  );

  const defaultSavedAddr = validSavedLocations.length > 0
    ? formatSavedLocationFull(validSavedLocations[0])
    : (user?.address_text && user.address_text.trim() !== 'Bengaluru, India' ? user.address_text.trim() : '');

  const [optForDelivery, setOptForDelivery] = useState(false);
  const [optForPickup, setOptForPickup] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(defaultSavedAddr);
  const [pickupAddress, setPickupAddress] = useState(defaultSavedAddr);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);

  React.useEffect(() => {
    if (defaultSavedAddr) {
      if (!deliveryAddress) setDeliveryAddress(defaultSavedAddr);
      if (!pickupAddress) setPickupAddress(defaultSavedAddr);
    }
  }, [defaultSavedAddr]);

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

    const needsAddress = (item.offers_delivery && optForDelivery) || (item.offers_pickup && optForPickup);
    if (needsAddress && !hasUserAddress) {
      setErrorMsg('You must first set your delivery address before requesting delivery or collection.');
      setIsAddLocationOpen(true);
      return;
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (item.status === 'RENTED') {
      setErrorMsg('This item is currently rented out to another neighbor and cannot accept new rental requests right now.');
      return;
    }

    if (item.status === 'UNAVAILABLE') {
      setErrorMsg('This listing has been paused by the owner and is currently unavailable.');
      return;
    }

    if (startDate < todayStr) {
      setErrorMsg('Start date cannot be in the past. Please select an upcoming date.');
      return;
    }

    if (startDate === todayStr && startTime <= currentHourMin) {
      setErrorMsg(`Pickup time (${startTime}) has already passed for today. Please select an upcoming time.`);
      return;
    }

    if (endDate < startDate) {
      setErrorMsg('Return date cannot be earlier than start date.');
      return;
    }

    if (endDate === startDate && endTime <= startTime) {
      setErrorMsg(`Return time (${endTime}) must be after pickup time (${startTime}).`);
      return;
    }

    if (endDate === todayStr && endTime <= currentHourMin) {
      setErrorMsg(`Return time (${endTime}) has already passed for today. Please select an upcoming time.`);
      return;
    }

    // CALENDAR CHECK: Ensure selected dates and times do not overlap with booked dates
    const hasOverlap = bookedDates.some((b: any) => {
      const bStart = b.start_date?.slice(0, 10);
      const bEnd = (b.end_date || b.start_date)?.slice(0, 10);
      if (!bStart || !bEnd) return false;
      if (bStart > endDate || bEnd < startDate) return false;

      // If dates overlap, check if time slots overlap
      const bStartTime = b.start_time || '10:00';
      const bEndTime = b.end_time || '18:00';
      const reqStart = `${startDate}T${startTime}`;
      const reqEnd = `${endDate}T${endTime}`;
      const existingStart = `${bStart}T${bStartTime}`;
      const existingEnd = `${bEnd}T${bEndTime}`;

      return reqStart < existingEnd && existingStart < reqEnd;
    });

    if (hasOverlap) {
      setErrorMsg('This product is unavailable during the selected dates and times because it is already reserved. Please pick different dates or hours on the calendar.');
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
        is_borrowing: rentType === 'Borrow',
        booking_type: rentType === 'Borrow' ? 'BORROW' : 'RENT',
        timezone_offset_minutes: new Date().getTimezoneOffset(),
        requires_delivery: isDeliveredByLender,
        delivery_fee: deliveryCost,
        requires_pickup: isCollectedByLender,
        pickup_fee: pickupCost,
        pickup_type: isDeliveredByLender ? 'MY_LOCATION' : 'LENDER_LOCATION',
        pickup_locality: isDeliveredByLender ? deliveryAddress.trim() : (item.locality || 'Lender Locality'),
        return_type: isCollectedByLender ? 'MY_LOCATION' : 'LENDER_LOCATION',
        return_locality: isCollectedByLender ? pickupAddress.trim() : (item.locality || 'Lender Locality'),
        message: proposalMessage || `Hey! I'd love to ${(isFreeListing || rentType === 'Borrow') ? 'borrow' : 'rent'} your ${item.title} for ${durationDays} days.`,
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      setSubmittedBookingId(booking.id);
      onBookingSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to submit ${(isFreeListing || rentType === 'Borrow') ? 'borrowing' : 'rental'} request.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-surface border border-divider rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden my-4 text-ink">
        
        {/* Top Header / Breadcrumb bar matching Screen 3 */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-divider bg-surface">
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
        <div className="p-3.5 sm:p-6 lg:p-8 max-h-[88dvh] sm:max-h-[85vh] overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left 7 Columns: Gallery + Item Details */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Gallery Layout with Full Uncropped Picture and Lightbox */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
                {/* Thumbnails only if multiple real photos exist */}
                {images.length > 1 && (
                  <div className="flex sm:flex-col gap-2.5 overflow-x-auto sm:overflow-visible shrink-0 pb-1 sm:pb-0 scrollbar-none">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer bg-zinc-950 flex items-center justify-center ${
                          activeImageIndex === idx ? 'border-brand ring-2 ring-brand/30 scale-105' : 'border-divider hover:border-brand/40 opacity-70 hover:opacity-100'
                        }`}
                        title={`View photo ${idx + 1}`}
                      >
                        <img src={img} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover blur-xs opacity-40 pointer-events-none" />
                        <img src={img} alt={`Thumbnail ${idx + 1}`} className="relative z-10 w-full h-full object-contain" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Large Main Photo: Shows FULL uncropped picture with elegant ambient backdrop */}
                <div 
                  onClick={() => setIsLightboxOpen(true)}
                  className="flex-1 min-h-[300px] sm:min-h-[420px] max-h-[500px] aspect-[4/3] sm:aspect-[16/10] rounded-2xl overflow-hidden bg-zinc-950 dark:bg-black border border-divider relative flex items-center justify-center group cursor-zoom-in shadow-inner"
                  title="Click to view full picture"
                >
                  {/* Ambient blurred backdrop so any aspect ratio fills elegantly without awkward bars */}
                  <img
                    src={images[activeImageIndex] || images[0]}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110 pointer-events-none"
                  />
                  {/* Full Uncropped High-Resolution Image */}
                  <img
                    src={images[activeImageIndex] || images[0]}
                    alt={item.title}
                    className="relative z-10 max-w-full max-h-[480px] w-auto h-auto object-contain mx-auto transition-transform duration-300 group-hover:scale-[1.01]"
                  />
                  {/* View Fullscreen button badge */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLightboxOpen(true);
                    }}
                    className="absolute top-3 right-3 z-20 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-black/65 hover:bg-black/90 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-all shadow-md cursor-pointer"
                    title="View full picture"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">View Full</span>
                  </button>
                  {/* Photo counter if multiple */}
                  {images.length > 1 && (
                    <div className="absolute bottom-3 right-3 z-20 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px] font-black tracking-wider shadow-sm pointer-events-none">
                      {activeImageIndex + 1} / {images.length}
                    </div>
                  )}
                </div>
              </div>

              {/* Title & Share / Heart row */}
              <div className="flex items-start justify-between gap-4 pt-1">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
                    {formatCleanTitle(item.title)}
                  </h1>

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {isFreeListing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display flex items-center gap-1.5">
                          <Sparkles className="w-5 h-5 text-emerald-500" /> Free to Borrow
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          Community Gear
                        </span>
                      </div>
                    ) : (
                      <>
                        <span className="text-xl sm:text-2xl font-black text-ink font-display">
                          ₹{Number(item.price_per_day)} <span className="text-xs font-normal text-ink-secondary">/ day</span>
                        </span>
                        {isAvailableForBorrowing && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                            <Sparkles className="w-3 h-3" /> Free Borrowing Available
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-2.5 text-xs font-medium text-ink-secondary flex-wrap">
                    {Number(item.owner_rating) > 0 ? (
                      <>
                        <div className="flex items-center gap-1 text-ink font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{Number(item.owner_rating).toFixed(1)}</span>
                        </div>
                        <span>•</span>
                      </>
                    ) : null}
                    <div className="flex items-center gap-1.5 font-bold text-ink">
                      <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span className="text-[11px] font-extrabold text-brand bg-brand-soft px-2.5 py-1 rounded-full border border-brand/20">
                        {reachDistanceText}
                      </span>
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
                    onClick={toggleFavorite}
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
                  if (onOpenUserProfile && (item.owner_username || item.owner_id)) {
                    onClose();
                    onOpenUserProfile(item.owner_username || item.owner_id);
                  }
                }}
                className="bg-canvas border border-divider hover:border-brand/40 rounded-2xl p-4 flex items-center justify-between gap-4 cursor-pointer transition-colors group"
                title={`View ${item.owner_name || 'Owner'}'s community profile`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={item.owner_avatar || (item.owner_name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(item.owner_name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')}
                    alt={item.owner_name || 'Owner'}
                    className="w-12 h-12 rounded-full object-cover border border-zinc-200 group-hover:scale-105 transition-transform shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="text-sm font-extrabold text-ink group-hover:text-brand transition-colors truncate">{item.owner_name || 'Gear Owner'}</h4>
                    <div className="text-xs text-ink-secondary font-medium flex items-center gap-2 mt-0.5 flex-wrap">
                      <span>{(item as any).owner_is_verified ? 'Verified Lender' : 'Gear Owner'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-ink font-semibold">
                        <MapPin className="w-3 h-3 text-brand shrink-0" />
                        <span className="truncate">{reachDistanceText}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenUserProfile && (item.owner_username || item.owner_id)) {
                      onClose();
                      onOpenUserProfile(item.owner_username || item.owner_id);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-full border border-divider bg-surface hover:bg-brand-soft hover:text-brand hover:border-brand/40 text-xs font-bold text-ink transition-colors cursor-pointer shadow-xs shrink-0"
                >
                  View profile
                </button>
              </div>

              {/* Pickup & Handover Guide Box */}
              <div className="p-3.5 rounded-2xl bg-surface border border-divider flex items-center gap-3 text-xs">
                <div className="w-8 h-8 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-ink truncate">
                    Safe Handover & Return
                  </div>
                  <div className="text-[11px] text-ink-secondary font-medium">
                    Self pickup and return coordinate directly with owner via chat upon request confirmation.
                  </div>
                </div>
              </div>



              {/* About this item description */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider">About this item</h3>
                <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed font-medium">
                  {item.description || "No specific details provided by the owner. You can coordinate details via chat."}
                </p>
              </div>

              {/* Real Category & Condition Badges */}
              {(item.category || item.condition) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {item.category && (
                    <span className="px-3 py-1 bg-canvas text-ink-secondary text-xs font-semibold rounded-full border border-divider">
                      {item.category}
                    </span>
                  )}
                  {item.condition && (
                    <span className="px-3 py-1 bg-canvas text-ink-secondary text-xs font-semibold rounded-full border border-divider">
                      {item.condition} condition
                    </span>
                  )}
                </div>
              )}

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
                    if (start === end && endTime <= startTime) {
                      const [h, m] = startTime.split(':').map(Number);
                      const newEndH = Math.min(23, (h || 10) + 2);
                      setEndTime(`${String(newEndH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`);
                    }
                  }}
                  onSelectStartTime={(t) => {
                    setStartTime(t);
                    setErrorMsg('');
                    if (startDate === endDate && endTime <= t) {
                      const [h, m] = t.split(':').map(Number);
                      const newEndH = Math.min(23, (h || 10) + 2);
                      setEndTime(`${String(newEndH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`);
                    }
                  }}
                  onSelectEndTime={(t) => {
                    setEndTime(t);
                    setErrorMsg('');
                  }}
                />
              </div>

            </div>

            {/* Right 5 Columns: "Rent this item" Sidebar Card from Screen 3 */}
            <div className="lg:col-span-5 lg:sticky lg:top-4 self-start">
              <div className="bg-canvas border border-divider rounded-3xl p-6 shadow-md max-h-[calc(85vh-3rem)] overflow-y-auto">
                
                <h3 className="text-lg font-extrabold text-ink mb-4 font-display">
                  {isFreeListing || rentType === 'Borrow' ? 'Borrow this item' : 'Rent this item'}
                </h3>

                {/* If available for borrowing AND has rental price, allow choice. If strictly free borrowing, hide rent choice completely! */}
                {isAvailableForBorrowing && !isFreeListing && (
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
                      <span>Free Borrowing</span>
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
                      {item.owner_name} has received your {isFreeListing || rentType === 'Borrow' ? 'borrowing request' : 'rental proposal'}. Check your coordination chat for updates!
                    </p>
                    <button
                      onClick={() => {
                        onClose();
                        if (onOpenChatWithBooking) onOpenChatWithBooking(submittedBookingId);
                      }}
                      className="btn-primary text-xs w-full py-2.5 cursor-pointer"
                    >
                      Open Coordination Chat
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleBookingSubmit} className="space-y-4">
                    
                    {/* Address Requirement Banner */}
                    {!hasUserAddress && isAuthenticated && (
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-2 animate-in fade-in">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold">Address Required to Order</div>
                            <div className="text-[11px] text-ink-secondary mt-0.5">
                              You must add your address before ordering or requesting rent. We do not assume your address.
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAddLocationOpen(true)}
                          className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Your Address First</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Chosen Rental Schedule (synced live from the calendar & time selectors on the left) */}
                    <div className="p-3 rounded-2xl bg-surface border border-divider flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-ink flex flex-wrap items-center gap-1.5">
                            <span>{startDate}</span>
                            <span className="text-brand font-bold text-[11px]">{formatTime12(startTime)}</span>
                            <span className="text-ink-secondary font-normal">→</span>
                            <span>{endDate}</span>
                            <span className="text-brand font-bold text-[11px]">{formatTime12(endTime)}</span>
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
                                <Truck className="w-5 h-5 text-brand shrink-0" />
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
                              <div className="pt-2 border-t border-divider/60 space-y-2 animate-in fade-in">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-secondary flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-brand" />
                                    <span>Delivery Address</span>
                                    <span className="text-brand">*</span>
                                  </label>
                                  {validSavedLocations.length > 0 && (
                                    <span className="text-[10px] text-ink-secondary font-medium">From saved profile locations</span>
                                  )}
                                </div>

                                {/* Choose from Saved Profile Locations */}
                                {validSavedLocations.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {validSavedLocations.map((loc) => {
                                      const full = formatSavedLocationFull(loc);
                                      const isSelected = deliveryAddress === full;
                                      const subtitle = loc.locality || loc.building_flat_house;
                                      return (
                                        <button
                                          key={loc.id}
                                          type="button"
                                          onClick={() => setDeliveryAddress(full)}
                                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                            isSelected
                                              ? 'bg-brand/10 border-brand text-brand shadow-xs'
                                              : 'bg-surface border-divider text-ink-secondary hover:text-ink hover:border-brand/40'
                                          }`}
                                        >
                                          <MapPin className="w-3 h-3 text-brand shrink-0" />
                                          <span className="font-extrabold">{loc.label}</span>
                                          {subtitle && (
                                            <span className="text-[10px] opacity-75 max-w-[130px] truncate">
                                              ({subtitle})
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                                <input
                                  type="text"
                                  value={deliveryAddress}
                                  onChange={(e) => setDeliveryAddress(e.target.value)}
                                  placeholder="Enter where the owner should deliver to you..."
                                  className="w-full bg-canvas border border-divider rounded-xl px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-brand"
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
                                <RotateCcw className="w-5 h-5 text-brand shrink-0" />
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
                              <div className="pt-2 border-t border-divider/60 space-y-2 animate-in fade-in">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-secondary flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-brand" />
                                    <span>Return Collection Address</span>
                                    <span className="text-brand">*</span>
                                  </label>
                                  {validSavedLocations.length > 0 && (
                                    <span className="text-[10px] text-ink-secondary font-medium">From saved profile locations</span>
                                  )}
                                </div>

                                {/* Choose from Saved Profile Locations & Same as delivery */}
                                <div className="flex flex-wrap gap-1.5">
                                  {optForDelivery && deliveryAddress && (
                                    <button
                                      type="button"
                                      onClick={() => setPickupAddress(deliveryAddress)}
                                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                        pickupAddress === deliveryAddress
                                          ? 'bg-brand/10 border-brand text-brand shadow-xs'
                                          : 'bg-surface border-divider text-ink-secondary hover:text-ink hover:border-brand/40'
                                      }`}
                                    >
                                      <span>Same as delivery</span>
                                    </button>
                                  )}

                                  {validSavedLocations.map((loc) => {
                                    const full = formatSavedLocationFull(loc);
                                    const isSelected = pickupAddress === full;
                                    const subtitle = loc.locality || loc.building_flat_house;
                                    return (
                                      <button
                                        key={loc.id}
                                        type="button"
                                        onClick={() => setPickupAddress(full)}
                                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                          isSelected
                                            ? 'bg-brand/10 border-brand text-brand shadow-xs'
                                            : 'bg-surface border-divider text-ink-secondary hover:text-ink hover:border-brand/40'
                                        }`}
                                      >
                                        <MapPin className="w-3 h-3 text-brand shrink-0" />
                                        <span className="font-extrabold">{loc.label}</span>
                                        {subtitle && (
                                          <span className="text-[10px] opacity-75 max-w-[130px] truncate">
                                            ({subtitle})
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>

                                <input
                                  type="text"
                                  value={pickupAddress}
                                  onChange={(e) => setPickupAddress(e.target.value)}
                                  placeholder="Enter where the owner should collect on return..."
                                  className="w-full bg-canvas border border-divider rounded-xl px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-brand"
                                  required
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-divider space-y-1">
                        <div className="flex items-center gap-2 text-xs text-ink-secondary">
                          <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                          <span>Self pickup & return: <strong className="text-brand font-bold">{reachDistanceText}</strong></span>
                        </div>
                        <p className="text-[10px] text-ink-muted pl-5.5">
                          Exact pickup address shared privately after booking is confirmed.
                        </p>
                      </div>
                    )}

                    {/* Note message */}
                    <div>
                      <label className="block text-[11px] font-bold text-ink-secondary mb-1">Quick Note to Owner</label>
                      <input
                        type="text"
                        value={proposalMessage}
                        onChange={(e) => setProposalMessage(e.target.value)}
                        placeholder={isFreeListing || rentType === 'Borrow'
                          ? "e.g. Shooting a college project this weekend, promise to return safely!"
                          : "e.g. Shooting a college project this weekend..."}
                        className="w-full bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-medium text-ink outline-none focus:border-brand"
                      />
                    </div>

                    {/* Total cost & breakdown info box */}
                    <div className="pt-2 border-t border-divider space-y-1">
                      <div className="flex items-center justify-between text-xs text-ink-secondary font-medium">
                        <span>{isFreeListing || rentType === 'Borrow' ? 'Free Borrowing' : 'Rental'} ({durationDays} {durationDays === 1 ? 'day' : 'days'})</span>
                        <span>{isFreeListing || rentType === 'Borrow' ? 'Free (Borrow)' : `₹${baseCost}`}</span>
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
                          <div className="text-xs font-bold text-ink flex items-center justify-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-brand" /> Product Preview Mode
                          </div>
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
                    ) : !hasUserAddress && isAuthenticated ? (
                      <button
                        type="button"
                        onClick={() => setIsAddLocationOpen(true)}
                        className="btn-primary w-full py-3 text-xs sm:text-sm font-extrabold mt-2 cursor-pointer shadow-pink flex items-center justify-center gap-2"
                      >
                        <MapPin className="w-4 h-4" />
                        <span>Set Address to Order</span>
                      </button>
                    ) : item.status === 'RENTED' || (item as any).is_currently_booked ? (
                      <div className="space-y-1.5 mt-2">
                        <button
                          type="button"
                          disabled
                          className="w-full py-3 text-xs sm:text-sm font-extrabold rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <AlertCircle className="w-4 h-4" />
                          <span>Currently Rented Out</span>
                        </button>
                        <p className="text-[11px] text-center text-ink-secondary">
                          This item is currently out with another neighbor. You can select future dates on the calendar or browse nearby listings.
                        </p>
                      </div>
                    ) : item.status === 'UNAVAILABLE' ? (
                      <div className="space-y-1.5 mt-2">
                        <button
                          type="button"
                          disabled
                          className="w-full py-3 text-xs sm:text-sm font-extrabold rounded-2xl bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border border-zinc-500/30 cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <AlertCircle className="w-4 h-4" />
                          <span>Listing Currently Paused</span>
                        </button>
                        <p className="text-[11px] text-center text-ink-secondary">
                          The owner has paused this listing from accepting requests.
                        </p>
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
                            : (isFreeListing || rentType === 'Borrow')
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

      {/* Add Location Modal */}
      {isAddLocationOpen && (
        <AddLocationModal
          isOpen={isAddLocationOpen}
          onClose={() => setIsAddLocationOpen(false)}
          onSuccess={(newLoc) => {
            setIsAddLocationOpen(false);
            if (newLoc) {
              const full = formatSavedLocationFull(newLoc);
              setDeliveryAddress(full);
              setPickupAddress(full);
            }
          }}
        />
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Close full view"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Photo Navigation - Previous */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
              }}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-50 p-2.5 sm:p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
              title="Previous photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Full Image */}
          <div 
            className="relative max-w-full max-h-full flex flex-col items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[activeImageIndex] || images[0]}
              alt={item.title}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
            />
            {images.length > 1 && (
              <div className="mt-3 px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-bold shadow-md">
                {activeImageIndex + 1} / {images.length}
              </div>
            )}
          </div>

          {/* Photo Navigation - Next */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
              }}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-50 p-2.5 sm:p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
              title="Next photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
