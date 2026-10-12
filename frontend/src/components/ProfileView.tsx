import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Star, 
  Package, 
  MessageSquare,
  ShieldCheck, 
  Edit3, 
  Plus,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { Item, Booking, CommunityRequest } from '../lib/types';
import { ItemCard } from './ItemCard';

interface ProfileViewProps {
  onOpenDropGear: () => void;
  onOpenDropWish: () => void;
  onOpenChatWithBooking: (bookingId: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onOpenDropGear,
  onOpenDropWish,
  onOpenChatWithBooking,
}) => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'listings' | 'requests' | 'bookings' | 'reviews'>('listings');
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [myRequests, setMyRequests] = useState<CommunityRequest[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [items, reqs, books] = await Promise.all([
        api.getItems({ ownerId: user.id, status: 'ALL' }),
        api.getRequests({ seekerId: user.id, status: 'ALL' }),
        api.getBookings(),
      ]);
      setMyItems(items);
      setMyRequests(reqs);
      setMyBookings(books);
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-150">
      
      {/* Profile Banner & Header matching Screen 9 */}
      <div className="bg-surface border border-divider rounded-3xl overflow-hidden shadow-sm">
        
        {/* Banner Image */}
        <div className="h-44 sm:h-56 w-full relative bg-zinc-200 dark:bg-zinc-800">
          <img
            src="https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1600&q=80"
            alt="Profile Banner"
            className="w-full h-full object-cover"
          />
        </div>

        {/* User Card with Overlapping Avatar */}
        <div className="px-6 pb-6 pt-0 relative flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 text-center sm:text-left">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
            <img
              src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
              alt={user?.name || 'User'}
              className="w-28 h-28 rounded-full object-cover border-4 border-surface shadow-md bg-surface shrink-0"
            />

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-ink tracking-tight font-display">
                {user?.name || 'Aditi Sharma'}
              </h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-ink-secondary">
                <span className="flex items-center gap-1 text-ink">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  4.8 (24 reviews)
                </span>
                <span>•</span>
                <span>Member since Jan 2024</span>
                <span>•</span>
                <span className="flex items-center gap-0.5 text-brand">
                  <MapPin className="w-3.5 h-3.5" />
                  {user?.locality || 'Delhi'}
                </span>
              </div>
            </div>
          </div>

          <button className="btn-secondary text-xs px-4 py-2 shrink-0 cursor-pointer inline-flex items-center gap-1.5 shadow-xs">
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>

        {/* Stats Row matching Screen 9 */}
        <div className="grid grid-cols-4 border-t border-divider divide-x divide-divider text-center py-4 bg-canvas/40">
          <div>
            <div className="text-xl font-black text-ink font-display">{myItems.length || 5}</div>
            <div className="text-[11px] font-bold text-ink-secondary">Listings</div>
          </div>
          <div>
            <div className="text-xl font-black text-ink font-display">{myBookings.length || 12}</div>
            <div className="text-[11px] font-bold text-ink-secondary">Total Rents</div>
          </div>
          <div>
            <div className="text-xl font-black text-ink font-display">8</div>
            <div className="text-[11px] font-bold text-ink-secondary">Completed</div>
          </div>
          <div>
            <div className="text-xl font-black text-ink font-display">4.8</div>
            <div className="text-[11px] font-bold text-ink-secondary">Rating</div>
          </div>
        </div>

      </div>

      {/* Profile Tabs matching Screen 9 */}
      <div className="flex items-center gap-2 pt-8 pb-4">
        {[
          { key: 'listings', label: 'My Listings' },
          { key: 'requests', label: 'My Requests' },
          { key: 'bookings', label: 'Bookings' },
          { key: 'reviews', label: 'Reviews' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === tab.key
                ? 'bg-ink text-canvas shadow-xs'
                : 'bg-surface border border-divider text-ink-secondary hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'listings' && (
          <div>
            {myItems.length === 0 ? (
              <div className="py-16 text-center bg-surface border border-divider rounded-2xl p-6">
                <p className="text-sm font-bold text-ink">You haven't listed any gear yet.</p>
                <p className="text-xs text-ink-secondary mt-1">Start monetizing your unused cameras, tents, or tools!</p>
                <button
                  onClick={onOpenDropGear}
                  className="mt-4 btn-primary text-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> List Your Gear
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {myItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onClick={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-3">
            {myRequests.length === 0 ? (
              <div className="py-16 text-center bg-surface border border-divider rounded-2xl p-6">
                <p className="text-sm font-bold text-ink">No requests posted yet.</p>
                <button
                  onClick={onOpenDropWish}
                  className="mt-4 btn-primary text-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Post a Request
                </button>
              </div>
            ) : (
              myRequests.map((req) => (
                <div key={req.id} className="p-4 bg-surface border border-divider rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-ink text-sm">{req.item_name}</h4>
                    <p className="text-xs text-ink-secondary">₹{Number(req.offered_amount)} budget • {req.start_date}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-canvas border border-divider text-ink">
                    {req.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="space-y-3">
            {myBookings.map((b) => (
              <div key={b.id} className="p-4 bg-surface border border-divider rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-ink text-sm">{b.item_title}</h4>
                  <p className="text-xs text-ink-secondary">{b.start_date} • ₹{Number(b.total_price)}</p>
                </div>
                <button
                  onClick={() => onOpenChatWithBooking(b.id)}
                  className="btn-secondary text-xs"
                >
                  Open Chat
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="bg-surface border border-divider rounded-2xl p-6 space-y-4">
            <h4 className="text-sm font-extrabold text-ink">Community Reviews (24)</h4>
            <div className="space-y-3">
              {[
                { reviewer: 'Rohan Verma', rating: 5, date: '2 days ago', text: 'Canon 250D was in absolute mint condition! Included extra batteries and made my shoot super smooth.' },
                { reviewer: 'Ananya Roy', rating: 5, date: '1 week ago', text: 'Aditi is such a friendly owner! Very quick coordination and zero hassle.' },
              ].map((rev) => (
                <div key={rev.reviewer} className="p-3 rounded-xl bg-canvas border border-divider text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">{rev.reviewer}</span>
                    <span className="text-[11px] text-ink-secondary">{rev.date}</span>
                  </div>
                  <div className="flex text-amber-400">{'★'.repeat(rev.rating)}</div>
                  <p className="text-ink-secondary font-medium">{rev.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
