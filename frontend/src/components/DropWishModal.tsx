import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  Loader2,
  Navigation,
  Sparkles,
  MapPin,
  Trash2,
  RefreshCw,
  Megaphone,
  Calendar,
  Clock,
  ArrowRight,
  Truck,
  CheckCircle2,
  Compass,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { uploadItemPhoto } from '../lib/supabase';
import { detectCurrentLocation, getEffectiveSavedLocations, formatSavedLocationFull } from '../lib/location';

interface DropWishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onOpenAuth: () => void;
}

export const DropWishModal: React.FC<DropWishModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenAuth,
}) => {
  const { user, isAuthenticated } = useAuth();
  const savedLocations = getEffectiveSavedLocations(user);

  // Tomorrow for default start date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultStartDate = tomorrow.toISOString().split('T')[0];

  // 3 days later for default return date
  const threeDaysLater = new Date();
  threeDaysLater.setDate(threeDaysLater.getDate() + 4);
  const defaultEndDate = threeDaysLater.toISOString().split('T')[0];

  // Form Fields - Item Details
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics & Tech');
  const [imageUrl, setImageUrl] = useState('');

  // Form Fields - Rental Dates & Return Timeline
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [endTime, setEndTime] = useState('18:00');
  const [durationDays, setDurationDays] = useState<number>(3);
  const [offeredAmount, setOfferedAmount] = useState<number | ''>('');

  // Form Fields - Pickup & Drop-off Toggles & Extra Fee
  const [willPickup, setWillPickup] = useState<boolean>(true);
  const [willDropBack, setWillDropBack] = useState<boolean>(true);
  const [deliveryFee, setDeliveryFee] = useState<number | ''>('');

  // Form Fields - Exact Destination Location (Where user wants the item to be at)
  const [buildingHouseNo, setBuildingHouseNo] = useState('');
  const [streetArea, setStreetArea] = useState('');
  const [locality, setLocality] = useState(user?.locality || '');
  const [pincode, setPincode] = useState(user?.pincode || '');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState('');

  // States
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Live Camera Viewfinder States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // File & Camera input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Automatically calculate duration days based on start and return dates
  useEffect(() => {
    if (startDate && endDate) {
      try {
        const [sY, sM, sD] = startDate.split('-').map(Number);
        const [eY, eM, eD] = endDate.split('-').map(Number);
        if (sY && sM && sD && eY && eM && eD) {
          const sUtc = Date.UTC(sY, sM - 1, sD);
          const eUtc = Date.UTC(eY, eM - 1, eD);
          const calDiff = Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24));
          const days = Math.max(1, calDiff);
          setDurationDays(days);
        }
      } catch (err) {
        // Fallback
      }
    }
  }, [startDate, endDate]);

  // Clean stopCamera defined before any early return to prevent TDZ
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Stop camera when closing modal
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Prefill default destination location from user profile
  useEffect(() => {
    if (user && isOpen) {
      if (user.address_text && !buildingHouseNo && !streetArea) {
        const parts = user.address_text.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length > 0) {
          setBuildingHouseNo(parts[0]);
          if (parts.length > 1) {
            setStreetArea(parts.slice(1).join(', '));
          }
        } else {
          setStreetArea(user.address_text);
        }
      }
      if (user.locality && !locality) {
        setLocality(user.locality);
      }
      if (user.pincode && !pincode) {
        setPincode(user.pincode);
      }
    }
  }, [user, isOpen]);

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setErrorMsg('');
    setLocationSuccessMsg('');

    try {
      const loc = await detectCurrentLocation();
      // Keep buildingHouseNo intact so user can keep their building/flat
      if (loc.address_text) {
        setStreetArea(loc.address_text);
      }
      if (loc.locality) {
        setLocality(loc.locality);
      }
      if (loc.pincode) {
        setPincode(loc.pincode);
      }
      if (loc.latitude && loc.longitude) {
        setCoords({ latitude: loc.latitude, longitude: loc.longitude });
      }
      const locSummary = [loc.address_text, loc.locality].filter(Boolean).join(', ') || loc.city || 'Neighborhood location detected';
      setLocationSuccessMsg(`Location detected: ${locSummary}`);
      try {
        confetti({ particleCount: 25, spread: 50, origin: { y: 0.6 } });
      } catch { }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not detect GPS location. Please type your address manually.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');

    try {
      const publicUrl = await uploadItemPhoto(file, 'requests');
      setImageUrl(publicUrl);
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
        const file = new File([blob], `request-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const publicUrl = await uploadItemPhoto(file, 'requests');
        setImageUrl(publicUrl);
      } catch (err: any) {
        console.error('Upload error:', err);
        setErrorMsg(err.message || 'Failed to upload captured photo. Please try again.');
      } finally {
        setIsUploading(false);
      }
    }, 'image/jpeg', 0.9);
  };

  const descTrimmed = description.trim();
  const isDescTooShort = descTrimmed.length < 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }

    if (!itemName.trim() || itemName.trim().length < 3) {
      setErrorMsg('Item name must be at least 3 characters.');
      return;
    }

    if (isDescTooShort) {
      setErrorMsg('Minimum 10 characters are compulsory for the description.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg('Return date cannot be earlier than needed date.');
      return;
    }

    if (offeredAmount === '' || Number(offeredAmount) < 0) {
      setErrorMsg('Please specify a valid offered budget.');
      return;
    }

    const trimmedBuilding = buildingHouseNo.trim();
    if (!trimmedBuilding) {
      setErrorMsg('Building / Flat / House No. is compulsory. Please enter your building or flat number where you want the item.');
      return;
    }

    if (!locality.trim()) {
      setErrorMsg('Locality / Neighborhood is compulsory. Please enter the locality where you want the item.');
      return;
    }

    if ((!willPickup || !willDropBack) && (deliveryFee === '' || Number(deliveryFee) < 0)) {
      setErrorMsg('Please write down the extra amount you will pay to someone who will pick and drop the item for you.');
      return;
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (startDate < todayStr) {
      setErrorMsg('Start date cannot be in the past. Please select an upcoming date.');
      return;
    }

    if (startDate === todayStr && startTime <= currentHStr) {
      setErrorMsg(`Pickup time (${startTime}) has already passed for today. Please select an upcoming time.`);
      return;
    }

    if (endDate && endDate < startDate) {
      setErrorMsg('Return date cannot be earlier than start date.');
      return;
    }

    if (endDate && endDate === startDate && endTime && endTime <= startTime) {
      setErrorMsg(`Return time (${endTime}) must be after pickup time (${startTime}).`);
      return;
    }

    if (endDate && endDate === todayStr && endTime && endTime <= currentHStr) {
      setErrorMsg(`Return time (${endTime}) has already passed for today. Please select an upcoming time.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const fullDestinationAddress = [trimmedBuilding, streetArea.trim()].filter(Boolean).join(', ');
      const extraFeeNumber = (!willPickup || !willDropBack) ? Number(deliveryFee || 0) : 0;
      const finalLat = coords?.latitude ?? (user?.latitude ? Number(user.latitude) : undefined);
      const finalLon = coords?.longitude ?? (user?.longitude ? Number(user.longitude) : undefined);

      await api.createRequest({
        item_name: itemName.trim(),
        description: description.trim(),
        category,
        start_date: startDate,
        start_time: startTime,
        end_date: endDate,
        end_time: endTime,
        duration_days: durationDays,
        offered_amount: Number(offeredAmount || 0),
        locality: locality.trim(),
        address_text: fullDestinationAddress,
        pincode: pincode.trim() || undefined,
        latitude: finalLat,
        longitude: finalLon,
        will_pickup: willPickup,
        will_drop_back: willDropBack,
        delivery_fee: extraFeeNumber,
        pickup_type: willPickup ? 'LENDER_LOCATION' : 'MY_LOCATION',
        pickup_locality: willPickup ? 'Lender Location' : fullDestinationAddress,
        return_type: willDropBack ? 'LENDER_LOCATION' : 'MY_LOCATION',
        return_locality: willDropBack ? 'Lender Location' : fullDestinationAddress,
        image_url: imageUrl || undefined,
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to post request:', err);
      setErrorMsg(err.message || 'Failed to post request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="relative bg-surface rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-divider text-ink flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-surface shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5 fill-brand text-brand" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-ink font-display tracking-tight">
                Post a Request
              </h2>
              <p className="text-xs text-ink-secondary">
                All details on a single page — define when you need it, when you'll return it, and handover locations.
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

        {/* Single-Page Scrollable Form Body */}
        <form id="drop-wish-form" onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold animate-in fade-in">
              {errorMsg}
            </div>
          )}

          {/* SECTION 1: Item Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary flex items-center gap-1.5">
              <span>1. What item do you need?</span>
            </h3>

            {/* Item Name */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Item Name <span className="text-brand">*</span>
              </label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Sony A7 IV Camera or Camping Tent"
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
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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

            {/* Description with Compulsory Minimum 10 Characters Notice */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-ink">
                  Description <span className="text-brand">*</span>
                </label>
                {isDescTooShort && (
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 animate-in fade-in">
                    Minimum 10 characters compulsory ({descTrimmed.length}/10)
                  </span>
                )}
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Be specific about what you need, preferred model, condition, or what you'll use it for..."
                rows={3}
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-medium text-ink outline-none focus:border-brand resize-none"
                required
              />
            </div>
          </div>

          {/* SECTION 2: Reference Photo */}
          <div className="space-y-3 pt-2 border-t border-divider">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
                2. Reference Photo <span className="text-ink-secondary font-normal lowercase">(optional)</span>
              </h3>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-xs font-bold text-red-500 hover:text-red-600 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>

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

            {/* Live Camera Viewfinder */}
            {isCameraActive && (
              <div className="relative rounded-2xl overflow-hidden bg-black border border-divider shadow-inner p-2">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 object-cover rounded-xl"
                />
                <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={capturePhotoFromCamera}
                    className="px-5 py-2.5 rounded-full bg-brand hover:bg-brand/90 text-white text-xs font-extrabold shadow-lg cursor-pointer inline-flex items-center gap-2 active:scale-95 transition-transform"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Click Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2.5 rounded-full bg-surface/90 hover:bg-surface text-ink text-xs font-bold shadow-lg cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Image Preview */}
            {!isCameraActive && imageUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-divider bg-canvas p-3 flex items-center gap-4">
                <img
                  src={imageUrl}
                  alt="Reference Preview"
                  className="w-24 h-24 object-cover rounded-xl border border-divider shrink-0"
                />
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Picture Attached</span>
                  </div>
                  <p className="text-[11px] text-ink-secondary">
                    Your photo helps community members identify the exact model or condition.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-bold text-brand hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Change Picture</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Upload Buttons */}
            {!isCameraActive && !imageUrl && (
              <div className="border-2 border-dashed border-divider hover:border-brand/40 rounded-2xl p-5 text-center transition-colors bg-canvas/40">
                {isUploading ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-brand animate-spin" />
                    <span className="text-xs font-bold text-ink">Uploading photo...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-brand-soft text-brand flex items-center justify-center mx-auto">
                      <Camera className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-ink">Add a picture of what you want</h4>
                      <p className="text-[11px] text-ink-secondary mt-0.5">
                        Upload from your device storage or snap a picture right now with your camera.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 rounded-xl bg-surface border border-divider hover:border-brand hover:text-brand text-xs font-bold text-ink shadow-xs cursor-pointer inline-flex items-center gap-2 transition-all active:scale-95"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload from Computer / Phone</span>
                      </button>

                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-2 rounded-xl bg-surface border border-divider hover:border-brand hover:text-brand text-xs font-bold text-ink shadow-xs cursor-pointer inline-flex items-center gap-2 transition-all active:scale-95"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Take Photo with Camera</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: WHEN DO YOU NEED IT & RETURN SCHEDULE */}
          <div className="space-y-4 pt-2 border-t border-divider">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary flex items-center justify-between">
              <span>3. Rental Dates & Return Timeline</span>
              <span className="text-[11px] font-bold text-brand bg-brand-soft px-2.5 py-0.5 rounded-full">
                {durationDays} {durationDays === 1 ? 'Day' : 'Days'} Rental
              </span>
            </h3>

            {/* Start and Return Dates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Start / Handover Date & Time */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-ink">
                    <Calendar className="w-4 h-4 text-brand" />
                    <span>Needed From *</span>
                  </div>
                  <div className="text-[10px] font-bold text-brand flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Pickup Time</span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch { }
                    }}
                    className="col-span-7 bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none focus:border-brand cursor-pointer [color-scheme:dark]"
                    required
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch { }
                    }}
                    className="col-span-5 bg-surface border border-divider rounded-xl px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-brand cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>

                {/* Quick start time presets */}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {['09:00', '10:00', '12:00', '16:00', '18:00'].map((t) => {
                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    const isStartToday = startDate === todayStr;
                    const isPast = isStartToday && t <= currentHourMin;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={isPast}
                        onClick={() => !isPast && setStartTime(t)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border transition-all ${
                          isPast
                            ? 'opacity-30 cursor-not-allowed bg-zinc-800/40 border-zinc-700/40 text-zinc-500 line-through pointer-events-none'
                            : startTime === t
                            ? 'bg-brand text-white border-brand shadow-xs cursor-pointer'
                            : 'bg-surface border-divider text-ink-secondary hover:text-ink hover:border-brand/40 cursor-pointer'
                        }`}
                        title={isPast ? 'This time has already passed today' : undefined}
                      >
                        {t.startsWith('0') ? t.slice(1) : t} {parseInt(t) < 12 ? 'AM' : 'PM'} {isPast ? '(Passed)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* End / Return Date & Time */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-ink">
                    <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>When will you return it? *</span>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Return Time</span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="date"
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch { }
                    }}
                    className="col-span-7 bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none focus:border-brand cursor-pointer [color-scheme:dark]"
                    required
                  />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch { }
                    }}
                    className="col-span-5 bg-surface border border-divider rounded-xl px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-brand cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>

                {/* Quick return time presets */}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {['11:00', '14:00', '18:00', '20:00', '21:30'].map((t) => {
                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    const isEndToday = endDate === todayStr;
                    const isPast = (isEndToday && t <= currentHourMin) || (startDate === endDate && t <= startTime);
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={isPast}
                        onClick={() => !isPast && setEndTime(t)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border transition-all ${
                          isPast
                            ? 'opacity-30 cursor-not-allowed bg-zinc-800/40 border-zinc-700/40 text-zinc-500 line-through pointer-events-none'
                            : endTime === t
                            ? 'bg-brand text-white border-brand shadow-xs cursor-pointer'
                            : 'bg-surface border-divider text-ink-secondary hover:text-ink hover:border-brand/40 cursor-pointer'
                        }`}
                        title={isPast ? (startDate === endDate && t <= startTime ? 'Must be after pickup time' : 'This time has already passed today') : undefined}
                      >
                        {t.startsWith('0') ? t.slice(1) : t} {parseInt(t) < 12 ? 'AM' : 'PM'} {isPast ? '(Passed)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Offered Budget */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Your Offered Budget (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-ink-secondary">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 500"
                  value={offeredAmount}
                  onChange={(e) => setOfferedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-canvas border border-divider rounded-xl pl-8 pr-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  required
                />
              </div>
              <p className="text-[11px] text-ink-secondary mt-1">
                Total budget offered to the lender for the full {durationDays} days.
              </p>
            </div>
          </div>

          {/* SECTION 4: PICKUP & DROP-OFF TRANSPORT PREFERENCE (TOGGLES) */}
          <div className="space-y-4 pt-2 border-t border-divider">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-ink font-display flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-brand" />
                <span>4. Transport & Handover Preference</span>
              </h3>
              <p className="text-[11px] text-ink-secondary mt-0.5">
                Toggle whether you will pick up and return the gear yourself, or offer extra money for someone to deliver/collect it.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Toggle 1: Pickup */}
              <div className={`p-4 rounded-2xl border transition-all ${willPickup
                ? 'bg-emerald-500/5 border-emerald-500/30'
                : 'bg-brand/5 border-brand/30 ring-1 ring-brand/20'
                }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-black text-ink block">
                      {willPickup ? 'I will pick up the item myself' : 'I need it delivered to me'}
                    </span>
                    <span className="text-[11px] text-ink-secondary block mt-0.5">
                      {willPickup
                        ? "You will travel to the lender's place to collect the gear."
                        : "Lender or runner delivers gear to your destination."}
                    </span>
                  </div>

                  {/* Interactive Toggle Button */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={willPickup}
                    onClick={() => setWillPickup(!willPickup)}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer p-0.5 ${willPickup ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
                      }`}
                  >
                    <span className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${willPickup ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                  </button>
                </div>
              </div>

              {/* Toggle 2: Drop / Return */}
              <div className={`p-4 rounded-2xl border transition-all ${willDropBack
                ? 'bg-emerald-500/5 border-emerald-500/30'
                : 'bg-brand/5 border-brand/30 ring-1 ring-brand/20'
                }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-black text-ink block">
                      {willDropBack ? 'I will drop it back myself' : 'I need it collected from me'}
                    </span>
                    <span className="text-[11px] text-ink-secondary block mt-0.5">
                      {willDropBack
                        ? "You will return the gear back to the lender's place."
                        : "Lender or runner collects gear back from your place."}
                    </span>
                  </div>

                  {/* Interactive Toggle Button */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={willDropBack}
                    onClick={() => setWillDropBack(!willDropBack)}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer p-0.5 ${willDropBack ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
                      }`}
                  >
                    <span className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${willDropBack ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Extra Amount Box if NOT picking up OR NOT dropping back */}
            {(!willPickup || !willDropBack) && (
              <div className="p-4 rounded-2xl bg-brand/5 border border-brand/20 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <span>Extra amount you'll pay for transport / delivery service (₹)</span>
                    <span className="text-brand font-black">*</span>
                  </label>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-brand text-white">
                    Delivery Reward
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-ink-secondary">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 50 or 100"
                    className="w-full bg-surface border border-divider rounded-xl pl-8 pr-3.5 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                    required={!willPickup || !willDropBack}
                  />
                </div>
                <p className="text-[11px] text-ink-secondary">
                  Write down the extra convenience amount you will pay to someone who will {!willPickup && !willDropBack ? 'pick and drop the gear for you' : !willPickup ? 'deliver the gear to you' : 'collect the gear back from you'}.
                </p>
              </div>
            )}
          </div>

          {/* SECTION 5: EXACT DESTINATION LOCATION */}
          <div className="space-y-3 pt-2 border-t border-divider pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-ink font-display flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-brand" />
                  <span>5. Item Destination Location</span>
                </h3>
                <p className="text-[11px] text-ink-secondary mt-0.5">
                  Choose from your saved profile locations or enter your destination address.
                </p>
              </div>
            </div>

            {/* Choose from Saved Profile Locations */}
            {savedLocations.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-secondary">
                  Choose from saved profile locations:
                </span>
                <div className="flex flex-wrap gap-2">
                  {savedLocations.map((loc) => {
                    const isSelected = locality === loc.locality && buildingHouseNo === loc.building_flat_house;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => {
                          setBuildingHouseNo(loc.building_flat_house || '');
                          setStreetArea(loc.street_road_landmark || '');
                          setLocality(loc.locality || '');
                          setPincode(loc.pincode || '');
                          if (loc.latitude && loc.longitude) {
                            setCoords({ latitude: loc.latitude, longitude: loc.longitude });
                          } else {
                            setCoords(null);
                          }
                          setLocationSuccessMsg(`Location selected: ${loc.label}`);
                        }}
                        className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${isSelected
                          ? 'bg-brand/10 border-brand text-brand shadow-xs'
                          : 'bg-surface border-divider text-ink-secondary hover:text-ink hover:border-brand/40'
                          }`}
                      >
                        <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span className="font-extrabold">{loc.label}</span>
                        <span className="text-[10px] opacity-75">({loc.locality || loc.building_flat_house})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {locationSuccessMsg && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                <span>{locationSuccessMsg}</span>
              </div>
            )}

            {/* Structured Address Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Building / Flat / House No. (Compulsory) */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Building / Flat / House No. <span className="text-brand font-black">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={buildingHouseNo}
                  onChange={(e) => setBuildingHouseNo(e.target.value)}
                  placeholder="e.g. Flat 402, Building 3B / House #12"
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
                  value={streetArea}
                  onChange={(e) => setStreetArea(e.target.value)}
                  placeholder="e.g. 5th Main Road, Near Metro Station / Landmark"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                />
              </div>

              {/* Locality / Neighborhood (Compulsory) */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Locality / Neighborhood <span className="text-brand font-black">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  placeholder="e.g. Indiranagar, Koramangala, Whitefield"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                />
              </div>

              {/* PIN / Postal Code */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  PIN / Postal Code
                </label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 560060"
                  maxLength={10}
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Clean Fixed Footer outside scrollable form */}
        <div className="px-6 py-4 border-t border-divider bg-surface shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-secondary text-xs px-5 py-2.5 cursor-pointer font-bold"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="drop-wish-form"
            disabled={isSubmitting || isUploading}
            className="btn-primary text-xs px-6 py-2.5 shadow-pink cursor-pointer inline-flex items-center gap-2 font-bold disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing Request...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 stroke-[2.5]" />
                <span>Post Request</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
