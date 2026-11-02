import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  Upload,
  Camera,
  Loader2,
  Navigation,
  Sparkles,
  MapPin,
  Trash2,
  RefreshCw,
  Plus,
  Calendar,
  Clock,
  ArrowRight,
  Truck,
  CheckCircle2,
  Megaphone,
  Package,
  Send
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { uploadItemPhoto } from '../lib/supabase';
import { detectCurrentLocation, getEffectiveSavedLocations, formatSavedLocationFull } from '../lib/location';
import { MessageProposalData, SavedLocation } from '../lib/types';
import { AddLocationModal } from './AddLocationModal';

interface PersonalProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerName: string;
  partnerId: string;
  bookingId?: string | null;
  onSubmitProposal: (proposalData: MessageProposalData, summaryText: string) => Promise<void>;
  initialType?: 'LISTING' | 'REQUEST';
}

export const PersonalProposalModal: React.FC<PersonalProposalModalProps> = ({
  isOpen,
  onClose,
  partnerName,
  partnerId,
  bookingId,
  onSubmitProposal,
  initialType = 'LISTING',
}) => {
  const { user } = useAuth();

  // Active Tab: 'LISTING' (Offer to Lend) or 'REQUEST' (Request to Borrow)
  const [proposalType, setProposalType] = useState<'LISTING' | 'REQUEST'>(initialType);

  useEffect(() => {
    if (isOpen) {
      setProposalType(initialType);
    }
  }, [isOpen, initialType]);

  // ================= COMMON / SHARED STATES =================
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notes, setNotes] = useState('');

  // Live Camera Viewfinder States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');

    try {
      const publicUrl = await uploadItemPhoto(file, proposalType === 'LISTING' ? 'gear' : 'wishes');
      if (proposalType === 'LISTING') {
        setListingImage(publicUrl);
      } else {
        setRequestImage(publicUrl);
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMsg(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const startCamera = async () => {
    setErrorMsg('');
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && cameraInputRef.current) {
      cameraInputRef.current.click();
      return;
    }

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;
        setIsCameraActive(true);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        }, 100);
      } else {
        cameraInputRef.current?.click();
      }
    } catch (err: any) {
      console.warn('Webcam access error, falling back to camera file input:', err);
      cameraInputRef.current?.click();
    }
  };

  const capturePhotoFromCamera = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    stopCamera();
    setIsUploading(true);
    setErrorMsg('');

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setIsUploading(false);
        return;
      }
      try {
        const file = new File([blob], `deal-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const publicUrl = await uploadItemPhoto(file, proposalType === 'LISTING' ? 'gear' : 'wishes');
        if (proposalType === 'LISTING') {
          setListingImage(publicUrl);
        } else {
          setRequestImage(publicUrl);
        }
      } catch (err: any) {
        console.error('Upload error:', err);
        setErrorMsg(err.message || 'Failed to upload captured photo.');
      } finally {
        setIsUploading(false);
      }
    }, 'image/jpeg', 0.9);
  };

  // ================= FORM 1: PERSONAL GEAR LISTING OFFER (DropGearModal Style) =================
  const [listingTitle, setListingTitle] = useState('');
  const [listingCategory, setListingCategory] = useState('Electronics & Tech');
  const [listingCondition, setListingCondition] = useState('Like new');
  const [listingDescription, setListingDescription] = useState('');
  const [listingImage, setListingImage] = useState('');
  const [listingTypeChoice, setListingTypeChoice] = useState<'Rent' | 'Borrow'>('Rent');
  const [listingPricePerDay, setListingPricePerDay] = useState<number | ''>(300);
  const [listingDurationDays, setListingDurationDays] = useState<number>(2);
  const [listingStartDate, setListingStartDate] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return t.toISOString().split('T')[0];
  });
  const [listingOffersDelivery, setListingOffersDelivery] = useState(false);
  const [listingDeliveryFee, setListingDeliveryFee] = useState<number | ''>(0);
  const [listingOffersPickup, setListingOffersPickup] = useState(false);
  const [listingPickupFee, setListingPickupFee] = useState<number | ''>(0);

  // Saved Pickup & Drop Locations
  const savedLocations = getEffectiveSavedLocations(user);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('primary');
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);

  const getCalculatedEndDate = (start: string, days: number): string => {
    try {
      const d = new Date(start);
      d.setDate(d.getDate() + Number(days));
      return d.toISOString().split('T')[0];
    } catch {
      return start;
    }
  };

  const calculatedListingEndDate = getCalculatedEndDate(listingStartDate, listingDurationDays);
  const calculatedListingTotal = listingTypeChoice === 'Borrow'
    ? 0
    : (Number(listingPricePerDay || 0) * listingDurationDays) +
    (listingOffersDelivery ? Number(listingDeliveryFee || 0) : 0) +
    (listingOffersPickup ? Number(listingPickupFee || 0) : 0);

  // ================= FORM 2: PERSONAL BORROW REQUEST (DropWishModal Style) =================
  const [requestItemName, setRequestItemName] = useState('');
  const [requestCategory, setRequestCategory] = useState('Electronics & Tech');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestImage, setRequestImage] = useState('');

  // Dates & Times
  const [requestStartDate, setRequestStartDate] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return t.toISOString().split('T')[0];
  });
  const [requestStartTime, setRequestStartTime] = useState('10:00');
  const [requestEndDate, setRequestEndDate] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() + 3);
    return t.toISOString().split('T')[0];
  });
  const [requestEndTime, setRequestEndTime] = useState('18:00');
  const [requestDurationDays, setRequestDurationDays] = useState<number>(2);
  const [requestOfferedBudget, setRequestOfferedBudget] = useState<number | ''>(500);

  // Toggles for pick up & drop back
  const [requestWillPickup, setRequestWillPickup] = useState<boolean>(true);
  const [requestWillDropBack, setRequestWillDropBack] = useState<boolean>(true);
  const [requestExtraDeliveryFee, setRequestExtraDeliveryFee] = useState<number | ''>('');
  const [requestExtraReturnFee, setRequestExtraReturnFee] = useState<number | ''>('');

  // Destination Location (Where user wants the item to be at)
  const [reqBuildingHouseNo, setReqBuildingHouseNo] = useState('');
  const [reqStreetArea, setReqStreetArea] = useState('');
  const [reqLocality, setReqLocality] = useState(user?.locality || '');
  const [reqPincode, setReqPincode] = useState(user?.pincode || '');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState('');

  // Auto calculate request duration days
  useEffect(() => {
    if (requestStartDate && requestEndDate) {
      try {
        const s = new Date(`${requestStartDate}T${requestStartTime || '10:00'}`);
        const e = new Date(`${requestEndDate}T${requestEndTime || '18:00'}`);
        const diffMs = e.getTime() - s.getTime();
        const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        setRequestDurationDays(days);
      } catch (err) {
        // fallback
      }
    }
  }, [requestStartDate, requestEndDate, requestStartTime, requestEndTime]);

  // Prefill default destination location from user profile for request
  useEffect(() => {
    if (user && isOpen) {
      if (user.address_text && !reqBuildingHouseNo && !reqStreetArea) {
        const parts = user.address_text.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length > 0) {
          setReqBuildingHouseNo(parts[0]);
          if (parts.length > 1) {
            setReqStreetArea(parts.slice(1).join(', '));
          }
        } else {
          setReqStreetArea(user.address_text);
        }
      }
      if (user.locality && !reqLocality) {
        setReqLocality(user.locality);
      }
      if (user.pincode && !reqPincode) {
        setReqPincode(user.pincode);
      }
    }
  }, [user, isOpen]);

  const handleDetectRequestLocation = async () => {
    setIsDetectingLocation(true);
    setErrorMsg('');
    setLocationSuccessMsg('');
    try {
      const loc = await detectCurrentLocation();
      if (loc.address_text) {
        setReqStreetArea(loc.address_text);
      }
      if (loc.locality) {
        setReqLocality(loc.locality);
      }
      if (loc.pincode) {
        setReqPincode(loc.pincode);
      }
      const locSummary = [loc.address_text, loc.locality].filter(Boolean).join(', ') || loc.city || 'Neighborhood location detected';
      setLocationSuccessMsg(`Location detected: ${locSummary}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not fetch current location. Please fill fields manually.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const calculatedRequestTotal = (Number(requestOfferedBudget) || 0) +
    (!requestWillPickup ? Number(requestExtraDeliveryFee || 0) : 0) +
    (!requestWillDropBack ? Number(requestExtraReturnFee || 0) : 0);

  // ================= SUBMISSION HANDLERS =================
  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listingTitle.trim() || listingTitle.trim().length < 3) {
      setErrorMsg('Item title must be at least 3 characters.');
      return;
    }
    if (listingDescription.trim().length < 10) {
      setErrorMsg('Minimum 10 characters are compulsory for the description.');
      return;
    }
    if (!listingImage) {
      setErrorMsg('Please upload a picture of your item or take a photo with your camera.');
      return;
    }
    if (listingTypeChoice === 'Rent' && (listingPricePerDay === '' || Number(listingPricePerDay) <= 0)) {
      setErrorMsg('Please specify a valid daily rental price.');
      return;
    }

    const chosenLocation = savedLocations.find(l => l.id === selectedLocationId) || savedLocations[0];
    const fullLocText = chosenLocation ? formatSavedLocationFull(chosenLocation) : user?.locality || '';

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (listingStartDate < todayStr) {
      setErrorMsg('Start date cannot be in the past. Please select an upcoming date.');
      return;
    }

    let effectiveStartTime = '10:00:00';
    if (listingStartDate === todayStr && '10:00' <= currentHStr) {
      const nextD = new Date();
      nextD.setMinutes(nextD.getMinutes() + 30);
      effectiveStartTime = `${String(nextD.getHours()).padStart(2, '0')}:${String(nextD.getMinutes()).padStart(2, '0')}:00`;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const proposalPayload: MessageProposalData = {
        type: 'LISTING',
        title: listingTitle.trim(),
        description: listingDescription.trim(),
        category: listingCategory,
        price_per_day: listingTypeChoice === 'Borrow' ? 0 : Number(listingPricePerDay || 0),
        total_price: calculatedListingTotal,
        duration_days: Math.max(1, Number(listingDurationDays) || 1),
        start_date: listingStartDate,
        end_date: calculatedListingEndDate,
        start_time: effectiveStartTime,
        end_time: '18:00:00',
        delivery_option: listingOffersDelivery ? 'LENDER_DELIVERY' : 'SELF',
        delivery_fee: listingOffersDelivery ? Number(listingDeliveryFee || 0) : 0,
        collection_option: listingOffersPickup ? 'LENDER_COLLECT' : 'SELF',
        collection_fee: listingOffersPickup ? Number(listingPickupFee || 0) : 0,
        delivery_location: fullLocText,
        return_location: fullLocText,
        notes: notes.trim(),
        image_url: listingImage,
        status: 'PENDING',
      };

      const summary = `Personal Gear Offer: ${listingTitle.trim()} (₹${calculatedListingTotal} for ${listingDurationDays} days)`;

      await onSubmitProposal(proposalPayload, summary);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      onClose();
    } catch (err: any) {
      console.error('Failed to submit listing proposal:', err);
      setErrorMsg(err.message || 'Failed to send personal listing offer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestItemName.trim() || requestItemName.trim().length < 3) {
      setErrorMsg('Item name must be at least 3 characters.');
      return;
    }
    if (requestDescription.trim().length < 10) {
      setErrorMsg('Minimum 10 characters are compulsory for the description.');
      return;
    }
    if (!requestOfferedBudget || Number(requestOfferedBudget) <= 0) {
      setErrorMsg('Please specify a valid offered budget.');
      return;
    }
    if (!reqBuildingHouseNo.trim()) {
      setErrorMsg('Building, Flat or House number is compulsory to save the destination location.');
      return;
    }
    if (!reqLocality.trim()) {
      setErrorMsg('Locality or neighborhood is compulsory.');
      return;
    }

    const fullDestinationAddress = [
      reqBuildingHouseNo.trim(),
      reqStreetArea.trim(),
      reqLocality.trim(),
      reqPincode.trim(),
    ].filter(Boolean).join(', ');

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (requestStartDate < todayStr) {
      setErrorMsg('Start date cannot be in the past. Please select an upcoming date.');
      return;
    }

    if (requestStartDate === todayStr && requestStartTime <= currentHStr) {
      setErrorMsg(`Start time (${requestStartTime}) has already passed for today. Please select an upcoming time.`);
      return;
    }

    if (requestEndDate < requestStartDate) {
      setErrorMsg('Return date cannot be earlier than start date.');
      return;
    }

    if (requestEndDate === requestStartDate && requestEndTime <= requestStartTime) {
      setErrorMsg(`Return time (${requestEndTime}) must be after start time (${requestStartTime}).`);
      return;
    }

    if (requestEndDate === todayStr && requestEndTime <= currentHStr) {
      setErrorMsg(`Return time (${requestEndTime}) has already passed for today. Please select an upcoming time.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const pricePerDay = Math.round(Number(requestOfferedBudget) / Math.max(1, requestDurationDays));

      const proposalPayload: MessageProposalData = {
        type: 'REQUEST',
        title: requestItemName.trim(),
        description: requestDescription.trim(),
        category: requestCategory,
        price_per_day: pricePerDay,
        total_price: calculatedRequestTotal,
        duration_days: requestDurationDays,
        start_date: requestStartDate,
        end_date: requestEndDate,
        start_time: requestStartTime,
        end_time: requestEndTime,
        delivery_option: !requestWillPickup ? 'LENDER_DELIVERY' : 'SELF',
        delivery_fee: !requestWillPickup ? Number(requestExtraDeliveryFee || 0) : 0,
        collection_option: !requestWillDropBack ? 'LENDER_COLLECT' : 'SELF',
        collection_fee: !requestWillDropBack ? Number(requestExtraReturnFee || 0) : 0,
        delivery_location: fullDestinationAddress,
        return_location: fullDestinationAddress,
        notes: notes.trim(),
        image_url: requestImage || undefined,
        status: 'PENDING',
      };

      const summary = `Custom Borrow Request: ${requestItemName.trim()} (Offered Budget: ₹${calculatedRequestTotal} for ${requestDurationDays} days)`;

      await onSubmitProposal(proposalPayload, summary);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      onClose();
    } catch (err: any) {
      console.error('Failed to submit request proposal:', err);
      setErrorMsg(err.message || 'Failed to send personal borrow request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="relative bg-surface rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-divider text-ink flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden file & camera inputs for photo upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* TOP MODAL HEADER */}
        <div className="px-6 py-4 border-b border-divider bg-surface shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                {proposalType === 'LISTING' ? <Package className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-ink font-display tracking-tight">
                  {proposalType === 'LISTING' ? 'Personal Gear Listing Offer' : 'Personal Borrow Request'}
                </h2>
                <p className="text-xs text-ink-secondary">
                  Custom deal specifically for <span className="font-bold text-ink">{partnerName || 'Neighbor'}</span> — all details on a single page
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-canvas text-ink transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* TAB SWITCHER: Offer to Lend vs Request to Borrow */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-canvas rounded-2xl border border-divider mt-3">
            <button
              type="button"
              onClick={() => {
                setProposalType('LISTING');
                setErrorMsg('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${proposalType === 'LISTING'
                ? 'bg-brand text-white shadow-xs'
                : 'text-ink-secondary hover:text-ink'
                }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Offer to Lend (My Gear)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProposalType('REQUEST');
                setErrorMsg('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${proposalType === 'REQUEST'
                ? 'bg-brand text-white shadow-xs'
                : 'text-ink-secondary hover:text-ink'
                }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Request to Borrow</span>
            </button>
          </div>
        </div>

        {/* ERROR MESSAGE DISPLAY */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold animate-in fade-in shrink-0">
            {errorMsg}
          </div>
        )}

        {/* CAMERA VIEWFINDER OVERLAY IF ACTIVE */}
        {isCameraActive && (
          <div className="p-4 mx-6 my-3 bg-canvas rounded-2xl border border-divider space-y-3 shrink-0 animate-in zoom-in-95 duration-150">
            <div className="relative aspect-video w-full max-w-md mx-auto bg-black rounded-xl overflow-hidden shadow-inner">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                Live Camera
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={capturePhotoFromCamera}
                className="btn-primary text-xs px-5 py-2 shadow-pink font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Click Photo</span>
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="btn-secondary text-xs px-4 py-2 cursor-pointer font-bold"
              >
                Cancel Camera
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 1: PERSONAL GEAR LISTING FORM (EXACTLY LIKE DropGearModal)
           ========================================================================= */}
        {proposalType === 'LISTING' && (
          <form id="personal-listing-form" onSubmit={handleSubmitListing} className="p-6 space-y-6 flex-1 overflow-y-auto">
            {/* SECTION 1: Item Details */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary flex items-center gap-1.5">
                <span>1. Item Details</span>
              </h3>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Item Title <span className="text-brand">*</span>
                </label>
                <input
                  type="text"
                  value={listingTitle}
                  onChange={(e) => setListingTitle(e.target.value)}
                  placeholder="e.g. Sony Alpha 7 IV + 24–70mm Lens"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  required
                />
              </div>

              {/* Category & Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Category <span className="text-brand">*</span>
                  </label>
                  <select
                    value={listingCategory}
                    onChange={(e) => setListingCategory(e.target.value)}
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none cursor-pointer"
                  >
                    <option value="Electronics & Tech">Electronics & Tech</option>
                    <option value="Camping & Outdoor">Camping & Outdoor</option>
                    <option value="Tools & DIY">Tools & DIY</option>
                    <option value="Clothing & Fits">Clothing & Fits</option>
                    <option value="Home & Appliances">Home & Appliances</option>
                    <option value="Sports & Fitness">Sports & Fitness</option>
                    <option value="Books & Media">Books & Media</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Condition <span className="text-brand">*</span>
                  </label>
                  <select
                    value={listingCondition}
                    onChange={(e) => setListingCondition(e.target.value)}
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none cursor-pointer"
                  >
                    <option value="Like new">Like new</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                  </select>
                </div>
              </div>

              {/* Description with Compulsory Minimum 10 Characters Notice */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-ink">
                    Description <span className="text-brand">*</span>
                  </label>
                  {listingDescription.trim().length < 10 && (
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full transition-all">
                      Minimum 10 characters compulsory ({listingDescription.trim().length}/10)
                    </span>
                  )}
                </div>
                <textarea
                  value={listingDescription}
                  onChange={(e) => setListingDescription(e.target.value)}
                  placeholder="Be specific about your item, its condition, and included accessories..."
                  rows={3}
                  className={`w-full bg-canvas border rounded-xl p-3 text-xs font-medium text-ink outline-none transition-colors resize-none ${listingDescription.length > 0 && listingDescription.trim().length < 10
                    ? 'border-amber-400 focus:border-amber-500'
                    : 'border-divider focus:border-brand'
                    }`}
                  required
                />
              </div>
            </div>

            {/* SECTION 2: Photo Upload (Exactly like DropGearModal) */}
            <div className="space-y-3 pt-2 border-t border-divider">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
                2. Gear Photo <span className="text-brand">*</span>
              </h3>

              {!isCameraActive && (
                <div>
                  {listingImage ? (
                    <div className="flex items-center gap-4 p-3.5 bg-canvas rounded-2xl border border-divider">
                      <div className="w-20 h-20 rounded-xl overflow-hidden border border-divider shrink-0 relative group">
                        <img
                          src={listingImage}
                          alt="Item preview"
                          className="w-full h-full object-cover"
                        />
                        {isUploading && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                            <Loader2 className="w-5 h-5 animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Photo attached successfully</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="px-3 py-1 rounded-full border border-divider hover:bg-surface text-xs font-bold text-ink cursor-pointer inline-flex items-center gap-1 transition-colors"
                          >
                            <Upload className="w-3 h-3 text-brand" />
                            <span>Change Photo</span>
                          </button>
                          <button
                            type="button"
                            onClick={startCamera}
                            disabled={isUploading}
                            className="px-3 py-1 rounded-full border border-divider hover:bg-surface text-xs font-bold text-ink cursor-pointer inline-flex items-center gap-1 transition-colors"
                          >
                            <Camera className="w-3 h-3 text-brand" />
                            <span>Click New Photo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setListingImage('')}
                            className="px-2.5 py-1 rounded-full hover:bg-rose-500/10 text-rose-500 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 border-2 border-dashed border-divider rounded-2xl bg-canvas/40 text-center space-y-3">
                      {isUploading ? (
                        <div className="py-6 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-8 h-8 text-brand animate-spin" />
                          <span className="text-xs font-bold text-ink">Uploading photo...</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto shadow-inner">
                            <Camera className="w-6 h-6 stroke-[1.8]" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-ink">
                              Add a picture of your item
                            </p>
                            <p className="text-[11px] text-ink-secondary max-w-sm mx-auto">
                              Upload from your device storage or snap a picture right now with your camera.
                            </p>
                          </div>
                          <div className="flex items-center justify-center gap-2.5 pt-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="btn-secondary text-xs px-4 py-2 font-bold cursor-pointer inline-flex items-center gap-1.5 hover:border-brand hover:text-brand transition-colors"
                            >
                              <Upload className="w-3.5 h-3.5 text-brand" />
                              <span>Upload from Computer / Phone</span>
                            </button>
                            <button
                              type="button"
                              onClick={startCamera}
                              className="btn-secondary text-xs px-4 py-2 font-bold cursor-pointer inline-flex items-center gap-1.5 hover:border-brand hover:text-brand transition-colors"
                            >
                              <Camera className="w-3.5 h-3.5 text-brand" />
                              <span>Take Photo with Camera</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 3: Pricing & Rental Terms */}
            <div className="space-y-4 pt-2 border-t border-divider">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
                3. Pricing & Rental Terms
              </h3>

              {/* Listing Type Toggle */}
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => setListingTypeChoice('Rent')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${listingTypeChoice === 'Rent'
                    ? 'border-brand bg-brand-soft/30 text-ink shadow-xs ring-1 ring-brand'
                    : 'border-divider bg-canvas text-ink-secondary hover:text-ink'
                    }`}
                >
                  <div className="text-xs font-black">Rent for Fee</div>
                  <div className="text-[11px] text-ink-secondary">Set a daily price</div>
                </button>

                <button
                  type="button"
                  onClick={() => setListingTypeChoice('Borrow')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${listingTypeChoice === 'Borrow'
                    ? 'border-brand bg-brand-soft/30 text-ink shadow-xs ring-1 ring-brand'
                    : 'border-divider bg-canvas text-ink-secondary hover:text-ink'
                    }`}
                >
                  <div className="text-xs font-black">Free Community Sharing</div>
                  <div className="text-[11px] text-ink-secondary">Lend to neighbor for free</div>
                </button>
              </div>

              {/* Price & Schedule Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {listingTypeChoice === 'Rent' ? (
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">
                      Price per day (₹) <span className="text-brand">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 300"
                      value={listingPricePerDay}
                      onChange={(e) => setListingPricePerDay(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Price per day</label>
                    <div className="w-full bg-canvas/60 border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      ₹0 (Free community share)
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Rental Duration (Days) <span className="text-brand">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={listingDurationDays}
                    onChange={(e) => setListingDurationDays(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                    required
                  />
                </div>
              </div>

              {/* Rental Schedule Dates */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand" />
                    <span>Agreed Schedule Dates</span>
                  </span>
                  <span className="text-[11px] font-extrabold text-brand bg-brand-soft px-2.5 py-0.5 rounded-full border border-brand/20">
                    {listingDurationDays} {listingDurationDays === 1 ? 'Day' : 'Days'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-ink-secondary mb-1">Start Date</label>
                    <input
                      type="date"
                      value={listingStartDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setListingStartDate(e.target.value)}
                      className="w-full bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-ink-secondary mb-1">Scheduled Return Date</label>
                    <div className="w-full bg-surface/60 border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink">
                      {calculatedListingEndDate}
                    </div>
                  </div>
                </div>
              </div>

              {/* Handover & Delivery Options by Owner */}
              <div className="space-y-3 pt-3 border-t border-divider">
                <div>
                  <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <span>Delivery & Return Collection</span>
                  </h4>
                  <p className="text-[11px] text-ink-secondary">
                    Choose if you will deliver to the renter or collect the gear on return, plus any charges.
                  </p>
                </div>

                {/* Option 1: Delivery by Owner */}
                <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink">I will deliver to the renter</span>
                        {listingOffersDelivery && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            Ready to Deliver
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-ink-secondary">
                        Toggle ON if you are willing to deliver the product to {partnerName}.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setListingOffersDelivery(!listingOffersDelivery)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${listingOffersDelivery ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                      role="switch"
                      aria-checked={listingOffersDelivery}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${listingOffersDelivery ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>

                  {listingOffersDelivery && (
                    <div className="pt-2 border-t border-divider/60 flex items-center justify-between gap-3 animate-in fade-in">
                      <div>
                        <label className="text-xs font-bold text-ink block">Delivery Fee (₹)</label>
                        <span className="text-[10px] text-ink-secondary">Set ₹0 for free delivery or your delivery charge</span>
                      </div>
                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-secondary">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={listingDeliveryFee}
                          onChange={(e) => setListingDeliveryFee(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                          placeholder="0"
                          className="w-full bg-surface border border-divider rounded-xl pl-7 pr-3 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Option 2: Pickup by Owner upon return */}
                <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink">I will pick up / collect myself on return</span>
                        {listingOffersPickup && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            Ready to Collect
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-ink-secondary">
                        Toggle ON if you will collect the product from {partnerName} when rental ends.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setListingOffersPickup(!listingOffersPickup)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${listingOffersPickup ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                      role="switch"
                      aria-checked={listingOffersPickup}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${listingOffersPickup ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>

                  {listingOffersPickup && (
                    <div className="pt-2 border-t border-divider/60 flex items-center justify-between gap-3 animate-in fade-in">
                      <div>
                        <label className="text-xs font-bold text-ink block">Return Collection Fee (₹)</label>
                        <span className="text-[10px] text-ink-secondary">Set ₹0 for free collection or your pickup charge</span>
                      </div>
                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-secondary">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={listingPickupFee}
                          onChange={(e) => setListingPickupFee(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                          placeholder="0"
                          className="w-full bg-surface border border-divider rounded-xl pl-7 pr-3 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 4: Pickup & Drop Location (Exactly like DropGearModal) */}
            <div className="space-y-3 pt-2 border-t border-divider">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-brand" />
                    <span>4. Pickup & Drop Location</span>
                    <span className="text-brand">*</span>
                  </h3>
                  <p className="text-[11px] text-ink-secondary mt-0.5">
                    Choose where the renter will pick up the item and drop it back upon return.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddLocationOpen(true)}
                  className="btn-primary text-[11px] font-bold px-3 py-1.5 shadow-pink cursor-pointer inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Another Location</span>
                </button>
              </div>

              {/* List of Saved Locations in User's Profile */}
              <div className="space-y-2.5">
                {savedLocations.map((loc) => {
                  const isSelected = selectedLocationId === loc.id;
                  const formattedFull = formatSavedLocationFull(loc);
                  return (
                    <div
                      key={loc.id}
                      onClick={() => setSelectedLocationId(loc.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${isSelected
                        ? 'bg-brand/5 border-brand ring-1 ring-brand/20 shadow-xs'
                        : 'bg-canvas border-divider hover:border-brand/40'
                        }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${isSelected ? 'border-brand bg-brand' : 'border-divider bg-surface'
                        }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-ink">{loc.label}</span>
                          {loc.is_default && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-soft text-brand border border-brand/20">
                              Profile Primary
                            </span>
                          )}
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <Check className="w-2.5 h-2.5" /> Selected for this offer
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-ink-secondary mt-1 font-medium leading-relaxed">
                          <MapPin className="w-3.5 h-3.5 text-brand inline shrink-0 mr-1 -mt-0.5" />
                          <span>{formattedFull}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Deal Notes */}
            <div className="space-y-1.5 pt-2 border-t border-divider">
              <label className="block text-xs font-bold text-ink">
                Agreed Specifications & Inclusions (Notes)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Includes 2 extra batteries, charger, and 128GB high-speed memory card. Return charged."
                className="w-full bg-canvas border border-divider rounded-xl p-3 text-xs text-ink outline-none focus:border-brand font-medium resize-none placeholder:text-ink-muted"
              />
            </div>

            {/* Cost Summary Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-brand/10 to-brand/5 border border-brand/20 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-ink-secondary block font-semibold">Total Deal Value</span>
                <span className="text-xs font-black text-ink font-display">
                  {listingDurationDays} days @ ₹{listingTypeChoice === 'Borrow' ? 0 : listingPricePerDay}/day
                  {listingOffersDelivery && Number(listingDeliveryFee) > 0 && ` + ₹${listingDeliveryFee} delivery`}
                  {listingOffersPickup && Number(listingPickupFee) > 0 && ` + ₹${listingPickupFee} collection`}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-brand font-display block">
                  ₹{calculatedListingTotal}
                </span>
              </div>
            </div>
          </form>
        )}

        {/* =========================================================================
            TAB 2: PERSONAL BORROW REQUEST FORM (EXACTLY LIKE DropWishModal)
           ========================================================================= */}
        {proposalType === 'REQUEST' && (
          <form id="personal-request-form" onSubmit={handleSubmitRequest} className="p-6 space-y-6 flex-1 overflow-y-auto">
            {/* SECTION 1: What do you need? */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary flex items-center gap-1.5">
                <span>1. What do you need?</span>
              </h3>

              {/* Item Name */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Item Needed <span className="text-brand">*</span>
                </label>
                <input
                  type="text"
                  value={requestItemName}
                  onChange={(e) => setRequestItemName(e.target.value)}
                  placeholder="e.g. 4-Person Camping Tent with Sleeping Bags"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Category <span className="text-brand">*</span>
                </label>
                <select
                  value={requestCategory}
                  onChange={(e) => setRequestCategory(e.target.value)}
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none cursor-pointer"
                >
                  <option value="Electronics & Tech">Electronics & Tech</option>
                  <option value="Camping & Outdoor">Camping & Outdoor</option>
                  <option value="Tools & DIY">Tools & DIY</option>
                  <option value="Clothing & Fits">Clothing & Fits</option>
                  <option value="Home & Appliances">Home & Appliances</option>
                  <option value="Sports & Fitness">Sports & Fitness</option>
                  <option value="Books & Media">Books & Media</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-ink">
                    Description <span className="text-brand">*</span>
                  </label>
                  {requestDescription.trim().length < 10 && (
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full transition-all">
                      Minimum 10 characters compulsory ({requestDescription.trim().length}/10)
                    </span>
                  )}
                </div>
                <textarea
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  placeholder="Describe exactly what gear model, accessories, or specifications you need..."
                  rows={3}
                  className={`w-full bg-canvas border rounded-xl p-3 text-xs font-medium text-ink outline-none transition-colors resize-none ${requestDescription.length > 0 && requestDescription.trim().length < 10
                    ? 'border-amber-400 focus:border-amber-500'
                    : 'border-divider focus:border-brand'
                    }`}
                  required
                />
              </div>
            </div>

            {/* SECTION 2: Reference Photo (Optional) */}
            <div className="space-y-3 pt-2 border-t border-divider">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
                  2. Reference Photo (Optional)
                </h3>
                <span className="text-[10px] text-ink-secondary font-semibold">Optional</span>
              </div>

              {!isCameraActive && (
                <div>
                  {requestImage ? (
                    <div className="flex items-center gap-4 p-3.5 bg-canvas rounded-2xl border border-divider">
                      <div className="w-20 h-20 rounded-xl overflow-hidden border border-divider shrink-0 relative group">
                        <img
                          src={requestImage}
                          alt="Request preview"
                          className="w-full h-full object-cover"
                        />
                        {isUploading && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                            <Loader2 className="w-5 h-5 animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Reference photo attached</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="px-3 py-1 rounded-full border border-divider hover:bg-surface text-xs font-bold text-ink cursor-pointer inline-flex items-center gap-1 transition-colors"
                          >
                            <Upload className="w-3 h-3 text-brand" />
                            <span>Change Photo</span>
                          </button>
                          <button
                            type="button"
                            onClick={startCamera}
                            disabled={isUploading}
                            className="px-3 py-1 rounded-full border border-divider hover:bg-surface text-xs font-bold text-ink cursor-pointer inline-flex items-center gap-1 transition-colors"
                          >
                            <Camera className="w-3 h-3 text-brand" />
                            <span>Click New Photo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRequestImage('')}
                            className="px-2.5 py-1 rounded-full hover:bg-rose-500/10 text-rose-500 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border border-divider rounded-2xl bg-canvas/40 flex items-center justify-between gap-3 flex-wrap">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-ink">Have a photo of what you want?</p>
                        <p className="text-[11px] text-ink-secondary">Upload an image or take a quick photo for reference.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="btn-secondary text-xs px-3 py-1.5 font-bold cursor-pointer inline-flex items-center gap-1 hover:border-brand"
                        >
                          <Upload className="w-3 h-3 text-brand" />
                          <span>Upload</span>
                        </button>
                        <button
                          type="button"
                          onClick={startCamera}
                          className="btn-secondary text-xs px-3 py-1.5 font-bold cursor-pointer inline-flex items-center gap-1 hover:border-brand"
                        >
                          <Camera className="w-3 h-3 text-brand" />
                          <span>Camera</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 3: Rental Schedule & Offered Budget (Exactly like DropWishModal) */}
            <div className="space-y-4 pt-2 border-t border-divider">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
                3. Rental Schedule & Offered Budget
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Start Date & Time */}
                <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-2">
                  <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand" />
                    <span>Needed From (Start Date & Time) *</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={requestStartDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setRequestStartDate(e.target.value)}
                      className="w-full bg-surface border border-divider rounded-xl px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                      required
                    />
                    <input
                      type="time"
                      value={requestStartTime}
                      onChange={(e) => setRequestStartTime(e.target.value)}
                      className="w-full bg-surface border border-divider rounded-xl px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                      required
                    />
                  </div>
                </div>

                {/* Return Date & Time */}
                <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-2">
                  <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand" />
                    <span>When will you return it? *</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={requestEndDate}
                      min={requestStartDate || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setRequestEndDate(e.target.value)}
                      className="w-full bg-surface border border-divider rounded-xl px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                      required
                    />
                    <input
                      type="time"
                      value={requestEndTime}
                      onChange={(e) => setRequestEndTime(e.target.value)}
                      className="w-full bg-surface border border-divider rounded-xl px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Offered Budget */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-ink">
                    Your Offered Budget (₹) <span className="text-brand">*</span>
                  </label>
                  <span className="text-[11px] font-extrabold text-brand bg-brand-soft px-2.5 py-0.5 rounded-full border border-brand/20">
                    {requestDurationDays} {requestDurationDays === 1 ? 'Day' : 'Days'} Duration
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-secondary">₹</span>
                  <input
                    type="number"
                    min="1"
                    value={requestOfferedBudget}
                    onChange={(e) => setRequestOfferedBudget(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                    placeholder="e.g. 500"
                    className="w-full bg-surface border border-divider rounded-xl pl-8 pr-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                    required
                  />
                </div>
                <p className="text-[11px] text-ink-secondary">
                  Total rental budget offered to {partnerName} for the full {requestDurationDays} days.
                </p>
              </div>
            </div>

            {/* SECTION 4: Pickup & Return Logistics (Toggles & Extra Fee) */}
            <div className="space-y-3 pt-2 border-t border-divider">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
                4. Pickup & Return Logistics
              </h3>

              {/* Pickup Toggle */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink">I will pick up the item myself</span>
                      {requestWillPickup && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Self-Pickup
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-secondary">
                      Toggle OFF if you want {partnerName} to deliver to your location.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRequestWillPickup(!requestWillPickup)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${requestWillPickup ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-700'
                      }`}
                    role="switch"
                    aria-checked={requestWillPickup}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${requestWillPickup ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {!requestWillPickup && (
                  <div className="pt-2 border-t border-divider/60 flex items-center justify-between gap-3 animate-in fade-in">
                    <div>
                      <label className="text-xs font-bold text-ink block">Extra Fee for Delivery (₹)</label>
                      <span className="text-[10px] text-ink-secondary">Extra compensation to {partnerName} for delivering to you</span>
                    </div>
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-secondary">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={requestExtraDeliveryFee}
                        onChange={(e) => setRequestExtraDeliveryFee(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                        placeholder="e.g. 100"
                        className="w-full bg-surface border border-divider rounded-xl pl-7 pr-3 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Return Toggle */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink">I will drop / return the item myself</span>
                      {requestWillDropBack && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Self-Return
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-secondary">
                      Toggle OFF if you want {partnerName} to collect the gear from your location upon return.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRequestWillDropBack(!requestWillDropBack)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${requestWillDropBack ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-700'
                      }`}
                    role="switch"
                    aria-checked={requestWillDropBack}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${requestWillDropBack ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {!requestWillDropBack && (
                  <div className="pt-2 border-t border-divider/60 flex items-center justify-between gap-3 animate-in fade-in">
                    <div>
                      <label className="text-xs font-bold text-ink block">Extra Fee for Return Pickup (₹)</label>
                      <span className="text-[10px] text-ink-secondary">Extra compensation to {partnerName} for return collection</span>
                    </div>
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-secondary">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={requestExtraReturnFee}
                        onChange={(e) => setRequestExtraReturnFee(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                        placeholder="e.g. 100"
                        className="w-full bg-surface border border-divider rounded-xl pl-7 pr-3 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 5: Destination Location (Where user wants item to be at - exactly like DropWishModal) */}
            <div className="space-y-3 pt-2 border-t border-divider">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-brand" />
                    <span>5. Destination Location</span>
                    <span className="text-brand">*</span>
                  </h3>
                  <p className="text-[11px] text-ink-secondary mt-0.5">
                    Enter the exact address where you want the gear to be at.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDetectRequestLocation}
                  disabled={isDetectingLocation}
                  className="btn-primary text-[11px] font-bold px-3 py-1.5 shadow-pink cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  {isDetectingLocation ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Navigation className="w-3 h-3" />
                  )}
                  <span>Use My Location</span>
                </button>
              </div>

              {locationSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-in fade-in flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{locationSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Building / Flat / House No (Compulsory) */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-ink">
                      Building / Flat / House No. <span className="text-brand">*</span>
                    </label>
                    <span className="text-[10px] font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-full">
                      Compulsory
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={reqBuildingHouseNo}
                    onChange={(e) => setReqBuildingHouseNo(e.target.value)}
                    placeholder="e.g. Flat 402, Oakwood Heights / House #12"
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  />
                </div>

                {/* Street / Road / Landmark */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Street / Road / Landmark
                  </label>
                  <input
                    type="text"
                    value={reqStreetArea}
                    onChange={(e) => setReqStreetArea(e.target.value)}
                    placeholder="e.g. 100ft Road, Near Metro Station"
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  />
                </div>

                {/* Locality / Neighborhood */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Locality / Neighborhood <span className="text-brand">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={reqLocality}
                    onChange={(e) => setReqLocality(e.target.value)}
                    placeholder="e.g. Indiranagar, Bengaluru"
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  />
                </div>

                {/* PIN / Postal Code */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-ink mb-1">
                    PIN / Postal Code
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={reqPincode}
                    onChange={(e) => setReqPincode(e.target.value)}
                    placeholder="e.g. 560038"
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  />
                </div>
              </div>
            </div>

            {/* Custom Notes */}
            <div className="space-y-1.5 pt-2 border-t border-divider">
              <label className="block text-xs font-bold text-ink">
                Agreed Specifications & Inclusions (Notes)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Need for a weekend video shoot. Will return fully charged and cleaned."
                className="w-full bg-canvas border border-divider rounded-xl p-3 text-xs text-ink outline-none focus:border-brand font-medium resize-none placeholder:text-ink-muted"
              />
            </div>

            {/* Cost Summary Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-brand/10 to-brand/5 border border-brand/20 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-ink-secondary block font-semibold">Total Offered Deal Value</span>
                <span className="text-xs font-black text-ink font-display">
                  {requestDurationDays} days rental
                  {!requestWillPickup && Number(requestExtraDeliveryFee) > 0 && ` + ₹${requestExtraDeliveryFee} delivery`}
                  {!requestWillDropBack && Number(requestExtraReturnFee) > 0 && ` + ₹${requestExtraReturnFee} return`}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-brand font-display block">
                  ₹{calculatedRequestTotal}
                </span>
              </div>
            </div>
          </form>
        )}

        {/* CLEAN NON-OVERLAPPING FIXED FOOTER */}
        <div className="px-6 py-4 border-t border-divider bg-surface shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-secondary text-xs px-5 py-2.5 cursor-pointer font-bold"
          >
            Cancel
          </button>

          {proposalType === 'LISTING' ? (
            <button
              type="submit"
              form="personal-listing-form"
              disabled={isSubmitting || isUploading}
              className="btn-primary text-xs px-6 py-2.5 shadow-pink cursor-pointer inline-flex items-center gap-2 font-bold disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Offer...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 stroke-[2.5]" />
                  <span>Send Listing Offer (₹{calculatedListingTotal})</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="submit"
              form="personal-request-form"
              disabled={isSubmitting || isUploading}
              className="btn-primary text-xs px-6 py-2.5 shadow-pink cursor-pointer inline-flex items-center gap-2 font-bold disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Request...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Borrow Request (₹{calculatedRequestTotal})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Add Location Modal for adding another location from profile */}
      <AddLocationModal
        isOpen={isAddLocationOpen}
        onClose={() => setIsAddLocationOpen(false)}
        onSuccess={(newLoc) => {
          setSelectedLocationId(newLoc.id);
        }}
      />
    </div>
  );
};
