import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Search, ArrowLeft, MessageSquare, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { Conversation, Message } from '../lib/types';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBookingId?: string | null;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  initialBookingId,
}) => {
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(initialBookingId || null);
  const [showMobileThread, setShowMobileThread] = useState<boolean>(!!initialBookingId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeBookingData, setActiveBookingData] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom smoothly within the messages container only (avoids jerking page/ancestor modals)
  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

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

  // Non-intrusive background polling every 3.5 seconds while chat is open
  useEffect(() => {
    if (!isOpen || !selectedBookingId) return;

    const interval = setInterval(() => {
      api.getMessages(selectedBookingId)
        .then((data) => {
          if (data?.messages && Array.isArray(data.messages)) {
            setMessages((prev) => {
              if (prev.length !== data.messages.length || prev[prev.length - 1]?.id !== data.messages[data.messages.length - 1]?.id) {
                return data.messages;
              }
              return prev;
            });
          }
        })
        .catch(() => {});
    }, 3500);

    return () => clearInterval(interval);
  }, [isOpen, selectedBookingId]);

  const loadConversations = async () => {
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
    }
  };

  const loadMessages = async (bookingId: string) => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  // Resolve active conversation either from conversation list or directly from booking details
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

      // Reconcile optimistic message with real database id
      if (serverMsg && serverMsg.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...serverMsg, sender_name: user?.name || 'You' } : m
          )
        );
      }

      // Update conversations sidebar last message
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
      // Restore input text so user does not lose message
      setInputText(textToSend);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-surface rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto border border-divider h-[88vh] max-h-[680px] min-h-[420px] flex flex-col">
        
        {/* Top Header */}
        <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-divider bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-ink font-display leading-tight">
                Rental Messages & Coordination
              </h2>
              <p className="text-[10px] text-ink-secondary hidden sm:block">
                Direct coordination for pickup, return, and rental questions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-hover text-ink-secondary hover:text-ink transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Chat Grid */}
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          
          {/* Left Column: Conversation List */}
          <div className={`md:col-span-4 border-r border-divider flex flex-col bg-canvas/40 h-full min-h-0 overflow-hidden ${showMobileThread ? 'hidden md:flex' : 'flex'}`}>
            {/* Search messages */}
            <div className="shrink-0 p-3 border-b border-divider bg-surface/60">
              <div className="flex items-center gap-2 bg-surface border border-divider rounded-full px-3 py-1.5 text-xs">
                <Search className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="bg-transparent border-none outline-none text-xs font-medium text-ink w-full"
                />
              </div>
            </div>

            {/* Conversation list items */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-divider/60">
              {filteredConversations.length === 0 ? (
                <div className="p-6 text-center space-y-2 text-ink-secondary">
                  <p className="text-xs font-bold text-ink">No Conversations Yet</p>
                  <p className="text-[11px] leading-relaxed">
                    When you request an item or accept a rental booking, a coordination thread will appear here.
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
                      className={`p-3 sm:p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-surface font-bold border-l-4 border-brand shadow-xs' : 'hover:bg-surface/70'
                      }`}
                    >
                      <img
                        src={partnerAvatar}
                        alt={chat.partner_name || 'Member'}
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-divider"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-ink truncate">{chat.partner_name || 'Neighbor'}</span>
                          {chat.last_message_at && (
                            <span className="text-[10px] text-ink-secondary shrink-0">
                              {new Date(chat.last_message_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-ink-secondary truncate mt-0.5 font-medium">
                          {chat.last_message || `Booking: ${chat.item_title || 'Item'}`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-bold text-brand bg-brand-soft px-1.5 py-0.2 rounded">
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

          {/* Right Column: Active Conversation */}
          <div className={`md:col-span-8 flex flex-col justify-between bg-surface h-full min-h-0 overflow-hidden ${showMobileThread ? 'flex' : 'hidden md:flex'}`}>
            
            {activeConversation ? (
              <>
                {/* Active Thread Header */}
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
                      className="w-9 h-9 rounded-full object-cover border border-divider shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-extrabold text-ink truncate">
                        {activeConversation.partner_name || 'Neighbor'}
                      </h4>
                      <p className="text-[10px] text-ink-secondary flex items-center gap-1.5 truncate">
                        <span className="font-semibold truncate">{activeConversation.item_title}</span>
                        <span>•</span>
                        <span className="font-bold text-brand uppercase tracking-wider">{activeConversation.booking_status}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 text-xs pl-2">
                    <span className="font-extrabold text-ink block font-display">₹{Number(activeConversation.total_price)}</span>
                    <span className="text-[10px] text-ink-secondary block">{activeConversation.duration_days} days</span>
                  </div>
                </div>

                {/* Error Banner if sending fails */}
                {sendError && (
                  <div className="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/50 flex items-center justify-between text-xs text-red-600 dark:text-red-400">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{sendError}</span>
                    </div>
                    <button onClick={() => setSendError(null)} className="text-xs font-bold hover:underline">
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Messages Thread Container */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3 bg-canvas/30"
                >
                  {isLoading ? (
                    <div className="py-16 text-center text-xs text-ink-secondary flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                      <span>Loading messages...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-16 text-center space-y-2 text-ink-secondary">
                      <div className="w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center mx-auto mb-2">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-ink">No Messages in this Chat</p>
                      <p className="text-[11px] max-w-xs mx-auto text-ink-secondary">
                        Send a message below to coordinate pickup spot, return time, or ask questions.
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
                              className="w-6 h-6 rounded-full object-cover shrink-0 border border-divider mb-1"
                            />
                          )}

                          <div
                            className={`max-w-[78%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-xs break-words whitespace-pre-wrap overflow-hidden ${
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
                  className="shrink-0 p-3 sm:p-3.5 border-t border-divider bg-surface flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message to your neighbor..."
                    className="flex-1 bg-canvas border border-divider rounded-full px-4 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-brand text-white flex items-center justify-center shrink-0 shadow-pink transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
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
                <div className="w-12 h-12 rounded-2xl bg-canvas border border-divider flex items-center justify-center text-ink-muted">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-extrabold text-ink">Select a Conversation</h4>
                <p className="text-xs max-w-xs">
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
