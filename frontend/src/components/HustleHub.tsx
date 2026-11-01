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
  ArrowUpRight,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  Search,
  ShieldAlert
} from 'lucide-react';
import { api } from '../lib/api';
import { SupportTicket, isAuthorizedAdmin } from '../lib/types';
import { useAuth } from '../lib/authContext';

export const HustleHub: React.FC = () => {
  const { user } = useAuth();
  const [activeSidebar, setActiveSidebar] = useState('Overview');
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Support & Concerns Admin State
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketFilterType, setTicketFilterType] = useState<'ALL' | 'CONCERN' | 'FEEDBACK'>('ALL');
  const [ticketFilterStatus, setTicketFilterStatus] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [adminNoteInputs, setAdminNoteInputs] = useState<Record<string, string>>({});
  const [isUpdatingTicket, setIsUpdatingTicket] = useState<string | null>(null);

  useEffect(() => {
    api.getAnalytics()
      .then(res => setAnalytics(res))
      .catch(err => console.error('Failed to load analytics:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const loadAdminTickets = async () => {
    setIsLoadingTickets(true);
    try {
      const tickets = await api.getAdminSupportTickets({
        status: ticketFilterStatus,
        type: ticketFilterType,
      });
      setSupportTickets(Array.isArray(tickets) ? tickets : []);
    } catch (err) {
      console.error('Failed to load admin support tickets:', err);
      setSupportTickets([]);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (activeSidebar === 'Concerns & Feedback' || activeSidebar === 'Reports') {
      loadAdminTickets();
    }
  }, [activeSidebar, ticketFilterType, ticketFilterStatus]);

  const handleUpdateTicket = async (ticketId: string, newStatus?: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED', notes?: string) => {
    setIsUpdatingTicket(ticketId);
    try {
      const updated = await api.updateAdminSupportTicket(ticketId, {
        status: newStatus,
        admin_notes: notes || adminNoteInputs[ticketId] || undefined,
      });
      setSupportTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...updated } : t));
      alert(`Ticket updated successfully! The user has been notified.`);
    } catch (err: any) {
      alert(err.message || 'Could not update ticket');
    } finally {
      setIsUpdatingTicket(null);
    }
  };

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
    { name: 'Concerns & Feedback', icon: <AlertTriangle className="w-4 h-4 text-amber-500" /> },
    { name: 'Users', icon: <Users className="w-4 h-4" /> },
    { name: 'Listings', icon: <Package className="w-4 h-4" /> },
    { name: 'Requests', icon: <Target className="w-4 h-4" /> },
    { name: 'Bookings', icon: <Layers className="w-4 h-4" /> },
    { name: 'Analytics', icon: <TrendingUp className="w-4 h-4" /> },
    { name: 'Locality', icon: <MapPin className="w-4 h-4" /> },
    { name: 'Reports', icon: <FileText className="w-4 h-4" /> },
    { name: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  if (!isAuthorizedAdmin(user?.email)) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4 animate-in fade-in duration-150">
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto text-2xl">
          🔒
        </div>
        <h2 className="text-xl font-black text-ink font-display">Admin Portal Restricted</h2>
        <p className="text-xs text-ink-secondary leading-relaxed">
          The Admin console is restricted exclusively to authorized platform administrators (falaksadiqua786@gmail.com & rajsamriddhi60@gmail.com).
        </p>
      </div>
    );
  }

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
          
          {activeSidebar === 'Concerns & Feedback' ? (
            <div className="space-y-6">
              {/* Header & Filter Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-divider">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-display flex items-center gap-2">
                    <span>Community Concerns & Feedback</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand/10 text-brand font-black">
                      {supportTickets.length} Total
                    </span>
                  </h2>
                  <p className="text-xs text-ink-secondary font-medium mt-0.5">
                    Issues reported by neighbors & feature suggestions. Resolving immediately notifies the user.
                  </p>
                </div>

                <button
                  onClick={loadAdminTickets}
                  className="btn-secondary text-xs px-3.5 py-1.5 cursor-pointer font-bold inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Refresh Tickets</span>
                </button>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-canvas p-3 rounded-2xl border border-divider text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-ink mr-1">Type:</span>
                  {(['ALL', 'CONCERN', 'FEEDBACK'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTicketFilterType(t)}
                      className={`px-3 py-1 rounded-xl font-bold cursor-pointer transition-all ${
                        ticketFilterType === t ? 'bg-brand text-white shadow-xs' : 'hover:bg-surface text-ink-secondary'
                      }`}
                    >
                      {t === 'ALL' ? 'All' : t === 'CONCERN' ? '⚠️ Concerns' : '💡 Feedback'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-ink mr-1">Status:</span>
                  {(['ALL', 'OPEN', 'RESOLVED'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setTicketFilterStatus(s)}
                      className={`px-3 py-1 rounded-xl font-bold cursor-pointer transition-all ${
                        ticketFilterStatus === s ? 'bg-ink text-canvas shadow-xs' : 'hover:bg-surface text-ink-secondary'
                      }`}
                    >
                      {s === 'ALL' ? 'All' : s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ticket Cards List */}
              {isLoadingTickets ? (
                <div className="py-20 text-center text-xs text-ink-secondary flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-brand animate-spin" />
                  <span>Loading support tickets...</span>
                </div>
              ) : supportTickets.length === 0 ? (
                <div className="py-20 text-center space-y-2 bg-canvas rounded-2xl border border-divider">
                  <div className="w-12 h-12 rounded-full bg-surface border border-divider flex items-center justify-center mx-auto text-xl">
                    🎉
                  </div>
                  <p className="text-sm font-bold text-ink">No Tickets Matching Filter</p>
                  <p className="text-xs text-ink-secondary max-w-sm mx-auto">
                    All concerns and feedback are resolved or none have been submitted under this view.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {supportTickets.map((ticket) => {
                    const isUpdating = isUpdatingTicket === ticket.id;
                    return (
                      <div
                        key={ticket.id}
                        className="p-5 rounded-2xl bg-canvas border border-divider space-y-3.5 transition-all hover:border-divider/80"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              ticket.type === 'CONCERN' 
                                ? 'bg-red-500/10 text-red-500 border border-red-500/25' 
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/25'
                            }`}>
                              {ticket.type === 'CONCERN' ? '⚠️ Concern' : '💡 Feedback'}
                            </span>
                            <span className="text-xs font-bold text-ink bg-surface px-2.5 py-0.5 rounded-full border border-divider">
                              {ticket.category}
                            </span>
                            {ticket.priority && ticket.priority !== 'NORMAL' && (
                              <span className="text-[10px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                {ticket.priority} Priority
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                              ticket.status === 'RESOLVED'
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : ticket.status === 'IN_REVIEW'
                                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}>
                              Status: {ticket.status}
                            </span>
                            <span className="text-[10px] text-ink-muted">
                              {new Date(ticket.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Title & Body */}
                        <div>
                          <h3 className="text-base font-black text-ink">{ticket.subject}</h3>
                          <p className="text-xs text-ink-secondary mt-1 leading-relaxed whitespace-pre-wrap">
                            {ticket.description}
                          </p>
                        </div>

                        {/* User Identity info */}
                        <div className="p-3 rounded-xl bg-surface border border-divider flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={ticket.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.user_name || 'Neighbor')}&background=0F172A&color=fff&bold=true`}
                              alt={ticket.user_name || 'User'}
                              className="w-7 h-7 rounded-full object-cover border border-divider"
                            />
                            <div>
                              <span className="font-bold text-ink">{ticket.user_name || 'Member'}</span>
                              <span className="text-ink-secondary ml-2 text-[11px]">{ticket.user_email}</span>
                            </div>
                          </div>
                          {ticket.user_locality && (
                            <span className="text-[11px] text-ink-muted hidden sm:inline">{ticket.user_locality}</span>
                          )}
                        </div>

                        {/* Existing Admin Notes if resolved */}
                        {ticket.admin_notes && (
                          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1">
                            <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Admin Resolution Note:</span>
                            </div>
                            <p className="text-ink-secondary pl-5 text-[11px]">{ticket.admin_notes}</p>
                          </div>
                        )}

                        {/* Admin Actions Bar */}
                        <div className="pt-2 border-t border-divider flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={adminNoteInputs[ticket.id] !== undefined ? adminNoteInputs[ticket.id] : ''}
                              onChange={(e) => setAdminNoteInputs({ ...adminNoteInputs, [ticket.id]: e.target.value })}
                              placeholder="Type resolution notes to notify user (e.g. Deposit refunded / Bug fixed)..."
                              className="w-full bg-surface border border-divider rounded-xl px-3 py-1.5 text-xs text-ink outline-none focus:border-brand"
                            />
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {ticket.status !== 'IN_REVIEW' && ticket.status !== 'RESOLVED' && (
                              <button
                                disabled={isUpdating}
                                onClick={() => handleUpdateTicket(ticket.id, 'IN_REVIEW')}
                                className="px-3 py-1.5 rounded-xl border border-blue-500/30 text-blue-500 hover:bg-blue-500/10 text-xs font-bold cursor-pointer"
                              >
                                Mark In Review
                              </button>
                            )}

                            {ticket.status !== 'RESOLVED' ? (
                              <button
                                disabled={isUpdating}
                                onClick={() => handleUpdateTicket(ticket.id, 'RESOLVED')}
                                className="btn-primary text-xs px-4 py-1.5 shadow-pink font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Resolve & Notify User</span>
                              </button>
                            ) : (
                              <button
                                disabled={isUpdating}
                                onClick={() => handleUpdateTicket(ticket.id, 'OPEN')}
                                className="text-xs font-bold text-ink-muted hover:text-ink px-3 py-1 cursor-pointer"
                              >
                                Reopen
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
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
          </>
          )}

        </main>

      </div>

    </div>
  );
};
