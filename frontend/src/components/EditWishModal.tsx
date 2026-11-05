import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Loader2, Trash2, Calendar, Target, Upload, Camera, ImageIcon } from 'lucide-react';
import { CommunityRequest } from '../lib/types';
import { api } from '../lib/api';
import { detectCurrentLocation, parseAddressText, buildAddressString } from '../lib/location';
import { uploadItemPhoto } from '../lib/supabase';

interface EditWishModalProps {
  request: CommunityRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditWishModal: React.FC<EditWishModalProps> = ({
  request,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics & Tech');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationDays, setDurationDays] = useState<number | ''>('');
  const [offeredAmount, setOfferedAmount] = useState<number | ''>('');
  
  // Pickup & Drop Toggles & Extra Fee
  const [willPickup, setWillPickup] = useState<boolean>(true);
  const [willDropBack, setWillDropBack] = useState<boolean>(true);
  const [deliveryFee, setDeliveryFee] = useState<number | ''>('');

  // Destination Location Fields
  const [buildingHouseNo, setBuildingHouseNo] = useState('');
  const [streetArea, setStreetArea] = useState('');
  const [locality, setLocality] = useState('');
  const [pincode, setPincode] = useState('');
  const [locationSuccessMsg, setLocationSuccessMsg] = useState('');

  const [status, setStatus] = useState<'OPEN' | 'FULFILLED' | 'CANCELLED'>('OPEN');
  const [imageUrl, setImageUrl] = useState('');

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (request && isOpen) {
      setItemName(request.item_name || '');
      setDescription(request.description || '');
      setCategory(request.category || 'Electronics & Tech');
      // Format start_date to YYYY-MM-DD for date input
      const dateVal = request.start_date ? new Date(request.start_date).toISOString().split('T')[0] : '';
      setStartDate(dateVal);
      const endDateVal = request.end_date ? new Date(request.end_date).toISOString().split('T')[0] : '';
      setEndDate(endDateVal);
      setDurationDays(request.duration_days || 1);
      setOfferedAmount(Number(request.offered_amount) || '');
      
      setWillPickup(request.will_pickup ?? (request.pickup_type !== 'MY_LOCATION'));
      setWillDropBack(request.will_drop_back ?? (request.return_type !== 'MY_LOCATION'));
      setDeliveryFee(Number(request.delivery_fee) || '');

      if (request.address_text) {
        const addr = parseAddressText(request.address_text);
        setBuildingHouseNo(addr.building);
        setStreetArea(addr.street);
      } else {
        setBuildingHouseNo('');
        setStreetArea('');
      }
      setLocality(request.locality || '');
      setPincode(request.pincode || '');

      setStatus(request.status || 'OPEN');
      setImageUrl(request.image_url || '');
      setErrorMsg('');
      setLocationSuccessMsg('');
    }
  }, [request, isOpen]);

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

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setErrorMsg('');
    setLocationSuccessMsg('');
    try {
      const loc = await detectCurrentLocation();
      if (loc.address_text) {
        setStreetArea(loc.address_text);
      }
      if (loc.locality) {
        setLocality(loc.locality);
      }
      if (loc.pincode) {
        setPincode(loc.pincode);
      }
      const locSummary = [loc.address_text, loc.locality].filter(Boolean).join(', ') || loc.city || 'Location detected';
      setLocationSuccessMsg(`Location detected: ${locSummary}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not detect location.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setErrorMsg('');
    try {
      const publicUrl = await uploadItemPhoto(file, 'gear');
      setImageUrl(publicUrl);
    } catch (err: any) {
      console.error('Photo upload error:', err);
      setErrorMsg('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;
    if (!itemName.trim()) {
      setErrorMsg('Item name is required');
      return;
    }
    if (offeredAmount === '' || Number(offeredAmount) < 0) {
      setErrorMsg('Please specify a valid offered budget');
      return;
    }

    const trimmedBuilding = buildingHouseNo.trim();
    if (!trimmedBuilding) {
      setErrorMsg('Building / Flat / House No. is compulsory.');
      return;
    }
    if (!locality.trim()) {
      setErrorMsg('Locality / Neighborhood is compulsory.');
      return;
    }

    if ((!willPickup || !willDropBack) && (deliveryFee === '' || Number(deliveryFee) < 0)) {
      setErrorMsg('Please write down the extra amount you will pay for someone to pick and drop for you.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      const fullDestinationAddress = buildAddressString(trimmedBuilding, streetArea.trim(), pincode.trim(), locality.trim());
      const extraFeeNumber = (!willPickup || !willDropBack) ? Number(deliveryFee || 0) : 0;

      await api.updateRequest(request.id, {
        item_name: itemName.trim(),
        description: description.trim(),
        category,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        duration_days: Number(durationDays || 1),
        offered_amount: Number(offeredAmount),
        locality: locality.trim(),
        address_text: fullDestinationAddress,
        pincode: pincode.trim() || undefined,
        will_pickup: willPickup,
        will_drop_back: willDropBack,
        delivery_fee: extraFeeNumber,
        pickup_type: willPickup ? 'LENDER_LOCATION' : 'MY_LOCATION',
        pickup_locality: willPickup ? 'Lender Location' : fullDestinationAddress,
        return_type: willDropBack ? 'LENDER_LOCATION' : 'MY_LOCATION',
        return_locality: willDropBack ? 'Lender Location' : fullDestinationAddress,
        status,
        image_url: imageUrl || null,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update request:', err);
      setErrorMsg(err.message || 'Failed to update request.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!request) return;
    if (!window.confirm(`Are you sure you want to delete your request for "${request.item_name}"?`)) {
      return;
    }

    setIsDeleting(true);
    setErrorMsg('');
    try {
      await api.deleteRequest(request.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to delete request:', err);
      setErrorMsg(err.message || 'Failed to delete request.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !request) return null;

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
              Edit Gear Request
            </h3>
            <p className="text-xs text-ink-secondary">Update your wanted item details, offered budget, or status</p>
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

          {/* Reference Photo Upload */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1.5">
              Reference Picture <span className="font-normal text-ink-secondary">(Optional)</span>
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-canvas border border-divider overflow-hidden shrink-0 relative group flex items-center justify-center">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Request Reference"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-ink-secondary p-2 text-center">
                    <Camera className="w-6 h-6 stroke-[1.5]" />
                  </div>
                )}
                {isUploadingPhoto && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="px-3.5 py-1.5 rounded-full border border-divider hover:bg-canvas text-xs font-bold text-ink cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-brand" />
                    <span>{isUploadingPhoto ? 'Uploading...' : imageUrl ? 'Change Picture' : 'Upload Picture'}</span>
                  </button>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="px-3 py-1.5 rounded-full hover:bg-rose-500/10 text-rose-500 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <p className="text-[11px] text-ink-secondary">
                  Add a photo of the item you want so neighbors know the exact model or condition.
                </p>
              </div>
            </div>
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Item Name *</label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. GoPro Hero 12 for weekend hike"
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
                <option value="Clothing & Fits">Clothing & Fits</option>
                <option value="Tools & DIY">Tools & DIY</option>
                <option value="Home & Appliances">Home & Appliances</option>
                <option value="Sports & Fitness">Sports & Fitness</option>
                <option value="Books & Media">Books & Media</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Request Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none cursor-pointer"
              >
                <option value="OPEN">Open (Seeking Gear)</option>
                <option value="FULFILLED">Fulfilled</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Date & Return Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Needed From Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Return Date *</label>
              <input
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Duration & Budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Duration (Days)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 2"
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Offered Budget (₹) *</label>
              <input
                type="number"
                min="0"
                value={offeredAmount}
                onChange={(e) => setOfferedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 500"
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand"
                required
              />
            </div>
          </div>

          {/* Transport & Handover Preference Toggles */}
          <div className="space-y-3 pt-1 border-t border-divider">
            <label className="block text-xs font-bold text-ink">Transport & Handover Preference</label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Pickup Toggle */}
              <div className={`p-3 rounded-2xl border transition-all ${
                willPickup
                  ? 'bg-emerald-500/5 border-emerald-500/30'
                  : 'bg-brand/5 border-brand/30'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-ink block">
                      {willPickup ? 'Pick up myself' : 'Need delivery'}
                    </span>
                    <span className="text-[10px] text-ink-secondary block">
                      {willPickup ? 'Go to lender to collect' : 'Lender delivers to you'}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={willPickup}
                    onClick={() => setWillPickup(!willPickup)}
                    className={`w-10 h-5.5 rounded-full transition-colors relative shrink-0 cursor-pointer p-0.5 ${
                      willPickup ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span className={`block w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform ${
                      willPickup ? 'translate-x-4.5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Drop / Return Toggle */}
              <div className={`p-3 rounded-2xl border transition-all ${
                willDropBack
                  ? 'bg-emerald-500/5 border-emerald-500/30'
                  : 'bg-brand/5 border-brand/30'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-ink block">
                      {willDropBack ? 'Drop back myself' : 'Need collection'}
                    </span>
                    <span className="text-[10px] text-ink-secondary block">
                      {willDropBack ? 'Return to lender yourself' : 'Lender collects from you'}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={willDropBack}
                    onClick={() => setWillDropBack(!willDropBack)}
                    className={`w-10 h-5.5 rounded-full transition-colors relative shrink-0 cursor-pointer p-0.5 ${
                      willDropBack ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span className={`block w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform ${
                      willDropBack ? 'translate-x-4.5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Extra Amount if not picking up or dropping back */}
            {(!willPickup || !willDropBack) && (
              <div className="p-3 rounded-2xl bg-brand/5 border border-brand/20 space-y-1.5 animate-in fade-in">
                <label className="block text-xs font-bold text-ink">
                  Extra amount you'll pay for transport / delivery service (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-secondary">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 50 or 100"
                    className="w-full bg-surface border border-divider rounded-xl pl-7 pr-3 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand"
                    required={!willPickup || !willDropBack}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Destination Location */}
          <div className="space-y-2 pt-1 border-t border-divider">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-ink">Item Destination Location</label>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="text-[11px] font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3 h-3" />
                <span>{isDetectingLocation ? 'Detecting...' : 'Use current location'}</span>
              </button>
            </div>

            {locationSuccessMsg && (
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {locationSuccessMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-ink mb-0.5">
                  Building / Flat / House No. <span className="text-brand">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={buildingHouseNo}
                  onChange={(e) => setBuildingHouseNo(e.target.value)}
                  placeholder="e.g. Flat 402, Building 3B / House #12"
                  className="w-full bg-canvas border border-divider rounded-xl px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-ink mb-0.5">Street / Landmark</label>
                <input
                  type="text"
                  value={streetArea}
                  onChange={(e) => setStreetArea(e.target.value)}
                  placeholder="e.g. 5th Main Road, Near Metro Station / Landmark"
                  className="w-full bg-canvas border border-divider rounded-xl px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-ink mb-0.5">
                  Locality / City <span className="text-brand">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  placeholder="e.g. Indiranagar, Koramangala, Whitefield"
                  className="w-full bg-canvas border border-divider rounded-xl px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-ink mb-0.5">PIN Code</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 560060"
                  className="w-full bg-canvas border border-divider rounded-xl px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Description / Specifics</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you using it for? Any specific brand or accessories needed?"
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
              <span>Delete Request</span>
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
