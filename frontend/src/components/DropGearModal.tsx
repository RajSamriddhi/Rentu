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
  AlertCircle,
  Pencil
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { uploadItemPhoto } from '../lib/supabase';
import { detectCurrentLocation, getEffectiveSavedLocations, formatSavedLocationFull } from '../lib/location';
import { Item, SavedLocation } from '../lib/types';
import { AddLocationModal } from './AddLocationModal';
import { SetLocationModal } from './SetLocationModal';

interface DropGearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newItem?: Item) => void;
  onOpenAuth: () => void;
  onOpenProfile?: () => void;
}

export const DropGearModal: React.FC<DropGearModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenAuth,
  onOpenProfile,
}) => {
  const { user, isAuthenticated } = useAuth();

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics & Tech');
  const [listingType, setListingType] = useState<'Rent' | 'Borrow'>('Rent');
  const [pricePerDay, setPricePerDay] = useState<number | ''>('');
  const [maxDurationDays, setMaxDurationDays] = useState(365);
  const [condition, setCondition] = useState('Like new');
  const [locality, setLocality] = useState(user?.locality || '');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<number | ''>(0);
  const [offersPickup, setOffersPickup] = useState(false);
  const [pickupFee, setPickupFee] = useState<number | ''>(0);

  // Saved Pickup & Drop Locations
  const savedLocations = getEffectiveSavedLocations(user);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => {
    return savedLocations.length > 0 ? savedLocations[0].id : '';
  });
  const [detectedLocation, setDetectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address_text?: string;
    pincode?: string;
    locality?: string;
  } | null>(null);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState('');
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null);
  const [isSetLocationOpen, setIsSetLocationOpen] = useState(false);

  useEffect(() => {
    if (savedLocations.length > 0 && !selectedLocationId && !detectedLocation) {
      setSelectedLocationId(savedLocations[0].id);
      setLocality(savedLocations[0].locality);
    }
  }, [savedLocations, selectedLocationId, detectedLocation]);

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
    setLocationSuccessMsg('');
    try {
      const loc = await detectCurrentLocation();
      setLocality(loc.locality);
      setDetectedLocation({
        latitude: loc.latitude,
        longitude: loc.longitude,
        address_text: loc.address_text,
        pincode: loc.pincode,
        locality: loc.locality,
      });
      const summary = [loc.address_text, loc.locality].filter(Boolean).join(', ') || 'Current location detected';
      setLocationSuccessMsg(`Location detected: ${summary}`);
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
      const publicUrl = await uploadItemPhoto(file, 'gear');
      setImageUrl(publicUrl);
      setImageUrls((prev) => [...prev, publicUrl]);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMsg(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset input value so same photo can be re-selected if desired
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
        const file = new File([blob], `gear-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const publicUrl = await uploadItemPhoto(file, 'gear');
        setImageUrl(publicUrl);
        setImageUrls((prev) => [...prev, publicUrl]);
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

    if (!title.trim() || title.trim().length < 3) {
      setErrorMsg('Item title must be at least 3 characters.');
      return;
    }

    if (isDescTooShort) {
      setErrorMsg('Minimum 10 characters are compulsory for the description.');
      return;
    }

    if (!imageUrl) {
      setErrorMsg('Please upload a picture of your item or take a photo with your camera.');
      return;
    }

    if (listingType === 'Rent' && (pricePerDay === '' || Number(pricePerDay) <= 0)) {
      setErrorMsg('Please specify a valid daily rental price.');
      return;
    }

    const chosenLocation = savedLocations.find(l => l.id === selectedLocationId) || (savedLocations.length > 0 ? savedLocations[0] : null);
    const finalLocality = detectedLocation?.locality || chosenLocation?.locality || locality.trim() || user?.locality || '';
    if (!detectedLocation && !chosenLocation) {
      setErrorMsg('Please add your location in your profile section or use your current GPS location before listing.');
      return;
    }
    if (!finalLocality) {
      setErrorMsg('Please specify your pickup and drop location or add one to your profile.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const itemAddress = detectedLocation?.address_text
        || (chosenLocation ? [chosenLocation.building_flat_house, chosenLocation.street_road_landmark].filter(Boolean).join(', ') : '')
        || finalLocality;
      const itemPincode = detectedLocation?.pincode || chosenLocation?.pincode || user?.pincode || undefined;
      const itemLat = detectedLocation?.latitude ?? chosenLocation?.latitude ?? (user?.latitude ? Number(user.latitude) : undefined);
      const itemLon = detectedLocation?.longitude ?? chosenLocation?.longitude ?? (user?.longitude ? Number(user.longitude) : undefined);

      const createdItem = await api.createItem({
        title: title.trim(),
        description: description.trim(),
        category,
        condition,
        price_per_day: listingType === 'Borrow' ? 0 : Number(pricePerDay || 0),
        max_duration_days: Number(maxDurationDays),
        image_urls: imageUrls.length > 0 ? imageUrls : [imageUrl],
        sticker_badge: 'Available',
        locality: finalLocality,
        address_text: itemAddress,
        pincode: itemPincode,
        latitude: itemLat,
        longitude: itemLon,
        available_for_borrowing: listingType === 'Borrow',
        offers_delivery: offersDelivery,
        delivery_fee: offersDelivery ? Number(deliveryFee || 0) : 0,
        offers_pickup: offersPickup,
        pickup_fee: offersPickup ? Number(pickupFee || 0) : 0,
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      onSuccess(createdItem);
      onClose();
    } catch (err: any) {
      console.error('Failed to list item:', err);
      setErrorMsg(err.message || 'Failed to list item. Please try again.');
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
          <div>
            <h2 className="text-lg sm:text-xl font-black text-ink font-display tracking-tight">
              List an Item
            </h2>
            <p className="text-xs text-ink-secondary">
              All details on a single page — turn your unused gear into daily income.
            </p>
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
        <form id="drop-gear-form" onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold animate-in fade-in">
              {errorMsg}
            </div>
          )}

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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sony Headphones WH-1000XM4"
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

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Condition <span className="text-brand">*</span>
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
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
                {/* Compulsory 10-char warning shown only while under 10 chars, removed once completed */}
                {isDescTooShort && (
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full transition-all">
                    Minimum 10 characters compulsory ({descTrimmed.length}/10)
                  </span>
                )}
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Be specific about your item, its condition, and included accessories..."
                rows={3}
                className={`w-full bg-canvas border rounded-xl p-3 text-xs font-medium text-ink outline-none transition-colors resize-none ${
                  description.length > 0 && isDescTooShort
                    ? 'border-amber-400 focus:border-amber-500'
                    : 'border-divider focus:border-brand'
                }`}
                required
              />
            </div>
          </div>

          {/* SECTION 2: Photo Upload (From Computer/Phone OR Camera) */}
          <div className="space-y-3 pt-2 border-t border-divider">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
              2. Gear Photo <span className="text-brand">*</span>
            </h3>

            {/* Hidden file & camera inputs */}
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

            {/* Live Camera Viewfinder (if webcam mode is active) */}
            {isCameraActive && (
              <div className="p-4 bg-canvas rounded-2xl border border-divider space-y-3 animate-in zoom-in-95 duration-150">
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

            {/* Photo Preview or Selection Area */}
            {!isCameraActive && (
              <div>
                {imageUrl ? (
                  <div className="flex items-center gap-4 p-3.5 bg-canvas rounded-2xl border border-divider">
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-divider shrink-0 relative group">
                      <img
                        src={imageUrl}
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
                          onClick={() => setImageUrl('')}
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

          {/* SECTION 3: Pricing & Availability */}
          <div className="space-y-4 pt-2 border-t border-divider">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
              3. Pricing & Rental Terms
            </h3>

            {/* Listing Type Toggle */}
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setListingType('Rent')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  listingType === 'Rent'
                    ? 'border-brand bg-brand-soft/30 text-ink shadow-xs ring-1 ring-brand'
                    : 'border-divider bg-canvas text-ink-secondary hover:text-ink'
                }`}
              >
                <div className="text-xs font-black">Rent for Fee</div>
                <div className="text-[11px] text-ink-secondary">Set a daily price</div>
              </button>

              <button
                type="button"
                onClick={() => setListingType('Borrow')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  listingType === 'Borrow'
                    ? 'border-brand bg-brand-soft/30 text-ink shadow-xs ring-1 ring-brand'
                    : 'border-divider bg-canvas text-ink-secondary hover:text-ink'
                }`}
              >
                <div className="text-xs font-black">Free Community Sharing</div>
                <div className="text-[11px] text-ink-secondary">Lend to neighbors for free</div>
              </button>
            </div>

            {/* Price */}
            <div>
              {listingType === 'Rent' ? (
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Price per day (₹) <span className="text-brand">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 250"
                    value={pricePerDay}
                    onChange={(e) => setPricePerDay(e.target.value === '' ? '' : Number(e.target.value))}
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
                      {offersDelivery && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Ready to Deliver
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-secondary">
                      Toggle ON if you are willing to deliver the product to the person renting it.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOffersDelivery(!offersDelivery)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      offersDelivery ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                    role="switch"
                    aria-checked={offersDelivery}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        offersDelivery ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {offersDelivery && (
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
                        value={deliveryFee}
                        onChange={(e) => setDeliveryFee(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
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
                      {offersPickup && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Ready to Collect
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-secondary">
                      Toggle ON if you will collect the product from the renter when rental duration ends.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOffersPickup(!offersPickup)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      offersPickup ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                    role="switch"
                    aria-checked={offersPickup}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        offersPickup ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {offersPickup && (
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
                        value={pickupFee}
                        onChange={(e) => setPickupFee(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                        placeholder="0"
                        className="w-full bg-surface border border-divider rounded-xl pl-7 pr-3 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: Pickup & Drop Location */}
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

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isDetectingLocation}
                  className="px-3 py-1.5 rounded-xl border border-divider hover:border-brand/40 text-[11px] font-bold text-ink hover:text-brand bg-surface transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Navigation className={`w-3.5 h-3.5 text-brand ${isDetectingLocation ? 'animate-spin' : ''}`} />
                  <span>{isDetectingLocation ? 'Detecting...' : 'Use Current Location'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddLocationOpen(true)}
                  className="btn-primary text-[11px] font-bold px-3 py-1.5 shadow-pink cursor-pointer inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Another Location</span>
                </button>
              </div>
            </div>

            {locationSuccessMsg && (
              <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{locationSuccessMsg}</span>
              </div>
            )}

            {/* List of Saved Locations in User's Profile */}
            <div className="space-y-2.5">
              {/* If no location set in profile and no detected location */}
              {savedLocations.length === 0 && !detectedLocation && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-black text-ink">No Location Set in Your Profile</h4>
                      <p className="text-[11px] text-ink-secondary mt-0.5 leading-relaxed">
                        You have not set any location in your profile yet. Please add your location in your profile section so lenders and borrowers can coordinate handoffs, or use your current location below.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <button
                      type="button"
                      onClick={() => setIsSetLocationOpen(true)}
                      className="btn-primary text-xs px-3.5 py-1.5 shadow-pink font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>+ Add Location to Profile</span>
                    </button>

                    {onOpenProfile && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenProfile();
                        }}
                        className="btn-secondary text-xs px-3.5 py-1.5 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-brand" />
                        <span>Go to Profile Section</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={isDetectingLocation}
                      className="btn-secondary text-xs px-3.5 py-1.5 font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Navigation className={`w-3.5 h-3.5 text-brand ${isDetectingLocation ? 'animate-spin' : ''}`} />
                      <span>{isDetectingLocation ? 'Detecting...' : 'Use Current Location'}</span>
                    </button>
                  </div>
                </div>
              )}

              {detectedLocation && (
                <div className="p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 bg-brand/5 border-brand ring-1 ring-brand/20 shadow-xs">
                  <div className="mt-0.5 w-4 h-4 rounded-full border border-brand bg-brand flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-ink">Detected Current Location (GPS)</span>
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <Check className="w-2.5 h-2.5" /> Selected for this listing
                      </span>
                    </div>
                    <p className="text-xs text-ink-secondary mt-1 font-medium leading-relaxed">
                      <MapPin className="w-3.5 h-3.5 text-brand inline shrink-0 mr-1 -mt-0.5" />
                      <span>{detectedLocation.address_text || detectedLocation.locality}</span>
                    </p>
                  </div>
                </div>
              )}
              {savedLocations.map((loc) => {
                const isSelected = !detectedLocation && selectedLocationId === loc.id;
                const formattedFull = formatSavedLocationFull(loc);
                return (
                  <div
                    key={loc.id}
                    onClick={() => {
                      setSelectedLocationId(loc.id);
                      setLocality(loc.locality);
                      setDetectedLocation(null);
                      setLocationSuccessMsg('');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'bg-brand/5 border-brand ring-1 ring-brand/20 shadow-xs'
                        : 'bg-canvas border-divider hover:border-brand/40'
                    }`}
                  >
                    {/* Radio indicator */}
                    <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? 'border-brand bg-brand' : 'border-divider bg-surface'
                    }`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-ink">
                          {loc.label}
                        </span>
                        {loc.is_default && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-soft text-brand border border-brand/20">
                            Profile Primary
                          </span>
                        )}
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <Check className="w-2.5 h-2.5" /> Selected for this listing
                          </span>
                        )}

                        {/* Edit Address Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (loc.is_default) {
                              setIsSetLocationOpen(true);
                            } else {
                              setEditingLocation(loc);
                              setIsAddLocationOpen(true);
                            }
                          }}
                          className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-ink-secondary hover:text-brand hover:bg-brand/10 transition-colors px-2 py-0.5 rounded-lg cursor-pointer"
                          title={`Edit ${loc.label} address`}
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
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
            form="drop-gear-form"
            disabled={isSubmitting || isUploading}
            className="btn-primary text-xs px-6 py-2.5 shadow-pink cursor-pointer inline-flex items-center gap-2 font-bold disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing Gear...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 stroke-[2.5]" />
                <span>List Item Now</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Add / Edit Saved Location Modal */}
      <AddLocationModal
        isOpen={isAddLocationOpen}
        locationToEdit={editingLocation}
        onClose={() => {
          setIsAddLocationOpen(false);
          setEditingLocation(null);
        }}
        onSuccess={(newLoc) => {
          setSelectedLocationId(newLoc.id);
          setLocality(newLoc.locality);
          setEditingLocation(null);
        }}
      />

      {/* Set Profile Location Modal */}
      <SetLocationModal
        isOpen={isSetLocationOpen}
        onClose={() => setIsSetLocationOpen(false)}
        onSuccess={(newLoc) => {
          setIsSetLocationOpen(false);
          setSelectedLocationId('primary');
          setLocality(newLoc.locality);
          setLocationSuccessMsg(`Profile location set to ${newLoc.locality}!`);
        }}
        canSkip={false}
      />
    </div>
  );
};
