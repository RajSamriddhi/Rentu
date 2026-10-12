import React, { useState, useEffect } from 'react';
import { 
  Users, 
  TrendingUp, 
  Package, 
  Target, 
  MapPin, 
  Settings, 
  FileText, 
  BarChart3, 
  Layers, 
  ChevronDown,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../lib/api';

export const HustleHub: React.FC = () => {
  const [activeSidebar, setActiveSidebar] = useState('Overview');

  const sidebarLinks = [
    { name: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { name: 'Users', icon: <Users className="w-4 h-4" /> },
    { name: 'Listings', icon: <Package className="w-4 h-4" /> },
    { name: 'Requests', icon: <Target className="w-4 h-4" /> },
    { name: 'Bookings', icon: <Layers className="w-4 h-4" /> },
    { name: 'Analytics', icon: <TrendingUp className="w-4 h-4" /> },
    { name: 'Locality', icon: <MapPin className="w-4 h-4" /> },
    { name: 'Reports', icon: <FileText className="w-4 h-4" /> },
    { name: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const categoryBars = [
    { name: 'Electronics', percentage: 29, color: 'bg-purple-500' },
    { name: 'Tools & DIY', percentage: 24, color: 'bg-amber-400' },
    { name: 'Clothing & Accessories', percentage: 18, color: 'bg-pink-500' },
    { name: 'Home & Appliances', percentage: 14, color: 'bg-teal-500' },
    { name: 'Sports', percentage: 8, color: 'bg-orange-500' },
    { name: 'Books & Media', percentage: 5, color: 'bg-indigo-500' },
    { name: 'Camping', percentage: 4, color: 'bg-emerald-500' },
    { name: 'Other', percentage: 2, color: 'bg-zinc-400' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-150">
      
      <div className="bg-surface border border-divider rounded-3xl overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-12 min-h-[650px]">
        
        {/* Left Sidebar matching Screen 10 (3 cols) */}
        <aside className="md:col-span-3 border-r border-divider p-5 bg-canvas/40 space-y-6">
          <div className="font-extrabold text-sm text-ink px-3 py-1">
            Admin Dashboard
          </div>

          <nav className="space-y-1 text-xs font-bold">
            {sidebarLinks.map((item) => {
              const isActive = activeSidebar === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setActiveSidebar(item.name)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-ink text-canvas shadow-xs'
                      : 'text-ink-secondary hover:text-ink hover:bg-surface'
                  }`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Dashboard Area matching Screen 10 (9 cols) */}
        <main className="md:col-span-9 p-6 sm:p-8 space-y-6 bg-surface">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-divider">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-display">
                Community Overview
              </h2>
              <p className="text-xs text-ink-secondary font-medium">Real-time peer rental ecosystem statistics</p>
            </div>

            <div className="flex items-center gap-2 bg-canvas border border-divider px-3 py-1.5 rounded-full text-xs font-bold text-ink cursor-pointer hover:bg-surface-hover self-start sm:self-auto">
              <span>Last 30 days</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </div>
          </div>

          {/* Top 4 Metrics Cards matching Screen 10 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
              <div className="text-xs font-semibold text-ink-secondary">Total Users</div>
              <div className="text-2xl font-black text-ink font-display">1,248</div>
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" /> +12%
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
              <div className="text-xs font-semibold text-ink-secondary">Active Lenders</div>
              <div className="text-2xl font-black text-ink font-display">412</div>
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" /> +14%
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
              <div className="text-xs font-semibold text-ink-secondary">Active Borrowers</div>
              <div className="text-2xl font-black text-ink font-display">836</div>
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" /> +19%
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
              <div className="text-xs font-semibold text-ink-secondary">Estimated Rental Value</div>
              <div className="text-2xl font-black text-brand font-display">₹1,24,600</div>
              <div className="text-[11px] font-bold text-ink-secondary">
                Peer savings ₹3.8L+
              </div>
            </div>
          </div>

          {/* Ratio Card matching Screen 10 */}
          <div className="p-4 rounded-2xl bg-[#FFF5F7] dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-brand uppercase tracking-wider">Lender to Borrower Ratio</div>
              <div className="text-xs text-ink-secondary font-medium mt-0.5">Healthy marketplace balance across campuses</div>
            </div>
            <div className="text-2xl font-black text-brand font-display self-start sm:self-auto">
              1 : 2.0
            </div>
          </div>

          {/* 2-Column Charts matching Screen 10: Categories Bar Chart + Locality Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            
            {/* Most Active Categories Bar Chart */}
            <div className="bg-canvas border border-divider rounded-2xl p-5 space-y-4">
              <h4 className="text-sm font-extrabold text-ink">Most Active Categories</h4>
              <div className="space-y-2.5">
                {categoryBars.map((cat) => (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-ink">{cat.name}</span>
                      <span className="text-ink-secondary">{cat.percentage}%</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${cat.color} rounded-full`}
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Users by Locality Donut Visualization matching Screen 10 */}
            <div className="bg-canvas border border-divider rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <h4 className="text-sm font-extrabold text-ink">Users by Locality</h4>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
                {/* Visual Donut representation */}
                <div className="relative w-36 h-36 rounded-full border-[14px] border-brand flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-[14px] border-purple-400 rotate-45 border-t-transparent border-l-transparent" />
                  <div className="text-center">
                    <span className="text-xl font-black text-ink font-display">1.2K</span>
                    <span className="block text-[10px] font-bold text-ink-secondary">Locals</span>
                  </div>
                </div>

                {/* Donut Legend matching Screen 10 */}
                <div className="space-y-1.5 text-xs font-semibold text-ink">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand shrink-0" />
                    <span>Saket (36%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shrink-0" />
                    <span>Hauz Khas (24%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                    <span>Lajpat Nagar (18%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                    <span>GK (12%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 shrink-0" />
                    <span>Other (10%)</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-ink-secondary text-center pt-2 border-t border-divider">
                Rentals restricted to user's registered home city.
              </div>
            </div>

          </div>

        </main>

      </div>

    </div>
  );
};
