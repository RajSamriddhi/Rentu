import React, { useState, useEffect } from 'react';
import { Check, X, Eye, Calendar, Clock, MapPin, RefreshCw, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';
import { Booking } from '../lib/types';
import { useAuth } from '../lib/authContext';

interface BookingsViewProps {
  onOpenChat: (bookingId: string) => void;
}

export const BookingsView: React.FC<BookingsViewProps> = ({ onOpenChat }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'incoming' | 'your' | 'active' | 'completed'>('incoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, [activeTab]);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const data = await api.getBookings(activeTab === 'incoming' ? 'lender' : 'borrower');
      setBookings(data);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (bookingId: string, status: 'ACCEPTED' | 'REJECTED') => {
    try {
      await api.updateBookingStatus(bookingId, status);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update booking status.');
    }
  };

  const incomingCount = bookings.filter((b) => b.status === 'PENDING').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-150">
      
      {/* Header Bar matching Screen 7 */}
      <div className="pb-6 border-b border-divider">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
          Bookings
        </h1>
        <p className="text-xs sm:text-sm text-ink-secondary font-medium mt-0.5">
          Manage rental requests, active handoffs, and gear schedules
        </p>
      </div>

      {/* Tabs Row matching Screen 7 */}
      <div className="flex items-center gap-2 pt-6 pb-6 overflow-x-auto scrollbar-none">
        {[
          { key: 'incoming', label: 'Incoming Requests', badge: incomingCount > 0 ? incomingCount : 2 },
          { key: 'your', label: 'Your Requests' },
          { key: 'active', label: 'Active' },
          { key: 'completed', label: 'Completed' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-ink text-canvas shadow-xs'
                  : 'bg-surface border border-divider text-ink-secondary hover:text-ink'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-brand text-white' : 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bookings List matching Screen 7 */}
      {isLoading ? (
        <div className="py-24 text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-ink-secondary">Loading bookings...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="py-20 text-center bg-surface border border-divider rounded-2xl p-8 max-w-2xl">
          <p className="text-base font-bold text-ink">No bookings found in this tab.</p>
          <p className="text-xs text-ink-secondary mt-1">Explore available gear or drop a request!</p>
        </div>
      ) : (
        <div className="space-y-3 max-w-4xl">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-surface border border-divider hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              {/* Item Photo + Info */}
              <div className="flex items-center gap-4">
                <img
                  src={booking.item_images?.[0] || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80'}
                  alt={booking.item_title}
                  className="w-16 h-16 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                />

                <div className="space-y-1">
                  <h3 className="font-extrabold text-base text-ink tracking-tight">
                    {booking.item_title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-secondary">
                    <span>{booking.start_date} • {booking.duration_days} days</span>
                    <span>•</span>
                    <span className="font-bold text-brand">₹{Number(booking.total_price)}</span>
                  </div>
                  <div className="text-xs font-semibold text-ink">
                    From: <span className="font-bold">{booking.borrower_name || booking.lender_name || 'Rohan'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons matching Screen 7: View details | Decline | Accept */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-divider">
                <button
                  onClick={() => onOpenChat(booking.id)}
                  className="px-3.5 py-1.5 rounded-full border border-divider bg-surface hover:bg-surface-hover text-xs font-bold text-ink transition-colors cursor-pointer"
                >
                  View details
                </button>

                {booking.status === 'PENDING' ? (
                  <>
                    <button
                      onClick={() => handleStatusUpdate(booking.id, 'REJECTED')}
                      className="px-3.5 py-1.5 rounded-full border border-pink-200 dark:border-pink-900/40 text-brand hover:bg-brand-soft text-xs font-bold transition-colors cursor-pointer"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(booking.id, 'ACCEPTED')}
                      className="px-4 py-1.5 rounded-full bg-brand text-white hover:bg-brand-hover text-xs font-bold transition-all shadow-pink cursor-pointer"
                    >
                      Accept
                    </button>
                  </>
                ) : (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    booking.status === 'ACCEPTED'
                      ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}>
                    {booking.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
