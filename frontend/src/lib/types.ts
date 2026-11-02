export interface User {
  id: string;
  firebase_uid?: string;
  email: string;
  name: string;
  phone?: string;
  locality: string;
  address_text?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  trust_score?: number;
  role: 'USER' | 'ADMIN';
  notify_nearby_requests_5km?: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  price_per_day: number | string;
  max_duration_days: number;
  image_urls: string[];
  sticker_badge: string;
  locality: string;
  address_text?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  distance_meters?: number | null;
  status: 'AVAILABLE' | 'RENTED' | 'UNAVAILABLE';
  available_for_borrowing?: boolean;
  offers_delivery?: boolean;
  delivery_fee?: number;
  offers_pickup?: boolean;
  pickup_fee?: number;
  booked_dates?: Array<{
    id?: string;
    start_date: string;
    end_date: string;
    start_time?: string;
    end_time?: string;
    duration_days?: number;
    status?: string;
  }>;
  condition?: string;
  created_at: string;
  owner_name?: string;
  owner_avatar?: string;
  owner_locality?: string;
  owner_trust_score?: number;
  owner_bio?: string;
  owner_phone?: string;
  owner_email?: string;
  owner_rating?: number;
  related_items?: Item[];
}

export interface CommunityRequest {
  id: string;
  seeker_id: string;
  item_name: string;
  description: string;
  category: string;
  start_date: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  duration_days: number;
  offered_amount: number | string;
  locality: string;
  pickup_type?: 'LENDER_LOCATION' | 'MY_LOCATION' | 'CUSTOM_LOCATION';
  pickup_locality?: string;
  return_type?: 'LENDER_LOCATION' | 'MY_LOCATION' | 'CUSTOM_LOCATION';
  return_locality?: string;
  image_url?: string | null;
  status: 'OPEN' | 'FULFILLED' | 'CANCELLED';
  created_at: string;
  seeker_name?: string;
  seeker_avatar?: string;
  seeker_locality?: string;
  seeker_trust_score?: number;
  seeker_phone?: string;
  seeker_email?: string;
}

export interface Booking {
  id: string;
  item_id: string;
  borrower_id: string;
  lender_id: string;
  start_date: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  duration_days: number;
  total_price: number | string;
  pickup_type?: 'LENDER_LOCATION' | 'MY_LOCATION' | 'CUSTOM_LOCATION';
  pickup_locality?: string;
  return_type?: 'LENDER_LOCATION' | 'MY_LOCATION' | 'CUSTOM_LOCATION';
  return_locality?: string;
  requires_delivery?: boolean;
  delivery_fee?: number;
  requires_pickup?: boolean;
  pickup_fee?: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'HANDED_OVER' | 'COMPLETED' | 'CANCELLED';
  pickup_code?: string;
  return_code?: string;
  handed_over_at?: string;
  completed_at?: string;
  user_review_id?: string;
  user_rating?: number;
  user_comment?: string;
  user_reviewed_at?: string;
  message?: string;
  created_at: string;
  item_title?: string;
  item_images?: string[];
  item_category?: string;
  item_locality?: string;
  item_rate?: number | string;
  borrower_name?: string;
  borrower_avatar?: string;
  borrower_phone?: string;
  borrower_email?: string;
  lender_name?: string;
  lender_avatar?: string;
  lender_phone?: string;
  lender_email?: string;
}

export interface MessageProposalData {
  type: 'LISTING' | 'REQUEST';
  title: string;
  description?: string;
  category?: string;
  price_per_day?: number;
  total_price: number;
  duration_days: number;
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  delivery_option?: 'SELF' | 'LENDER_DELIVERY';
  delivery_fee?: number;
  collection_option?: 'SELF' | 'LENDER_COLLECT';
  collection_fee?: number;
  delivery_location?: string;
  return_location?: string;
  notes?: string;
  image_url?: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  booking_id?: string;
  item_id?: string;
  accepted_at?: string;
}

