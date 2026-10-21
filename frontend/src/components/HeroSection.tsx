import React from 'react';
import { Search, ArrowRight, Heart } from 'lucide-react';

interface HeroSectionProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: () => void;
  onGetStarted: () => void;
  onOpenDropGear: () => void;
  itemsCount?: number;
  requestsCount?: number;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  searchQuery,
  setSearchQuery,
  onSearch,
  onGetStarted,
  onOpenDropGear,
  itemsCount = 0,
  requestsCount = 0,
}) => {
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
            <div className="mt-8 max-w-xl mx-auto lg:mx-0">
              <form 
                onSubmit={(e) => { e.preventDefault(); onSearch(); }}
                className="bg-white dark:bg-[#181922] border border-divider rounded-full p-2 pl-4 shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              >
                <Search className="w-5 h-5 text-ink-muted shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="What are you looking for?"
                  className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-ink placeholder:text-ink-muted placeholder:font-normal px-2"
                />

                {/* Circular Pink Search Button */}
                <button
                  type="submit"
                  className="w-11 h-11 bg-brand hover:bg-brand-hover text-white rounded-full flex items-center justify-center shrink-0 shadow-pink transition-transform hover:scale-105 cursor-pointer"
                  title="Search Rentals"
                >
                  <Search className="w-4 h-4" />
                </button>
              </form>
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
