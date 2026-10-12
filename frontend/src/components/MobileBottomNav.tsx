import React from 'react';
import { Compass, Target, Plus, Calendar, User } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'home' | 'explore' | 'requests' | 'bookings' | 'hustle' | 'profile';
  setActiveTab: (tab: 'home' | 'explore' | 'requests' | 'bookings' | 'hustle' | 'profile') => void;
  onOpenDropGear: () => void;
  onOpenDropWish: () => void;
  onOpenChat: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenDropGear,
}) => {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#12131A]/95 backdrop-blur-md border-t border-divider px-3 py-2 flex items-center justify-around shadow-lg">
      <button
        onClick={() => setActiveTab('explore')}
        className={`flex flex-col items-center gap-1 p-1 text-[10px] font-bold transition-colors cursor-pointer ${
          activeTab === 'explore' ? 'text-brand' : 'text-ink-secondary hover:text-ink'
        }`}
      >
        <Compass className="w-5 h-5" />
        <span>Explore</span>
      </button>

      <button
        onClick={() => setActiveTab('requests')}
        className={`flex flex-col items-center gap-1 p-1 text-[10px] font-bold transition-colors cursor-pointer ${
          activeTab === 'requests' ? 'text-brand' : 'text-ink-secondary hover:text-ink'
        }`}
      >
        <Target className="w-5 h-5" />
        <span>Requests</span>
      </button>

      {/* Floating Center Action */}
      <button
        onClick={onOpenDropGear}
        className="w-12 h-12 -mt-5 rounded-full bg-brand text-white flex items-center justify-center shadow-pink cursor-pointer transition-transform active:scale-95"
        title="List Gear"
      >
        <Plus className="w-6 h-6 stroke-[3]" />
      </button>

      <button
        onClick={() => setActiveTab('bookings')}
        className={`flex flex-col items-center gap-1 p-1 text-[10px] font-bold transition-colors cursor-pointer ${
          activeTab === 'bookings' ? 'text-brand' : 'text-ink-secondary hover:text-ink'
        }`}
      >
        <Calendar className="w-5 h-5" />
        <span>Bookings</span>
      </button>

      <button
        onClick={() => setActiveTab('profile')}
        className={`flex flex-col items-center gap-1 p-1 text-[10px] font-bold transition-colors cursor-pointer ${
          activeTab === 'profile' ? 'text-brand' : 'text-ink-secondary hover:text-ink'
        }`}
      >
        <User className="w-5 h-5" />
        <span>Profile</span>
      </button>
    </div>
  );
};
