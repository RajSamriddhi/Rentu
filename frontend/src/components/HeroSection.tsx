import React from 'react';
import { ArrowRight, Heart, LockKeyhole, Plus, Search, ShieldCheck, Sparkles, Zap } from 'lucide-react';

interface HeroSectionProps {
  onOpenDropGear: () => void;
  onOpenDropWish?: () => void;
  onGetStarted: () => void;
  itemsCount?: number;
  requestsCount?: number;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  onSearch?: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenDropGear,
  onOpenDropWish,
  onGetStarted,
  itemsCount = 0,
  requestsCount = 0,
  searchQuery = '',
  setSearchQuery,
  onSearch,
}) => {
  return (
    <section className="relative isolate overflow-hidden bg-canvas px-4 py-6 transition-colors sm:px-6 sm:py-9 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_12%_15%,rgba(225,29,116,0.12),transparent_38%),radial-gradient(ellipse_at_88%_78%,rgba(124,58,237,0.1),transparent_36%)]" />
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-divider bg-surface/80 px-5 py-7 shadow-sm backdrop-blur-sm sm:px-9 sm:py-10 lg:px-12 lg:py-12">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div className="text-center lg:text-left">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand lg:mx-0">
              <Sparkles className="h-3.5 w-3.5" /> The neighborhood sharing network
            </div>
            <h1 className="mt-5 font-display text-4xl font-black leading-[1.04] tracking-[-0.045em] text-ink sm:text-5xl lg:text-6xl">
              Borrow. Rent. Lend.
              <span className="mt-1 block text-brand">Everything.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-sm font-medium leading-7 text-ink-secondary sm:text-base lg:mx-0">
              Get the gear you need from people nearby. Make more of what you already own.
            </p>

            {setSearchQuery && onSearch && (
              <form
                onSubmit={(event) => { event.preventDefault(); onSearch(); }}
                className="mx-auto mt-7 flex max-w-xl items-center gap-2 rounded-2xl border border-divider bg-canvas p-2 pl-4 shadow-sm transition-all focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10 lg:mx-0"
              >
                <Search className="h-5 w-5 shrink-0 text-ink-muted" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="What are you looking for?"
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-muted"
                />
                <button
                  type="submit"
                  aria-label="Search rentals"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-md shadow-brand/20 transition-all hover:scale-105 hover:bg-brand-hover"
                >
                  <Search className="h-4 w-4" />
                </button>
              </form>
            )}

            <div className="mt-5 flex flex-col justify-center gap-2.5 sm:flex-row lg:justify-start">
              <button
                type="button"
                onClick={onGetStarted}
                className="btn-primary min-h-11 rounded-2xl px-5 text-sm shadow-lg shadow-brand/20 transition-transform hover:-translate-y-0.5"
              >
                Explore marketplace <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onOpenDropGear}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-divider bg-canvas px-5 text-sm font-bold text-ink transition-colors hover:border-brand/40 hover:bg-brand-soft"
              >
                <Plus className="h-4 w-4 text-brand" /> List gear
              </button>
              {onOpenDropWish && (
                <button
                  type="button"
                  onClick={onOpenDropWish}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-transparent px-4 text-sm font-bold text-ink-secondary transition-colors hover:bg-canvas hover:text-brand"
                >
                  <Zap className="h-4 w-4 text-brand" /> Post a request
                </button>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-ink-secondary lg:justify-start">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-500" />Community powered</span>
              <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5 text-amber-500" />Secure handovers</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
            <div className="absolute -right-3 -top-4 h-24 w-24 rounded-full bg-amber-300/50 blur-2xl" />
            <div className="absolute -bottom-5 -left-4 h-28 w-28 rounded-full bg-brand/15 blur-2xl" />
            <div className="relative rounded-[1.75rem] border border-divider bg-canvas p-4 shadow-xl shadow-zinc-900/5 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-ink-secondary">Your neighborhood, in motion</p>
                  <p className="mt-1 font-display text-lg font-extrabold tracking-tight text-ink">Share more. Buy less.</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Sparkles className="h-5 w-5" /></span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-divider bg-surface p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">Gear to explore</p>
                  <p className="mt-2 font-display text-3xl font-black tracking-tight text-ink">{itemsCount}</p>
                  <p className="mt-1 text-xs font-medium text-ink-secondary">Ready for its next outing</p>
                </div>
                <div className="rounded-2xl border border-divider bg-surface p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">Community asks</p>
                  <p className="mt-2 font-display text-3xl font-black tracking-tight text-ink">{requestsCount}</p>
                  <p className="mt-1 text-xs font-medium text-ink-secondary">Help someone find a thing</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-brand/15 bg-brand-soft/70 p-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-xl shadow-sm">📸</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-ink">A camera for the weekend</p>
                  <p className="mt-0.5 text-xs font-medium text-ink-secondary">Find it nearby, rent it simply.</p>
                </div>
                <Heart className="h-4 w-4 shrink-0 fill-brand text-brand" />
              </div>
            </div>
            <div className="absolute -bottom-4 right-5 rounded-full border border-divider bg-surface px-3.5 py-2 text-[11px] font-extrabold text-ink shadow-lg sm:right-8">
              People over things <span className="ml-1 text-brand">✳</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
