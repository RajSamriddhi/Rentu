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
  Compass
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { uploadItemPhoto } from '../lib/supabase';
import { detectCurrentLocation } from '../lib/location';

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

  // Form Fields - Pickup & Return Logistics
  const [pickupType, setPickupType] = useState<'LENDER_LOCATION' | 'MY_LOCATION' | 'CUSTOM_LOCATION'>('LENDER_LOCATION');
  const [pickupLocality, setPickupLocality] = useState('');
  const [locality, setLocality] = useState(user?.locality || '');

  const [returnType, setReturnType] = useState<'LENDER_LOCATION' | 'MY_LOCATION' | 'CUSTOM_LOCATION'>('LENDER_LOCATION');
  const [returnLocality, setReturnLocality] = useState('');

  // States
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isDetectingPickupLoc, setIsDetectingPickupLoc] = useState(false);
  const [isDetectingReturnLoc, setIsDetectingReturnLoc] = useState(false);
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
        const s = new Date(`${startDate}T${startTime || '10:00'}`);
        const e = new Date(`${endDate}T${endTime || '18:00'}`);
        const diffMs = e.getTime() - s.getTime();
        const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        setDurationDays(days);
      } catch (err) {
        // Fallback
      }
    }
  }, [startDate, endDate, startTime, endTime]);

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

  // Update default locality when user loads
  useEffect(() => {
    if (user?.locality && !locality) {
      setLocality(user.locality);
    }
  }, [user]);

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
        if (!locality) setLocality(loc.locality);
      } else {
        setLocality(loc.locality);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not detect GPS location.');
    } finally {
      if (target === 'return') setIsDetectingReturnLoc(false);
      else if (target === 'pickup') setIsDetectingPickupLoc(false);
      else setIsDetectingLocation(false);
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

    if (!locality.trim()) {
      setErrorMsg('Please specify your locality or address.');
      return;
    }

    if (pickupType === 'CUSTOM_LOCATION' && !pickupLocality.trim()) {
      setErrorMsg('Please specify the custom pickup meetup spot or landmark.');
      return;
    }

    if (returnType === 'CUSTOM_LOCATION' && !returnLocality.trim()) {
      setErrorMsg('Please specify the return meetup spot or landmark.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const finalPickupLoc = pickupType === 'MY_LOCATION' 
        ? locality.trim() 
        : pickupType === 'CUSTOM_LOCATION' 
        ? pickupLocality.trim() 
        : '';

      const finalReturnLoc = returnType === 'MY_LOCATION' 
        ? locality.trim() 
        : returnType === 'CUSTOM_LOCATION' 
        ? returnLocality.trim() 
        : '';

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
        locality: locality.trim() || user?.locality || '',
        pickup_type: pickupType,
        pickup_locality: finalPickupLoc || undefined,
        return_type: returnType,
        return_locality: finalReturnLoc || undefined,
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
                    <span>✓ Picture Attached</span>
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
                <div className="flex items-center gap-2 text-xs font-bold text-ink">
                  <Calendar className="w-4 h-4 text-brand" />
                  <span>Needed From (Start Date & Time) *</span>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="col-span-7 bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                    required
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="col-span-5 bg-surface border border-divider rounded-xl px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* End / Return Date & Time */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-ink">
                  <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>When will you return it? (Return Date) *</span>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="date"
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="col-span-7 bg-surface border border-divider rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                    required
                  />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="col-span-5 bg-surface border border-divider rounded-xl px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-brand"
                  />
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

          {/* SECTION 4: PICKUP LOGISTICS */}
          <div className="space-y-3 pt-2 border-t border-divider">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
              4. Pickup Handover: Where will you receive the item?
            </h3>

            {/* 3 Selectable Pickup Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setPickupType('LENDER_LOCATION')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  pickupType === 'LENDER_LOCATION'
                    ? 'border-brand bg-brand-soft/40 text-ink ring-1 ring-brand shadow-xs'
                    : 'border-divider bg-canvas text-ink-secondary hover:text-ink hover:border-zinc-300'
                }`}
              >
                <div className="text-xs font-black text-ink flex items-center gap-1.5">
                  <span>🚶 I'll go to Lender's place</span>
                </div>
                <div className="text-[11px] text-ink-secondary mt-1">
                  You will travel to the lender's location/neighborhood to pick up the gear.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPickupType('MY_LOCATION');
                  if (!locality && user?.locality) setLocality(user.locality);
                }}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  pickupType === 'MY_LOCATION'
                    ? 'border-brand bg-brand-soft/40 text-ink ring-1 ring-brand shadow-xs'
                    : 'border-divider bg-canvas text-ink-secondary hover:text-ink hover:border-zinc-300'
                }`}
              >
                <div className="text-xs font-black text-ink flex items-center gap-1.5">
                  <span>📍 My Current Location</span>
                </div>
                <div className="text-[11px] text-ink-secondary mt-1">
                  Ask lender to deliver the gear directly to your current live location.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPickupType('CUSTOM_LOCATION')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  pickupType === 'CUSTOM_LOCATION'
                    ? 'border-brand bg-brand-soft/40 text-ink ring-1 ring-brand shadow-xs'
                    : 'border-divider bg-canvas text-ink-secondary hover:text-ink hover:border-zinc-300'
                }`}
              >
                <div className="text-xs font-black text-ink flex items-center gap-1.5">
                  <span>🤝 Custom Meet Location</span>
                </div>
                <div className="text-[11px] text-ink-secondary mt-1">
                  Choose a mutual landmark, cafe, or metro station for pickup.
                </div>
              </button>
            </div>

            {/* Custom Pickup Location Input when CUSTOM_LOCATION is selected */}
            {pickupType === 'CUSTOM_LOCATION' && (
              <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-ink">
                    Custom Pickup Meetup Spot / Landmark *
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDetectLocation('pickup')}
                    disabled={isDetectingPickupLoc}
                    className="text-[11px] font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Navigation className="w-3 h-3 text-brand" />
                    <span>{isDetectingPickupLoc ? 'Detecting...' : 'GPS'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={pickupLocality}
                  onChange={(e) => setPickupLocality(e.target.value)}
                  placeholder="e.g. Indiranagar Metro Station Gate 1 or Forum Mall Main Entrance"
                  className="w-full bg-surface border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  required
                />
                <p className="text-[11px] text-ink-secondary">
                  Specify the exact mutual public spot where you'd like to meet the lender to collect the gear.
                </p>
              </div>
            )}

            {/* Address / Locality Input */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-ink">
                  {pickupType === 'MY_LOCATION' 
                    ? 'Your Current Delivery Address / Locality *' 
                    : pickupType === 'CUSTOM_LOCATION'
                    ? 'Your General Area / City *'
                    : 'Your Area / Neighborhood (to find nearby lenders) *'}
                </label>
                <button
                  type="button"
                  onClick={() => handleDetectLocation('main')}
                  disabled={isDetectingLocation}
                  className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-brand bg-brand-soft hover:bg-brand/20 active:scale-95 px-2.5 py-1 rounded-lg border border-brand/20 transition-all cursor-pointer disabled:opacity-50"
                  title="Detect GPS location"
                >
                  {isDetectingLocation ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Detecting...</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-3 h-3 text-brand" />
                      <span>Use Current GPS 📍</span>
                    </>
                  )}
                </button>
              </div>
              <input
                type="text"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                placeholder="e.g. Indiranagar, Bengaluru or HSR Layout Sector 2"
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                required
              />
              <p className="text-[11px] text-ink-secondary mt-1">
                {pickupType === 'MY_LOCATION'
                  ? 'Lender will bring or deliver the gear directly to this current address.'
                  : 'Helps us show your request to lenders in your immediate area.'}
              </p>
            </div>
          </div>

          {/* SECTION 5: RETURN & DROP-OFF LOGISTICS */}
          <div className="space-y-3 pt-2 border-t border-divider pb-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
              5. Return Handover: How and where will you return the item?
            </h3>

            {/* 3 Selectable Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setReturnType('LENDER_LOCATION')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  returnType === 'LENDER_LOCATION'
                    ? 'border-brand bg-brand-soft/40 text-ink ring-1 ring-brand shadow-xs'
                    : 'border-divider bg-canvas text-ink-secondary hover:text-ink hover:border-zinc-300'
                }`}
              >
                <div className="text-xs font-black text-ink">🚶 Return to Lender</div>
                <div className="text-[11px] text-ink-secondary mt-0.5">
                  You drop it back at the lender's place.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setReturnType('MY_LOCATION');
                  if (!returnLocality && locality) setReturnLocality(locality);
                }}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  returnType === 'MY_LOCATION'
                    ? 'border-brand bg-brand-soft/40 text-ink ring-1 ring-brand shadow-xs'
                    : 'border-divider bg-canvas text-ink-secondary hover:text-ink hover:border-zinc-300'
                }`}
              >
                <div className="text-xs font-black text-ink">🏠 Collect at My Place</div>
                <div className="text-[11px] text-ink-secondary mt-0.5">
                  Lender collects gear from your location.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReturnType('CUSTOM_LOCATION')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  returnType === 'CUSTOM_LOCATION'
                    ? 'border-brand bg-brand-soft/40 text-ink ring-1 ring-brand shadow-xs'
                    : 'border-divider bg-canvas text-ink-secondary hover:text-ink hover:border-zinc-300'
                }`}
              >
                <div className="text-xs font-black text-ink">🤝 Custom Meetup Spot</div>
                <div className="text-[11px] text-ink-secondary mt-0.5">
                  Meet at a mutual landmark or metro station.
                </div>
              </button>
            </div>

            {/* Custom or Return Location Input if applicable */}
            {(returnType === 'CUSTOM_LOCATION' || returnType === 'MY_LOCATION') && (
              <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-ink">
                    {returnType === 'CUSTOM_LOCATION' 
                      ? 'Return Meetup Spot / Landmark *' 
                      : 'Collection Address (Where lender picks it up) *'}
                  </label>

                  <div className="flex items-center gap-2">
                    {((pickupType === 'CUSTOM_LOCATION' && pickupLocality) || locality) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (returnType === 'CUSTOM_LOCATION' && pickupType === 'CUSTOM_LOCATION' && pickupLocality) {
                            setReturnLocality(pickupLocality);
                          } else if (locality) {
                            setReturnLocality(locality);
                          }
                        }}
                        className="text-[11px] font-bold text-brand hover:underline cursor-pointer"
                      >
                        Same as pickup
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDetectLocation('return')}
                      disabled={isDetectingReturnLoc}
                      className="text-[11px] font-bold text-brand hover:underline cursor-pointer"
                    >
                      {isDetectingReturnLoc ? '...' : 'GPS'}
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={returnLocality}
                  onChange={(e) => setReturnLocality(e.target.value)}
                  placeholder={
                    returnType === 'CUSTOM_LOCATION' 
                      ? 'e.g. Indiranagar Metro Station or Forum Mall Gate 2' 
                      : 'e.g. Your apartment address / room'
                  }
                  className="w-full bg-surface border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  required={returnType === 'CUSTOM_LOCATION'}
                />
              </div>
            )}
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
                <span>Post Request Now 🎯</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
