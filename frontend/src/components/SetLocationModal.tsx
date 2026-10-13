import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Navigation, 
  Loader2, 
  Check, 
  Sparkles, 
  Building2, 
  Compass, 
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { detectCurrentLocation, ResolvedLocation } from '../lib/location';
import { CITIES, extractCity } from '../lib/city';

interface SetLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (location: ResolvedLocation) => void;
  canSkip?: boolean;
}

export const SetLocationModal: React.FC<SetLocationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  canSkip = true,
}) => {
  const { user, refreshUser } = useAuth();

  const [locality, setLocality] = useState(user?.locality || 'Saket, New Delhi');
  const [addressText, setAddressText] = useState(user?.address_text || '');
  const [city, setCity] = useState<string>(user?.locality ? extractCity(user.locality) : 'Delhi');
  const [pincode, setPincode] = useState(user?.pincode || '');
  const [latitude, setLatitude] = useState<number | undefined>(user?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(user?.longitude);

  const [isDetecting, setIsDetecting] = useState(false);
  const [detectStatus, setDetectStatus] = useState<string>('');
  const [hasDetected, setHasDetected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Prefill state from user profile whenever modal opens
  useEffect(() => {
    if (user) {
      setLocality(user.locality || 'Saket, New Delhi');
      setAddressText(user.address_text || '');
      setCity(user.locality ? extractCity(user.locality) : 'Delhi');
      setPincode(user.pincode || '');
      setLatitude(user.latitude);
      setLongitude(user.longitude);
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  // 1-Click Detect GPS Location
  const handleFindCurrentLocation = async () => {
    setErrorMsg('');
    setIsDetecting(true);
    setDetectStatus('Requesting GPS coordinates...');
    try {
      setDetectStatus('Connecting to satellites & pinpointing address...');
      const loc = await detectCurrentLocation();
      
      setLocality(loc.locality);
      setCity(loc.city);
      setAddressText(loc.address_text);
      setPincode(loc.pincode);
      setLatitude(loc.latitude);
      setLongitude(loc.longitude);
      setHasDetected(true);
      setDetectStatus(`Detected: ${loc.locality}`);

      // Micro celebration
      try {
        confetti({
          particleCount: 25,
          spread: 45,
          origin: { y: 0.6 },
        });
      } catch {}
    } catch (err: any) {
      console.warn('Geolocation error:', err);
      setErrorMsg(err.message || 'Could not find current location. Please enter your address below.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!locality.trim()) {
      setErrorMsg('Please enter your locality or campus name.');
      return;
    }

    setIsSaving(true);
    try {
      const cleanLocality = locality.trim();
      const cleanAddress = addressText.trim() || cleanLocality;

      // Update user profile in backend
      await api.updateProfile({
        locality: cleanLocality,
        address_text: cleanAddress,
        pincode: pincode.trim(),
        latitude,
        longitude,
      });

      // Update localStorage fallback
      localStorage.setItem('rentu_user_location', JSON.stringify({
        locality: cleanLocality,
        address_text: cleanAddress,
        pincode: pincode.trim(),
        city,
        latitude,
        longitude,
      }));

      // Refresh auth profile
      await refreshUser();

      // Confetti celebrate
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {}

      if (onSuccess) {
        onSuccess({
          locality: cleanLocality,
          city,
          address_text: cleanAddress,
          pincode: pincode.trim(),
          latitude: latitude || 28.5245,
          longitude: longitude || 77.2065,
          full_address: cleanAddress,
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Save location error:', err);
      // Even if remote network fails, store locally so user can proceed
      localStorage.setItem('rentu_user_location', JSON.stringify({
        locality,
        address_text: addressText || locality,
        city,
      }));
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="relative bg-surface w-full max-w-lg rounded-3xl border border-divider shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-surface">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-ink font-display leading-tight">
                Set Your Location
              </h3>
              <p className="text-[11px] text-ink-secondary font-medium">
                Connect with nearby lenders & unlock accurate gear distance
              </p>
            </div>
          </div>
          {canSkip && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-surface-hover text-ink-secondary hover:text-ink transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs p-3.5 rounded-2xl flex items-start gap-2.5 font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1-Click Detect GPS Location Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-brand/10 via-brand-soft/60 to-purple-500/10 border-2 border-brand/30 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-brand">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Instant Setup</span>
                </div>
                <h4 className="text-sm font-extrabold text-ink">
                  Find My Current Location
                </h4>
                <p className="text-xs text-ink-secondary">
                  Auto-detect your locality, street address, and PIN code with 1 click.
                </p>
              </div>

              <button
                type="button"
                onClick={handleFindCurrentLocation}
                disabled={isDetecting}
                className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover active:scale-95 text-white font-extrabold text-xs px-4 py-3 rounded-xl shadow-md transition-all cursor-pointer shrink-0 disabled:opacity-60"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Detecting GPS...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4 animate-pulse" />
                    <span>Detect Location 📍</span>
                  </>
                )}
              </button>
            </div>

            {/* GPS Detection Status Pill */}
            {hasDetected && (
              <div className="mt-3 pt-3 border-t border-brand/20 flex items-center justify-between text-xs text-brand font-bold animate-in fade-in">
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{detectStatus}</span>
                </span>
                {latitude && longitude && (
                  <span className="text-[10px] font-mono text-ink-secondary bg-surface px-2 py-0.5 rounded-md border border-divider">
                    {latitude.toFixed(4)}, {longitude.toFixed(4)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Form: Review & Confirm Address Details */}
          <form onSubmit={handleSaveLocation} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Locality / Neighborhood *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-ink-secondary absolute left-3 top-3" />
                  <input
                    type="text"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="e.g. Saket, South Delhi"
                    className="w-full bg-canvas border border-divider rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  City *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-ink-secondary absolute left-3 top-3" />
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-canvas border border-divider rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand transition-colors cursor-pointer appearance-none"
                  >
                    {CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Full Street Address / Flat / Landmark
              </label>
              <textarea
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder="e.g. Flat 302, Green Park Apts, Main Ring Road, near Metro Gate 2"
                rows={2}
                className="w-full bg-canvas border border-divider rounded-xl px-3 py-2 text-xs font-medium text-ink outline-none focus:border-brand transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  PIN / Postal Code
                </label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 110017"
                  maxLength={10}
                  className="w-full bg-canvas border border-divider rounded-xl px-3 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Radar Visibility
                </label>
                <div className="flex items-center gap-2 bg-canvas border border-divider rounded-xl px-3 py-2.5 text-xs text-ink-secondary font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-[11px] font-bold text-ink truncate">
                    100m - 5km Radius
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-divider flex items-center justify-between gap-3">
              {canSkip ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs font-bold text-ink-secondary hover:text-ink cursor-pointer transition-colors"
                >
                  Skip for now
                </button>
              ) : <div />}

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 bg-ink dark:bg-white text-white dark:text-ink hover:opacity-90 active:scale-95 font-extrabold text-xs px-6 py-3 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Save Location & Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