export interface Message {
  id: string;
  booking_id?: string | null;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type?: 'TEXT' | 'PROPOSAL' | 'SYSTEM';
  proposal_data?: MessageProposalData | any;
  is_edited?: boolean;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

export interface Conversation {
  conversation_id?: string;
  booking_id: string | null;
  booking_status: string;
  start_date?: string;
  duration_days?: number;
  total_price: number | string;
  item_title: string;
  item_images: string[];
  item_locality?: string;
  partner_id: string;
  partner_name: string;
  partner_avatar?: string;
  partner_phone?: string;
  last_message?: string;
  last_message_at?: string;
}

export interface CommunityPulse {
  total_users: number;
  active_lenders: number;
  active_borrowers: number;
  available_gear: number;
  currently_rented_gear: number;
  total_bookings: number;
  completed_bookings: number;
  total_community_volume: number;
  open_wishes: number;
  fulfilled_wishes: number;
}

export interface CategoryStat {
  category: string;
  count: number;
  avg_rate: number;
}

export interface CommunityLeaderboardMember {
  id: string;
  name: string;
  email?: string;
  locality?: string;
  avatar_url?: string;
  bio?: string;
  rating: number;
  trust_score: number;
  reviews_count: number;
  highlight_review?: string;
  rank: number;
  category_type: 'top_rated' | 'top_lenders' | 'top_borrowers' | 'top_sharers';
  metric_label: string;
  metric_value: string;
  badges: string[];
  items_count?: number;
  free_items_count?: number;
  lent_count?: number;
  borrowed_count?: number;
  requests_count?: number;
}

export interface CommunityLeaderboardData {
  top_rated: CommunityLeaderboardMember[];
  top_lenders: CommunityLeaderboardMember[];
  top_borrowers: CommunityLeaderboardMember[];
  top_sharers: CommunityLeaderboardMember[];
  total_community_members: number;
}

export interface UserReview {
  id: string;
  reviewer_name: string;
  reviewer_avatar?: string;
  reviewer_locality?: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface PublicUserProfile {
  id: string;
  name: string;
  email?: string;
  locality?: string;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  trust_score: number;
  rating: number;
  created_at?: string;
  is_following?: boolean;
  is_blocked?: boolean;
  is_blocked_by?: boolean;
  followers_count?: number;
  following_count?: number;
  items: Item[];
  requests: CommunityRequest[];
  reviews: UserReview[];
  stats: {
    listings_count: number;
    requests_count: number;
    completed_lent: number;
    completed_borrowed: number;
    reviews_count: number;
  };
}

export interface AppNotification {
  id: string;
  user_id: string;
  sender_id?: string;
  booking_id?: string;
  message_id?: string;
  type: string;
  title: string;
  body: string;
  reference_id?: string;
  reference_type?: string;
  read_at?: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

export interface SupportTicket {
  id: string;
  user_id?: string | null;
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
  user_phone?: string;
  user_locality?: string;
  type: 'CONCERN' | 'FEEDBACK';
  category: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  admin_notes?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export const AUTHORIZED_ADMIN_EMAILS = [
  'falaksadiqua786@gmail.com',
  'rajsamriddhi60@gmail.com',
];

export const isAuthorizedAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  return AUTHORIZED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

export interface UserSearchResult {
  id: string;
  name: string;
  email?: string;
  locality?: string;
  avatar_url?: string;
  bio?: string;
  rating: number;
  trust_score: number;
  items_count: number;
  requests_count: number;
  reviews_count: number;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  items?: Item[];
  suggestions?: string[];
  mode?: 'ai' | 'fallback';
  provider?: string;
  timestamp: string;
}

export interface AiChatContext {
  itemId?: string | null;
  locality?: string | null;
  startDate?: string | null;
  durationDays?: number | null;
}

export interface AiChatResponse {
  reply: string;
  mode: 'ai' | 'fallback';
  provider?: string;
  items: Item[];
  suggestions: string[];
}
