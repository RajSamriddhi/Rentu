import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Loader2, 
  Check, 
  User, 
  MapPin, 
  Phone, 
  FileText, 
  Camera, 
  ImageIcon,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { uploadItemPhoto, supabase } from '../lib/supabase';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESET_BANNERS = [
  {
    name: 'Mountain Peak',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Redwood Forest',
    url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Night Campfire',
    url: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Camera Studio',
    url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Neon Cyber',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Minimal Dark',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80',
  },
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [locality, setLocality] = useState(user?.locality || 'Saket, New Delhi');
  const [addressText, setAddressText] = useState(user?.address_text || '');
  const [pincode, setPincode] = useState(user?.pincode || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [bannerUrl, setBannerUrl] = useState(
    user?.banner_url || 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1600&q=80'
  );

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUploadStatus, setAvatarUploadStatus] = useState('');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerUploadStatus, setBannerUploadStatus] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Sync state when user changes
  React.useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setPhone(user.phone || '');
      setLocality(user.locality || 'Saket, New Delhi');
      setAddressText(user.address_text || '');
      setPincode(user.pincode || '');
      setAvatarUrl(user.avatar_url || '');
      setBannerUrl(
        user.banner_url || 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1600&q=80'
      );
    }
  }, [user]);

  if (!isOpen) return null;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    setAvatarUploadStatus('Uploading avatar to Supabase...');
    setErrorMsg('');

    try {
      if (supabase) {
        const publicUrl = await uploadItemPhoto(file, 'avatars');
        setAvatarUrl(publicUrl);
        setAvatarUploadStatus('✓ Profile picture uploaded!');
      } else {
        const previewUrl = URL.createObjectURL(file);
        setAvatarUrl(previewUrl);
        setAvatarUploadStatus('Local photo preview active.');
      }
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      const previewUrl = URL.createObjectURL(file);
      setAvatarUrl(previewUrl);
      setAvatarUploadStatus(`Notice: ${err.message || 'Using local preview'}`);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBanner(true);
    setBannerUploadStatus('Uploading banner to Supabase...');
    setErrorMsg('');

    try {
      if (supabase) {
        const publicUrl = await uploadItemPhoto(file, 'banners');
        setBannerUrl(publicUrl);
        setBannerUploadStatus('✓ Background banner uploaded!');
      } else {
        const previewUrl = URL.createObjectURL(file);
        setBannerUrl(previewUrl);
        setBannerUploadStatus('Local banner preview active.');
      }
    } catch (err: any) {
      console.error('Banner upload failed:', err);
      const previewUrl = URL.createObjectURL(file);
      setBannerUrl(previewUrl);
      setBannerUploadStatus(`Notice: ${err.message || 'Using local preview'}`);
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');

    try {
      await api.updateProfile({
        name: name.trim(),
        bio: bio.trim(),
        phone: phone.trim() || undefined,
        locality: locality.trim(),
        address_text: addressText.trim() || undefined,
        pincode: pincode.trim() || undefined,
        avatar_url: avatarUrl || undefined,
        banner_url: bannerUrl || undefined,
      });

      await refreshUser();
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentAvatarDisplay = avatarUrl || (name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-surface rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-4 border border-divider">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-canvas/30">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-black text-ink uppercase tracking-wider font-display">
              Edit Your Profile & Appearance
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-hover text-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* 1. Background Cover Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-brand" />
                Background Cover Picture
              </label>
              {bannerUploadStatus && (
                <span className="text-[11px] text-emerald-500 font-bold">{bannerUploadStatus}</span>
              )}
            </div>

            {/* Banner Preview & Direct Upload Button */}
            <div className="relative h-32 sm:h-36 w-full rounded-2xl overflow-hidden border border-divider group bg-zinc-800">
              <img
                src={bannerUrl}
                alt="Banner Preview"
                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={isUploadingBanner}
                  className="bg-white/90 dark:bg-zinc-900/90 hover:bg-white text-ink px-4 py-2 rounded-full text-xs font-bold shadow-lg cursor-pointer inline-flex items-center gap-1.5 backdrop-blur-sm"
                >
                  {isUploadingBanner ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  Upload Custom Cover Photo
                </button>
              </div>
            </div>

            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerFileChange}
              className="hidden"
            />

            {/* Curated Theme Presets */}
            <div>
              <p className="text-[11px] font-bold text-ink-secondary mb-1.5">Or choose a preset cover theme:</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PRESET_BANNERS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setBannerUrl(preset.url)}
                    className={`relative rounded-xl overflow-hidden h-14 border-2 transition-all cursor-pointer group ${
                      bannerUrl === preset.url
                        ? 'border-brand ring-2 ring-brand/30'
                        : 'border-divider hover:border-ink-secondary'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-1">
                      <span className="text-[9px] font-black text-white text-center leading-tight truncate">
                        {preset.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Profile Avatar Section */}
          <div className="space-y-2 pt-2 border-t border-divider">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-brand" />
                Profile Picture
              </label>
              {avatarUploadStatus && (
                <span className="text-[11px] text-emerald-500 font-bold">{avatarUploadStatus}</span>
              )}
            </div>

            <div className="flex items-center gap-4 p-3 bg-canvas border border-divider rounded-2xl">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-divider shrink-0 group">
                <img
                  src={currentAvatarDisplay}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                  title="Upload photo"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 space-y-1.5">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="btn-secondary text-xs px-3 py-1.5 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    {isUploadingAvatar ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading to Supabase...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" /> Upload Photo from Computer
                      </>
                    )}
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="text-xs text-ink-secondary hover:text-red-500 underline cursor-pointer"
                    >
                      Reset to Initials
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-ink-secondary">
                  PNG, JPG or WEBP up to 5MB. Saved directly to Supabase Storage.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Basic Info Fields */}
          <div className="space-y-3 pt-2 border-t border-divider">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sadiqua Parween"
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                required
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Bio / Tagline</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell others what you do, what gear you love, or what you like borrowing..."
                rows={2}
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2 text-xs font-medium text-ink outline-none focus:border-brand"
              />
            </div>

            {/* Grid: Phone & Locality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Locality / City *</label>
                <input
                  type="text"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  placeholder="e.g. Kengeri, Bangalore"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  required
                />
              </div>
            </div>

            {/* Grid: Address & Pincode */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-ink mb-1">Pickup Address (Friendly)</label>
                <input
                  type="text"
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  placeholder="e.g. 5th Cross, Near Metro Station"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Pincode</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 560060"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>

          {/* Submit CTA */}
          <div className="pt-4 border-t border-divider flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs cursor-pointer px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploadingAvatar || isUploadingBanner}
              className="btn-primary text-xs cursor-pointer shadow-pink px-6 py-2 inline-flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Save All Changes
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
