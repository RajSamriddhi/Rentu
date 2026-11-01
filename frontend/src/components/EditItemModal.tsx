import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, MapPin, Loader2, Trash2, CheckCircle2, Sparkles } from 'lucide-react';
import { Item } from '../lib/types';
import { api } from '../lib/api';
import { uploadItemPhoto } from '../lib/supabase';
import { detectCurrentLocation } from '../lib/location';

interface EditItemModalProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
  item,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics & Tech');
  const [pricePerDay, setPricePerDay] = useState<number | ''>('');
  const [maxDurationDays, setMaxDurationDays] = useState(5);
  const [locality, setLocality] = useState('');
  const [status, setStatus] = useState<'AVAILABLE' | 'RENTED' | 'UNAVAILABLE'>('AVAILABLE');
  const [imageUrl, setImageUrl] = useState('');
  const [availableForBorrowing, setAvailableForBorrowing] = useState(false);
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<number | ''>(0);
  const [offersPickup, setOffersPickup] = useState(false);
  const [pickupFee, setPickupFee] = useState<number | ''>(0);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item && isOpen) {
      setTitle(item.title || '');
      setDescription(item.description || '');
      setCategory(item.category || 'Electronics & Tech');
      setPricePerDay(Number(item.price_per_day) || '');
      setMaxDurationDays(item.max_duration_days || 5);
      setLocality(item.locality || '');
      setStatus(item.status || 'AVAILABLE');
      setImageUrl(item.image_urls?.[0] || '');
      setAvailableForBorrowing(Boolean(item.available_for_borrowing));
      setOffersDelivery(Boolean(item.offers_delivery));
      setDeliveryFee(item.delivery_fee !== undefined ? Number(item.delivery_fee) : 0);
      setOffersPickup(Boolean(item.offers_pickup));
      setPickupFee(item.pickup_fee !== undefined ? Number(item.pickup_fee) : 0);
      setErrorMsg('');
    }
  }, [item, isOpen]);

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setErrorMsg('');
    try {
      const loc = await detectCurrentLocation();
      setLocality(loc.locality);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not detect location.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');
    try {
      const publicUrl = await uploadItemPhoto(file, 'gear');
      setImageUrl(publicUrl);
    } catch (err: any) {
      console.error('Photo upload error:', err);
      setErrorMsg('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    if (!title.trim()) {
      setErrorMsg('Title is required');
      return;
    }
    if (pricePerDay === '' || Number(pricePerDay) < 0) {
      setErrorMsg('Please specify a valid daily rate');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      await api.updateItem(item.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        price_per_day: Number(pricePerDay),
        max_duration_days: Number(maxDurationDays),
        locality: locality.trim(),
        status,
        available_for_borrowing: availableForBorrowing,
        offers_delivery: offersDelivery,
        delivery_fee: offersDelivery ? Number(deliveryFee || 0) : 0,
        offers_pickup: offersPickup,
        pickup_fee: offersPickup ? Number(pickupFee || 0) : 0,
        image_urls: imageUrl ? [imageUrl] : item.image_urls,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update listing:', err);
      setErrorMsg(err.message || 'Failed to update item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${item.title}"? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    setErrorMsg('');
    try {
      await api.deleteItem(item.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      setErrorMsg(err.message || 'Failed to delete listing.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        className="relative bg-surface w-full max-w-lg rounded-3xl border border-divider shadow-2xl overflow-hidden my-auto text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-surface">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-ink font-display">
              Edit Gear Listing
            </h3>
            <p className="text-xs text-ink-secondary">Update your gear details, daily price, or availability</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-canvas text-ink transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Photo Preview & Replace */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1.5">Gear Photo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-canvas border border-divider overflow-hidden shrink-0 relative group">
                <img
                  src={imageUrl || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80'}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-3.5 py-1.5 rounded-full border border-divider hover:bg-canvas text-xs font-bold text-ink cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-brand" />
                  <span>{isUploading ? 'Uploading...' : 'Replace Photo'}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <p className="text-[11px] text-ink-secondary">Upload a clear photo of your gear</p>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sony Alpha A7 IV Camera"
              className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand"
              required
            />
          </div>

          {/* Category & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none cursor-pointer"
              >
                <option value="Electronics & Tech">Electronics & Tech</option>
                <option value="Camping & Outdoor">Camping & Outdoor</option>
                <option value="Clothing & Accessories">Clothing & Accessories</option>
                <option value="Tools & DIY">Tools & DIY</option>
                <option value="Home & Appliances">Home & Appliances</option>
                <option value="Sports & Fitness">Sports & Fitness</option>
                <option value="Books & Media">Books & Media</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Listing Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none cursor-pointer"
              >
                <option value="AVAILABLE">✨ Available for Rent</option>
                <option value="RENTED">🔒 Currently Rented</option>
                <option value="UNAVAILABLE">⏸️ Paused / Unavailable</option>
              </select>
            </div>
          </div>

          {/* Price & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Price Per Day (₹) *</label>
              <input
                type="number"
                min="0"
                value={pricePerDay}
                onChange={(e) => setPricePerDay(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 350"
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Max Duration (Days)</label>
              <select
                value={maxDurationDays}
                onChange={(e) => setMaxDurationDays(Number(e.target.value))}
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none cursor-pointer"
              >
                <option value={3}>Up to 3 days</option>
                <option value={5}>Up to 5 days</option>
                <option value={7}>Up to 7 days (1 week)</option>
                <option value={14}>Up to 14 days (2 weeks)</option>
                <option value={30}>Up to 30 days (1 month)</option>
              </select>
            </div>
          </div>

          {/* Locality */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-ink">Locality / Neighborhood</label>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="text-[11px] font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3 h-3" />
                <span>{isDetectingLocation ? 'Detecting...' : 'Detect GPS'}</span>
              </button>
            </div>
            <input
              type="text"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              placeholder="e.g. Indiranagar, Bangalore"
              className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand"
            />
          </div>

          {/* Toggle: Also available for borrowing */}
          <div className="p-3.5 rounded-2xl bg-canvas border border-divider flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink">Available for Borrowing</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-soft text-brand border border-brand/20">
                  Option
                </span>
              </div>
              <p className="text-[11px] text-ink-secondary">
                Tell everyone this item can also be borrowed for free when you agree.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAvailableForBorrowing(!availableForBorrowing)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                availableForBorrowing ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
              role="switch"
              aria-checked={availableForBorrowing}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  availableForBorrowing ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Delivery & Return Collection Options by Owner */}
          <div className="space-y-3 pt-3 border-t border-divider">
            <div>
              <h4 className="text-xs font-bold text-ink">Delivery & Return Collection</h4>
              <p className="text-[11px] text-ink-secondary">
                Choose if you will deliver to the renter or collect the gear on return, plus any charges.
              </p>
            </div>

            {/* Option 1: Delivery by Owner */}
            <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink">I will deliver to the renter 🚗</span>
                    {offersDelivery && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        Ready to Deliver
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-secondary">
                    Toggle ON if you are ready to deliver this product directly to the person renting it.
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
                    <span className="text-xs font-bold text-ink">I will pick up / collect myself on return 🔄</span>
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

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mention gear condition, included accessories, or pickup guidelines..."
              className="w-full bg-canvas border border-divider rounded-xl p-3 text-xs font-medium text-ink outline-none focus:border-brand resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-divider flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
              className="px-4 py-2.5 rounded-full text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Delete Listing</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs px-4 py-2.5 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className="btn-primary text-xs px-5 py-2.5 shadow-pink cursor-pointer inline-flex items-center gap-1.5 font-bold disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
