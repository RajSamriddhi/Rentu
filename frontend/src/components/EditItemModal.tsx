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
      setErrorMsg('');
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

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
