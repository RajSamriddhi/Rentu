import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, Search, ArrowLeft, Check, AlertCircle, 
  Clock, MapPin, Sparkles, User as UserIcon, ShieldCheck, ChevronRight,
  Plus, X, Package, Calendar, DollarSign, Truck, FileText, CheckCircle2, XCircle,
  Trash2, Pencil
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { Conversation, Message, MessageProposalData } from '../lib/types';

interface MessagesViewProps {
  initialBookingId?: string | null;
  initialPartner?: { id: string; name: string; avatar?: string } | null;
  onOpenAuth: () => void;
  onNavigateHome?: () => void;
  onOpenUserProfile?: (userId: string) => void;
  onOpenBookings?: () => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  initialBookingId,
  initialPartner,
  onOpenAuth,
  onNavigateHome,
  onOpenUserProfile,
  onOpenBookings,
}) => {
  const { user, isAuthenticated } = useAuth();

  const initialConvId = initialPartner
    ? `dm_${initialPartner.id}`
    : (initialBookingId || null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialConvId);
  const [showMobileThread, setShowMobileThread] = useState<boolean>(!!initialConvId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeBookingData, setActiveBookingData] = useState<any>(null);
  const [activePartnerData, setActivePartnerData] = useState<any>(initialPartner || null);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Message inline editing & deletion state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Custom Listing & Request Proposal Modal State
  const [isCreateProposalOpen, setIsCreateProposalOpen] = useState(false);
  const [proposalType, setProposalType] = useState<'LISTING' | 'REQUEST'>('LISTING');
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalCategory, setProposalCategory] = useState('Electronics & Tech');
  const [proposalRate, setProposalRate] = useState<number>(300);
  const [proposalDays, setProposalDays] = useState<number>(2);
  const [proposalStartDate, setProposalStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [proposalStartTime, setProposalStartTime] = useState('10:00');
  const [proposalEndTime, setProposalEndTime] = useState('18:00');
  const [proposalDeliveryOption, setProposalDeliveryOption] = useState<'SELF' | 'LENDER_DELIVERY'>('SELF');
  const [proposalDeliveryFee, setProposalDeliveryFee] = useState<number>(100);
  const [proposalCollectionOption, setProposalCollectionOption] = useState<'SELF' | 'LENDER_COLLECT'>('SELF');
  const [proposalCollectionFee, setProposalCollectionFee] = useState<number>(65);
  const [proposalLocation, setProposalLocation] = useState('');
  const [proposalNotes, setProposalNotes] = useState('');
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
  const [isAcceptingProposal, setIsAcceptingProposal] = useState<string | null>(null);

  const getCalculatedEndDate = (startDate: string, durationDays: number): string => {
    try {
      const d = new Date(startDate);
      d.setDate(d.getDate() + Number(durationDays));
      return d.toISOString().split('T')[0];
    } catch {
      return startDate;
    }
  };

  const calculatedRentalCost = Math.max(0, Number(proposalRate) || 0) * Math.max(1, Number(proposalDays) || 1);
  const calculatedDeliveryFee = proposalDeliveryOption === 'LENDER_DELIVERY' ? Math.max(0, Number(proposalDeliveryFee) || 0) : 0;
  const calculatedCollectionFee = proposalCollectionOption === 'LENDER_COLLECT' ? Math.max(0, Number(proposalCollectionFee) || 0) : 0;
  const calculatedTotalDealCost = calculatedRentalCost + calculatedDeliveryFee + calculatedCollectionFee;

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
    if (initialPartner) {
      const dmId = `dm_${initialPartner.id}`;
      setSelectedConvId(dmId);
      setActivePartnerData(initialPartner);
      setShowMobileThread(true);
    } else if (initialBookingId) {
      setSelectedConvId(initialBookingId);
      setShowMobileThread(true);
    }
  }, [initialPartner, initialBookingId]);

  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
    } else {
      setMessages([]);
      setActiveBookingData(null);
    }
  }, [selectedConvId]);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length]);

  // Live polling every 4 seconds for messages and conversations list
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      // 1. Refresh conversations
      api.getConversations()
        .then((data) => {
          if (Array.isArray(data)) {
            setConversations((prev) => {
              let updated = [...data];
              const currentPartner = activePartnerData || initialPartner;
              if (currentPartner && currentPartner.id) {
                const dmKey = `dm_${currentPartner.id}`;
                const exists = updated.some(c => 
                  c.conversation_id === dmKey || 
                  c.partner_id === currentPartner.id ||
                  (currentPartner.firebase_uid && c.partner_id === currentPartner.firebase_uid)
                );
                if (!exists) {
                  const synth = prev.find(c => c.conversation_id === dmKey || c.partner_id === currentPartner.id);
                  if (synth) updated.unshift(synth);
                }
              }
              return updated;
            });
          }
        })
        .catch(() => {});

      // 2. Refresh messages if a conversation is selected
      if (selectedConvId) {
        api.getMessages(selectedConvId)
          .then((data) => {
            if (data?.messages && Array.isArray(data.messages)) {
              setMessages((prev) => {
                if (
                  prev.length !== data.messages.length || 
                  prev[prev.length - 1]?.id !== data.messages[data.messages.length - 1]?.id ||
                  JSON.stringify(prev.map(m => m.content)) !== JSON.stringify(data.messages.map(m => m.content))
                ) {
                  return data.messages;
                }
                return prev;
              });
            }
          })
          .catch(() => {});
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isAuthenticated, selectedConvId, activePartnerData, initialPartner]);

  const loadConversations = async () => {
    setIsLoadingConversations(true);
    try {
      const data = await api.getConversations();
      let list: Conversation[] = Array.isArray(data) ? data : [];

      // If activePartnerData or initialPartner was set and not in list, prepend synthetic DM entry
      const currentPartner = activePartnerData || initialPartner;
      if (currentPartner && currentPartner.id) {
        const dmKey = `dm_${currentPartner.id}`;
        const exists = list.some(c => 
          (c.conversation_id === dmKey) || 
          (c.partner_id === currentPartner.id && (!c.booking_id || c.booking_status === 'DIRECT_DM')) ||
          (currentPartner.firebase_uid && c.partner_id === currentPartner.firebase_uid)
        );
        if (!exists) {
          const synth: Conversation = {
            conversation_id: dmKey,
            booking_id: null,
            booking_status: 'DIRECT_DM',
            item_title: 'Direct Message',
            item_images: [],
            total_price: 0,
            partner_id: currentPartner.id,
            partner_name: currentPartner.name || 'Neighbor',
            partner_avatar: currentPartner.avatar_url || currentPartner.avatar,
            last_message: 'Direct conversation',
            last_message_at: new Date().toISOString(),
          };
          list = [synth, ...list];
        }
      }

      setConversations(list);
      if (list.length > 0 && !selectedConvId) {
        setSelectedConvId(list[0].conversation_id || list[0].booking_id || `dm_${list[0].partner_id}`);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setConversations([]);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadMessages = async (convId: string) => {
    setIsLoadingMessages(true);
    try {
      const data = await api.getMessages(convId);
      if (data?.booking) {
        setActiveBookingData(data.booking);
      } else {
        setActiveBookingData(null);
      }
      if (data?.partner) {
        setActivePartnerData(data.partner);
        // Ensure this partner is visible in the conversations list!
        setConversations((prev) => {
          const dmKey = `dm_${data.partner.id}`;
          const exists = prev.some(c => 
            c.conversation_id === dmKey || 
            c.partner_id === data.partner.id ||
            c.conversation_id === convId ||
            c.booking_id === convId
          );
          if (!exists) {
            const synth: Conversation = {
              conversation_id: dmKey,
              booking_id: null,
              booking_status: 'DIRECT_DM',
              item_title: 'Direct Message',
              item_images: [],
              total_price: 0,
              partner_id: data.partner.id,
              partner_name: data.partner.name || 'Neighbor',
              partner_avatar: data.partner.avatar_url || data.partner.avatar,
              last_message: 'Direct conversation',
              last_message_at: new Date().toISOString(),
            };
            return [synth, ...prev];
          }
          return prev;
        });
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

  // Close active chat from right side
  const handleCloseChat = () => {
    setSelectedConvId(null);
    setActivePartnerData(null);
    setActiveBookingData(null);
    setMessages([]);
    setShowMobileThread(false);
    setEditingMessageId(null);
  };

  // Delete entire conversation
  const handleDeleteConversation = async (convId: string, partnerName?: string) => {
    const confirmMsg = partnerName
      ? `Are you sure you want to delete your conversation with ${partnerName}? All messages in this chat will be permanently deleted.`
      : 'Are you sure you want to delete this chat conversation? All messages will be permanently deleted.';

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.deleteConversation(convId);
      setConversations((prev) =>
        prev.filter((c) => {
          const key = c.conversation_id || c.booking_id || `dm_${c.partner_id}`;
          return (
            key !== convId &&
            c.conversation_id !== convId &&
            c.booking_id !== convId &&
            `dm_${c.partner_id}` !== convId
          );
        })
      );

      const isActive =
        selectedConvId === convId ||
        activeConversation?.conversation_id === convId ||
        activeConversation?.booking_id === convId ||
        `dm_${activeConversation?.partner_id}` === convId;

      if (isActive) {
        handleCloseChat();
      }
    } catch (err: any) {
      console.error('Failed to delete conversation:', err);
      alert(err.message || 'Failed to delete conversation. Please try again.');
    }
  };

  // Message Edit & Delete Handlers
  const handleStartEdit = (m: Message) => {
    setEditingMessageId(m.id);
    setEditingText(m.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (messageId: string) => {
    const trimmed = editingText.trim();
    if (!trimmed || isSavingEdit) return;

    setIsSavingEdit(true);
    try {
      await api.editMessage(messageId, trimmed);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: trimmed, is_edited: true } : m
        )
      );
      setEditingMessageId(null);
      setEditingText('');

      // Also update last message in conversation list
      setConversations((prev) =>
        prev.map((c) => {
          const match =
            c.conversation_id === selectedConvId ||
            c.booking_id === selectedConvId ||
            `dm_${c.partner_id}` === selectedConvId;
          return match ? { ...c, last_message: trimmed } : c;
        })
      );
    } catch (err: any) {
      console.error('Failed to edit message:', err);
      alert(err.message || 'Failed to edit message');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;

    try {
      await api.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      // Update conversations if needed
      setConversations((prev) =>
        prev.map((c) => {
          const match =
            c.conversation_id === selectedConvId ||
            c.booking_id === selectedConvId ||
            `dm_${c.partner_id}` === selectedConvId;
          return match ? { ...c, last_message: 'Message deleted' } : c;
        })
      );
    } catch (err: any) {
      console.error('Failed to delete message:', err);
      alert(err.message || 'Failed to delete message');
    }
  };

  const activeConversation: Conversation | null =
    conversations.find((c) =>
      c.conversation_id === selectedConvId ||
      c.booking_id === selectedConvId ||
      `dm_${c.partner_id}` === selectedConvId
    ) ||
    (activePartnerData
      ? {
          conversation_id: `dm_${activePartnerData.id}`,
          booking_id: null,
          booking_status: 'DIRECT_DM',
          total_price: 0,
          item_title: 'Direct Message',
          item_images: [],
          partner_id: activePartnerData.id,
          partner_name: activePartnerData.name || 'Neighbor',
          partner_avatar: activePartnerData.avatar_url || activePartnerData.avatar,
        }
      : activeBookingData
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
    if (!textToSend || !selectedConvId || isSending) return;

    setSendError(null);
    const tempId = `temp-${Date.now()}`;
    const receiverId = activeConversation?.partner_id || (selectedConvId.startsWith('dm_') ? selectedConvId.replace('dm_', '') : '');

    const optimisticMsg: Message = {
      id: tempId,
      booking_id: activeConversation?.booking_id || undefined,
      sender_id: user?.id || 'me',
      sender_name: user?.name || 'You',
      receiver_id: receiverId,
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const serverMsg = await api.sendMessage(
        activeConversation?.booking_id || null,
        receiverId,
        textToSend
      );

      if (serverMsg && serverMsg.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...serverMsg, sender_name: user?.name || 'You' } : m
          )
        );
      }

      setConversations((prev) => {
        const exists = prev.some((c) =>
          c.conversation_id === selectedConvId ||
          c.booking_id === selectedConvId ||
          `dm_${c.partner_id}` === selectedConvId
        );
        if (exists) {
          return prev.map((c) => {
            const match =
              c.conversation_id === selectedConvId ||
              c.booking_id === selectedConvId ||
              `dm_${c.partner_id}` === selectedConvId;
            return match
              ? { ...c, last_message: textToSend, last_message_at: new Date().toISOString() }
              : c;
          });
        } else {
          const newEntry: Conversation = {
            conversation_id: selectedConvId,
            booking_id: activeConversation?.booking_id || null,
            booking_status: activeConversation?.booking_status || 'DIRECT_DM',
            item_title: activeConversation?.item_title || 'Direct Message',
            item_images: activeConversation?.item_images || [],
            total_price: activeConversation?.total_price || 0,
            partner_id: receiverId,
            partner_name: activeConversation?.partner_name || 'Neighbor',
            partner_avatar: activeConversation?.partner_avatar,
            last_message: textToSend,
            last_message_at: new Date().toISOString(),
          };
          return [newEntry, ...prev];
        }
      });

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

  const handleAcceptProposal = async (messageId: string) => {
    if (!messageId || isAcceptingProposal) return;
    setIsAcceptingProposal(messageId);
    try {
      const res = await api.acceptProposal(messageId);
      if (res && res.proposal_data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  proposal_data: res.proposal_data,
                  booking_id: res.booking?.id || m.booking_id,
                }
              : m
          )
        );

        if (res.booking?.id) {
          setActiveBookingData((prev: any) => ({
            ...(prev || {}),
            id: res.booking.id,
            status: 'ACCEPTED',
          }));
        }

        if (selectedConvId) {
          loadMessages(selectedConvId);
        }
        loadConversations();
      }
    } catch (err: any) {
      console.error('Failed to accept proposal:', err);
      alert(err.message || 'Failed to accept agreement. Please try again.');
    } finally {
      setIsAcceptingProposal(null);
    }
  };

  const handleDeclineProposal = async (messageId: string) => {
    if (!messageId || isAcceptingProposal) return;
    try {
      const res = await api.declineProposal(messageId);
      if (res && res.proposal_data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, proposal_data: res.proposal_data }
              : m
          )
        );
      }
    } catch (err: any) {
      console.error('Failed to decline proposal:', err);
    }
  };

  const handleCreateProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalTitle.trim() || !selectedConvId || isSubmittingProposal) return;

    const receiverId = activeConversation?.partner_id || (selectedConvId.startsWith('dm_') ? selectedConvId.replace('dm_', '') : '');
    if (!receiverId) return;

    setIsSubmittingProposal(true);
    setSendError(null);

    const calculatedEnd = getCalculatedEndDate(proposalStartDate, proposalDays);

    const proposalPayload: MessageProposalData = {
      type: proposalType,
      title: proposalTitle.trim(),
      category: proposalCategory,
      price_per_day: Number(proposalRate) || 0,
      total_price: calculatedTotalDealCost,
      duration_days: Math.max(1, Number(proposalDays) || 1),
      start_date: proposalStartDate,
      end_date: calculatedEnd,
      start_time: proposalStartTime,
      end_time: proposalEndTime,
      delivery_option: proposalDeliveryOption,
      delivery_fee: calculatedDeliveryFee,
      collection_option: proposalCollectionOption,
      collection_fee: calculatedCollectionFee,
      delivery_location: proposalLocation.trim(),
      notes: proposalNotes.trim(),
      status: 'PENDING',
    };

    const summaryText = `📦 ${proposalType === 'LISTING' ? 'Personal Gear Offer' : 'Custom Borrow Request'}: ${proposalTitle.trim()} (₹${calculatedTotalDealCost} for ${proposalDays} days)`;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      booking_id: activeConversation?.booking_id || undefined,
      sender_id: user?.id || 'me',
      sender_name: user?.name || 'You',
      receiver_id: receiverId,
      content: summaryText,
      message_type: 'PROPOSAL',
      proposal_data: proposalPayload,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setIsCreateProposalOpen(false);

    try {
      const serverMsg = await api.sendMessage(
        activeConversation?.booking_id || null,
        receiverId,
        summaryText,
        'PROPOSAL',
        proposalPayload
      );

      if (serverMsg && serverMsg.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...serverMsg, sender_name: user?.name || 'You' } : m
          )
        );
      }

      setProposalTitle('');
      setProposalNotes('');
      setProposalLocation('');

      loadConversations();
    } catch (err: any) {
      console.error('Failed to create proposal:', err);
      setSendError(err.message || 'Failed to send custom proposal.');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSubmittingProposal(false);
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
                  const chatKey = chat.conversation_id || chat.booking_id || `dm_${chat.partner_id}`;
                  const isSelected =
                    chatKey === selectedConvId ||
                    chat.booking_id === selectedConvId ||
                    `dm_${chat.partner_id}` === selectedConvId;
                  const partnerAvatar =
                    chat.partner_avatar ||
                    (chat.partner_name
                      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.partner_name)}&background=0F172A&color=fff&bold=true`
                      : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu');

                  const isDirect = chat.booking_status === 'DIRECT_DM' || !chat.booking_id;

                  return (
                    <div
                      key={chatKey}
                      onClick={() => {
                        setSelectedConvId(chatKey);
                        setShowMobileThread(true);
                      }}
                      className={`p-3.5 sm:p-4 flex items-start gap-3 cursor-pointer transition-all group relative ${
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
                          <div className="flex items-center gap-1.5 shrink-0 pl-1">
                            {chat.last_message_at && (
                              <span className="text-[10px] text-ink-secondary font-medium">
                                {new Date(chat.last_message_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteConversation(chatKey, chat.partner_name);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-500/10 text-ink-muted hover:text-red-500 transition-opacity cursor-pointer shrink-0"
                              title="Delete conversation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-ink-secondary truncate font-medium">
                          {chat.last_message || (isDirect ? 'Direct conversation' : `Rental request for ${chat.item_title}`)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                            isDirect 
                              ? 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20' 
                              : 'text-brand bg-brand-soft border-brand/20'
                          }`}>
                            {isDirect ? 'Direct Message' : chat.item_title}
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
                      onClick={() => activeConversation.partner_id && onOpenUserProfile?.(activeConversation.partner_id)}
                      className="w-10 h-10 rounded-full object-cover border border-divider shrink-0 cursor-pointer hover:ring-2 hover:ring-brand hover:scale-105 transition-all"
                      title={`View ${activeConversation.partner_name || 'Member'}'s public profile`}
                    />

                    <div className="min-w-0">
                      <h2 
                        onClick={() => activeConversation.partner_id && onOpenUserProfile?.(activeConversation.partner_id)}
                        className="text-sm sm:text-base font-black text-ink truncate font-display flex items-center gap-1.5 cursor-pointer hover:text-brand transition-colors"
                        title={`View ${activeConversation.partner_name || 'Member'}'s public profile`}
                      >
                        <span className="hover:underline">{activeConversation.partner_name || 'Neighbor'}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Active Member" />
                      </h2>
                      <div className="text-[11px] text-ink-secondary flex items-center gap-1.5 truncate">
                        {activeConversation.booking_status === 'DIRECT_DM' || !activeConversation.booking_id ? (
                          <>
                            <span className="font-bold text-purple-600 dark:text-purple-400">Direct Chat</span>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => activeConversation.partner_id && onOpenUserProfile?.(activeConversation.partner_id)}
                              className="text-brand font-bold hover:underline cursor-pointer"
                            >
                              View Profile
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-ink truncate">{activeConversation.item_title}</span>
                            <span>•</span>
                            <span className="font-extrabold text-brand uppercase tracking-wider text-[10px]">
                              {activeConversation.booking_status}
                            </span>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => activeConversation.partner_id && onOpenUserProfile?.(activeConversation.partner_id)}
                              className="text-brand font-bold hover:underline cursor-pointer"
                            >
                              Profile
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Launch Personal Listing / Request Proposal Button */}
                    <button
                      type="button"
                      onClick={() => setIsCreateProposalOpen(true)}
                      className="btn-primary text-[11px] px-3 py-1.5 font-bold shadow-pink rounded-full inline-flex items-center gap-1 cursor-pointer transition-transform hover:scale-105"
                      title="Release a personal listing or custom request for this neighbor"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span className="hidden sm:inline">Custom Deal</span>
                    </button>

                    {activeConversation.booking_id && Number(activeConversation.total_price) > 0 ? (
                      <div className="text-right shrink-0 pl-1 hidden sm:block">
                        <span className="font-black text-ink text-sm sm:text-base font-display block">
                          ₹{Number(activeConversation.total_price)}
                        </span>
                        <span className="text-[10px] font-bold text-ink-secondary block">
                          {activeConversation.duration_days} {activeConversation.duration_days === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                    ) : (
                      <div className="shrink-0 pl-1 hidden sm:block">
                        <span className="text-[11px] font-bold text-ink-secondary px-3 py-1 rounded-full bg-canvas border border-divider">
                          Direct DM 💬
                        </span>
                      </div>
                    )}

                    {/* Delete Entire Chat Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedConvId) {
                          handleDeleteConversation(selectedConvId, activeConversation?.partner_name);
                        }
                      }}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-canvas hover:bg-red-500/10 border border-divider hover:border-red-500/30 text-ink-secondary hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer"
                      title="Delete entire chat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Close Active Chat Button */}
                    <button
                      type="button"
                      onClick={handleCloseChat}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-canvas hover:bg-divider/60 border border-divider text-ink-secondary hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
                      title="Close chat"
                    >
                      <X className="w-4 h-4" />
                    </button>
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
                        Discuss handover logistics, pickup timing, or click the <span className="text-brand font-bold">+ button</span> below to release a custom listing deal.
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

                      // 1. SYSTEM Announcement Messages (Deal confirmation, milestones)
                      if (m.message_type === 'SYSTEM') {
                        return (
                          <div key={m.id} className="flex justify-center my-3">
                            <div className="max-w-md bg-surface/90 border border-emerald-500/30 rounded-2xl px-4 py-2 text-center text-xs text-ink shadow-xs">
                              <span className="font-semibold text-ink leading-relaxed">{m.content}</span>
                              <span className="block text-[10px] text-ink-secondary mt-0.5">{formattedTime}</span>
                            </div>
                          </div>
                        );
                      }

                      // 2. PROPOSAL Messages (Personal Listing or Custom Request Deal Card)
                      if (m.message_type === 'PROPOSAL' && m.proposal_data) {
                        const pData = typeof m.proposal_data === 'string' ? JSON.parse(m.proposal_data) : m.proposal_data;
                        const isPending = !pData.status || pData.status === 'PENDING';
                        const isAccepted = pData.status === 'ACCEPTED';
                        const isDeclined = pData.status === 'DECLINED';

                        return (
                          <div
                            key={m.id}
                            className={`flex items-end gap-2 my-2 ${isMe ? 'justify-end' : 'justify-start'}`}
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
                                onClick={() => m.sender_id && onOpenUserProfile?.(m.sender_id)}
                                className="w-7 h-7 rounded-full object-cover shrink-0 border border-divider mb-1 cursor-pointer hover:ring-2 hover:ring-brand transition-all"
                                title={`View ${m.sender_name || 'Member'}'s public profile`}
                              />
                            )}

                            <div className={`w-full max-w-sm sm:max-w-md rounded-3xl border p-4 shadow-sm transition-all overflow-hidden ${
                              isAccepted
                                ? 'bg-surface border-emerald-500/40 text-ink ring-1 ring-emerald-500/20'
                                : isMe
                                ? 'bg-surface border-brand/40 text-ink shadow-xs'
                                : 'bg-surface border-divider text-ink'
                            }`}>
                              {/* Proposal Header */}
                              <div className="flex items-center justify-between gap-2 pb-3 border-b border-divider/60">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                                    <Package className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-brand block">
                                      {pData.type === 'LISTING' ? 'Personal Gear Offer' : 'Custom Gear Request'}
                                    </span>
                                    <span className="text-[11px] font-bold text-ink-secondary truncate block">
                                      Direct Agreement Proposal
                                    </span>
                                  </div>
                                </div>

                                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 ${
                                  isAccepted
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                    : isDeclined
                                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                                }`}>
                                  {isAccepted ? '✓ Accepted & Booked' : isDeclined ? 'Declined' : 'Pending Review'}
                                </span>
                              </div>

                              {/* Title & Terms */}
                              <div className="py-3 space-y-2.5">
                                <h3 className="text-sm font-black text-ink font-display leading-tight">
                                  {pData.title || 'Personal Deal Item'}
                                </h3>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="p-2.5 rounded-2xl bg-canvas border border-divider/60">
                                    <span className="text-[10px] text-ink-secondary block font-semibold">Agreed Price</span>
                                    <span className="font-black text-ink text-sm sm:text-base font-display">
                                      ₹{pData.total_price || 0}
                                    </span>
                                    <span className="text-[10px] text-ink-secondary block">
                                      ₹{pData.price_per_day || 0}/day • {pData.duration_days} {pData.duration_days === 1 ? 'day' : 'days'}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-2xl bg-canvas border border-divider/60">
                                    <span className="text-[10px] text-ink-secondary block font-semibold">Rental Schedule</span>
                                    <span className="font-bold text-ink text-[11px] block">{pData.start_date}</span>
                                    <span className="text-[10px] text-ink-secondary block">to {pData.end_date || 'End Date'}</span>
                                  </div>
                                </div>

                                {/* Handover Info */}
                                <div className="text-[11px] text-ink-secondary flex items-center gap-1.5 bg-canvas/60 px-3 py-1.5 rounded-xl border border-divider/40">
                                  <Truck className="w-3.5 h-3.5 text-brand shrink-0" />
                                  <span className="truncate">
                                    {pData.delivery_option === 'LENDER_DELIVERY' 
                                      ? `Owner Delivery (+₹${pData.delivery_fee || 0})` 
                                      : 'Borrower Self Pickup & Return'}
                                    {pData.delivery_location ? ` • ${pData.delivery_location}` : ''}
                                  </span>
                                </div>

                                {/* Custom Notes */}
                                {pData.notes && (
                                  <div className="text-[11px] text-ink bg-canvas/40 p-2.5 rounded-xl border border-divider/40 leading-relaxed italic">
                                    "{pData.notes}"
                                  </div>
                                )}
                              </div>

                              {/* Card Action Footer */}
                              <div className="pt-2 border-t border-divider/60">
                                {isAccepted ? (
                                  <div className="flex items-center justify-between gap-2 py-1">
                                    <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span>Scheduled in Bookings</span>
                                    </span>
                                    {onOpenBookings && (
                                      <button
                                        type="button"
                                        onClick={onOpenBookings}
                                        className="text-[11px] font-bold text-brand hover:underline cursor-pointer"
                                      >
                                        View Calendar →
                                      </button>
                                    )}
                                  </div>
                                ) : isDeclined ? (
                                  <div className="text-[11px] text-ink-secondary py-1 italic">
                                    This agreement proposal was declined.
                                  </div>
                                ) : (
                                  // PENDING STATE
                                  <div>
                                    {!isMe ? (
                                      <div className="flex items-center gap-2 pt-1">
                                        <button
                                          type="button"
                                          onClick={() => handleAcceptProposal(m.id)}
                                          disabled={isAcceptingProposal === m.id}
                                          className="flex-1 btn-primary py-2 px-3 text-xs font-bold rounded-xl shadow-pink cursor-pointer flex items-center justify-center gap-1.5"
                                        >
                                          {isAcceptingProposal === m.id ? (
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                          ) : (
                                            <>
                                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                                              <span>Accept Agreement & Book</span>
                                            </>
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeclineProposal(m.id)}
                                          disabled={isAcceptingProposal === m.id}
                                          className="px-3 py-2 text-xs font-bold text-ink-secondary hover:text-red-500 hover:bg-red-500/10 rounded-xl border border-divider transition-colors cursor-pointer"
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="text-[11px] text-ink-secondary flex items-center gap-1.5 py-1 font-medium">
                                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                                        <span>Waiting for {activeConversation.partner_name || 'neighbor'} to review and accept</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="text-[9px] mt-1.5 flex items-center justify-end gap-1 text-ink-secondary">
                                <span>{formattedTime}</span>
                                {isMe && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 3. STANDARD CHAT TEXT MESSAGE
                      return (
                        <div
                          key={m.id}
                          className={`flex items-end gap-2 group ${isMe ? 'justify-end' : 'justify-start'}`}
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
                              onClick={() => m.sender_id && onOpenUserProfile?.(m.sender_id)}
                              className="w-7 h-7 rounded-full object-cover shrink-0 border border-divider mb-1 cursor-pointer hover:ring-2 hover:ring-brand transition-all"
                              title={`View ${m.sender_name || 'Member'}'s public profile`}
                            />
                          )}

                          {/* Hover action buttons for sender (Edit & Delete) */}
                          {isMe && editingMessageId !== m.id && (
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity text-ink-muted mb-1 order-first">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(m)}
                                className="p-1 rounded-full hover:bg-canvas hover:text-ink transition-colors cursor-pointer"
                                title="Edit message"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                className="p-1 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer"
                                title="Delete message"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <div
                            className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-xs break-words whitespace-pre-wrap overflow-hidden ${
                              isMe
                                ? 'bg-brand text-white rounded-br-xs'
                                : 'bg-surface border border-divider text-ink rounded-bl-xs'
                            }`}
                          >
                            {!isMe && m.sender_name && (
                              <div 
                                onClick={() => m.sender_id && onOpenUserProfile?.(m.sender_id)}
                                className="text-[10px] font-black text-brand mb-0.5 cursor-pointer hover:underline"
                                title={`View ${m.sender_name}'s public profile`}
                              >
                                {m.sender_name}
                              </div>
                            )}

                            {editingMessageId === m.id ? (
                              <div className="space-y-2 min-w-[200px]">
                                <input
                                  type="text"
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveEdit(m.id);
                                    }
                                    if (e.key === 'Escape') {
                                      handleCancelEdit();
                                    }
                                  }}
                                  autoFocus
                                  className="w-full bg-white/15 dark:bg-black/30 border border-white/40 text-white rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-white font-medium"
                                />
                                <div className="flex items-center justify-end gap-1.5 text-[10px]">
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-2 py-0.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer font-bold"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(m.id)}
                                    disabled={!editingText.trim() || isSavingEdit}
                                    className="px-2.5 py-0.5 rounded-full bg-white text-brand shadow-xs hover:bg-white/90 transition-all cursor-pointer font-extrabold disabled:opacity-50"
                                  >
                                    {isSavingEdit ? 'Saving...' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="break-words select-text">{m.content}</div>

                                <div
                                  className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                                    isMe ? 'text-white/75' : 'text-ink-secondary'
                                  }`}
                                >
                                  {m.is_edited && (
                                    <span className="italic mr-0.5 opacity-80">(edited)</span>
                                  )}
                                  <span>{formattedTime}</span>
                                  {isMe && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply Input Bar with + Button */}
                <form
                  onSubmit={handleSendMessage}
                  className="shrink-0 p-3 sm:p-4 border-t border-divider bg-surface flex items-center gap-2 sm:gap-3"
                >
                  {/* Plus button to launch personal listing / request */}
                  <button
                    type="button"
                    onClick={() => setIsCreateProposalOpen(true)}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-canvas hover:bg-brand-soft border border-divider hover:border-brand text-ink-secondary hover:text-brand flex items-center justify-center shrink-0 transition-all cursor-pointer group shadow-xs"
                    title="Release a personal listing or request agreement for this neighbor (+)"
                  >
                    <Plus className="w-5 h-5 transition-transform group-hover:rotate-90 duration-200" />
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Message ${activeConversation.partner_name || 'neighbor'}...`}
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

      {/* Modal: Create Personal Listing / Borrow Request Agreement */}
      {isCreateProposalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-surface border border-divider rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-divider flex items-center justify-between bg-surface">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-ink font-display">
                    {proposalType === 'LISTING' ? 'Personal Gear Listing Offer' : 'Personal Borrow Request'}
                  </h3>
                  <p className="text-xs text-ink-secondary">
                    Custom deal specifically for {activeConversation?.partner_name || 'this neighbor'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateProposalOpen(false)}
                className="w-8 h-8 rounded-full bg-canvas hover:bg-divider/60 text-ink-secondary flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Proposal Form */}
            <form onSubmit={handleCreateProposalSubmit} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-canvas rounded-2xl border border-divider">
                <button
                  type="button"
                  onClick={() => setProposalType('LISTING')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    proposalType === 'LISTING'
                      ? 'bg-brand text-white shadow-xs'
                      : 'text-ink-secondary hover:text-ink'
                  }`}
                >
                  📦 Offer to Lend (My Gear)
                </button>
                <button
                  type="button"
                  onClick={() => setProposalType('REQUEST')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    proposalType === 'REQUEST'
                      ? 'bg-brand text-white shadow-xs'
                      : 'text-ink-secondary hover:text-ink'
                  }`}
                >
                  🎯 Request to Borrow
                </button>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  {proposalType === 'LISTING' ? 'Gear / Equipment Title *' : 'Item Needed *'}
                </label>
                <input
                  type="text"
                  required
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  placeholder={proposalType === 'LISTING' ? 'e.g. Sony Alpha 7 IV + 24-70mm Lens' : 'e.g. 4-Person Camping Tent with Sleeping Bags'}
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 font-semibold"
                />
              </div>

              {/* Category & Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">Category</label>
                  <select
                    value={proposalCategory}
                    onChange={(e) => setProposalCategory(e.target.value)}
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs text-ink outline-none focus:border-brand font-semibold cursor-pointer"
                  >
                    <option value="Electronics & Tech">Electronics & Tech</option>
                    <option value="Photography & Video">Photography & Video</option>
                    <option value="Outdoor & Camping">Outdoor & Camping</option>
                    <option value="Gaming & VR">Gaming & VR</option>
                    <option value="Tools & DIY">Tools & DIY</option>
                    <option value="Music & Audio">Music & Audio</option>
                    <option value="Party & Events">Party & Events</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">
                    Rate (₹/day)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-ink-muted">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={proposalRate}
                      onChange={(e) => setProposalRate(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-canvas border border-divider rounded-xl pl-7 pr-3.5 py-2.5 text-xs text-ink outline-none focus:border-brand font-bold"
                      placeholder="300"
                    />
                  </div>
                </div>
              </div>

              {/* Schedule: Start Date & Duration */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-divider space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand" />
                    <span>Rental Schedule</span>
                  </span>
                  <span className="text-[11px] font-extrabold text-brand bg-brand-soft px-2.5 py-0.5 rounded-full border border-brand/20">
                    {proposalDays} {proposalDays === 1 ? 'Day' : 'Days'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-ink-secondary mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={proposalStartDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setProposalStartDate(e.target.value)}
                      className="w-full bg-surface border border-divider rounded-xl px-2.5 py-2 text-xs text-ink outline-none focus:border-brand font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-ink-secondary mb-1">Duration (Days)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      required
                      value={proposalDays}
                      onChange={(e) => setProposalDays(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-surface border border-divider rounded-xl px-2.5 py-2 text-xs text-ink outline-none focus:border-brand font-bold"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-ink-secondary flex items-center justify-between pt-1 border-t border-divider/40">
                  <span>Scheduled Return Date:</span>
                  <span className="font-bold text-ink">{getCalculatedEndDate(proposalStartDate, proposalDays)}</span>
                </div>
              </div>

              {/* Handover & Delivery Options */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-ink">Handover & Delivery</label>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProposalDeliveryOption('SELF')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      proposalDeliveryOption === 'SELF'
                        ? 'border-brand bg-brand-soft/30 text-ink'
                        : 'border-divider bg-canvas text-ink-secondary hover:text-ink'
                    }`}
                  >
                    <span className="text-xs font-bold block">Self Pickup</span>
                    <span className="text-[10px] text-ink-secondary block">Borrower collects</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProposalDeliveryOption('LENDER_DELIVERY')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      proposalDeliveryOption === 'LENDER_DELIVERY'
                        ? 'border-brand bg-brand-soft/30 text-ink'
                        : 'border-divider bg-canvas text-ink-secondary hover:text-ink'
                    }`}
                  >
                    <span className="text-xs font-bold block">Lender Delivers</span>
                    <span className="text-[10px] text-brand font-bold block">+₹{proposalDeliveryFee} fee</span>
                  </button>
                </div>

                {proposalDeliveryOption === 'LENDER_DELIVERY' && (
                  <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                    <span className="text-[11px] font-bold text-ink-secondary shrink-0">Delivery Fee (₹):</span>
                    <input
                      type="number"
                      min="0"
                      value={proposalDeliveryFee}
                      onChange={(e) => setProposalDeliveryFee(Math.max(0, Number(e.target.value)))}
                      className="w-24 bg-canvas border border-divider rounded-lg px-2 py-1 text-xs text-ink font-bold"
                    />
                  </div>
                )}

                <div>
                  <input
                    type="text"
                    value={proposalLocation}
                    onChange={(e) => setProposalLocation(e.target.value)}
                    placeholder="Handover address or locality (e.g. Indiranagar, Gate 2)"
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2 text-xs text-ink outline-none focus:border-brand font-medium placeholder:text-ink-muted mt-1"
                  />
                </div>
              </div>

              {/* Custom Agreement Notes */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Agreed Specifications & Inclusions
                </label>
                <textarea
                  rows={2}
                  value={proposalNotes}
                  onChange={(e) => setProposalNotes(e.target.value)}
                  placeholder="e.g. Includes 2 extra batteries, charger, and 128GB high-speed memory card. Return charged."
                  className="w-full bg-canvas border border-divider rounded-xl p-3 text-xs text-ink outline-none focus:border-brand font-medium resize-none placeholder:text-ink-muted"
                />
              </div>

              {/* Cost Summary Banner */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-brand/10 to-brand/5 border border-brand/20 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-ink-secondary block font-medium">Total Deal Value</span>
                  <span className="text-xs font-black text-ink font-display">
                    {proposalDays} days @ ₹{proposalRate}/day
                    {proposalDeliveryOption === 'LENDER_DELIVERY' && ` + ₹${proposalDeliveryFee} delivery`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base sm:text-lg font-black text-brand font-display block">
                    ₹{calculatedTotalDealCost}
                  </span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateProposalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-divider text-ink font-bold text-xs hover:bg-canvas transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!proposalTitle.trim() || isSubmittingProposal}
                  className="flex-1 btn-primary py-2.5 px-4 rounded-xl text-xs font-extrabold shadow-pink flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  {isSubmittingProposal ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Agreement</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
