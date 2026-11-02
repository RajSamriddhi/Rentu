import React, { useState } from 'react';
import { 
  X, 
  Settings as SettingsIcon, 
  Bell, 
  MapPin, 
  Moon, 
  Sun, 
  ShieldCheck, 
  Check, 
  Loader2, 
  Mail, 
  Calendar,
  Radio
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useTheme } from '../lib/themeContext';
import { api } from '../lib/api';
import { formatFullAddress } from '../lib/location';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSetLocation?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenSetLocation,
}) => {
  const { user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [notifyNearby5km, setNotifyNearby5km] = useState<boolean>(
    user?.notify_nearby_requests_5km ?? true
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state if user changes
  React.useEffect(() => {
    if (user) {
      setNotifyNearby5km(user.notify_nearby_requests_5km ?? true);
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleToggleRadarAlerts = async () => {
    const nextVal = !notifyNearby5km;
    setNotifyNearby5km(nextVal);
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await api.updateProfile({
        notify_nearby_requests_5km: nextVal,
      });
      await refreshUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to update radar setting:', err);
      // Revert if error
      setNotifyNearby5km(!nextVal);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-surface border border-divider rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-divider flex items-center justify-between bg-canvas/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-ink font-display">Account Settings</h3>
              <p className="text-[11px] text-ink-secondary">Manage your community preferences & radar alerts</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-divider hover:bg-canvas flex items-center justify-center text-ink transition-colors cursor-pointer"
            title="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Section 1: Radar Proximity Alerts (Requested under Settings) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-ink font-display flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-brand" />
                <span>Radar & Proximity Alerts</span>
              </label>
              {saveSuccess && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3 stroke-[3]" /> Saved
                </span>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-canvas border border-divider flex items-center justify-between gap-4 transition-colors hover:border-brand/30">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Bell className="w-4 h-4 text-brand shrink-0" />
                  <span className="text-xs font-bold text-ink">5 km Nearby Request Alerts</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-brand/10 text-brand">RADAR</span>
                </div>
                <p className="text-[11px] text-ink-secondary leading-relaxed">
                  Get an instant notification whenever someone within 5 km posts a gear wish. Turn off anytime.
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleRadarAlerts}
                disabled={isSaving}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 disabled:opacity-60 ${
                  notifyNearby5km ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
                title={notifyNearby5km ? 'Disable 5 km alerts' : 'Enable 5 km alerts'}
              >
                {isSaving ? (
                  <div className="w-5 h-5 rounded-full bg-white shadow-sm flex items-center justify-center absolute top-0.5 left-0.5">
                    <Loader2 className="w-3 h-3 animate-spin text-brand" />
                  </div>
                ) : (
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform absolute top-0.5 ${
                      notifyNearby5km ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Home Locality & Location Radius */}
          <div className="space-y-3 pt-2 border-t border-divider">
            <label className="text-xs font-black uppercase tracking-wider text-ink font-display flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-brand" />
              <span>Registered Neighborhood & Hub</span>
            </label>

            <div className="p-4 rounded-2xl bg-canvas border border-divider flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs font-bold text-ink flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{formatFullAddress(user)}</span>
                </div>
                <p className="text-[11px] text-ink-secondary">
                  Used as your center point for proximity filters and distance calculations.
                </p>
              </div>

              {onOpenSetLocation && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSetLocation();
                  }}
                  className="px-3 py-1.5 rounded-xl border border-divider hover:border-brand text-xs font-bold text-ink hover:text-brand transition-colors cursor-pointer shrink-0 bg-surface shadow-2xs"
                >
                  Change 📍
                </button>
              )}
            </div>
          </div>

          {/* Section 3: Appearance & Theme */}
          <div className="space-y-3 pt-2 border-t border-divider">
            <label className="text-xs font-black uppercase tracking-wider text-ink font-display">
              Display & Theme
            </label>

            <div className="p-4 rounded-2xl bg-canvas border border-divider flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-surface border border-divider flex items-center justify-center text-ink shrink-0">
                  {theme === 'dark' ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-ink capitalize">{theme} Mode</div>
                  <div className="text-[11px] text-ink-secondary">Toggle between dark obsidian and light chic aesthetics</div>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className="px-3 py-1.5 rounded-xl border border-divider bg-surface hover:border-zinc-400 text-xs font-bold text-ink transition-colors cursor-pointer shadow-2xs"
              >
                Switch to {theme === 'dark' ? 'Light ☀️' : 'Dark 🌙'}
              </button>
            </div>
          </div>

          {/* Section 4: Account Information */}
          <div className="space-y-3 pt-2 border-t border-divider">
            <label className="text-xs font-black uppercase tracking-wider text-ink font-display flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-brand" />
              <span>Account Credentials</span>
            </label>

            <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-secondary flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-ink-secondary" /> Email:
                </span>
                <span className="font-bold text-ink">{user?.email || 'N/A'}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-divider/60">
                <span className="text-ink-secondary flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-ink-secondary" /> Member Since:
                </span>
                <span className="font-semibold text-ink">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '2026'}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-divider bg-canvas/40 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary text-xs font-bold px-5 py-2 cursor-pointer shadow-pink"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

