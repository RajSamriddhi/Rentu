import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Search, ArrowLeft, MessageSquare, Clock, MapPin } from 'lucide-react';
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
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    }
  }, [selectedBookingId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const activeConversation = conversations.find((c) => c.booking_id === selectedBookingId);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedBookingId || isSending) return;

    const textToSend = inputText.trim();
    const tempId = `m-${Date.now()}`;
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
      await api.sendMessage(selectedBookingId, activeConversation?.partner_id || '', textToSend);
    } catch (err) {
      console.error('Failed to send message:', err);
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-surface rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-4 border border-divider h-[600px] flex flex-col">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-divider">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand" />
            <h2 className="text-base font-extrabold text-ink font-display">
              Rental Messages & Handoffs
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-hover text-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Chat */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          
          {/* Left Column: Conversation List */}
          <div className={`md:col-span-4 border-r border-divider flex-col bg-canvas/40 ${showMobileThread ? 'hidden md:flex' : 'flex'}`}>
            {/* Search messages */}
            <div className="p-3 border-b border-divider">
              <div className="flex items-center gap-2 bg-surface border border-divider rounded-full px-3 py-1.5 text-xs">
                <Search className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="bg-transparent border-none outline-none text-xs font-medium text-ink w-full"
                />
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto divide-y divide-divider/60">
              {filteredConversations.length === 0 ? (
                <div className="p-6 text-center space-y-2 text-ink-secondary">
                  <p className="text-xs font-bold text-ink">No Conversations Yet</p>
                  <p className="text-[11px] leading-relaxed">
                    When you request an item or accept a rental booking, a secure chat thread will appear here.
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
                      className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-surface font-bold border-l-4 border-brand' : 'hover:bg-surface'
                      }`}
                    >
                      <img
                        src={partnerAvatar}
                        alt={chat.partner_name}
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-divider"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-ink truncate">{chat.partner_name || 'Neighbor'}</span>
                          {chat.last_message_at && (
                            <span className="text-[10px] text-ink-secondary">
                              {new Date(chat.last_message_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-ink-secondary truncate mt-0.5 font-medium">
                          {chat.last_message || `Booking: ${chat.item_title || 'Item'}`}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Conversation */}
          <div className={`md:col-span-8 flex-col justify-between bg-surface ${showMobileThread ? 'flex' : 'hidden md:flex'}`}>
            
            {activeConversation ? (
              <>
                {/* Active Header */}
                <div className="px-4 sm:px-6 py-3 border-b border-divider flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowMobileThread(false)}
                      className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-canvas text-ink-secondary hover:text-ink cursor-pointer"
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
                      alt={activeConversation.partner_name}
                      className="w-9 h-9 rounded-full object-cover border border-divider"
                    />
                    <div>
                      <h4 className="text-sm font-extrabold text-ink">{activeConversation.partner_name || 'Neighbor'}</h4>
                      <p className="text-[10px] text-ink-secondary flex items-center gap-1.5">
                        <span>{activeConversation.item_title}</span>
                        <span>•</span>
                        <span className="font-bold text-brand">{activeConversation.booking_status}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right hidden sm:block text-xs">
                    <span className="font-bold text-ink">₹{Number(activeConversation.total_price)}</span>
                    <span className="text-[10px] text-ink-secondary block">{activeConversation.duration_days} days</span>
                  </div>
                </div>

                {/* Messages Thread */}
                <div className="flex-1 p-6 overflow-y-auto space-y-3.5 bg-canvas/30">
                  {isLoading ? (
                    <div className="py-12 text-center text-xs text-ink-secondary">
                      Loading messages...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-16 text-center space-y-2 text-ink-secondary">
                      <p className="text-xs font-bold text-ink">No Messages in this Chat</p>
                      <p className="text-[11px] max-w-xs mx-auto">
                        Send a message below to coordinate pickup time, location, or questions about the gear.
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMe = m.sender_id === (user?.id || 'me');
                      return (
                        <div
                          key={m.id}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-xs ${
                              isMe
                                ? 'bg-[#E11D74] text-white rounded-br-xs'
                                : 'bg-surface border border-divider text-ink rounded-bl-xs'
                            }`}
                          >
                            <div>{m.content}</div>
                            <div className={`text-[9px] mt-1 text-right ${isMe ? 'text-white/70' : 'text-ink-secondary'}`}>
                              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Input Bar */}
                <form onSubmit={handleSendMessage} className="p-3.5 border-t border-divider bg-surface flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message to your neighbor..."
                    className="flex-1 bg-canvas border border-divider rounded-full px-4 py-2 text-xs font-medium text-ink outline-none focus:border-brand"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center shrink-0 shadow-pink transition-transform hover:scale-105 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
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
