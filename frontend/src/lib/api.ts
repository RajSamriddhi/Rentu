import { 
  User, 
  Item, 
  CommunityRequest, 
  Booking, 
  Message, 
  Conversation, 
  CommunityPulse, 
  CategoryStat 
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
    duration_days: number;
    offered_amount: number;
    locality: string;
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
    duration_days: number;
    message?: string;
  }): Promise<Booking> {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateBookingStatus(id: string, status: 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'): Promise<Booking> {
    const res = await fetch(`${API_BASE}/bookings/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
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

  async getMessages(bookingId: string): Promise<{ booking: Booking; messages: Message[] }> {
    const res = await fetch(`${API_BASE}/messages/${bookingId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async sendMessage(booking_id: string, receiver_id: string, content: string): Promise<Message> {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ booking_id, receiver_id, content }),
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
};
