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
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics()
      .then(res => setAnalytics(res))
      .catch(err => console.error('Failed to load analytics:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const pulse = analytics?.pulse || {};
  const categories: Array<{ category: string; count: number; avg_rate?: number }> = analytics?.categories || [];
  const localities: Array<{ locality: string; user_count: number }> = analytics?.localities || [];

  const totalUsers = pulse?.total_users || 0;
  const activeLenders = pulse?.active_lenders || 0;
  const activeBorrowers = pulse?.active_borrowers || 0;
  const totalVolume = Number(pulse?.total_community_volume || 0);
  const ratioText = activeLenders > 0 ? `1 : ${(activeBorrowers / activeLenders).toFixed(1)}` : (activeBorrowers > 0 ? `0 : ${activeBorrowers}` : '1 : 1');

  const totalCategoryItems = categories.reduce((sum, c) => sum + Number(c.count || 0), 0) || 1;
  const categoryPalette = [
    'bg-purple-500', 'bg-amber-400', 'bg-pink-500', 'bg-teal-500', 
    'bg-orange-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-zinc-400'
  ];

  const totalLocalityUsers = localities.reduce((sum, l) => sum + Number(l.user_count || 0), 0) || 1;
  const localityPalette = ['bg-brand', 'bg-purple-400', 'bg-emerald-400', 'bg-amber-400', 'bg-zinc-400'];

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-150">
      
      <div className="bg-surface border border-divider rounded-3xl overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-12 min-h-[650px]">
        
        {/* Left Sidebar (3 cols) */}
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

        {/* Right Dashboard Area (9 cols) */}
        <main className="md:col-span-9 p-6 sm:p-8 space-y-6 bg-surface">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-divider">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-display">
                Community Overview
              </h2>
              <p className="text-xs text-ink-secondary font-medium">Real-time peer rental ecosystem statistics</p>
            </div>

            <div className="flex items-center gap-2 bg-canvas border border-divider px-3 py-1.5 rounded-full text-xs font-bold text-ink self-start sm:self-auto">
              <span>Live Database</span>
            </div>
          </div>

          {/* Top 4 Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
              <div className="text-xs font-semibold text-ink-secondary">Total Users</div>
              <div className="text-2xl font-black text-ink font-display">{totalUsers}</div>
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" /> Live
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
              <div className="text-xs font-semibold text-ink-secondary">Active Lenders</div>
              <div className="text-2xl font-black text-ink font-display">{activeLenders}</div>
              <div className="text-[11px] font-bold text-ink-secondary">
                {pulse?.available_gear || 0} gear available
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
              <div className="text-xs font-semibold text-ink-secondary">Active Borrowers</div>
              <div className="text-2xl font-black text-ink font-display">{activeBorrowers}</div>
              <div className="text-[11px] font-bold text-ink-secondary">
                {pulse?.open_wishes || 0} open wishes
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
              <div className="text-xs font-semibold text-ink-secondary">Rental Value Handled</div>
              <div className="text-2xl font-black text-brand font-display">₹{totalVolume.toLocaleString('en-IN')}</div>
              <div className="text-[11px] font-bold text-ink-secondary">
                {pulse?.completed_bookings || 0} completed handoffs
              </div>
            </div>
          </div>

          {/* Ratio Card */}
          <div className="p-4 rounded-2xl bg-[#FFF5F7] dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-brand uppercase tracking-wider">Lender to Borrower Ratio</div>
              <div className="text-xs text-ink-secondary font-medium mt-0.5">Marketplace balance based on registered users</div>
            </div>
            <div className="text-2xl font-black text-brand font-display self-start sm:self-auto">
              {ratioText}
            </div>
          </div>

          {/* 2-Column Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            
            {/* Most Active Categories Bar Chart */}
            <div className="bg-canvas border border-divider rounded-2xl p-5 space-y-4">
              <h4 className="text-sm font-extrabold text-ink">Most Active Categories</h4>
              {categories.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink-secondary font-medium">
                  No gear listed in categories yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {categories.map((cat, idx) => {
                    const percentage = Math.round((Number(cat.count) / totalCategoryItems) * 100);
                    const color = categoryPalette[idx % categoryPalette.length];
                    return (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-ink">{cat.category}</span>
                          <span className="text-ink-secondary">{percentage}% ({cat.count})</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${color} rounded-full`}
                            style={{ width: `${Math.max(percentage, 5)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Users by Locality Visualization */}
            <div className="bg-canvas border border-divider rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <h4 className="text-sm font-extrabold text-ink">Users by Locality</h4>
              
              {localities.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink-secondary font-medium">
                  No locality data registered yet.
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
                  <div className="relative w-36 h-36 rounded-full border-[14px] border-brand flex items-center justify-center">
                    <div className="text-center">
                      <span className="text-xl font-black text-ink font-display">{totalUsers}</span>
                      <span className="block text-[10px] font-bold text-ink-secondary">Total Users</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs font-semibold text-ink">
                    {localities.map((loc, idx) => {
                      const percentage = Math.round((Number(loc.user_count) / totalLocalityUsers) * 100);
                      const color = localityPalette[idx % localityPalette.length];
                      return (
                        <div key={loc.locality} className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
                          <span>{loc.locality} ({percentage}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="text-[11px] text-ink-secondary text-center pt-2 border-t border-divider">
                Verified community statistics from live database. Rentals restricted to user's registered home city.
              </div>
            </div>

          </div>

        </main>

      </div>

    </div>
  );
};
