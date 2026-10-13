import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  MapPin, 
  ChevronDown, 
  User as UserIcon, 
  LogOut, 
  MessageSquare, 
  BarChart3, 
  Bell, 
  Search,
  Calendar,
  Sparkles,
  Sun,
  Moon,
  Menu,
  X,
  Compass,
  Target,
  Navigation
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useTheme } from '../lib/themeContext';
import { CITIES } from '../lib/city';

interface NavbarProps {
  activeTab: 'home' | 'explore' | 'requests' | 'bookings' | 'hustle' | 'profile';
  setActiveTab: (tab: 'home' | 'explore' | 'requests' | 'bookings' | 'hustle' | 'profile') => void;
  selectedLocality: string;
  setSelectedLocality: (loc: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearch: () => void;
  onOpenDropGear: () => void;
  onOpenDropWish: () => void;
  onOpenAuth: () => void;
  onOpenChat: () => void;
  onOpenHowItWorks: () => void;
  onOpenSetLocation?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  selectedLocality,
  setSelectedLocality,
  searchQuery,
  setSearchQuery,
  onSearch,
  onOpenDropGear,
  onOpenDropWish,
  onOpenAuth,
  onOpenChat,
  onOpenHowItWorks,
  onOpenSetLocation,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLocalityMenu, setShowLocalityMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const postMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const localityMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (postMenuRef.current && !postMenuRef.current.contains(target)) {
        setShowPostMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
      if (localityMenuRef.current && !localityMenuRef.current.contains(target)) {
        setShowLocalityMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#111218]/95 backdrop-blur-md border-b border-divider transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-6">
          
          {/* Left: Brand Logo (Rentu⁺) + Desktop Nav Links */}
          <div className="flex items-center gap-5 sm:gap-8 shrink-0">
            <button 
              onClick={() => { setActiveTab('home'); setShowMobileMenu(false); }}
              className="flex items-center gap-1.5 group text-left cursor-pointer focus:outline-none"
              title="Rentu⁺ Home"
            >
              <span className="font-extrabold text-2xl sm:text-3xl tracking-tight text-ink font-display">
                Rentu<sup className="text-brand font-black text-lg">⁺</sup>
              </span>
            </button>

            {/* Nav links matching Screen 1 & Screen 2: Explore, Requests, How it works */}
            <nav className="hidden md:flex items-center gap-5 text-xs font-bold">
              <button
                onClick={() => setActiveTab('explore')}
                className={`transition-colors cursor-pointer ${
                  activeTab === 'explore' ? 'text-brand' : 'text-ink-secondary hover:text-ink'
                }`}
              >
                Explore
              </button>

              <button
                onClick={() => setActiveTab('requests')}
                className={`transition-colors cursor-pointer ${
                  activeTab === 'requests' ? 'text-brand' : 'text-ink-secondary hover:text-ink'
                }`}
              >
                Requests
              </button>

              <button
                onClick={onOpenHowItWorks}
                className="text-ink-secondary hover:text-ink transition-colors cursor-pointer"
              >
                How it works
              </button>
            </nav>
          </div>

          {/* Center: Search Bar in Navbar on Desktop */}
          <div className="flex-1 max-w-md hidden lg:block">
            <form 
              onSubmit={(e) => { e.preventDefault(); onSearch(); }}
              className="relative flex items-center bg-canvas border border-divider hover:border-zinc-300 dark:hover:border-zinc-600 rounded-full px-3.5 py-2 transition-all focus-within:border-brand focus-within:bg-surface"
            >
              <Search className="w-4 h-4 text-ink-muted mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rentals, cameras, tents..."
                className="bg-transparent border-none outline-none text-xs font-semibold text-ink placeholder:text-ink-muted placeholder:font-normal w-full"
              />
            </form>
          </div>

          {/* Right: Controls & Actions (Carefully sized to NEVER overflow) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            
            {/* City Location Indicator / Selector (Visible on md+) */}
            <div className="hidden md:flex items-center">
              {isAuthenticated ? (
                <div 
                  id="user-city-indicator"
                  className="flex items-center gap-1.5 bg-canvas border border-divider rounded-full px-3 py-1.5 text-xs font-bold text-ink shadow-xs select-none"
                  title={`Showing rentals in ${selectedLocality} (your registered city)`}
                >
                  <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                  <span className="font-extrabold">{selectedLocality}</span>
                  <span className="text-[10px] font-black uppercase text-brand bg-brand-soft px-1.5 py-0.5 rounded-full border border-brand/20">
                    Your City
                  </span>
                </div>
              ) : (
                <div className="relative" ref={localityMenuRef}>
                  <button
                    id="locality-menu-btn"
                    onClick={() => setShowLocalityMenu(!showLocalityMenu)}
                    className="flex items-center gap-1.5 bg-canvas hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-divider rounded-full px-3 py-1.5 text-xs font-bold text-ink transition-colors cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span className="font-extrabold">{selectedLocality}</span>
                    <ChevronDown className="w-3 h-3 text-ink-secondary" />
                  </button>

                  {showLocalityMenu && (
                    <div className="absolute right-0 mt-2 w-52 bg-surface border border-divider rounded-2xl shadow-xl p-2 z-50 text-xs font-semibold animate-in fade-in zoom-in-95 duration-100">
                      {onOpenSetLocation && (
                        <button
                          onClick={() => {
                            setShowLocalityMenu(false);
                            onOpenSetLocation();
                          }}
                          className="w-full text-left px-2.5 py-2 mb-1.5 rounded-xl bg-brand-soft hover:bg-brand/20 text-brand font-extrabold flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5 shrink-0" />
                          <span>Set Exact Location 📍</span>
                        </button>
                      )}
                      <div className="px-2.5 py-1 text-[10px] font-black uppercase text-ink-secondary">
                        Select Your City
                      </div>
                      {CITIES.map((city) => {
                        const isSelected = selectedLocality === city;
                        return (
                          <button
                            key={city}
                            id={`city-option-${city.toLowerCase()}`}
                            onClick={() => {
                              setSelectedLocality(city);
                              setShowLocalityMenu(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl transition-colors flex items-center justify-between cursor-pointer ${
                              isSelected ? 'bg-brand-soft font-extrabold text-brand' : 'hover:bg-canvas text-ink'
                            }`}
                          >
                            <span>{city}</span>
                            {isSelected && <span className="text-brand font-black">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dark / Light Mode Toggle Button */}
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-ink-secondary hover:text-ink transition-all cursor-pointer relative"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 rotate-0 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-zinc-600 dark:text-zinc-300 transition-transform hover:-rotate-12" />
              )}
            </button>

            {/* Mobile Search Toggle Button */}
            <button
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              className="lg:hidden p-1.5 sm:p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-ink-secondary hover:text-ink transition-colors cursor-pointer"
              title="Search"
              aria-label="Toggle search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* AUTHENTICATED: Notifications, Chat, Post CTA, User Profile */}
            {isAuthenticated ? (
              <>
                {/* Notification Bell (Hidden on small screens, accessible via hamburger) */}
                <button
                  onClick={() => setActiveTab('bookings')}
                  className="relative p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-ink-secondary hover:text-ink transition-colors cursor-pointer hidden md:flex"
                  title="Notifications & Bookings"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand" />
                </button>

                {/* Messages Icon (Hidden on small screens, accessible via hamburger) */}
                <button
                  onClick={onOpenChat}
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-ink-secondary hover:text-ink transition-colors cursor-pointer hidden md:flex"
                  title="Messages"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>

                {/* Post Menu Button (+ List Item / + Post Request) */}
                <div className="relative" ref={postMenuRef}>
                  <button
                    id="post-menu-btn"
                    onClick={() => setShowPostMenu(!showPostMenu)}
                    className="btn-primary text-xs px-2.5 sm:px-3.5 py-1.5 sm:py-2 cursor-pointer shadow-pink inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                    <span>Post</span>
                    <ChevronDown className="w-3 h-3 ml-0.5 hidden sm:inline" />
                  </button>

                  {showPostMenu && (
                    <div className="absolute right-0 mt-2 w-60 bg-surface border border-divider rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs text-ink">
                      <button
                        onClick={() => { setShowPostMenu(false); onOpenDropGear(); }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-canvas transition-colors flex items-center gap-2.5 font-bold text-ink cursor-pointer"
                      >
                        <span className="text-base">💸</span>
                        <div>
                          <div>List Gear for Rent</div>
                          <div className="text-[10px] text-ink-secondary font-medium">Turn unused items into income</div>
                        </div>
                      </button>

                      <button
                        onClick={() => { setShowPostMenu(false); onOpenDropWish(); }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-canvas transition-colors flex items-center gap-2.5 font-bold text-ink cursor-pointer mt-1"
                      >
                        <span className="text-base">🎯</span>
                        <div>
                          <div>Post a Request</div>
                          <div className="text-[10px] text-ink-secondary font-medium">Ask community for items you need</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* User Profile Avatar Dropdown */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    id="user-menu-btn"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-1.5 p-1 bg-canvas hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-divider rounded-full transition-all cursor-pointer"
                  >
                    <img
                      src={user?.avatar_url || (user?.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')}
                      alt={user?.name || 'User'}
                      className="w-7 h-7 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                    />
                    <span className="text-xs font-bold text-ink max-w-[80px] truncate hidden md:inline">
                      {user?.name?.split(' ')[0]}
                    </span>
                    <ChevronDown className="w-3 h-3 text-ink-secondary mr-1 hidden sm:inline" />
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-surface border border-divider rounded-2xl shadow-xl p-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100 text-ink">
                      <div className="px-3 py-2 border-b border-divider mb-1">
                        <div className="font-extrabold text-sm text-ink">{user?.name}</div>
                        <div className="text-[11px] text-ink-secondary truncate">{user?.email}</div>
                      </div>

                      <button
                        onClick={() => { setActiveTab('profile'); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-canvas flex items-center gap-2.5 font-bold text-ink cursor-pointer"
                      >
                        <UserIcon className="w-4 h-4 text-ink-secondary" />
                        <span>My Profile & Listings</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('bookings'); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-canvas flex items-center gap-2.5 font-bold text-ink cursor-pointer"
                      >
                        <Calendar className="w-4 h-4 text-ink-secondary" />
                        <span>Bookings</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('hustle'); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-canvas flex items-center gap-2.5 font-bold text-ink cursor-pointer"
                      >
                        <BarChart3 className="w-4 h-4 text-ink-secondary" />
                        <span>Admin Dashboard</span>
                      </button>

                      {/* Sign Out */}
                      <div className="pt-1.5 border-t border-divider">
                        <button
                          onClick={() => { logout(); setShowUserMenu(false); setActiveTab('explore'); }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-pink-50 text-brand flex items-center gap-2 font-bold cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* UNAUTHENTICATED: Single clean Sign In button */
              <div className="flex items-center">
                <button
                  id="navbar-signin-btn"
                  onClick={onOpenAuth}
                  className="btn-primary text-xs px-3.5 sm:px-4 py-1.5 sm:py-2 cursor-pointer shadow-pink font-bold"
                >
                  <span>Sign In</span>
                </button>
              </div>
            )}

            {/* Mobile Hamburger Menu Toggle Button (Visible on md and below) */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-1.5 rounded-xl hover:bg-canvas text-ink transition-colors cursor-pointer"
              title="Toggle Menu"
              aria-label="Open mobile navigation menu"
            >
              {showMobileMenu ? <X className="w-5 h-5 text-brand" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Search Input Dropdown */}
        {showMobileSearch && (
          <div className="lg:hidden pb-3 pt-1 animate-in slide-in-from-top-2 duration-150 border-t border-divider/40 mt-1">
            <form 
              onSubmit={(e) => { 
                e.preventDefault(); 
                onSearch(); 
                setShowMobileSearch(false);
              }}
              className="relative flex items-center bg-canvas border border-divider rounded-full px-3.5 py-1.5 focus-within:border-brand shadow-xs"
            >
              <Search className="w-4 h-4 text-ink-muted mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rentals, cameras, tents..."
                className="bg-transparent border-none outline-none text-xs font-semibold text-ink placeholder:text-ink-muted w-full"
                autoFocus
              />
              <button
                type="submit"
                className="ml-2 bg-brand text-white px-3 py-1 rounded-full text-[11px] font-bold shrink-0 shadow-xs cursor-pointer"
              >
                Go
              </button>
            </form>
          </div>
        )}

        {/* Responsive Mobile Navigation Drawer / Dropdown */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-divider/60 bg-surface/95 dark:bg-[#111218]/95 backdrop-blur-md px-3 py-4 space-y-4 animate-in slide-in-from-top-2 duration-150 shadow-xl">
            {/* City Selector in Mobile Menu */}
            <div className="bg-canvas border border-divider rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase text-ink-secondary tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand" />
                  Your Location
                </span>
                <span className="text-[10px] font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-full">
                  {selectedLocality}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {CITIES.map((city) => (
                  <button
                    key={city}
                    onClick={() => {
                      setSelectedLocality(city);
                    }}
                    className={`text-center py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedLocality === city
                        ? 'bg-brand text-white shadow-xs'
                        : 'bg-surface border border-divider text-ink hover:border-zinc-400'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation Links */}
            <div className="space-y-1">
              <button
                onClick={() => { setActiveTab('explore'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'explore' ? 'bg-brand text-white' : 'text-ink hover:bg-canvas'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Explore Rentals</span>
              </button>

              <button
                onClick={() => { setActiveTab('requests'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'requests' ? 'bg-brand text-white' : 'text-ink hover:bg-canvas'
                }`}
              >
                <Target className="w-4 h-4" />
                <span>Requests Wanted Board</span>
              </button>

              <button
                onClick={() => { onOpenHowItWorks(); setShowMobileMenu(false); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-ink hover:bg-canvas transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-brand" />
                <span>How It Works</span>
              </button>

              {onOpenSetLocation && (
                <button
                  onClick={() => { onOpenSetLocation(); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-brand bg-brand-soft/70 hover:bg-brand/20 transition-colors cursor-pointer"
                >
                  <Navigation className="w-4 h-4 text-brand" />
                  <span>Set My Exact Location 📍</span>
                </button>
              )}
            </div>

            {/* Authenticated or Unauthenticated actions in Mobile Menu */}
            {isAuthenticated ? (
              <div className="pt-2 border-t border-divider space-y-1">
                <button
                  onClick={() => { setActiveTab('profile'); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-ink hover:bg-canvas transition-colors cursor-pointer"
                >
                  <UserIcon className="w-4 h-4 text-ink-secondary" />
                  <span>My Profile & Listings</span>
                </button>

                <button
                  onClick={() => { onOpenChat(); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-ink hover:bg-canvas transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-ink-secondary" />
                  <span>Messages</span>
                </button>

                <button
                  onClick={() => { setActiveTab('bookings'); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-ink hover:bg-canvas transition-colors cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-ink-secondary" />
                  <span>Bookings & Activity</span>
                </button>

                <button
                  onClick={() => { logout(); setShowMobileMenu(false); setActiveTab('explore'); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-brand hover:bg-pink-50 transition-colors cursor-pointer mt-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-divider">
                <button
                  id="mobile-signin-btn"
                  onClick={() => { onOpenAuth(); setShowMobileMenu(false); }}
                  className="btn-primary w-full py-2.5 text-xs text-center font-bold shadow-pink cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
