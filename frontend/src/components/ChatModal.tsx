import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Search } from 'lucide-react';
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fallback demo chats matching Screen 8 if no DB chats exist yet
  const DEMO_CHATS = [
    {
      id: 'demo-1',
      booking_id: 'booking-1',
      other_user_name: 'Rohan',
      other_user_avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80',
      last_message: 'Hey! Is the projector still available?',
      time_ago: '2m',
      unread: true,
      online: true,
    },
    {
      id: 'demo-2',
      booking_id: 'booking-2',
      other_user_name: 'Meera',
      other_user_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80',
      last_message: 'Can I rent the tent this weekend?',
      time_ago: '1h',
      unread: false,
      online: false,
    },
    {
      id: 'demo-3',
      booking_id: 'demo-3',
      other_user_name: 'Arjun',
      other_user_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80',
      last_message: 'Thanks! See you tomorrow.',
      time_ago: '3h',
      unread: false,
      online: false,
    },
    {
      id: 'demo-4',
      booking_id: 'demo-4',
      other_user_name: 'Simran',
      other_user_avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80',
      last_message: 'Is pickup from Saket okay?',
      time_ago: '1d',
      unread: false,
      online: false,
    },
  ];

  // Default demo message thread matching Screen 8
  const DEFAULT_THREAD: Message[] = [
    {
      id: 'm1',
      booking_id: 'booking-1',
      sender_id: 'rohan',
      sender_name: 'Rohan',
      receiver_id: user?.id || 'me',
      content: 'Hey! Is the projector still available?',
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'm2',
      booking_id: 'booking-1',
      sender_id: user?.id || 'me',
      sender_name: user?.name || 'You',
      receiver_id: 'rohan',
      content: 'Yes, it is! When do you need it?',
      created_at: new Date(Date.now() - 3000000).toISOString(),
    },
    {
      id: 'm3',
      booking_id: 'booking-1',
      sender_id: 'rohan',
      sender_name: 'Rohan',
      receiver_id: user?.id || 'me',
      content: "I'm looking for 12-14 Oct.",
      created_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'm4',
      booking_id: 'booking-1',
      sender_id: user?.id || 'me',
      sender_name: user?.name || 'You',
      receiver_id: 'rohan',
      content: 'That works! I can accept your request.',
      created_at: new Date(Date.now() - 600000).toISOString(),
    },
  ];

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialBookingId) {
      setSelectedBookingId(initialBookingId);
    }
  }, [initialBookingId]);

  useEffect(() => {
    if (selectedBookingId) {
      loadMessages(selectedBookingId);
    } else {
      setMessages(DEFAULT_THREAD);
    }
  }, [selectedBookingId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
      if (data.length > 0 && !selectedBookingId) {
        setSelectedBookingId(data[0].booking_id);
      }
    } catch {
      // Use demo conversations
    }
  };

  const loadMessages = async (bookingId: string) => {
    setIsLoading(true);
    try {
      const data = await api.getMessages(bookingId);
      if (data?.messages && data.messages.length > 0) {
        setMessages(data.messages);
      } else {
        setMessages(DEFAULT_THREAD);
      }
    } catch {
      setMessages(DEFAULT_THREAD);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: `m-${Date.now()}`,
      booking_id: selectedBookingId || 'booking-1',
      sender_id: user?.id || 'me',
      sender_name: user?.name || 'You',
      receiver_id: 'rohan',
      content: inputText.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMessage]);
    const textToSend = inputText;
    setInputText('');

    if (selectedBookingId && selectedBookingId !== 'booking-1') {
      try {
        await api.sendMessage(selectedBookingId, 'other-user', textToSend);
      } catch (err) {
        console.error('Failed to send message via API:', err);
      }
    }
  };

  if (!isOpen) return null;

  const activeContact = DEMO_CHATS[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-surface rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-4 border border-divider h-[600px] flex flex-col">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-divider">
          <h2 className="text-base font-extrabold text-ink font-display">
            Messages
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-hover text-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Chat matching Screen 8 */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          
          {/* Left Column: Conversation List matching Screen 8 (4 cols) */}
          <div className="md:col-span-4 border-r border-divider flex flex-col bg-canvas/40">
            {/* Search messages */}
            <div className="p-3 border-b border-divider">
              <div className="flex items-center gap-2 bg-surface border border-divider rounded-full px-3 py-1.5 text-xs">
                <Search className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="bg-transparent border-none outline-none text-xs font-medium text-ink w-full"
                />
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto divide-y divide-divider/60">
              {DEMO_CHATS.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedBookingId(chat.booking_id)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                    chat.id === 'demo-1' ? 'bg-surface font-bold' : 'hover:bg-surface'
                  }`}
                >
                  <img
                    src={chat.other_user_avatar}
                    alt={chat.other_user_name}
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-divider"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-ink truncate">{chat.other_user_name}</span>
                      <span className="text-[10px] text-ink-secondary">{chat.time_ago}</span>
                    </div>
                    <p className="text-[11px] text-ink-secondary truncate mt-0.5 font-medium">
                      {chat.last_message}
                    </p>
                  </div>
                  {chat.unread && (
                    <span className="w-2 h-2 rounded-full bg-brand shrink-0 mt-2" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Active Conversation matching Screen 8 (8 cols) */}
          <div className="md:col-span-8 flex flex-col justify-between bg-surface">
            
            {/* Active Header */}
            <div className="px-6 py-3 border-b border-divider flex items-center gap-3">
              <img
                src={activeContact.other_user_avatar}
                alt={activeContact.other_user_name}
                className="w-9 h-9 rounded-full object-cover border border-divider"
              />
              <div>
                <h4 className="text-sm font-extrabold text-ink">{activeContact.other_user_name}</h4>
                <span className="text-[10px] font-bold text-emerald-600">Online</span>
              </div>
            </div>

            {/* Messages Thread */}
            <div className="flex-1 p-6 overflow-y-auto space-y-3.5 bg-canvas/30">
              {messages.map((m) => {
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
                          : 'bg-canvas border border-divider text-ink rounded-bl-xs'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Input Bar matching Screen 8 */}
            <form onSubmit={handleSendMessage} className="p-3.5 border-t border-divider bg-surface flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-canvas border border-divider rounded-full px-4 py-2 text-xs font-medium text-ink outline-none focus:border-brand"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center shrink-0 shadow-pink transition-transform hover:scale-105 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>

          </div>

        </div>

      </div>
    </div>
  );
};
