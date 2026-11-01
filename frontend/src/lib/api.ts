import { 
  User, 
  Item, 
  CommunityRequest, 
  Booking, 
  Message, 
  Conversation, 
  CommunityPulse, 
  CategoryStat,
  CommunityLeaderboardData,
  PublicUserProfile,
  UserSearchResult,
  AiChatResponse,
  AiChatContext
} from './types';

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api` 
  : '/api';

export class ApiError extends Error {
  code: string;
  details?: any;
  constructor(message: string, code: string = 'UNKNOWN', details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

const getHeaders = () => {
  const token = localStorage.getItem('borrowflex_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text().catch(() => '');
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = {};
  }

  if (!res.ok || json.success === false) {
    const errorInfo = json.error || {};
    let msg = errorInfo.message;
    if (errorInfo.details && Array.isArray(errorInfo.details) && errorInfo.details.length > 0) {
      const detailStr = errorInfo.details.map((d: any) => `${d.field ? `${d.field}: ` : ''}${d.message}`).join(', ');
      msg = errorInfo.message ? `${errorInfo.message} (${detailStr})` : detailStr;
    }

    if (!msg && text) {
      if (text.includes('<title>')) {
        const match = text.match(/<title>(.*?)<\/title>/i);
        if (match && match[1]) msg = match[1].trim();
      } else if (text.length < 200 && !text.startsWith('<!DOCTYPE')) {
        msg = text.trim();
      }
    }

    const fallbackMsg = res.status === 401 
      ? 'Please sign in to complete this action.' 
      : `Backend service error (HTTP ${res.status})${msg ? `: ${msg}` : ''}`;
    throw new ApiError(
      msg || fallbackMsg,
      errorInfo.code || `HTTP_${res.status}`,
      errorInfo.details
    );
  }
  return json.data as T;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  async register(data: {
    email: string;
    password: string;
    name: string;
    locality: string;
    phone?: string;
    avatar_url?: string;
    bio?: string;
  }): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async demoLogin(role: 'lender' | 'borrower' | 'admin' | 'creator'): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    return handleResponse(res);
  },

  async firebaseSync(data: {
    firebaseUid: string;
    email: string;
    name: string;
    avatarUrl?: string;
    locality?: string;
    phone?: string;
  }): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/firebase-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },


  async getMe(): Promise<User & { stats: any }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Items
  async getItems(params?: {
    category?: string;
    search?: string;
    locality?: string;
    status?: string;
    ownerId?: string;
  }): Promise<Item[]> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== 'All') query.append('category', params.category);
    if (params?.search) query.append('search', params.search);
    if (params?.locality) query.append('locality', params.locality);
    if (params?.status) query.append('status', params.status);
    if (params?.ownerId) query.append('ownerId', params.ownerId);

    const res = await fetch(`${API_BASE}/items?${query.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getItem(id: string): Promise<Item> {
    const res = await fetch(`${API_BASE}/items/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createItem(data: {
    title: string;
    description: string;
    category: string;
    price_per_day: number;
    max_duration_days: number;
    image_urls: string[];
    sticker_badge: string;
    locality: string;
    available_for_borrowing?: boolean;
    offers_delivery?: boolean;
    delivery_fee?: number;
    offers_pickup?: boolean;
    pickup_fee?: number;
  }): Promise<Item> {
    const res = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateItem(id: string, data: Partial<Item>): Promise<Item> {
    const res = await fetch(`${API_BASE}/items/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async toggleItemBorrowing(id: string, available_for_borrowing: boolean): Promise<Item> {
    const res = await fetch(`${API_BASE}/items/${id}/borrowing`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ available_for_borrowing }),
    });
    return handleResponse(res);
  },

  async getItemAvailability(id: string): Promise<Array<{
    id?: string;
    start_date: string;
    end_date: string;
    start_time?: string;
    end_time?: string;
    duration_days?: number;
    status?: string;
  }>> {
    const res = await fetch(`${API_BASE}/items/${id}/availability`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async deleteItem(id: string): Promise<{ id: string }> {
    const res = await fetch(`${API_BASE}/items/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Requests / Bounties
  async getRequests(params?: {
    category?: string;
    locality?: string;
    status?: string;
    seekerId?: string;
  }): Promise<CommunityRequest[]> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== 'All') query.append('category', params.category);
    if (params?.locality) query.append('locality', params.locality);
    if (params?.status) query.append('status', params.status);
    if (params?.seekerId) query.append('seekerId', params.seekerId);

    const res = await fetch(`${API_BASE}/requests?${query.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createRequest(data: {
    item_name: string;
    description: string;
    category: string;
    start_date: string;
    start_time?: string;
    end_date?: string;
    end_time?: string;
    duration_days: number;
    offered_amount: number;
    locality: string;
    pickup_type?: 'LENDER_LOCATION' | 'MY_LOCATION' | 'CUSTOM_LOCATION';
    pickup_locality?: string;
    return_type?: 'LENDER_LOCATION' | 'MY_LOCATION' | 'CUSTOM_LOCATION';
    return_locality?: string;
    image_url?: string;
  }): Promise<CommunityRequest> {
    const res = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateRequest(id: string, data: Partial<CommunityRequest>): Promise<CommunityRequest> {
    const res = await fetch(`${API_BASE}/requests/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateRequestStatus(id: string, status: 'OPEN' | 'FULFILLED' | 'CANCELLED'): Promise<CommunityRequest> {
    return this.updateRequest(id, { status });
  },

  async deleteRequest(id: string): Promise<{ id: string }> {
    const res = await fetch(`${API_BASE}/requests/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Bookings
  async getBookings(role?: 'borrower' | 'lender'): Promise<Booking[]> {
    const query = role ? `?role=${role}` : '';
    const res = await fetch(`${API_BASE}/bookings${query}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createBooking(data: {
    item_id: string;
    start_date: string;
    start_time?: string;
    end_date?: string;
    end_time?: string;
    duration_days: number;
    total_price?: number;
    pickup_type?: 'LENDER_LOCATION' | 'MY_LOCATION' | 'CUSTOM_LOCATION';
    pickup_locality?: string;
    return_type?: 'LENDER_LOCATION' | 'MY_LOCATION' | 'CUSTOM_LOCATION';
    return_locality?: string;
    requires_delivery?: boolean;
    delivery_fee?: number;
    requires_pickup?: boolean;
    pickup_fee?: number;
    message?: string;
  }): Promise<Booking> {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateBookingStatus(id: string, status: 'ACCEPTED' | 'REJECTED' | 'HANDED_OVER' | 'COMPLETED' | 'CANCELLED'): Promise<Booking> {
    const res = await fetch(`${API_BASE}/bookings/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse(res);
  },

  async verifyPickup(id: string, code: string): Promise<Booking> {
    const res = await fetch(`${API_BASE}/bookings/${id}/verify-pickup`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code }),
    });
    return handleResponse(res);
  },

  async verifyReturn(id: string, code: string): Promise<Booking> {
    const res = await fetch(`${API_BASE}/bookings/${id}/verify-return`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code }),
    });
    return handleResponse(res);
  },

  async submitReview(bookingId: string, rating: number, comment?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}/review`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ rating, comment: comment || '' }),
    });
    return handleResponse(res);
  },

  // Analytics ("Hustle Hub")
  async getAnalytics(): Promise<{
    pulse: CommunityPulse;
    categories: CategoryStat[];
    topLenders: any[];
  }> {
    const res = await fetch(`${API_BASE}/analytics/overview`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Messages & Coordination
  async getConversations(): Promise<Conversation[]> {
    const res = await fetch(`${API_BASE}/messages/conversations`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getMessages(conversationId: string): Promise<{ booking?: Booking | null; partner?: any; messages: Message[] }> {
    const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(conversationId)}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async sendMessage(booking_id: string | null | undefined, receiver_id: string, content: string): Promise<Message> {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ booking_id: booking_id || undefined, receiver_id, content }),
    });
    return handleResponse(res);
  },

  // Users
  async getUser(id: string): Promise<User & { items: Item[]; stats: any }> {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const res = await fetch(`${API_BASE}/users/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getCommunityLeaderboard(): Promise<CommunityLeaderboardData> {
    const res = await fetch(`${API_BASE}/users/leaderboard`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getUserProfile(userId: string): Promise<PublicUserProfile> {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async searchUsers(query: string): Promise<UserSearchResult[]> {
    const res = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async followUser(userId: string): Promise<{ is_following: boolean; followers_count: number }> {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/follow`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async unfollowUser(userId: string): Promise<{ is_following: boolean; followers_count: number }> {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/unfollow`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async blockUser(userId: string): Promise<{ is_blocked: boolean }> {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/block`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async unblockUser(userId: string): Promise<{ is_blocked: boolean }> {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/unblock`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getNotifications(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async markNotificationRead(id: string): Promise<void> {
    await fetch(`${API_BASE}/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PUT',
      headers: getHeaders(),
    });
  },

  async markAllNotificationsRead(): Promise<void> {
    await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: getHeaders(),
    });
  },

  // Support & Concerns (Community Care)
  async submitSupportTicket(data: {
    type: 'CONCERN' | 'FEEDBACK';
    category: string;
    subject: string;
    description: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    user_email?: string;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/support`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getMySupportTickets(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/support/my`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getAdminSupportTickets(filters?: { status?: string; type?: string; category?: string }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters?.type && filters.type !== 'ALL') params.append('type', filters.type);
    if (filters?.category && filters.category !== 'ALL') params.append('category', filters.category);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/support/admin${qs}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async updateAdminSupportTicket(id: string, data: {
    status?: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    admin_notes?: string;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/support/admin/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Rentu AI Assistant
  async sendAiChatMessage(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context?: AiChatContext
  ): Promise<AiChatResponse> {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ messages, context }),
    });
    return handleResponse(res);
  },
};
