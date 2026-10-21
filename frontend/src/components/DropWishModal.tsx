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
  Megaphone
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

  // Tomorrow + 2 days default for start date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const defaultDate = tomorrow.toISOString().split('T')[0];

  // Form Fields
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics & Tech');
  const [startDate, setStartDate] = useState(defaultDate);
  const [durationDays, setDurationDays] = useState<number | ''>(2);
  const [offeredAmount, setOfferedAmount] = useState<number | ''>('');
  const [locality, setLocality] = useState(user?.locality || '');
  const [imageUrl, setImageUrl] = useState('');

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

  // IMPORTANT: stopCamera is defined before any useEffect or return to prevent TDZ
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

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setErrorMsg('');
    try {
      const loc = await detectCurrentLocation();
      setLocality(loc.locality);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not detect GPS location.');
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
    // On touch mobile devices, native camera capture gives best quality & hardware shutter
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && cameraInputRef.current) {
      cameraInputRef.current.click();
      return;
    }

    // On desktop / laptop, open live webcam viewfinder in the form
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
        setErrorMsg('Failed to upload captured photo. Please try again.');
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

    if (offeredAmount === '' || Number(offeredAmount) < 0) {
      setErrorMsg('Please specify a valid offered budget.');
      return;
    }

    if (!locality.trim()) {
      setErrorMsg('Please specify your locality or use GPS.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await api.createRequest({
        item_name: itemName.trim(),
        description: description.trim(),
        category,
        start_date: startDate,
        duration_days: Number(durationDays || 1),
        offered_amount: Number(offeredAmount || 0),
        locality: locality.trim() || user?.locality || '',
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
        className="relative bg-surface rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-divider text-ink flex flex-col max-h-[88vh]"
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
                All details on a single page — tell the community what you need.
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
              <span>1. What do you need?</span>
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
                {/* Compulsory 10-char warning shown only while under 10 chars, removed once completed */}
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

          {/* SECTION 2: Photo / Reference Picture */}
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

            {/* Hidden native inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {/* Camera input with capture for mobile native shutter */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Live Camera Viewfinder (Desktop/Laptop mode) */}
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

            {/* Image Preview if uploaded */}
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
                    Your photo will help community members identify the exact item or model you want.
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

            {/* Upload & Camera Buttons (When no image or camera active) */}
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

          {/* SECTION 3: Needed Date, Duration & Budget */}
          <div className="space-y-4 pt-2 border-t border-divider">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
              3. Date, Duration & Budget
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Needed Date */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Needed By Date <span className="text-brand">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  required
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Duration (Days) <span className="text-brand">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  placeholder="e.g. 2"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  required
                />
              </div>

              {/* Offered Budget */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Offered Budget (₹) <span className="text-brand">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 500"
                  value={offeredAmount}
                  onChange={(e) => setOfferedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  required
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Location */}
          <div className="space-y-3 pt-2 border-t border-divider pb-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
              4. Preferred Location
            </h3>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-ink">
                  Your Locality / Campus / Area <span className="text-brand">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleDetectLocation}
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
                placeholder="e.g. Indiranagar, Bengaluru"
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                required
              />
            </div>
          </div>
        </form>

        {/* Clean, Non-overlapping Fixed Footer outside scrollable form */}
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
                <span>Post Request Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
