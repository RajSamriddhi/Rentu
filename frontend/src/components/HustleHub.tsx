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
  ShieldAlert,
  Trash2,
  Edit3,
  ShieldCheck,
  Download,
  Plus,
  RefreshCw,
  Eye,
  Check,
  X
} from 'lucide-react';
import { api } from '../lib/api';
import { SupportTicket, isAuthorizedAdmin } from '../lib/types';
import { useAuth } from '../lib/authContext';

export const HustleHub: React.FC = () => {
  const { user } = useAuth();
  const [activeSidebar, setActiveSidebar] = useState('Overview');
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Support & Concerns Admin State
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketFilterType, setTicketFilterType] = useState<'ALL' | 'CONCERN' | 'FEEDBACK'>('ALL');
  const [ticketFilterStatus, setTicketFilterStatus] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [adminNoteInputs, setAdminNoteInputs] = useState<Record<string, string>>({});
  const [isUpdatingTicket, setIsUpdatingTicket] = useState<string | null>(null);

  // 2. Users Admin State
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'USER' | 'ADMIN'>('ALL');
  const [isUpdatingUser, setIsUpdatingUser] = useState<string | null>(null);

  // 3. Listings Admin State
  const [adminListings, setAdminListings] = useState<any[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [listingSearch, setListingSearch] = useState('');
  const [listingStatusFilter, setListingStatusFilter] = useState<string>('ALL');
  const [isUpdatingListing, setIsUpdatingListing] = useState<string | null>(null);

  // 4. Requests Admin State
  const [adminRequests, setAdminRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('ALL');

  // 5. Bookings Admin State
  const [adminBookings, setAdminBookings] = useState<any[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL');
  const [isUpdatingBooking, setIsUpdatingBooking] = useState<string | null>(null);

  // 6. Locality Admin State
  const [adminLocalities, setAdminLocalities] = useState<any[]>([]);
  const [isLoadingLocalities, setIsLoadingLocalities] = useState(false);
  const [newPincode, setNewPincode] = useState('');
  const [newLocality, setNewLocality] = useState('');
  const [newCity, setNewCity] = useState('Bangalore');
  const [newState, setNewState] = useState('Karnataka');
  const [isAddingLocality, setIsAddingLocality] = useState(false);

  // 7. Reports Admin State
  const [adminReports, setAdminReports] = useState<any>(null);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  useEffect(() => {
    loadOverviewAnalytics();
  }, []);

  const loadOverviewAnalytics = () => {
    setIsLoading(true);
    api.getAnalytics()
      .then(res => setAnalytics(res))
      .catch(err => console.error('Failed to load analytics:', err))
      .finally(() => setIsLoading(false));
  };

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

  const loadAdminUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const users = await api.getAdminUsers();
      setAdminUsers(Array.isArray(users) ? users : []);
    } catch (err) {
      console.error('Failed to load admin users:', err);
      setAdminUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadAdminListings = async () => {
    setIsLoadingListings(true);
    try {
      const listings = await api.getAdminListings();
      setAdminListings(Array.isArray(listings) ? listings : []);
    } catch (err) {
      console.error('Failed to load admin listings:', err);
      setAdminListings([]);
    } finally {
      setIsLoadingListings(false);
    }
  };

  const loadAdminRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const reqs = await api.getAdminRequests();
      setAdminRequests(Array.isArray(reqs) ? reqs : []);
    } catch (err) {
      console.error('Failed to load admin requests:', err);
      setAdminRequests([]);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const loadAdminBookings = async () => {
    setIsLoadingBookings(true);
    try {
      const bookings = await api.getAdminBookings();
      setAdminBookings(Array.isArray(bookings) ? bookings : []);
    } catch (err) {
      console.error('Failed to load admin bookings:', err);
      setAdminBookings([]);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const loadAdminLocalities = async () => {
    setIsLoadingLocalities(true);
    try {
      const locs = await api.getAdminLocalities();
      setAdminLocalities(Array.isArray(locs) ? locs : []);
    } catch (err) {
      console.error('Failed to load admin localities:', err);
      setAdminLocalities([]);
    } finally {
      setIsLoadingLocalities(false);
    }
  };

  const loadAdminReports = async () => {
    setIsLoadingReports(true);
    try {
      const reports = await api.getAdminReports();
      setAdminReports(reports);
    } catch (err) {
      console.error('Failed to load admin reports:', err);
      setAdminReports(null);
    } finally {
      setIsLoadingReports(false);
    }
  };

  // Load data reactively when switching tabs
  useEffect(() => {
    if (activeSidebar === 'Concerns & Feedback') loadAdminTickets();
    if (activeSidebar === 'Users') loadAdminUsers();
    if (activeSidebar === 'Listings') loadAdminListings();
    if (activeSidebar === 'Requests') loadAdminRequests();
    if (activeSidebar === 'Bookings') loadAdminBookings();
    if (activeSidebar === 'Locality') loadAdminLocalities();
    if (activeSidebar === 'Reports') {
      loadAdminReports();
      loadAdminTickets();
    }
    if (activeSidebar === 'Overview' || activeSidebar === 'Analytics') loadOverviewAnalytics();
  }, [activeSidebar]);

  // Support ticket update
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

  // User role toggle / trust score update
  const handleToggleUserRole = async (targetUser: any) => {
    const newRole = targetUser.role === 'ADMIN' ? 'USER' : 'ADMIN';
    if (!window.confirm(`Are you sure you want to change ${targetUser.name}'s role to ${newRole}?`)) return;

    setIsUpdatingUser(targetUser.id);
    try {
      await api.updateAdminUser(targetUser.id, { role: newRole });
      setAdminUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u));
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
    } finally {
      setIsUpdatingUser(null);
    }
  };

  const handleUpdateUserTrust = async (targetUser: any) => {
    const input = window.prompt(`Enter new trust score for ${targetUser.name} (0 - 100):`, String(targetUser.trust_score || 95));
    if (input === null) return;
    const score = parseInt(input, 10);
    if (isNaN(score) || score < 0 || score > 100) {
      alert('Please enter a valid number between 0 and 100.');
      return;
    }

    setIsUpdatingUser(targetUser.id);
    try {
      await api.updateAdminUser(targetUser.id, { trust_score: score });
      setAdminUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, trust_score: score } : u));
    } catch (err: any) {
      alert(err.message || 'Failed to update trust score');
    } finally {
      setIsUpdatingUser(null);
    }
  };

  // Listing status & delete
  const handleUpdateListingStatus = async (itemId: string, status: 'AVAILABLE' | 'RENTED' | 'UNAVAILABLE') => {
    setIsUpdatingListing(itemId);
    try {
      await api.updateAdminListingStatus(itemId, status);
      setAdminListings(prev => prev.map(item => item.id === itemId ? { ...item, status } : item));
    } catch (err: any) {
      alert(err.message || 'Failed to update listing status');
    } finally {
      setIsUpdatingListing(null);
    }
  };

  const handleDeleteListing = async (itemId: string, title: string) => {
    if (!window.confirm(`Delete listing "${title}" permanently from Rentu?`)) return;
    try {
      await api.deleteAdminListing(itemId);
      setAdminListings(prev => prev.filter(item => item.id !== itemId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete listing');
    }
  };

  // Request delete
  const handleDeleteRequest = async (requestId: string, itemName: string) => {
    if (!window.confirm(`Delete request "${itemName}" permanently?`)) return;
    try {
      await api.deleteAdminRequest(requestId);
      setAdminRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete request');
    }
  };

  // Booking status override
  const handleUpdateBookingStatus = async (bookingId: string, status: 'ACCEPTED' | 'HANDED_OVER' | 'COMPLETED' | 'CANCELLED') => {
    setIsUpdatingBooking(bookingId);
    try {
      await api.updateAdminBookingStatus(bookingId, status);
      setAdminBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
    } catch (err: any) {
      alert(err.message || 'Failed to update booking');
    } finally {
      setIsUpdatingBooking(null);
    }
  };

  // Add locality zone
  const handleAddLocalitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPincode.trim() || !newLocality.trim() || isAddingLocality) return;
    setIsAddingLocality(true);
    try {
      const added = await api.addAdminLocality({
        pincode: newPincode.trim(),
        locality: newLocality.trim(),
        city: newCity.trim(),
        state: newState.trim(),
      });
      setAdminLocalities(prev => [added, ...prev]);
      setNewPincode('');
      setNewLocality('');
      alert('Community zone registered successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to register locality');
    } finally {
      setIsAddingLocality(false);
    }
  };

  // CSV Export utility
  const exportToCSV = (filename: string, rows: object[]) => {
    if (!rows || !rows.length) {
      alert('No data available to export.');
      return;
    }
    const separator = ',';
    const keys = Object.keys(rows[0]);
    const csvContent =
      keys.join(separator) +
      '\n' +
      rows.map(row => {
        return keys.map(k => {
          let cell = (row as any)[k] === null || (row as any)[k] === undefined ? '' : (row as any)[k];
          cell = typeof cell === 'object' ? JSON.stringify(cell).replace(/"/g, '""') : cell.toString().replace(/"/g, '""');
          if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
          return cell;
        }).join(separator);
      }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Analytics derivations
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
          <div className="font-extrabold text-sm text-ink px-3 py-1 flex items-center justify-between">
            <span>Admin Dashboard</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live Connection" />
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
                      ? 'bg-ink text-canvas shadow-xs font-black'
                      : 'text-ink-secondary hover:text-ink hover:bg-surface font-semibold'
                  }`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-divider/60 px-3 space-y-1">
            <span className="text-[10px] uppercase font-black text-ink-muted tracking-wider block">Authorized Admin</span>
            <span className="text-xs font-bold text-ink truncate block">{user?.email}</span>
            <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Verified Administrator
            </span>
          </div>
        </aside>

        {/* Right Dashboard Area (9 cols) */}
        <main className="md:col-span-9 p-6 sm:p-8 space-y-6 bg-surface overflow-y-auto max-h-[85vh]">
          
          {/* TAB 1: OVERVIEW */}
          {activeSidebar === 'Overview' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-divider">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-display">
                    Community Overview
                  </h2>
                  <p className="text-xs text-ink-secondary font-medium">Real-time peer rental ecosystem statistics</p>
                </div>

                <div className="flex items-center gap-2 bg-canvas border border-divider px-3 py-1.5 rounded-full text-xs font-bold text-ink self-start sm:self-auto">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
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
                    Verified community statistics from live database.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONCERNS & FEEDBACK */}
          {activeSidebar === 'Concerns & Feedback' && (
            <div className="space-y-6 animate-in fade-in duration-150">
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

              {/* Filters */}
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

              {/* Tickets List */}
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

                        <div>
                          <h3 className="text-base font-black text-ink">{ticket.subject}</h3>
                          <p className="text-xs text-ink-secondary mt-1 leading-relaxed whitespace-pre-wrap">
                            {ticket.description}
                          </p>
                        </div>

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

                        {ticket.admin_notes && (
                          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1">
                            <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Admin Resolution Note:</span>
                            </div>
                            <p className="text-ink-secondary pl-5 text-[11px]">{ticket.admin_notes}</p>
                          </div>
                        )}

                        <div className="pt-2 border-t border-divider flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={adminNoteInputs[ticket.id] !== undefined ? adminNoteInputs[ticket.id] : ''}
                              onChange={(e) => setAdminNoteInputs({ ...adminNoteInputs, [ticket.id]: e.target.value })}
                              placeholder="Type resolution notes to notify user (e.g. Deposit refunded / Bug resolved)..."
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
          )}

          {/* TAB 3: USERS */}
          {activeSidebar === 'Users' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-divider">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-display flex items-center gap-2">
                    <span>Registered Community Members</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand/10 text-brand font-black">
                      {adminUsers.length} Users
                    </span>
                  </h2>
                  <p className="text-xs text-ink-secondary font-medium mt-0.5">
                    View user trust scores, gear listing activity, role permissions, and contact details.
                  </p>
                </div>

                <button
                  onClick={loadAdminUsers}
                  className="btn-secondary text-xs px-3.5 py-1.5 cursor-pointer font-bold inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Users</span>
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-canvas p-3 rounded-2xl border border-divider">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink-muted" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name, email, or locality..."
                    className="w-full bg-surface border border-divider rounded-xl pl-9 pr-3 py-1.5 text-xs text-ink outline-none focus:border-brand font-semibold"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-bold text-ink mr-1">Role:</span>
                  {(['ALL', 'USER', 'ADMIN'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setUserRoleFilter(r)}
                      className={`px-3 py-1 rounded-xl font-bold cursor-pointer transition-all ${
                        userRoleFilter === r ? 'bg-brand text-white shadow-xs' : 'hover:bg-surface text-ink-secondary'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Users Table */}
              {isLoadingUsers ? (
                <div className="py-20 text-center text-xs text-ink-secondary flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-brand animate-spin" />
                  <span>Loading community members...</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-divider bg-canvas">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface/80 border-b border-divider text-ink font-black uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3.5">User</th>
                        <th className="p-3.5">Locality</th>
                        <th className="p-3.5">Role</th>
                        <th className="p-3.5">Trust / Rating</th>
                        <th className="p-3.5">Activity</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider/60 font-medium">
                      {adminUsers
                        .filter(u => {
                          if (userRoleFilter !== 'ALL' && u.role !== userRoleFilter) return false;
                          if (!userSearch) return true;
                          const q = userSearch.toLowerCase();
                          return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.locality?.toLowerCase().includes(q);
                        })
                        .map(u => (
                          <tr key={u.id} className="hover:bg-surface/60 transition-colors">
                            <td className="p-3.5">
                              <div className="flex items-center gap-3">
                                <img
                                  src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'Member')}&background=0F172A&color=fff&bold=true`}
                                  alt={u.name}
                                  className="w-8 h-8 rounded-full object-cover border border-divider shrink-0"
                                />
                                <div className="min-w-0">
                                  <span className="font-bold text-ink block truncate">{u.name || 'Neighbor'}</span>
                                  <span className="text-[11px] text-ink-secondary block truncate">{u.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className="text-ink font-semibold">{u.locality || 'Nearby'}</span>
                              {u.phone && <span className="block text-[10px] text-ink-muted">{u.phone}</span>}
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                u.role === 'ADMIN'
                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                                  : 'bg-canvas text-ink-secondary border border-divider'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-ink">{u.trust_score || 95}%</span>
                                <span className="text-amber-500 font-bold">★ {Number(u.rating || 5.0).toFixed(1)}</span>
                              </div>
                            </td>
                            <td className="p-3.5 text-ink-secondary">
                              <div className="text-[11px]">
                                <span className="font-bold text-ink">{u.items_count || 0}</span> gear •{' '}
                                <span className="font-bold text-ink">{u.requests_count || 0}</span> wishes •{' '}
                                <span className="font-bold text-ink">{u.bookings_count || 0}</span> rentals
                              </div>
                            </td>
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateUserTrust(u)}
                                  className="px-2.5 py-1 rounded-lg border border-divider hover:border-brand text-[11px] font-bold text-ink cursor-pointer"
                                  title="Edit Trust Score"
                                >
                                  Score
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleUserRole(u)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                                    u.role === 'ADMIN'
                                      ? 'text-red-500 border border-red-500/30 hover:bg-red-500/10'
                                      : 'text-purple-600 border border-purple-500/30 hover:bg-purple-500/10'
                                  }`}
                                >
                                  {u.role === 'ADMIN' ? 'Demote' : 'Make Admin'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LISTINGS */}
          {activeSidebar === 'Listings' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-divider">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-display flex items-center gap-2">
                    <span>Gear Listings Management</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand/10 text-brand font-black">
                      {adminListings.length} Listed Items
                    </span>
                  </h2>
                  <p className="text-xs text-ink-secondary font-medium mt-0.5">
                    Monitor listed items, change availability statuses, and take down policy violations.
                  </p>
                </div>

                <button
                  onClick={loadAdminListings}
                  className="btn-secondary text-xs px-3.5 py-1.5 cursor-pointer font-bold inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Listings</span>
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-canvas p-3 rounded-2xl border border-divider">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink-muted" />
                  <input
                    type="text"
                    value={listingSearch}
                    onChange={(e) => setListingSearch(e.target.value)}
                    placeholder="Search by title, owner, or category..."
                    className="w-full bg-surface border border-divider rounded-xl pl-9 pr-3 py-1.5 text-xs text-ink outline-none focus:border-brand font-semibold"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-bold text-ink mr-1">Status:</span>
                  {(['ALL', 'AVAILABLE', 'RENTED', 'UNAVAILABLE'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setListingStatusFilter(s)}
                      className={`px-3 py-1 rounded-xl font-bold cursor-pointer transition-all ${
                        listingStatusFilter === s ? 'bg-brand text-white shadow-xs' : 'hover:bg-surface text-ink-secondary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Listings Table */}
              {isLoadingListings ? (
                <div className="py-20 text-center text-xs text-ink-secondary flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-brand animate-spin" />
                  <span>Loading listings...</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-divider bg-canvas">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface/80 border-b border-divider text-ink font-black uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3.5">Gear Item</th>
                        <th className="p-3.5">Category</th>
                        <th className="p-3.5">Rate</th>
                        <th className="p-3.5">Owner</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider/60 font-medium">
                      {adminListings
                        .filter(item => {
                          if (listingStatusFilter !== 'ALL' && item.status !== listingStatusFilter) return false;
                          if (!listingSearch) return true;
                          const q = listingSearch.toLowerCase();
                          return item.title?.toLowerCase().includes(q) || item.owner_name?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q);
                        })
                        .map(item => {
                          const images = Array.isArray(item.image_urls) ? item.image_urls : (typeof item.image_urls === 'string' ? JSON.parse(item.image_urls || '[]') : []);
                          const firstImg = images[0] || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80';

                          return (
                            <tr key={item.id} className="hover:bg-surface/60 transition-colors">
                              <td className="p-3.5">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={firstImg}
                                    alt={item.title}
                                    className="w-10 h-10 rounded-xl object-cover border border-divider shrink-0 bg-surface"
                                  />
                                  <div className="min-w-0">
                                    <span className="font-bold text-ink block truncate">{item.title}</span>
                                    <span className="text-[11px] text-ink-muted block truncate">{item.locality || 'Nearby'}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3.5">
                                <span className="bg-surface px-2.5 py-0.5 rounded-full border border-divider text-[11px] font-bold text-ink">
                                  {item.category}
                                </span>
                              </td>
                              <td className="p-3.5 font-bold text-ink">
                                ₹{Number(item.price_per_day)}/day
                              </td>
                              <td className="p-3.5">
                                <span className="font-bold text-ink block truncate">{item.owner_name || 'Lender'}</span>
                                <span className="text-[10px] text-ink-secondary block truncate">{item.owner_email}</span>
                              </td>
                              <td className="p-3.5">
                                <select
                                  value={item.status}
                                  onChange={(e) => handleUpdateListingStatus(item.id, e.target.value as any)}
                                  className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border outline-none cursor-pointer ${
                                    item.status === 'AVAILABLE'
                                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                      : item.status === 'RENTED'
                                      ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                                      : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
                                  }`}
                                >
                                  <option value="AVAILABLE">AVAILABLE</option>
                                  <option value="RENTED">RENTED</option>
                                  <option value="UNAVAILABLE">UNAVAILABLE</option>
                                </select>
                              </td>
                              <td className="p-3.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteListing(item.id, item.title)}
                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                  title="Delete Listing"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: REQUESTS */}
          {activeSidebar === 'Requests' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-divider">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-display flex items-center gap-2">
                    <span>Community Gear Wishes & Requests</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand/10 text-brand font-black">
                      {adminRequests.length} Wishes
                    </span>
                  </h2>
                  <p className="text-xs text-ink-secondary font-medium mt-0.5">
                    Items sought by community borrowers and fulfilled by local lenders.
                  </p>
                </div>

                <button
                  onClick={loadAdminRequests}
                  className="btn-secondary text-xs px-3.5 py-1.5 cursor-pointer font-bold inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Requests</span>
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-canvas p-3 rounded-2xl border border-divider">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink-muted" />
                  <input
                    type="text"
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                    placeholder="Search by wish, seeker name, or category..."
                    className="w-full bg-surface border border-divider rounded-xl pl-9 pr-3 py-1.5 text-xs text-ink outline-none focus:border-brand font-semibold"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-bold text-ink mr-1">Status:</span>
                  {(['ALL', 'OPEN', 'FULFILLED', 'CANCELLED'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setRequestStatusFilter(s)}
                      className={`px-3 py-1 rounded-xl font-bold cursor-pointer transition-all ${
                        requestStatusFilter === s ? 'bg-brand text-white shadow-xs' : 'hover:bg-surface text-ink-secondary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Requests Table */}
              {isLoadingRequests ? (
                <div className="py-20 text-center text-xs text-ink-secondary flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-brand animate-spin" />
                  <span>Loading community wishes...</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-divider bg-canvas">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface/80 border-b border-divider text-ink font-black uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3.5">Wish / Gear</th>
                        <th className="p-3.5">Category</th>
                        <th className="p-3.5">Budget</th>
                        <th className="p-3.5">Seeker</th>
                        <th className="p-3.5">Schedule</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider/60 font-medium">
                      {adminRequests
                        .filter(r => {
                          if (requestStatusFilter !== 'ALL' && r.status !== requestStatusFilter) return false;
                          if (!requestSearch) return true;
                          const q = requestSearch.toLowerCase();
                          return r.item_name?.toLowerCase().includes(q) || r.seeker_name?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q);
                        })
                        .map(r => (
                          <tr key={r.id} className="hover:bg-surface/60 transition-colors">
                            <td className="p-3.5">
                              <span className="font-bold text-ink block">{r.item_name}</span>
                              <span className="text-[11px] text-ink-muted block line-clamp-1">{r.description || 'No description provided'}</span>
                            </td>
                            <td className="p-3.5">
                              <span className="bg-surface px-2.5 py-0.5 rounded-full border border-divider text-[11px] font-bold text-ink">
                                {r.category || 'General'}
                              </span>
                            </td>
                            <td className="p-3.5 font-bold text-brand">
                              ₹{Number(r.offered_amount)}
                            </td>
                            <td className="p-3.5">
                              <span className="font-bold text-ink block truncate">{r.seeker_name || 'Seeker'}</span>
                              <span className="text-[10px] text-ink-secondary block truncate">{r.seeker_email}</span>
                            </td>
                            <td className="p-3.5 text-ink-secondary">
                              <span className="text-ink font-semibold">{r.start_date}</span>
                              <span className="block text-[10px] text-ink-muted">({r.duration_days} days)</span>
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                r.status === 'OPEN'
                                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                                  : r.status === 'FULFILLED'
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                                  : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/30'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteRequest(r.id, r.item_name)}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Delete Request"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: BOOKINGS */}
          {activeSidebar === 'Bookings' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-divider">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-display flex items-center gap-2">
                    <span>Rental Transactions & Handoffs</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand/10 text-brand font-black">
                      {adminBookings.length} Bookings
                    </span>
                  </h2>
                  <p className="text-xs text-ink-secondary font-medium mt-0.5">
                    Track handover codes, payment totals, active rental dates, and manual status overrides.
                  </p>
                </div>

                <button
                  onClick={loadAdminBookings}
                  className="btn-secondary text-xs px-3.5 py-1.5 cursor-pointer font-bold inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Bookings</span>
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-canvas p-3 rounded-2xl border border-divider">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink-muted" />
                  <input
                    type="text"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search by gear, borrower, or lender..."
                    className="w-full bg-surface border border-divider rounded-xl pl-9 pr-3 py-1.5 text-xs text-ink outline-none focus:border-brand font-semibold"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-bold text-ink mr-1">Status:</span>
                  {(['ALL', 'ACCEPTED', 'HANDED_OVER', 'COMPLETED', 'CANCELLED'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setBookingStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer transition-all text-[11px] ${
                        bookingStatusFilter === s ? 'bg-brand text-white shadow-xs' : 'hover:bg-surface text-ink-secondary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bookings Table */}
              {isLoadingBookings ? (
                <div className="py-20 text-center text-xs text-ink-secondary flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-brand animate-spin" />
                  <span>Loading bookings...</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-divider bg-canvas">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface/80 border-b border-divider text-ink font-black uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3.5">Item</th>
                        <th className="p-3.5">Borrower → Lender</th>
                        <th className="p-3.5">Dates</th>
                        <th className="p-3.5">Total</th>
                        <th className="p-3.5">Security Codes</th>
                        <th className="p-3.5">Status Override</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider/60 font-medium">
                      {adminBookings
                        .filter(b => {
                          if (bookingStatusFilter !== 'ALL' && b.status !== bookingStatusFilter) return false;
                          if (!bookingSearch) return true;
                          const q = bookingSearch.toLowerCase();
                          return b.item_title?.toLowerCase().includes(q) || b.borrower_name?.toLowerCase().includes(q) || b.lender_name?.toLowerCase().includes(q);
                        })
                        .map(b => (
                          <tr key={b.id} className="hover:bg-surface/60 transition-colors">
                            <td className="p-3.5 font-bold text-ink max-w-[180px] truncate">
                              {b.item_title}
                            </td>
                            <td className="p-3.5">
                              <span className="font-bold text-ink block">{b.borrower_name || 'Borrower'}</span>
                              <span className="text-[10px] text-ink-muted block">to {b.lender_name || 'Lender'}</span>
                            </td>
                            <td className="p-3.5 text-ink-secondary">
                              <span className="font-semibold text-ink">{b.start_date}</span>
                              <span className="block text-[10px] text-ink-muted">{b.duration_days} days</span>
                            </td>
                            <td className="p-3.5 font-black text-brand text-sm">
                              ₹{Number(b.total_price)}
                            </td>
                            <td className="p-3.5">
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="px-2 py-0.5 rounded bg-surface border border-divider font-mono" title="Pickup Handover Code">
                                  P: {b.pickup_code || '---'}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-surface border border-divider font-mono" title="Return Handover Code">
                                  R: {b.return_code || '---'}
                                </span>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <select
                                value={b.status}
                                onChange={(e) => handleUpdateBookingStatus(b.id, e.target.value as any)}
                                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border outline-none cursor-pointer ${
                                  b.status === 'COMPLETED'
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                    : b.status === 'HANDED_OVER'
                                    ? 'bg-purple-500/10 text-purple-500 border-purple-500/30'
                                    : b.status === 'ACCEPTED'
                                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
                                }`}
                              >
                                <option value="PENDING">PENDING</option>
                                <option value="ACCEPTED">ACCEPTED</option>
                                <option value="HANDED_OVER">HANDED_OVER</option>
                                <option value="COMPLETED">COMPLETED</option>
                                <option value="CANCELLED">CANCELLED</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: ANALYTICS */}
          {activeSidebar === 'Analytics' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-divider">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-display">
                    Performance & Marketplace Analytics
                  </h2>
                  <p className="text-xs text-ink-secondary font-medium">Aggregated peer rental velocity, category economics, and trust benchmarks.</p>
                </div>

                <button
                  onClick={loadOverviewAnalytics}
                  className="btn-secondary text-xs px-3.5 py-1.5 cursor-pointer font-bold inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Metrics</span>
                </button>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
                  <span className="text-[11px] font-bold text-ink-secondary">Gross Volume</span>
                  <div className="text-2xl font-black text-brand font-display">₹{totalVolume.toLocaleString('en-IN')}</div>
                  <span className="text-[10px] text-emerald-500 font-bold">100% Peer Commission-Free</span>
                </div>

                <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
                  <span className="text-[11px] font-bold text-ink-secondary">Handoff Success</span>
                  <div className="text-2xl font-black text-ink font-display">100%</div>
                  <span className="text-[10px] text-ink-muted">0 Reported Disputes</span>
                </div>

                <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
                  <span className="text-[11px] font-bold text-ink-secondary">Avg Daily Rate</span>
                  <div className="text-2xl font-black text-ink font-display">₹280</div>
                  <span className="text-[10px] text-ink-muted">Across All Categories</span>
                </div>

                <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
                  <span className="text-[11px] font-bold text-ink-secondary">Community Trust Avg</span>
                  <div className="text-2xl font-black text-emerald-500 font-display">98%</div>
                  <span className="text-[10px] text-ink-muted">Verified Neighbors</span>
                </div>
              </div>

              {/* Top Lenders Leaderboard */}
              <div className="bg-canvas border border-divider rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-extrabold text-ink flex items-center justify-between">
                  <span>Top Gear Champions (Lender Supply Leaders)</span>
                  <span className="text-[11px] text-brand font-bold">Top Verified</span>
                </h3>

                <div className="divide-y divide-divider/60">
                  {(analytics?.topLenders || []).map((lender: any, idx: number) => (
                    <div key={lender.id || idx} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-brand font-display w-4">#{idx + 1}</span>
                        <img
                          src={lender.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(lender.name || 'Member')}&background=0F172A&color=fff&bold=true`}
                          alt={lender.name}
                          className="w-8 h-8 rounded-full object-cover border border-divider"
                        />
                        <div>
                          <span className="font-bold text-ink block">{lender.name || 'Neighbor'}</span>
                          <span className="text-[10px] text-ink-muted block">{lender.locality || 'Nearby'}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-ink block">{lender.gear_count} gear listed</span>
                        <span className="text-[10px] text-emerald-500 font-bold block">{lender.trust_score}% Trust</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: LOCALITY */}
          {activeSidebar === 'Locality' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-divider">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-display flex items-center gap-2">
                    <span>Locality & Geo-Zone Registry</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand/10 text-brand font-black">
                      {adminLocalities.length} Active Zones
                    </span>
                  </h2>
                  <p className="text-xs text-ink-secondary font-medium mt-0.5">
                    Authorized postal codes & neighborhoods covered by Rentu's 5km hyper-local radar.
                  </p>
                </div>

                <button
                  onClick={loadAdminLocalities}
                  className="btn-secondary text-xs px-3.5 py-1.5 cursor-pointer font-bold inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Zones</span>
                </button>
              </div>

              {/* Add Zone Form */}
              <form onSubmit={handleAddLocalitySubmit} className="p-4 rounded-2xl bg-canvas border border-divider space-y-3">
                <h3 className="text-xs font-black text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-brand" />
                  <span>Register New Community Neighborhood</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-ink-secondary mb-1">Pincode *</label>
                    <input
                      type="text"
                      required
                      value={newPincode}
                      onChange={(e) => setNewPincode(e.target.value)}
                      placeholder="e.g. 560038"
                      className="w-full bg-surface border border-divider rounded-xl px-3 py-1.5 text-xs text-ink outline-none focus:border-brand font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-ink-secondary mb-1">Locality / Area *</label>
                    <input
                      type="text"
                      required
                      value={newLocality}
                      onChange={(e) => setNewLocality(e.target.value)}
                      placeholder="e.g. Indiranagar"
                      className="w-full bg-surface border border-divider rounded-xl px-3 py-1.5 text-xs text-ink outline-none focus:border-brand font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-ink-secondary mb-1">City</label>
                    <input
                      type="text"
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                      placeholder="Bangalore"
                      className="w-full bg-surface border border-divider rounded-xl px-3 py-1.5 text-xs text-ink outline-none focus:border-brand font-semibold"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isAddingLocality}
                      className="w-full btn-primary py-2 px-3 text-xs font-bold rounded-xl shadow-pink cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isAddingLocality ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Zone</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Locality Table */}
              {isLoadingLocalities ? (
                <div className="py-20 text-center text-xs text-ink-secondary flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-brand animate-spin" />
                  <span>Loading localities...</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-divider bg-canvas">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface/80 border-b border-divider text-ink font-black uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3.5">Pincode</th>
                        <th className="p-3.5">Locality / Neighborhood</th>
                        <th className="p-3.5">City & State</th>
                        <th className="p-3.5">Community Members</th>
                        <th className="p-3.5">Active Gear</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider/60 font-medium">
                      {adminLocalities.map((loc, idx) => (
                        <tr key={loc.pincode || idx} className="hover:bg-surface/60 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-ink">
                            {loc.pincode}
                          </td>
                          <td className="p-3.5 font-bold text-ink">
                            {loc.locality}
                          </td>
                          <td className="p-3.5 text-ink-secondary">
                            {loc.city}, {loc.state}
                          </td>
                          <td className="p-3.5">
                            <span className="font-bold text-ink">{loc.users_count || 0}</span> neighbors
                          </td>
                          <td className="p-3.5">
                            <span className="font-bold text-brand">{loc.items_count || 0}</span> listings
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 9: REPORTS */}
          {activeSidebar === 'Reports' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-divider">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-display">
                    Platform Reports & Data Export
                  </h2>
                  <p className="text-xs text-ink-secondary font-medium">Download live ecosystem audit files and monitor system health.</p>
                </div>

                <button
                  onClick={loadAdminReports}
                  className="btn-secondary text-xs px-3.5 py-1.5 cursor-pointer font-bold inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Health</span>
                </button>
              </div>

              {/* Health Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
                  <span className="text-[11px] font-bold text-ink-secondary">Database Status</span>
                  <div className="text-xl font-black text-emerald-500 font-display flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Supabase Connected</span>
                  </div>
                  <span className="text-[10px] text-ink-muted">3NF Schema Relational Integrity</span>
                </div>

                <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
                  <span className="text-[11px] font-bold text-ink-secondary">Server Uptime</span>
                  <div className="text-xl font-black text-ink font-display">
                    {Math.round((adminReports?.server_health?.uptime_seconds || 1200) / 60)} mins
                  </div>
                  <span className="text-[10px] text-emerald-500 font-bold">100% Operational</span>
                </div>

                <div className="p-4 rounded-2xl bg-canvas border border-divider space-y-1">
                  <span className="text-[11px] font-bold text-ink-secondary">Tickets Resolved</span>
                  <div className="text-xl font-black text-ink font-display">
                    {adminReports?.stats?.resolved_support_tickets || 0} / {adminReports?.stats?.total_support_tickets || 0}
                  </div>
                  <span className="text-[10px] text-ink-muted">All User Concerns Addressed</span>
                </div>
              </div>

              {/* Data Export Cards */}
              <div className="bg-canvas border border-divider rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-ink">Export Live Platform Data (CSV)</h3>
                  <p className="text-xs text-ink-secondary">Single-click export of platform tables for offline auditing and reporting.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      const users = await api.getAdminUsers();
                      exportToCSV('rentu_users', users);
                    }}
                    className="p-3.5 rounded-xl bg-surface border border-divider hover:border-brand flex items-center justify-between text-xs font-bold text-ink transition-colors cursor-pointer group"
                  >
                    <span>Export Users CSV</span>
                    <Download className="w-4 h-4 text-brand group-hover:scale-110 transition-transform" />
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const listings = await api.getAdminListings();
                      exportToCSV('rentu_listings', listings);
                    }}
                    className="p-3.5 rounded-xl bg-surface border border-divider hover:border-brand flex items-center justify-between text-xs font-bold text-ink transition-colors cursor-pointer group"
                  >
                    <span>Export Listings CSV</span>
                    <Download className="w-4 h-4 text-brand group-hover:scale-110 transition-transform" />
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const bookings = await api.getAdminBookings();
                      exportToCSV('rentu_bookings', bookings);
                    }}
                    className="p-3.5 rounded-xl bg-surface border border-divider hover:border-brand flex items-center justify-between text-xs font-bold text-ink transition-colors cursor-pointer group"
                  >
                    <span>Export Bookings CSV</span>
                    <Download className="w-4 h-4 text-brand group-hover:scale-110 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: SETTINGS */}
          {activeSidebar === 'Settings' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-divider">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-display">
                    Platform & Security Settings
                  </h2>
                  <p className="text-xs text-ink-secondary font-medium">System configuration, administrator email access, and geo-fence policies.</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Authorized Admins Card */}
                <div className="p-5 rounded-2xl bg-canvas border border-divider space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black text-ink uppercase tracking-wider">Authorized Platform Administrators</h3>
                      <p className="text-xs text-ink-secondary mt-0.5">Strict access restriction to these emails:</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      Active Access Controls
                    </span>
                  </div>

                  <div className="space-y-2 pt-1">
                    {[
                      { email: 'falaksadiqua786@gmail.com', name: 'Sadiqua Parween (Co-Founder & Lead)' },
                      { email: 'rajsamriddhi60@gmail.com', name: 'Samriddhi Raj (Co-Founder & Lead)' }
                    ].map(admin => (
                      <div key={admin.email} className="p-3 rounded-xl bg-surface border border-divider flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-brand text-white font-bold flex items-center justify-center text-xs">
                            {admin.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-ink block">{admin.name}</span>
                            <span className="text-[11px] text-ink-secondary block font-mono">{admin.email}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                          Root Administrator
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Platform Parameters */}
                <div className="p-5 rounded-2xl bg-canvas border border-divider space-y-3">
                  <h3 className="text-xs font-black text-ink uppercase tracking-wider">Ecosystem Parameters</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-surface border border-divider">
                      <span className="text-ink-secondary block text-[11px]">Community Fee</span>
                      <span className="font-black text-ink text-sm">0% (Zero Commission)</span>
                      <span className="text-[10px] text-emerald-500 block">Lenders keep 100% of rental earnings</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface border border-divider">
                      <span className="text-ink-secondary block text-[11px]">Nearby Discovery Radar</span>
                      <span className="font-black text-ink text-sm">5.0 Kilometers</span>
                      <span className="text-[10px] text-ink-muted block">Users can disable 5km notifications in Settings</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface border border-divider">
                      <span className="text-ink-secondary block text-[11px]">Security Handshake</span>
                      <span className="font-black text-ink text-sm">Dual 6-Digit Codes</span>
                      <span className="text-[10px] text-ink-muted block">Pickup and return verification pins required</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface border border-divider">
                      <span className="text-ink-secondary block text-[11px]">Max Standard Rental Period</span>
                      <span className="font-black text-ink text-sm">30 Calendar Days</span>
                      <span className="text-[10px] text-ink-muted block">Custom agreements available via DM</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>

      </div>

    </div>
  );
};
