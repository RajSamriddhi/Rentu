import React from 'react';
import { MapPin, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { Item } from '../lib/types';
import { getReachDistance } from '../lib/distance';

interface AiListingCardProps {
  item: Item & {
    savings_per_day?: number | null;
    savings_percentage?: number | null;
    estimated_total?: number;
    duration_days?: number;
    availability_verified?: boolean;
    is_available?: boolean;
  };
  onSelectItem: (item: Item) => void;
}

export const AiListingCard: React.FC<AiListingCardProps> = ({ item, onSelectItem }) => {
  const thumbUrl = (item.image_urls && item.image_urls.length > 0)
    ? item.image_urls[0]
    : 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80';

  const dailyPrice = Number(item.price_per_day);
  const estTotal = item.estimated_total ?? (item.duration_days ? dailyPrice * item.duration_days : null);

  return (
    <div className="group relative clean-card p-3 bg-surface hover:border-brand/60 transition-all shadow-xs hover:shadow-card-hover rounded-2xl border border-divider flex flex-col gap-2">
      
      {/* Top Details row */}
      <div className="flex items-start gap-3">
        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-canvas border border-divider shrink-0">
          <img
            src={thumbUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-brand-soft text-brand border border-brand/20">
              {item.category || 'Gear'}
            </span>

            {/* Savings Badge */}
            {item.savings_per_day && item.savings_per_day > 0 ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Save ₹{item.savings_per_day}/day ({item.savings_percentage}% off)</span>
              </span>
            ) : null}
          </div>

          <h5 className="text-xs font-black text-ink truncate mt-1 group-hover:text-brand transition-colors">
            {item.title}
          </h5>

          <div className="flex items-center gap-2 text-[11px] text-ink-secondary mt-0.5">
            <span className="font-extrabold text-ink">
              ₹{dailyPrice}<span className="text-[10px] font-normal text-ink-secondary">/day</span>
            </span>
            {estTotal && (
              <>
                <span>•</span>
                <span className="text-brand font-bold">₹{estTotal} total</span>
              </>
            )}
            <span>•</span>
            <span className="flex items-center gap-0.5 truncate">
              <MapPin className="w-3 h-3 text-ink-muted shrink-0" />
              <span className="truncate">{getReachDistance(item)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2 border-t border-divider/60 flex items-center justify-between gap-2">
        <div className="text-[10px] text-ink-secondary flex items-center gap-1">
          {item.availability_verified ? (
            item.is_available ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Verified Available</span>
              </span>
            ) : (
              <span className="text-amber-600 font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>Dates Booked</span>
              </span>
            )
          ) : (
            <span className="text-ink-secondary flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Available to Rent</span>
            </span>
          )}
        </div>

        <button
          onClick={() => onSelectItem(item)}
          className="btn-primary text-[11px] font-extrabold py-1 px-3.5 shadow-xs cursor-pointer flex items-center gap-1 hover:scale-102"
        >
          <span>View Gear</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

    </div>
  );
};
