import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  Lightbulb, 
  Send, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  HelpCircle,
  FileQuestion,
  MessageSquare,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { SupportTicket } from '../lib/types';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CONCERN_CATEGORIES = [
  'Booking & Handover Logistics',
  'Item Quality or Damage',
  'Payment & Deposit Settlement',
  'Neighbor Conduct & Safety',
  'App Bug or Technical Glitch',
  'Other Concern',
];

const FEEDBACK_CATEGORIES = [
  'New Feature Suggestion',
  'Design & User Experience',
  'Categories & Neighborhoods',
  'Love Rentu / Compliment',
  'General Thought',
];

export const HelpSupportModal: React.FC<HelpSupportModalProps> = ({ isOpen, onClose }) => {
  const { user, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [ticketType, setTicketType] = useState<'CONCERN' | 'FEEDBACK'>('CONCERN');
  const [category, setCategory] = useState<string>(CONCERN_CATEGORIES[0]);
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [userEmail, setUserEmail] = useState(user?.email || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // History state
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setUserEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    // Reset category to default when switching between concern and feedback
    if (ticketType === 'CONCERN') {
      setCategory(CONCERN_CATEGORIES[0]);
    } else {
      setCategory(FEEDBACK_CATEGORIES[0]);
    }
  }, [ticketType]);

  useEffect(() => {
    if (isOpen && activeTab === 'HISTORY' && isAuthenticated) {
      loadHistory();
    }
  }, [isOpen, activeTab, isAuthenticated]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const tickets = await api.getMySupportTickets();
      setMyTickets(Array.isArray(tickets) ? tickets : []);
    } catch (err) {
      console.error('Failed to load tickets history:', err);
      setMyTickets([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setErrorMsg('Please provide both a subject and details.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await api.submitSupportTicket({
        type: ticketType,
        category,
        subject: subject.trim(),
        description: description.trim(),
        priority: ticketType === 'CONCERN' ? priority : 'NORMAL',
        user_email: userEmail.trim() || undefined,
      });

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });

      setSubmitSuccess(true);
      setSubject('');
      setDescription('');
    } catch (err: any) {
      console.error('Failed to submit support ticket:', err);
      setErrorMsg(err.message || 'Could not submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmitSuccess(false);
    setErrorMsg('');
    setSubject('');
    setDescription('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-surface rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-4 border border-divider">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-divider bg-canvas/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-ink uppercase tracking-wider font-display">
                Help & Community Care
              </h2>
              <p className="text-[11px] text-ink-secondary">
                Directly connected to Rentu Founders & Support Admin
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-canvas text-ink-secondary hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Mode Tabs: New Submission vs My History */}
        <div className="flex border-b border-divider text-xs font-bold bg-canvas/20">
          <button
            onClick={() => { setActiveTab('NEW'); handleResetForm(); }}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'NEW'
                ? 'border-brand text-brand font-black'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            Submit Concern or Feedback
          </button>
          {isAuthenticated && (
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'HISTORY'
                  ? 'border-brand text-brand font-black'
                  : 'border-transparent text-ink-secondary hover:text-ink'
              }`}
            >
              <span>My Submissions & Replies</span>
              {myTickets.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-brand/10 text-brand text-[10px] flex items-center justify-center font-bold">
                  {myTickets.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* TAB 1: NEW SUBMISSION */}
        {activeTab === 'NEW' && (
          <div className="p-6">
            {submitSuccess ? (
              <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-150">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto text-3xl">
                  ✓
                </div>
                <div>
                  <h3 className="text-xl font-black text-ink font-display">
                    {ticketType === 'CONCERN' ? 'Concern Submitted' : 'Feedback Received'}
                  </h3>
                  <p className="text-xs text-ink-secondary max-w-sm mx-auto mt-1 leading-relaxed">
                    Thank you! Your message was delivered directly to the Rentu Admin Portal. 
                    {ticketType === 'CONCERN' 
                      ? ' Our team will review the issue and post a resolution update directly to your account notifications.' 
                      : ' We appreciate your insights to make peer-to-peer sharing even better!'}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={handleResetForm}
                    className="btn-secondary text-xs px-4 py-2 cursor-pointer font-bold"
                  >
                    Submit Another
                  </button>
                  <button
                    onClick={onClose}
                    className="btn-primary text-xs px-6 py-2 shadow-pink cursor-pointer font-bold"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type Selection: Concern vs Feedback */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">
                    What would you like to do?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTicketType('CONCERN')}
                      className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        ticketType === 'CONCERN'
                          ? 'bg-red-500/10 border-red-500/40 text-red-500 shadow-xs'
                          : 'bg-canvas border-divider text-ink-secondary hover:text-ink hover:bg-surface'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                      <div>
                        <div className="text-xs font-black">Raise a Concern ⚠️</div>
                        <div className="text-[10px] text-ink-secondary leading-tight mt-0.5">
                          Report a rental problem, neighbor issue, damage, or bug
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTicketType('FEEDBACK')}
                      className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        ticketType === 'FEEDBACK'
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-xs'
                          : 'bg-canvas border-divider text-ink-secondary hover:text-ink hover:bg-surface'
                      }`}
                    >
                      <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <div>
                        <div className="text-xs font-black">Share Feedback 💡</div>
                        <div className="text-[10px] text-ink-secondary leading-tight mt-0.5">
                          Ideas, feature requests, or compliments for Rentu
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Category Selector */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(ticketType === 'CONCERN' ? CONCERN_CATEGORIES : FEEDBACK_CATEGORIES).map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                          category === cat
                            ? 'bg-brand text-white shadow-xs'
                            : 'bg-canvas border border-divider text-ink-secondary hover:text-ink hover:bg-surface'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Urgency for Concerns */}
                {ticketType === 'CONCERN' && (
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      Urgency Level
                    </label>
                    <div className="grid grid-cols-4 gap-2 text-xs font-bold">
                      {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((lvl) => (
                        <button
                          type="button"
                          key={lvl}
                          onClick={() => setPriority(lvl)}
                          className={`py-1.5 rounded-xl border text-center transition-all cursor-pointer text-[11px] ${
                            priority === lvl
                              ? lvl === 'URGENT' || lvl === 'HIGH'
                                ? 'bg-red-500 text-white border-red-500 shadow-xs'
                                : 'bg-brand text-white border-brand'
                              : 'bg-canvas border-divider text-ink-secondary hover:text-ink'
                          }`}
                        >
                          {lvl === 'URGENT' ? '🚨 Urgent' : lvl === 'HIGH' ? '⚡ High' : lvl === 'LOW' ? 'Low' : 'Normal'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subject */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Subject / Short Summary *
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={
                      ticketType === 'CONCERN'
                        ? 'e.g. Lens cap missing during return / late handover'
                        : 'e.g. Would love to have weekend bundle discounts'
                    }
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Details & Specifics *
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      ticketType === 'CONCERN'
                        ? 'Please describe what occurred, dates, any gear or booking references so admin can quickly assist...'
                        : 'Tell us your idea, what you liked, or how Rentu can be improved...'
                    }
                    className="w-full bg-canvas border border-divider rounded-xl p-3 text-xs font-medium text-ink outline-none focus:border-brand resize-none leading-relaxed"
                    required
                  />
                </div>

                {/* Contact Email confirmation */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Your Contact Email
                  </label>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="your-email@domain.com"
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2 text-xs font-medium text-ink outline-none focus:border-brand"
                  />
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 border-t border-divider flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-secondary text-xs px-4 py-2 cursor-pointer font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary text-xs px-6 py-2 shadow-pink cursor-pointer font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending to Admin...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit to Admin</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: MY TICKETS & REPLIES HISTORY */}
        {activeTab === 'HISTORY' && (
          <div className="p-6 max-h-[460px] overflow-y-auto space-y-3">
            {isLoadingHistory ? (
              <div className="py-16 text-center text-xs text-ink-secondary flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-brand animate-spin" />
                <span>Loading your past concerns & replies...</span>
              </div>
            ) : myTickets.length === 0 ? (
              <div className="py-16 text-center space-y-2 text-ink-secondary">
                <div className="w-10 h-10 rounded-full bg-canvas border border-divider flex items-center justify-center mx-auto text-lg">
                  🛡️
                </div>
                <p className="text-xs font-bold text-ink">No Prior Submissions</p>
                <p className="text-[11px] max-w-xs mx-auto">
                  You haven't submitted any concerns or feedback yet. Whenever you do, admin status and replies will appear here!
                </p>
              </div>
            ) : (
              myTickets.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl bg-canvas border border-divider space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        t.type === 'CONCERN' 
                          ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {t.type}
                      </span>
                      <span className="text-[10px] font-bold text-ink-secondary">
                        {t.category}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      t.status === 'RESOLVED'
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : t.status === 'IN_REVIEW'
                        ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                    }`}>
                      {t.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-black text-ink text-sm">{t.subject}</h4>
                    <p className="text-ink-secondary mt-1 text-[11px] leading-relaxed">{t.description}</p>
                  </div>

                  {/* Admin Resolution Note if present */}
                  {t.admin_notes && (
                    <div className="p-3 rounded-xl bg-surface border border-emerald-500/30 text-ink space-y-1 mt-2">
                      <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Admin Resolution Note:</span>
                      </div>
                      <p className="text-[11px] text-ink-secondary leading-relaxed pl-5">
                        {t.admin_notes}
                      </p>
                    </div>
                  )}

                  <div className="text-[10px] text-ink-muted pt-1 flex items-center justify-between border-t border-divider/50">
                    <span>Submitted on {new Date(t.created_at).toLocaleDateString()}</span>
                    {t.resolved_at && (
                      <span className="text-emerald-500 font-bold">
                        Resolved on {new Date(t.resolved_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
};
