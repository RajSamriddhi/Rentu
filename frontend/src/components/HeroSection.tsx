import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, Heart, Users, X } from 'lucide-react';
import { api } from '../lib/api';
import { UserSearchResult } from '../lib/types';

interface HeroSectionProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: () => void;
  onGetStarted: () => void;
  onOpenDropGear: () => void;
  itemsCount?: number;
  requestsCount?: number;
  onOpenUserProfile?: (userId: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  searchQuery,
  setSearchQuery,
  onSearch,
  onGetStarted,
  onOpenDropGear,
  itemsCount = 0,
  requestsCount = 0,
  onOpenUserProfile,
}) => {
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const heroSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setUserSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const results = await api.searchUsers(trimmed);
        setUserSearchResults(Array.isArray(results) ? results : []);
      } catch (err) {
        console.error('Failed to search users in hero:', err);
        setUserSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (heroSearchRef.current && !heroSearchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <section className="relative overflow-hidden pt-6 pb-8 bg-gradient-to-b from-[#FFF5F7] via-[#FFF8F9] to-canvas dark:from-[#22101A] dark:via-[#16121A] dark:to-canvas transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main 2-Column Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-4 pb-8">
          
          {/* Left Column: Headlines & Search */}
          <div className="lg:col-span-7 text-center lg:text-left">
            {/* Top Pill Sticker */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-white/80 dark:bg-zinc-800/80 border border-pink-200 dark:border-pink-900/50 text-brand shadow-xs mb-4">
              <span className="text-xs">✨</span> A COMMUNITY FOR SHARED THINGS
            </div>

            {/* Main Headline from Mockup */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-ink tracking-tight font-display leading-[1.1]">
              Borrow. Rent. <br />
              Lend. <span className="text-brand relative inline-block">
                Everything.
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 250 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 9C50 3 150 2 247 8" stroke="#E11D74" strokeWidth="4" strokeLinecap="round"/>
                </svg>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-5 text-base sm:text-lg font-medium text-ink-secondary max-w-xl mx-auto lg:mx-0 leading-relaxed">
              From cameras to camping gear, books to party fits — get what you need, give what you don't.
            </p>

            {/* Pill Search Bar matching Screen 1 */}
            <div ref={heroSearchRef} className="mt-8 max-w-xl mx-auto lg:mx-0 relative">
              <form 
                onSubmit={(e) => { 
                  e.preventDefault(); 
                  setShowDropdown(false);
                  onSearch(); 
                }}
                className="bg-white dark:bg-[#181922] border border-divider rounded-full p-2 pl-4 shadow-sm hover:shadow-md transition-all flex items-center gap-2 relative z-20"
              >
                <Search className="w-5 h-5 text-ink-muted shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  placeholder="What are you looking for? (Try gear or a neighbor's name)"
                  className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-ink placeholder:text-ink-muted placeholder:font-normal px-2"
                />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setUserSearchResults([]);
                      setShowDropdown(false);
                    }}
                    className="p-1 text-ink-muted hover:text-ink text-xs cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Circular Pink Search Button */}
                <button
                  type="submit"
                  className="w-11 h-11 bg-brand hover:bg-brand-hover text-white rounded-full flex items-center justify-center shrink-0 shadow-pink transition-transform hover:scale-105 cursor-pointer"
                  title="Search Rentals"
                >
                  <Search className="w-4 h-4" />
                </button>
              </form>

              {/* Live Search Flyout Dropdown */}
              {showDropdown && searchQuery.trim().length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface/98 backdrop-blur-xl border border-divider rounded-2xl shadow-2xl p-3 z-30 animate-in fade-in zoom-in-95 duration-150 divide-y divide-divider">
                  {/* Community Members section */}
                  <div>
                    <div className="flex items-center justify-between px-2 py-1 text-[10px] font-black uppercase tracking-wider text-ink-muted">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-brand" />
                        <span>Community Members</span>
                      </span>
                      {isSearchingUsers ? (
                        <span className="text-[10px] text-ink-secondary flex items-center gap-1 animate-pulse">Searching neighbors...</span>
                      ) : (
                        <span>{userSearchResults.length} found</span>
                      )}
                    </div>

                    {userSearchResults.length > 0 ? (
                      <div className="space-y-1 mt-1 max-h-56 overflow-y-auto">
                        {userSearchResults.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (onOpenUserProfile) {
                                onOpenUserProfile(u.id);
                              }
                              setShowDropdown(false);
                            }}
                            onClick={() => {
                              if (onOpenUserProfile) {
                                onOpenUserProfile(u.id);
                              }
                              setShowDropdown(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-canvas text-left cursor-pointer transition-colors group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={u.avatar_url || (u.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')}
                                alt={u.name}
                                className="w-9 h-9 rounded-full object-cover border border-divider group-hover:border-brand shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs sm:text-sm font-bold text-ink group-hover:text-brand truncate">{u.name}</span>
                                  <span className="inline-flex items-center text-[10px] font-black text-amber-500">
                                    ★ {u.rating ? u.rating.toFixed(1) : '5.0'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-ink-secondary truncate">
                                  {u.locality || 'Verified Neighbor'} • {u.items_count} gear listed • {u.trust_score}% trust
                                </div>
                              </div>
                            </div>

                            <span className="text-xs font-bold text-brand group-hover:underline shrink-0 ml-2">
                              View Profile →
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : !isSearchingUsers ? (
                      <div className="px-3 py-2 text-xs text-ink-secondary text-center">
                        No community members matching "{searchQuery}"
                      </div>
                    ) : null}
                  </div>

                  {/* Marketplace Gear Search option */}
                  <div className="pt-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDropdown(false);
                        onSearch();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-brand-soft text-left cursor-pointer transition-colors text-xs font-bold text-ink hover:text-brand"
                    >
                      <span className="flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-brand" />
                        <span>Search gear listings for "{searchQuery}"</span>
                      </span>
                      <span className="text-[10px] text-ink-muted">Press Enter ↵</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Visual Scrapbook Collage from Screen 1 */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-full max-w-md">
              
              {/* Main Photo Card (Young woman with camera) */}
              <div className="relative bg-white dark:bg-[#181922] p-2.5 rounded-3xl shadow-md border border-divider overflow-hidden rotate-1 hover:rotate-0 transition-transform duration-300">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80"
                  alt="Community creator taking photos"
                  className="w-full aspect-[4/4.2] object-cover rounded-2xl"
                />
              </div>

              {/* Inset Photo 1: Canon DSLR Camera */}
              <div className="absolute -top-3 -left-2 sm:-top-4 sm:-left-6 w-28 sm:w-36 bg-white dark:bg-[#181922] p-1.5 sm:p-2 rounded-2xl shadow-lg border border-divider -rotate-6 hover:rotate-0 transition-transform">
                <img
                  src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80"
                  alt="Canon DSLR camera"
                  className="w-full aspect-square object-cover rounded-xl"
                />
              </div>

              {/* Inset Photo 2: Cute Puppy / Lifestyle */}
              <div className="absolute -bottom-3 -left-2 sm:-bottom-4 sm:-left-4 w-24 sm:w-32 bg-white dark:bg-[#181922] p-1.5 sm:p-2 rounded-2xl shadow-lg border border-divider rotate-6 hover:rotate-0 transition-transform">
                <img
                  src="https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=400&q=80"
                  alt="Puppy friendly community"
                  className="w-full aspect-square object-cover rounded-xl"
                />
              </div>

              {/* Doodle Sticker 1: Top Yellow Tilted Badge */}
              <div className="absolute -top-3 right-4 bg-[#FEF08A] text-zinc-900 text-[10px] sm:text-[11px] font-black uppercase px-3 py-1.5 rounded-full border border-yellow-300 shadow-sm -rotate-6">
                <span>✨ SAME STUFF. MORE PEOPLE. HAPPIER PLANET.</span>
              </div>

              {/* Doodle Sticker 2: Round Pink Sticker */}
              <div className="absolute -bottom-3 right-6 w-20 h-20 rounded-full bg-[#FCE7F3] dark:bg-pink-950/70 border-2 border-dashed border-brand text-brand flex items-center justify-center text-center p-2 text-[9px] font-black uppercase leading-tight shadow-sm rotate-12">
                GOOD THINGS CIRCULATE
              </div>

              {/* Doodle Sticker 3: Purple Pill */}
              <div className="absolute top-1/2 -right-6 bg-[#EDE9FE] dark:bg-purple-950/70 text-purple-900 dark:text-purple-300 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800 shadow-sm rotate-90 hidden sm:block">
                PEOPLE OVER THINGS
              </div>

            </div>
          </div>

        </div>

        {/* Stats & Community Impact Banner */}
        <div className="mt-6 bg-white dark:bg-[#181922] border border-divider rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 divide-x-0 sm:divide-x divide-divider w-full md:w-auto">
            <div className="text-center sm:text-left sm:pr-6">
              <div className="text-2xl font-black text-ink font-display">{itemsCount}</div>
              <div className="text-xs font-semibold text-ink-secondary">Items Available</div>
            </div>
            <div className="text-center sm:text-left sm:px-6">
              <div className="text-2xl font-black text-ink font-display">{requestsCount}</div>
              <div className="text-xs font-semibold text-ink-secondary">Active Requests</div>
            </div>
            <div className="text-center sm:text-left sm:px-6">
              <div className="text-2xl font-black text-ink font-display">8</div>
              <div className="text-xs font-semibold text-ink-secondary">Categories</div>
            </div>
            <div className="text-center sm:text-left sm:pl-6">
              <div className="text-2xl font-black text-brand font-display">100%</div>
              <div className="text-xs font-semibold text-ink-secondary">Peer Verified</div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-divider">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-secondary">
              <div className="w-7 h-7 rounded-full bg-[#FCE7F3] text-brand flex items-center justify-center shrink-0">
                <Heart className="w-3.5 h-3.5 fill-brand" />
              </div>
              <span className="hidden lg:inline">Join a community that shares, saves and makes a difference.</span>
            </div>

            <button
              onClick={onGetStarted}
              className="btn-primary text-xs px-5 py-2.5 shrink-0 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};
