import React, { useState, useRef } from 'react';
import { X, Check, Upload, ArrowRight, ArrowLeft, Loader2, Image as ImageIcon, Navigation } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { uploadItemPhoto, supabase } from '../lib/supabase';
import { detectCurrentLocation } from '../lib/location';

interface DropGearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onOpenAuth: () => void;
}

export const DropGearModal: React.FC<DropGearModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenAuth,
}) => {
  const { user, isAuthenticated } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics & Tech');
  const [listingType, setListingType] = useState<'Rent' | 'Borrow'>('Rent');
  const [pricePerDay, setPricePerDay] = useState(300);
  const [maxDurationDays, setMaxDurationDays] = useState(5);
  const [condition, setCondition] = useState('Like new');
  const [locality, setLocality] = useState(user?.locality || 'Saket, New Delhi');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setUploadStatus('Uploading photo to Supabase Storage...');
    setErrorMsg('');

    try {
      if (supabase) {
        const publicUrl = await uploadItemPhoto(file);
        setImageUrl(publicUrl);
        setUploadStatus('Uploaded to Supabase Storage (item-photos)!');
      } else {
        const previewUrl = URL.createObjectURL(file);
        setImageUrl(previewUrl);
        setUploadStatus('Photo preview active. Add VITE_SUPABASE_URL to persist to cloud storage.');
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      const previewUrl = URL.createObjectURL(file);
      setImageUrl(previewUrl);
      setUploadStatus(`Notice: ${err.message || 'Using local photo preview'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const PHOTO_PRESETS = [
    { label: 'Headphones', url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80' },
    { label: 'Camera', url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80' },
    { label: 'Projector', url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80' },
    { label: 'Tent', url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80' },
    { label: 'Drill', url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80' },
    { label: 'Guitar', url: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=800&q=80' },
  ];

  if (!isOpen) return null;

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) setStep((s) => (s + 1) as any);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }

    const finalImage = imageUrl || PHOTO_PRESETS[0].url;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await api.createItem({
        title,
        description: description || `Great condition ${title} ready to rent or share locally.`,
        category,
        price_per_day: listingType === 'Borrow' ? 0 : Number(pricePerDay),
        max_duration_days: Number(maxDurationDays),
        image_urls: [finalImage],
        sticker_badge: '✨ Available',
        locality: locality || user?.locality || 'Saket, New Delhi',
      });

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to list item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-surface rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-4 border border-divider">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider">
          <div className="text-xs font-bold text-ink-secondary">
            Screen: List an Item
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-hover text-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Body matching Screen 5 */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
          
          {/* Left Stepper Column matching Screen 5 */}
          <div className="md:col-span-4 bg-canvas/60 p-4 md:p-6 border-b md:border-b-0 md:border-r border-divider space-y-3 md:space-y-6">
            <h3 className="text-[11px] font-black uppercase text-ink-secondary tracking-wider hidden md:block">
              Steps
            </h3>

            <div className="flex md:flex-col gap-3 md:gap-4 overflow-x-auto text-xs font-bold scrollbar-none pb-1 md:pb-0">
              {[
                { num: 1, label: 'Item details' },
                { num: 2, label: 'Pricing & Availability' },
                { num: 3, label: 'Photos' },
                { num: 4, label: 'Review' },
              ].map((s) => {
                const isActive = step === s.num;
                const isPassed = step > s.num;
                return (
                  <div key={s.num} className="flex items-center gap-2 md:gap-3 shrink-0">
                    <div
                      className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs font-extrabold transition-all shrink-0 ${
                        isActive
                          ? 'bg-brand text-white shadow-xs'
                          : isPassed
                          ? 'bg-emerald-500 text-white'
                          : 'bg-divider text-ink-secondary'
                      }`}
                    >
                      {isPassed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.num}
                    </div>
                    <span className={`text-[11px] md:text-xs whitespace-nowrap ${isActive ? 'text-ink font-extrabold' : 'text-ink-secondary'}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Form Area matching Screen 5 */}
          <div className="md:col-span-8 p-6 sm:p-8 flex flex-col justify-between">
            <form onSubmit={handleNext}>
              
              {/* Header Title + Sticker Doodle from Screen 5 */}
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-black text-ink tracking-tight font-display">
                    List an Item
                  </h2>
                  <p className="text-xs text-ink-secondary font-medium mt-1">
                    Turn your unused items into income (or help someone for free)
                  </p>
                </div>

                <div className="bg-brand-soft border border-brand/20 text-brand px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-xs rotate-3 shrink-0">
                  GOOD THINGS CIRCULATE
                </div>
              </div>

              {errorMsg && (
                <div className="mb-4 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-bold">
                  {errorMsg}
                </div>
              )}

              {/* STEP 1: ITEM DETAILS */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Item title *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Sony Headphones WH-1000XM4"
                      className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Category *</label>
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
                    <label className="block text-xs font-bold text-ink mb-1">Description *</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Be specific about your item, condition, and included accessories..."
                      rows={3}
                      className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2 text-xs font-medium text-ink outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Condition *</label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2 text-xs font-bold text-ink outline-none cursor-pointer"
                    >
                      <option value="Like new">Like new</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-ink">Gear Location / Area *</label>
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={isDetectingLocation}
                        className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-brand bg-brand-soft hover:bg-brand/20 active:scale-95 px-2 py-0.5 rounded-lg border border-brand/20 transition-all cursor-pointer disabled:opacity-50"
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
                      placeholder="e.g. Saket, South Delhi"
                      className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2 text-xs font-bold text-ink outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: PRICING & AVAILABILITY */}
              {step === 2 && (
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-bold text-ink mb-2">Listing type</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                        <input
                          type="radio"
                          name="listType"
                          checked={listingType === 'Rent'}
                          onChange={() => setListingType('Rent')}
                          className="text-brand accent-brand cursor-pointer"
                        />
                        <span className="font-bold">Rent (Set a price)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                        <input
                          type="radio"
                          name="listType"
                          checked={listingType === 'Borrow'}
                          onChange={() => setListingType('Borrow')}
                          className="text-brand accent-brand cursor-pointer"
                        />
                        <span>Borrow for free</span>
                      </label>
                    </div>
                  </div>

                  {listingType === 'Rent' && (
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Price per day * (₹)</label>
                      <input
                        type="number"
                        min="10"
                        value={pricePerDay}
                        onChange={(e) => setPricePerDay(Number(e.target.value))}
                        className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Maximum lending duration</label>
                    <select
                      value={maxDurationDays}
                      onChange={(e) => setMaxDurationDays(Number(e.target.value))}
                      className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none cursor-pointer"
                    >
                      <option value={3}>Up to 3 days</option>
                      <option value={5}>Up to 5 days</option>
                      <option value={7}>Up to 7 days (1 week)</option>
                      <option value={14}>Up to 14 days (2 weeks)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Pickup Locality</label>
                    <input
                      type="text"
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: PHOTOS (Powered by Supabase Storage) */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-ink">Item Photos</label>
                    <span className="text-[10px] font-semibold text-brand bg-brand-soft px-2 py-0.5 rounded-full border border-brand/20">
                      Supabase Storage: item-photos
                    </span>
                  </div>

                  {/* Supabase Storage Upload Box */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all ${
                      isUploading
                        ? 'border-brand bg-brand-soft/40'
                        : imageUrl
                        ? 'border-emerald-400 bg-emerald-500/5 hover:border-emerald-500'
                        : 'border-divider hover:border-brand hover:bg-surface-hover'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {isUploading ? (
                      <div className="flex flex-col items-center justify-center py-3 gap-2">
                        <Loader2 className="w-8 h-8 text-brand animate-spin" />
                        <span className="text-xs font-bold text-ink">Uploading photo to Supabase...</span>
                      </div>
                    ) : imageUrl ? (
                      <div className="flex items-center justify-center gap-4">
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-divider shadow-sm shrink-0">
                          <img src={imageUrl} alt="Uploaded item" className="w-full h-full object-cover" />
                        </div>
                        <div className="text-left">
                          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="w-4 h-4 stroke-[3]" /> Photo ready
                          </div>
                          <p className="text-[11px] text-ink-secondary truncate max-w-xs mt-0.5">
                            {imageUrl}
                          </p>
                          <span className="text-[10px] font-bold text-brand hover:underline mt-1 inline-block">
                            Click to replace photo
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-2 gap-1.5">
                        <div className="w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="text-xs font-bold text-ink">
                          Upload photo to Supabase
                        </div>
                        <div className="text-[11px] text-ink-secondary">
                          PNG, JPG, WebP up to 5MB (stored in bucket: item-photos)
                        </div>
                      </div>
                    )}
                  </div>

                  {uploadStatus && (
                    <div className="text-[11px] font-medium text-ink-secondary bg-canvas px-3 py-1.5 rounded-lg border border-divider">
                      {uploadStatus}
                    </div>
                  )}

                  {/* Preset Quick-Picks */}
                  <div>
                    <label className="block text-[11px] font-bold text-ink-secondary mb-2">
                      Or select a quick stock photo preset:
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {PHOTO_PRESETS.map((p) => (
                        <button
                          type="button"
                          key={p.label}
                          onClick={() => {
                            setImageUrl(p.url);
                            setUploadStatus(`Selected preset: ${p.label}`);
                          }}
                          className={`aspect-square rounded-xl overflow-hidden border-2 relative cursor-pointer transition-all ${
                            imageUrl === p.url ? 'border-brand ring-2 ring-brand' : 'border-divider hover:border-ink-secondary'
                          }`}
                        >
                          <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                          <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1 rounded font-bold">
                            {p.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-ink-secondary mb-1">
                      Or paste an existing image URL:
                    </label>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => {
                        setImageUrl(e.target.value);
                        setUploadStatus('');
                      }}
                      placeholder="https://...supabase.co/storage/v1/object/public/item-photos/..."
                      className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2 text-xs font-medium text-ink outline-none"
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW */}
              {step === 4 && (
                <div className="bg-canvas border border-divider rounded-2xl p-5 space-y-3 max-w-md">
                  <h4 className="text-sm font-extrabold text-ink">Listing Review</h4>
                  <div className="text-xs space-y-1.5 text-ink-secondary">
                    <div><span className="font-bold text-ink">Title:</span> {title}</div>
                    <div><span className="font-bold text-ink">Category:</span> {category}</div>
                    <div><span className="font-bold text-ink">Type:</span> {listingType}</div>
                    <div><span className="font-bold text-ink">Rate:</span> ₹{listingType === 'Borrow' ? '0 (Free)' : `${pricePerDay} / day`}</div>
                    <div><span className="font-bold text-ink">Max Duration:</span> {maxDurationDays} days</div>
                    <div><span className="font-bold text-ink">Condition:</span> {condition}</div>
                    <div><span className="font-bold text-ink">Locality:</span> {locality}</div>
                  </div>
                </div>
              )}

              {/* Stepper Navigation */}
              <div className="mt-8 pt-4 border-t border-divider flex items-center justify-between">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => (s - 1) as any)}
                    className="btn-secondary text-xs cursor-pointer inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                ) : <div />}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary text-xs cursor-pointer shadow-pink inline-flex items-center gap-1.5"
                >
                  <span>
                    {isSubmitting
                      ? 'Publishing...'
                      : step === 1
                      ? 'Next: Pricing & Availability'
                      : step === 2
                      ? 'Next: Photos'
                      : step === 3
                      ? 'Next: Review'
                      : 'Publish Listing ✨'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </form>
          </div>

        </div>

      </div>
    </div>
  );
};
