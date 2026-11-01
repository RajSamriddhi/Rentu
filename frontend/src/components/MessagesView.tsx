import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, Search, ArrowLeft, Check, AlertCircle, 
  Clock, MapPin, Sparkles, User as UserIcon, ShieldCheck, ChevronRight 
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { Conversation, Message } from '../lib/types';

interface MessagesViewProps {
  initialBookingId?: string | null;
  onOpenAuth: () => void;
  onNavigateHome?: () => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  initialBookingId,
  onOpenAuth,
  onNavigateHome,
}) => {
  const { user, isAuthenticated } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(initialBookingId || null);
  const [showMobileThread, setShowMobileThread] = useState<boolean>(!!initialBookingId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeBookingData, setActiveBookingData] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom cleanly within the thread container
  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (initialBookingId) {
      setSelectedBookingId(initialBookingId);
      setShowMobileThread(true);
    }
  }, [initialBookingId]);

  useEffect(() => {
    if (selectedBookingId) {
      loadMessages(selectedBookingId);
    } else {
      setMessages([]);
      setActiveBookingData(null);
    }
  }, [selectedBookingId]);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length]);

  // Live polling every 3.5 seconds
  useEffect(() => {
    if (!isAuthenticated || !selectedBookingId) return;

    const interval = setInterval(() => {
      api.getMessages(selectedBookingId)
        .then((data) => {
          if (data?.messages && Array.isArray(data.messages)) {
            setMessages((prev) => {
              if (
                prev.length !== data.messages.length || 
                prev[prev.length - 1]?.id !== data.messages[data.messages.length - 1]?.id
              ) {
                return data.messages;
              }
              return prev;
            });
          }
        })
        .catch(() => {});
    }, 3500);

    return () => clearInterval(interval);
  }, [isAuthenticated, selectedBookingId]);

  const loadConversations = async () => {
    setIsLoadingConversations(true);
    try {
      const data = await api.getConversations();
      const list = Array.isArray(data) ? data : [];
      setConversations(list);
      if (list.length > 0 && !selectedBookingId) {
        setSelectedBookingId(list[0].booking_id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setConversations([]);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadMessages = async (bookingId: string) => {
    setIsLoadingMessages(true);
    try {
      const data = await api.getMessages(bookingId);
      if (data?.booking) {
        setActiveBookingData(data.booking);
      }
      if (data?.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const activeConversation: Conversation | null =
    conversations.find((c) => c.booking_id === selectedBookingId) ||
    (activeBookingData
      ? {
          booking_id: activeBookingData.id,
          booking_status: activeBookingData.status,
          start_date: activeBookingData.start_date,
          duration_days: activeBookingData.duration_days,
          total_price: activeBookingData.total_price,
          item_title: activeBookingData.item_title,
          item_images: activeBookingData.item_images,
          item_locality: activeBookingData.item_locality,
          partner_id:
            activeBookingData.borrower_id === user?.id
              ? activeBookingData.lender_id
              : activeBookingData.borrower_id,
          partner_name:
            activeBookingData.borrower_id === user?.id
              ? activeBookingData.lender_name || 'Lender'
              : activeBookingData.borrower_name || 'Borrower',
          partner_avatar: undefined,
          partner_phone: undefined,
          last_message: activeBookingData.message,
          last_message_at: activeBookingData.created_at,
        }
      : null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || !selectedBookingId || isSending) return;

    setSendError(null);
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      booking_id: selectedBookingId,
      sender_id: user?.id || 'me',
      sender_name: user?.name || 'You',
      receiver_id: activeConversation?.partner_id || '',
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const serverMsg = await api.sendMessage(
        selectedBookingId,
        activeConversation?.partner_id || '',
        textToSend
      );

      if (serverMsg && serverMsg.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...serverMsg, sender_name: user?.name || 'You' } : m
          )
        );
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.booking_id === selectedBookingId
            ? { ...c, last_message: textToSend, last_message_at: new Date().toISOString() }
            : c
        )
      );

      inputRef.current?.focus();
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setSendError(err.message || 'Failed to send message. Please retry.');
      setInputText(textToSend);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  // Not signed in state
  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-surface border border-divider rounded-3xl p-8 sm:p-12 shadow-sm space-y-4 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-brand-soft text-brand flex items-center justify-center mx-auto shadow-xs">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-ink font-display">
            Direct Rental Messaging
          </h2>
          <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
            Sign in to access your direct messages with neighbors, coordinate pickup spots, and ask questions about gear.
          </p>
          <button
            onClick={onOpenAuth}
            className="btn-primary text-xs sm:text-sm px-6 py-3 font-extrabold shadow-pink cursor-pointer w-full"
          >
            Sign In to Open Messages 💬
          </button>
        </div>
      </div>
    );
  }

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.partner_name?.toLowerCase().includes(q) ||
      c.item_title?.toLowerCase().includes(q) ||
      c.last_message?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 h-[calc(100vh-4.5rem)] flex flex-col min-h-0">
      
      {/* Page Shell: Clean 2-Pane Messenger */}
      <div className="bg-surface border border-divider rounded-3xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        
        {/* Top Header Bar */}
        <div className="shrink-0 px-5 sm:px-6 py-3.5 border-b border-divider flex items-center justify-between bg-surface/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-ink font-display leading-tight">
                Messages & Handoff Coordination
              </h1>
              <p className="text-[11px] text-ink-secondary hidden sm:block">
                Direct chat with lenders & borrowers in your community
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-ink-secondary bg-canvas px-3 py-1 rounded-full border border-divider">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Verified Direct Chat</span>
            </span>
          </div>
        </div>

        {/* 2-Column Split: Conversations on Left, Active Chat on Right */}
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          
          {/* Left Column: Conversations List */}
          <div className={`md:col-span-4 border-r border-divider flex flex-col bg-canvas/30 h-full min-h-0 overflow-hidden ${showMobileThread ? 'hidden md:flex' : 'flex'}`}>
            
            {/* Search filter */}
            <div className="shrink-0 p-3 sm:p-3.5 border-b border-divider bg-surface/50">
              <div className="flex items-center gap-2 bg-surface border border-divider rounded-full px-3 py-1.5 text-xs focus-within:border-brand">
                <Search className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats by name or item..."
                  className="bg-transparent border-none outline-none text-xs font-semibold text-ink w-full"
                />
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-divider/50">
              {isLoadingConversations ? (
                <div className="py-16 text-center text-xs text-ink-secondary flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  <span>Loading conversations...</span>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center space-y-2 text-ink-secondary">
                  <div className="w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center mx-auto mb-2">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-ink">No Conversations Found</p>
                  <p className="text-[11px] leading-relaxed max-w-xs mx-auto">
                    When you request an item or accept a rental booking, your coordination chat will appear here.
                  </p>
                </div>
              ) : (
                filteredConversations.map((chat) => {
                  const isSelected = chat.booking_id === selectedBookingId;
                  const partnerAvatar =
                    chat.partner_avatar ||
                    (chat.partner_name
                      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.partner_name)}&background=0F172A&color=fff&bold=true`
                      : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu');

                  return (
                    <div
                      key={chat.booking_id}
                      onClick={() => {
                        setSelectedBookingId(chat.booking_id);
                        setShowMobileThread(true);
                      }}
                      className={`p-3.5 sm:p-4 flex items-start gap-3 cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-surface font-bold border-l-4 border-brand shadow-xs' 
                          : 'hover:bg-surface/70'
                      }`}
                    >
                      <img
                        src={partnerAvatar}
                        alt={chat.partner_name || 'Member'}
                        className="w-11 h-11 rounded-full object-cover shrink-0 border border-divider"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="font-black text-ink truncate">{chat.partner_name || 'Neighbor'}</span>
                          {chat.last_message_at && (
                            <span className="text-[10px] text-ink-secondary shrink-0 pl-1 font-medium">
                              {new Date(chat.last_message_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-secondary truncate font-medium">
                          {chat.last_message || `Rental request for ${chat.item_title}`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] font-extrabold text-brand bg-brand-soft px-2 py-0.5 rounded-full border border-brand/20">
                            {chat.item_title}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Conversation Thread */}
          <div className={`md:col-span-8 flex flex-col justify-between bg-surface h-full min-h-0 overflow-hidden ${showMobileThread ? 'flex' : 'hidden md:flex'}`}>
            
            {activeConversation ? (
              <>
                {/* Active Chat Header */}
                <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-divider flex items-center justify-between gap-3 bg-surface z-10">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setShowMobileThread(false)}
                      className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-canvas text-ink-secondary hover:text-ink cursor-pointer shrink-0"
                      title="Back to conversation list"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    
                    <img
                      src={
                        activeConversation.partner_avatar ||
                        (activeConversation.partner_name
                          ? `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConversation.partner_name)}&background=0F172A&color=fff&bold=true`
                          : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')
                      }
                      alt={activeConversation.partner_name || 'Member'}
                      className="w-10 h-10 rounded-full object-cover border border-divider shrink-0"
                    />

                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-black text-ink truncate font-display">
                        {activeConversation.partner_name || 'Neighbor'}
                      </h2>
                      <div className="text-[11px] text-ink-secondary flex items-center gap-1.5 truncate">
                        <span className="font-bold text-ink truncate">{activeConversation.item_title}</span>
                        <span>•</span>
                        <span className="font-extrabold text-brand uppercase tracking-wider text-[10px]">
                          {activeConversation.booking_status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <span className="font-black text-ink text-sm sm:text-base font-display block">
                      ₹{Number(activeConversation.total_price)}
                    </span>
                    <span className="text-[10px] font-bold text-ink-secondary block">
                      {activeConversation.duration_days} {activeConversation.duration_days === 1 ? 'day' : 'days'}
                    </span>
                  </div>
                </div>

                {/* Error Banner */}
                {sendError && (
                  <div className="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/50 flex items-center justify-between text-xs text-red-600 dark:text-red-400">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{sendError}</span>
                    </div>
                    <button onClick={() => setSendError(null)} className="text-xs font-bold hover:underline cursor-pointer">
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Messages Thread Container (Internal Scroll Only!) */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-canvas/20"
                >
                  {isLoadingMessages ? (
                    <div className="py-20 text-center text-xs text-ink-secondary flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                      <span>Loading messages...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-20 text-center space-y-2 text-ink-secondary">
                      <div className="w-12 h-12 rounded-full bg-brand-soft text-brand flex items-center justify-center mx-auto mb-2">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-ink">Start Your Coordination</p>
                      <p className="text-xs max-w-sm mx-auto text-ink-secondary">
                        Discuss handover logistics, pickup timing, or any questions about the item.
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMe =
                        m.sender_id === (user?.id || 'me') ||
                        (user?.firebase_uid && m.sender_id === user.firebase_uid) ||
                        (m.sender_name && user?.name && m.sender_name === user.name);

                      const formattedTime = m.created_at
                        ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Just now';

                      return (
                        <div
                          key={m.id}
                          className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isMe && (
                            <img
                              src={
                                m.sender_avatar ||
                                (m.sender_name
                                  ? `https://ui-avatars.com/api/?name=${encodeURIComponent(m.sender_name)}&background=0F172A&color=fff&bold=true`
                                  : 'https://api.dicebear.com/7.x/shapes/svg?seed=partner')
                              }
                              alt={m.sender_name || 'Member'}
                              className="w-7 h-7 rounded-full object-cover shrink-0 border border-divider mb-1"
                            />
                          )}

                          <div
                            className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-xs break-words whitespace-pre-wrap overflow-hidden ${
                              isMe
                                ? 'bg-brand text-white rounded-br-xs'
                                : 'bg-surface border border-divider text-ink rounded-bl-xs'
                            }`}
                          >
                            {!isMe && m.sender_name && (
                              <div className="text-[10px] font-black text-brand mb-0.5">
                                {m.sender_name}
                              </div>
                            )}

                            <div className="break-words select-text">{m.content}</div>

                            <div
                              className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                                isMe ? 'text-white/75' : 'text-ink-secondary'
                              }`}
                            >
                              <span>{formattedTime}</span>
                              {isMe && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply Input Bar */}
                <form
                  onSubmit={handleSendMessage}
                  className="shrink-0 p-3 sm:p-4 border-t border-divider bg-surface flex items-center gap-2 sm:gap-3"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message to your neighbor..."
                    className="flex-1 bg-canvas border border-divider rounded-full px-4 sm:px-5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-brand text-white flex items-center justify-center shrink-0 shadow-pink transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
                    aria-label="Send Message"
                  >
                    {isSending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 ml-0.5" />
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 text-ink-secondary">
                <div className="w-14 h-14 rounded-3xl bg-canvas border border-divider flex items-center justify-center text-ink-muted">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-ink font-display">Select a Conversation</h3>
                <p className="text-xs max-w-xs text-ink-secondary">
                  Choose a rental conversation from the list to message your neighbor.
                </p>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};
