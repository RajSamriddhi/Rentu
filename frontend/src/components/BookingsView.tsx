import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, MessageSquare, Check, X } from 'lucide-react';
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
  }, [user]);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const data = await api.getBookings();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load bookings:', err);
      setBookings([]);
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

  const incomingList = bookings.filter((b) => b.lender_id === user?.id && b.status === 'PENDING');
  const yourList = bookings.filter((b) => b.borrower_id === user?.id && b.status === 'PENDING');
  const activeList = bookings.filter((b) => b.status === 'ACCEPTED');
  const completedList = bookings.filter((b) => ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(b.status));

  const displayedBookings =
    activeTab === 'incoming' ? incomingList :
    activeTab === 'your' ? yourList :
    activeTab === 'active' ? activeList :
    completedList;

  const incomingCount = incomingList.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-150">
      
      {/* Header Bar */}
      <div className="pb-6 border-b border-divider">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
          Bookings
        </h1>
        <p className="text-xs sm:text-sm text-ink-secondary font-medium mt-0.5">
          Manage rental requests, active handoffs, and gear schedules
        </p>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 pt-6 pb-6 overflow-x-auto scrollbar-none">
        {[
          { key: 'incoming', label: 'Incoming Requests', badge: incomingCount > 0 ? incomingCount : undefined },
          { key: 'your', label: 'Your Requests', badge: yourList.length > 0 ? yourList.length : undefined },
          { key: 'active', label: 'Active', badge: activeList.length > 0 ? activeList.length : undefined },
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
              {tab.badge !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-brand text-white' : 'bg-brand/10 text-brand'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="py-24 text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-ink-secondary">Loading bookings...</p>
        </div>
      ) : displayedBookings.length === 0 ? (
        <div className="py-20 text-center bg-surface border border-divider rounded-2xl p-8 max-w-2xl">
          <p className="text-base font-bold text-ink">
            {activeTab === 'incoming' && 'No incoming requests yet.'}
            {activeTab === 'your' && 'You have not requested any gear yet.'}
            {activeTab === 'active' && 'No active rentals at the moment.'}
            {activeTab === 'completed' && 'No completed rentals yet.'}
          </p>
          <p className="text-xs text-ink-secondary mt-1">
            {activeTab === 'incoming'
              ? 'When neighbors request to rent your listed gear, their proposals will show up here.'
              : 'Explore available gear or drop a request in your community!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-4xl">
          {displayedBookings.map((booking) => {
            const isLender = booking.lender_id === user?.id;
            const otherPartyName = isLender ? booking.borrower_name : booking.lender_name;

            return (
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
                      <span>{booking.start_date}{booking.end_date ? ` to ${booking.end_date}` : ''} • {booking.duration_days} days</span>
                      <span>•</span>
                      <span className="font-bold text-brand">₹{Number(booking.total_price)}</span>
                    </div>
                    {(booking.pickup_type || booking.return_type) && (
                      <div className="text-[11px] text-ink-secondary pt-0.5 flex flex-wrap gap-x-2">
                        <span>Pickup: <strong className="text-ink">{booking.pickup_type === 'MY_LOCATION' ? '📍 Deliver to Borrower' : booking.pickup_type === 'CUSTOM_LOCATION' ? `🤝 Meet at ${booking.pickup_locality || 'Custom Spot'}` : "🚶 Lender's Place"}</strong></span>
                        <span>•</span>
                        <span>Return: <strong className="text-ink">{booking.return_type === 'MY_LOCATION' ? '🏠 Collect at Borrower' : booking.return_type === 'CUSTOM_LOCATION' ? `🤝 Meet at ${booking.return_locality || 'Custom Spot'}` : "🚶 To Lender"}</strong></span>
                      </div>
                    )}
                    <div className="text-xs font-semibold text-ink">
                      {isLender ? 'Requested by: ' : 'Lender: '}
                      <span className="font-bold">{otherPartyName || 'Community Member'}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons: View details / Chat | Decline | Accept */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-divider">
                  <button
                    onClick={() => onOpenChat(booking.id)}
                    className="px-3.5 py-1.5 rounded-full border border-divider bg-surface hover:bg-surface-hover text-xs font-bold text-ink transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-brand" />
                    <span>Chat & Details</span>
                  </button>

                  {isLender && booking.status === 'PENDING' ? (
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
                        : booking.status === 'PENDING'
                        ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}>
                      {booking.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
