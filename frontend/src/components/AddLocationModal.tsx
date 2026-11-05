import React, { useState, useEffect } from 'react';
import { X, MapPin, Navigation, Loader2, Sparkles, Plus, Pencil, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { detectCurrentLocation } from '../lib/location';
import { SavedLocation } from '../lib/types';

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (location: SavedLocation) => void;
  locationToEdit?: SavedLocation | null;
}

export const AddLocationModal: React.FC<AddLocationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  locationToEdit,
}) => {
  const { user, refreshUser } = useAuth();

  const [label, setLabel] = useState(locationToEdit?.label || 'Office');
  const [buildingHouseNo, setBuildingHouseNo] = useState(locationToEdit?.building_flat_house || '');
  const [streetArea, setStreetArea] = useState(locationToEdit?.street_road_landmark || '');
  const [locality, setLocality] = useState(locationToEdit?.locality || '');
  const [pincode, setPincode] = useState(locationToEdit?.pincode || '');
  const [latitude, setLatitude] = useState<number | undefined>(locationToEdit?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(locationToEdit?.longitude);

  const [isDetecting, setIsDetecting] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (locationToEdit) {
      setLabel(locationToEdit.label || 'Office');
      setBuildingHouseNo(locationToEdit.building_flat_house || '');
      setStreetArea(locationToEdit.street_road_landmark || '');
      setLocality(locationToEdit.locality || '');
      setPincode(locationToEdit.pincode || '');
      setLatitude(locationToEdit.latitude);
      setLongitude(locationToEdit.longitude);
      setLocationSuccessMsg('');
      setErrorMsg('');
    } else {
      setLabel('Office');
      setBuildingHouseNo('');
      setStreetArea('');
      setLocality('');
      setPincode('');
      setLatitude(undefined);
      setLongitude(undefined);
      setLocationSuccessMsg('');
      setErrorMsg('');
    }
  }, [locationToEdit, isOpen]);

  if (!isOpen) return null;

  const handleDetectLocation = async () => {
    setIsDetecting(true);
    setErrorMsg('');
    setLocationSuccessMsg('');

    try {
      const loc = await detectCurrentLocation();
      // Per instructions: Fill street, road, landmark, locality, and pin, but NOT building/flat/house
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

      const locSummary = [loc.address_text, loc.locality].filter(Boolean).join(', ') || loc.city || 'Location detected';
      setLocationSuccessMsg(`Current location detected: ${locSummary}`);
      try {
        confetti({ particleCount: 25, spread: 50, origin: { y: 0.6 } });
      } catch {}
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not detect current location.');
    } finally {
      setIsDetecting(false);
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

    const trimmedLocality = locality.trim();
    if (!trimmedLocality) {
      setErrorMsg('Locality / Neighborhood is required.');
      return;
    }

    setIsSaving(true);
    try {
      const locData: Omit<SavedLocation, 'id'> = {
        label: label.trim() || 'Additional Address',
        building_flat_house: trimmedBuilding,
        street_road_landmark: streetArea.trim(),
        locality: trimmedLocality,
        pincode: pincode.trim(),
        latitude,
        longitude,
      };

      let finalLoc: SavedLocation;
      if (locationToEdit) {
        await api.updateSavedLocation(locationToEdit.id, locData, user);
        await refreshUser();
        finalLoc = {
          ...locData,
          id: locationToEdit.id,
        };
      } else {
        const updatedUser = await api.addSavedLocation(locData, user);
        await refreshUser();

        // Find the newly added location from updatedUser or fallback
        const savedLocations = updatedUser.saved_locations || [];
        finalLoc = savedLocations[savedLocations.length - 1] || {
          ...locData,
          id: `loc_${Date.now()}`,
        };
      }

      try {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
      } catch {}

      onSuccess(finalLoc);
      onClose();
    } catch (err: any) {
      console.error('Failed to save location to profile:', err);
      setErrorMsg(err.message || 'Failed to save location to profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div 
        className="bg-surface border border-divider rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-divider flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
              {locationToEdit ? <Pencil className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-extrabold text-ink text-sm sm:text-base font-display">
                {locationToEdit ? 'Edit Saved Location' : 'Add Another Location'}
              </h3>
              <p className="text-[11px] text-ink-secondary">
                {locationToEdit ? 'Update this alternative pickup & drop location.' : 'Saved to your profile & available for future listings and bookings'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-canvas hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center text-ink-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 font-medium">
              {errorMsg}
            </div>
          )}

          {locationSuccessMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              {locationSuccessMsg}
            </div>
          )}

          {/* Location Label / Nickname */}
          <div>
            <label className="text-xs font-bold text-ink block mb-1">
              Location Label / Nickname <span className="text-brand">*</span>
            </label>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {['Office', 'Studio', 'Warehouse', 'Secondary Home', 'Pickup Hub'].map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setLabel(preset)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                    label === preset
                      ? 'bg-brand text-white border-brand shadow-xs'
                      : 'bg-canvas text-ink-secondary border-divider hover:border-brand/40'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Office, Photography Studio, Warehouse"
              className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand"
              required
            />
          </div>

          {/* GPS Auto-detect button */}
          <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-ink block">Use Current GPS Location</span>
                <span className="text-[10px] text-ink-secondary">Auto-fills street, neighborhood and pin code</span>
              </div>

              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetecting}
                className="btn-primary text-xs font-bold px-3 py-1.5 shadow-pink cursor-pointer inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Detecting...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Use My Current Location</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Compulsory Building/Flat/House */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-ink">
                Building / Flat / House No. <span className="text-brand font-black">* (Compulsory)</span>
              </label>
              <span className="text-[10px] font-bold text-brand uppercase tracking-wider">Required</span>
            </div>
            <input
              type="text"
              value={buildingHouseNo}
              onChange={(e) => setBuildingHouseNo(e.target.value)}
              placeholder="e.g. Flat 402, Building 3B / House #12"
              className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand"
              required
            />
          </div>

          {/* Street / Road / Landmark */}
          <div>
            <label className="text-xs font-bold text-ink block mb-1">
              Street / Road / Landmark
            </label>
            <input
              type="text"
              value={streetArea}
              onChange={(e) => setStreetArea(e.target.value)}
              placeholder="e.g. 5th Main Road, Near Metro Station / Landmark"
              className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand"
            />
          </div>

          {/* Locality & PIN code in grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                Locality / Area <span className="text-brand">*</span>
              </label>
              <input
                type="text"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                placeholder="e.g. Indiranagar, Koramangala, Whitefield"
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                PIN / Postal Code
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 560060"
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-divider">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="btn-secondary text-xs px-4 py-2 font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary text-xs px-5 py-2 font-bold shadow-pink cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{locationToEdit ? 'Saving Changes...' : 'Saving to Profile...'}</span>
                </>
              ) : locationToEdit ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Address Changes</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Location to Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

