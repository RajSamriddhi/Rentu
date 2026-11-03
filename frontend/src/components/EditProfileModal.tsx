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
  Sparkles,
  Navigation,
  Bell,
  Plus,
  Trash2,
  AtSign
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { uploadItemPhoto, supabase } from '../lib/supabase';
import { detectCurrentLocation, formatSavedLocationFull } from '../lib/location';
import { AddLocationModal } from './AddLocationModal';

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

  const parseAddress = (text?: string) => {
    if (!text) return { building: '', street: '' };
    const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { building: parts[0], street: parts.slice(1).join(', ') };
    }
    return { building: '', street: text };
  };

  const initialAddr = parseAddress(user?.address_text);
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [buildingHouseNo, setBuildingHouseNo] = useState(initialAddr.building);
  const [streetArea, setStreetArea] = useState(initialAddr.street);
  const [locality, setLocality] = useState(user?.locality || '');
  const [pincode, setPincode] = useState(user?.pincode || '');
  const [latitude, setLatitude] = useState<number | undefined>(user?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(user?.longitude);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState('');
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
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Sync state when user changes
  React.useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setBio(user.bio || '');
      setPhone(user.phone || '');
      const addr = parseAddress(user.address_text);
      setBuildingHouseNo(addr.building);
      setStreetArea(addr.street);
      setLocality(user.locality || '');
      setPincode(user.pincode || '');
      setLatitude(user.latitude);
      setLongitude(user.longitude);
      setAvatarUrl(user.avatar_url || '');
      setBannerUrl(
        user.banner_url || 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1600&q=80'
      );
    }
  }, [user]);

  // Debounced check for username
  React.useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (!clean) {
      setUsernameStatus(null);
      setIsCheckingUsername(false);
      return;
    }
    if (user?.username && clean === user.username.toLowerCase()) {
      setUsernameStatus({ available: true, message: 'This is your current handle' });
      setIsCheckingUsername(false);
      return;
    }

    if (clean.length < 3) {
      setUsernameStatus({ available: false, message: 'Username must be at least 3 characters' });
      setIsCheckingUsername(false);
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
      setUsernameStatus({ available: false, message: 'Only lowercase letters, numbers, and underscores allowed' });
      setIsCheckingUsername(false);
      return;
    }

    setIsCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.checkUsername(clean);
        setUsernameStatus(res);
      } catch (err: any) {
        setUsernameStatus({ available: false, message: err.message || 'Error checking username' });
      } finally {
        setIsCheckingUsername(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [username, user?.username]);

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
        setAvatarUploadStatus('Profile picture uploaded successfully.');
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
        setBannerUploadStatus('Background banner uploaded successfully.');
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

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setErrorMsg('');
    setLocationSuccessMsg('');
    try {
      const loc = await detectCurrentLocation();
      // DO NOT overwrite buildingHouseNo - user must manually type or keep their building/flat/house
      if (loc.address_text) {
        setStreetArea(loc.address_text);
      }
      if (loc.locality) {
        setLocality(loc.locality);
      }
      if (loc.pincode) {
        setPincode(loc.pincode);
      }
      setLatitude(loc.latitude);
      setLongitude(loc.longitude);

      // Clean friendly location summary without exposing raw latitude/longitude coordinates
      const locSummary = [loc.address_text, loc.locality].filter(Boolean).join(', ') || loc.city || 'Neighborhood location detected';
      setLocationSuccessMsg(`Location detected: ${locSummary}`);
      try {
        confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
      } catch {}
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not detect current location.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedBuilding = buildingHouseNo.trim();
    if (!trimmedBuilding) {
      setErrorMsg('Building / Flat / House No. is compulsory. Please enter your building, flat, or house number before saving.');
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername && cleanUsername !== user?.username?.toLowerCase()) {
      if (usernameStatus && !usernameStatus.available) {
        setErrorMsg(usernameStatus.message || 'Username is not available. Please choose another one.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const fullAddress = [trimmedBuilding, streetArea.trim()].filter(Boolean).join(', ');

      await api.updateProfile({
        name: name.trim(),
        username: cleanUsername || undefined,
        bio: bio.trim(),
        phone: phone.trim() || undefined,
        locality: locality.trim() || undefined,
        address_text: fullAddress,
        pincode: pincode.trim() || undefined,
        latitude,
        longitude,
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
            {/* Username / Custom Link */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-ink flex items-center gap-1.5 flex-wrap">
                  <AtSign className="w-3.5 h-3.5 text-brand" />
                  <span>Unique Username & Handle *</span>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Guaranteed Unique
                  </span>
                </label>
                {isCheckingUsername ? (
                  <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                  </span>
                ) : usernameStatus?.available ? (
                  <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Unique & Available
                  </span>
                ) : usernameStatus && !usernameStatus.available ? (
                  <span className="text-[11px] text-red-500 font-bold flex items-center gap-1">
                    <X className="w-3 h-3" /> {usernameStatus.message}
                  </span>
                ) : null}
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs font-bold text-ink-secondary select-none">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="your-unique-username"
                  maxLength={30}
                  className="w-full bg-canvas border border-divider rounded-xl pl-8 pr-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  required
                />
              </div>
              <p className="text-[11px] text-ink-secondary mt-1">
                Your dedicated page:{' '}
                <span className="text-brand font-mono font-bold">
                  rentu.site/{username || 'username'}
                </span>
                <span className="block text-[10px] text-ink-muted mt-0.5">
                  Your username is verified unique across Rentu and cannot be shared or duplicated by any other member.
                </span>
              </p>
            </div>

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

            {/* Phone Number */}
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

            {/* Location & Address Section */}
            <div className="pt-3 border-t border-divider space-y-3">
              {/* GPS "Use My Current Location" Card */}
              <div className="bg-canvas border border-divider rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-brand" />
                      <span className="text-xs font-black text-ink uppercase tracking-wider">
                        Set Your Location
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-secondary mt-0.5">
                      Coordinates are stored securely to calculate distance with nearby lenders & borrowers.
                    </p>
                  </div>

                  <button
                    type="button"
                    id="use-my-current-location-btn"
                    onClick={handleDetectLocation}
                    disabled={isDetectingLocation}
                    className="btn-primary text-xs px-3.5 py-2 inline-flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap active:scale-95 transition-all self-start sm:self-auto shrink-0"
                  >
                    {isDetectingLocation ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Detecting GPS...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Use my current location</span>
                      </>
                    )}
                  </button>
                </div>

                {(locationSuccessMsg || (latitude && longitude)) && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold animate-in fade-in">
                    <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                    <span>
                      {locationSuccessMsg || 'GPS Location pinpointed & verified'}
                    </span>
                  </div>
                )}
              </div>

              {/* Explicit Address Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Building / House / Flat No. */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Building / Flat / House No. <span className="text-brand font-black">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={buildingHouseNo}
                    onChange={(e) => setBuildingHouseNo(e.target.value)}
                    placeholder="e.g. Stanza Living Kimberly / Flat 304, Sunshine Apts"
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
                    placeholder="e.g. 5th Main, Near Metro Station"
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Locality / Neighborhood */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Locality / Neighborhood
                  </label>
                  <input
                    type="text"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="e.g. Indiranagar / Koramangala"
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
                    placeholder="e.g. 560038"
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Additional Saved Pickup & Drop Locations */}
              <div className="pt-3 border-t border-divider space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-brand" />
                      <span>Additional Saved Locations</span>
                    </h4>
                    <p className="text-[11px] text-ink-secondary">
                      Save alternative locations (e.g. Office, Studio) to quickly select when listing products.
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

                {/* Render User's Saved Locations */}
                {Array.isArray(user?.saved_locations) && user.saved_locations.length > 0 ? (
                  <div className="space-y-2">
                    {user.saved_locations.map((loc) => (
                      <div
                        key={loc.id}
                        className="p-3 rounded-2xl bg-canvas border border-divider flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-ink">{loc.label}</span>
                            <span className="text-[10px] text-ink-secondary font-medium">({loc.locality})</span>
                          </div>
                          <p className="text-[11px] text-ink-secondary truncate mt-0.5">
                            {formatSavedLocationFull(loc)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`Remove saved location "${loc.label}"?`)) {
                              await api.deleteSavedLocation(loc.id, user);
                              await refreshUser();
                            }
                          }}
                          className="p-1.5 rounded-lg text-ink-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                          title="Remove location"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-canvas border border-divider/60 text-center text-[11px] text-ink-secondary">
                    No additional locations saved yet. Click "+ Add Another Location" to add an office, studio, or warehouse address.
                  </div>
                )}
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

      {/* Add Another Location Modal */}
      <AddLocationModal
        isOpen={isAddLocationOpen}
        onClose={() => setIsAddLocationOpen(false)}
        onSuccess={async () => {
          await refreshUser();
        }}
      />
    </div>
  );
};
