import React, { useState } from 'react';
import { X, Check, Upload, Megaphone, ArrowRight, ArrowLeft } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';

interface DropWishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onOpenAuth: () => void;
}

export const DropWishModal: React.FC<DropWishModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenAuth,
}) => {
  const { user, isAuthenticated } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const defaultDate = tomorrow.toISOString().split('T')[0];

  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics & Tech');
  const [startDate, setStartDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('10:00 AM');
  const [durationDays, setDurationDays] = useState(2);
  const [offeredAmount, setOfferedAmount] = useState(300);
  const [locality, setLocality] = useState(user?.locality || 'Saket, New Delhi');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await api.createRequest({
        item_name: itemName,
        description: description || `Looking for ${itemName} for ${durationDays} days.`,
        category,
        start_date: startDate,
        start_time: startTime,
        duration_days: Number(durationDays),
        offered_amount: Number(offeredAmount),
        locality: locality || user?.locality || 'Saket, New Delhi',
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to post request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-surface rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-4 border border-divider">
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider">
          <div className="text-xs font-bold text-ink-secondary">
            Screen: Wanted Board
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-hover text-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Body matching Screen 4 */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
          
          {/* Left Stepper Column matching Screen 4 */}
          <div className="md:col-span-4 bg-canvas/60 p-6 border-r border-divider space-y-6">
            <h3 className="text-xs font-black uppercase text-ink-secondary tracking-wider">
              Steps
            </h3>

            <div className="space-y-4 text-xs font-bold">
              {[
                { num: 1, label: 'Item details' },
                { num: 2, label: 'Date & Budget' },
                { num: 3, label: 'Location & Preferences' },
                { num: 4, label: 'Review' },
              ].map((s) => {
                const isActive = step === s.num;
                const isPassed = step > s.num;
                return (
                  <div key={s.num} className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold transition-all ${
                        isActive
                          ? 'bg-brand text-white shadow-xs'
                          : isPassed
                          ? 'bg-emerald-500 text-white'
                          : 'bg-divider text-ink-secondary'
                      }`}
                    >
                      {isPassed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.num}
                    </div>
                    <span className={isActive ? 'text-ink font-extrabold' : 'text-ink-secondary'}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Form Area matching Screen 4 */}
          <div className="md:col-span-8 p-6 sm:p-8 flex flex-col justify-between">
            <form onSubmit={handleNext}>
              
              {/* Header Title + Megaphone Doodle */}
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-black text-ink tracking-tight font-display">
                    Post a Request
                  </h2>
                  <p className="text-xs text-ink-secondary font-medium mt-1">
                    Tell the community what you need. Someone might have it!
                  </p>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-brand-soft text-brand flex items-center justify-center text-xl shrink-0">
                  <Megaphone className="w-6 h-6 fill-brand text-brand" />
                </div>
              </div>

              {errorMsg && (
                <div className="mb-4 p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-bold">
                  {errorMsg}
                </div>
              )}

              {/* STEP 1: ITEM DETAILS */}
              {step === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Item name *</label>
                      <input
                        type="text"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        placeholder="e.g. Projector"
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
                        placeholder="Be specific about what you need..."
                        rows={3}
                        className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2 text-xs font-medium text-ink outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Add photos [optional]</label>
                      <div className="border-2 border-dashed border-zinc-200 hover:border-brand rounded-2xl p-4 text-center cursor-pointer transition-colors bg-canvas">
                        <Upload className="w-5 h-5 text-ink-muted mx-auto mb-1" />
                        <span className="text-[11px] font-bold text-ink-secondary">Click to upload or drag and drop</span>
                      </div>
                    </div>
                  </div>

                  {/* Tips Card on Right from Screen 4 */}
                  <div className="lg:col-span-5 bg-brand-soft border border-brand/20 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-extrabold text-brand uppercase tracking-wider">
                      Tips for a great request
                    </h4>
                    <ul className="text-xs text-ink-secondary space-y-2 font-medium">
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                        <span>Be specific with your requirements</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                        <span>Add reference photos if possible</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                        <span>Mention your preferred dates and duration</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                        <span>Set a reasonable budget</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                        <span>Include your preferred location</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* STEP 2: DATE & BUDGET */}
              {step === 2 && (
                <div className="space-y-4 max-w-md">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Preferred Time</label>
                      <input
                        type="text"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Duration (days)</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={durationDays}
                        onChange={(e) => setDurationDays(Number(e.target.value))}
                        className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Budget / Offered Amount (₹)</label>
                      <input
                        type="number"
                        min="50"
                        value={offeredAmount}
                        onChange={(e) => setOfferedAmount(Number(e.target.value))}
                        className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: LOCATION & PREFERENCES */}
              {step === 3 && (
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Your Locality / Campus</label>
                    <input
                      type="text"
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      placeholder="e.g. Saket, New Delhi"
                      className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW */}
              {step === 4 && (
                <div className="bg-canvas border border-divider rounded-2xl p-5 space-y-3 max-w-md">
                  <h4 className="text-sm font-extrabold text-ink">Review Request Details</h4>
                  <div className="text-xs space-y-1.5 text-ink-secondary">
                    <div><span className="font-bold text-ink">Item:</span> {itemName}</div>
                    <div><span className="font-bold text-ink">Category:</span> {category}</div>
                    <div><span className="font-bold text-ink">Dates:</span> {startDate} ({durationDays} days)</div>
                    <div><span className="font-bold text-ink">Offered Budget:</span> ₹{offeredAmount}</div>
                    <div><span className="font-bold text-ink">Locality:</span> {locality}</div>
                  </div>
                </div>
              )}

              {/* Navigation CTA row */}
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
                      ? 'Next: Date & Budget'
                      : step === 2
                      ? 'Next: Location'
                      : step === 3
                      ? 'Next: Review'
                      : 'Post Request 🎯'}
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
