import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, MessageSquareOff, Send, Search, ArrowLeft, Check, CheckCheck, AlertCircle, 
  Clock, MapPin, Sparkles, User as UserIcon, ShieldCheck, ChevronRight,
  Plus, X, Package, Calendar, DollarSign, Truck, FileText, CheckCircle2, XCircle,
  Trash2, Pencil, Image as ImageIcon, Phone, ExternalLink, Download, Loader2, Navigation,
  ClipboardCheck, Copy, Radio, LocateFixed, Compass, StopCircle, RefreshCw,
  Info, Smile, MoreHorizontal, MoreVertical, Bell, BellOff
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { Conversation, Message, MessageProposalData } from '../lib/types';
import { PersonalProposalModal } from './PersonalProposalModal';
import { uploadItemPhoto } from '../lib/supabase';
import { 
  detectCurrentLocation, 
  getEffectiveSavedLocations, 
  formatSavedLocationFull, 
  getGoogleMapsUrl, 
  getGoogleMapsDirectionsUrl, 
  ResolvedLocation 
} from '../lib/location';
import { formatTime12 } from '../lib/formatters';

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
  const [isAcceptingProposal, setIsAcceptingProposal] = useState<string | null>(null);

  // Media & Location State
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [detectedGpsLocation, setDetectedGpsLocation] = useState<ResolvedLocation | null>(null);
  const [locationModalTab, setLocationModalTab] = useState<'options' | 'live_duration'>('options');
  const [liveDurationMinutes, setLiveDurationMinutes] = useState<15 | 60 | 480>(60);
  const [liveLocationComment, setLiveLocationComment] = useState('');
  const [isSendingLocation, setIsSendingLocation] = useState(false);
  const [customLocationText, setCustomLocationText] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Instagram-style Features State
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isChatMuted, setIsChatMuted] = useState(false);

  // Custom Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'CONVERSATION' | 'MESSAGE';
    id: string;
    name?: string;
  } | null>(null);
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const hasUserClosedChatRef = useRef<boolean>(false);

  // Helper to reliably check if a conversation matches a selected identifier without null == null false positives
  const isConvMatch = (c: Conversation, targetId: string | null | undefined): boolean => {
    if (!targetId) return false;
    return Boolean(
      (c.conversation_id && c.conversation_id === targetId) ||
      (c.booking_id && c.booking_id === targetId) ||
      (c.partner_id && `dm_${c.partner_id}` === targetId)
    );
  };

  // Click outside to close Emoji Picker & Attachment Menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setIsEmojiPickerOpen(false);
      }
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target as Node)) {
        setIsAttachmentMenuOpen(false);
      }
    };
    if (isEmojiPickerOpen || isAttachmentMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isEmojiPickerOpen, isAttachmentMenuOpen]);

  // Auto-detect high-accuracy GPS satellite coordinates whenever Location Modal opens
  useEffect(() => {
    if (isLocationModalOpen) {
      setLocationModalTab('options');
      setIsDetectingLocation(true);
      detectCurrentLocation({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })
        .then((loc) => {
          setDetectedGpsLocation(loc);
        })
        .catch((err) => {
          console.warn('GPS detection background error:', err);
        })
        .finally(() => {
          setIsDetectingLocation(false);
        });
    }
  }, [isLocationModalOpen]);

  // Scroll to bottom cleanly within the thread container
  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  // Status ticks: 1 tick = sent, 2 ticks = reached recipient (delivered), 2 blue ticks = read/seen
  const renderMessageTicks = (m: Message, onBubble = true) => {
    // 3. Double Blue Ticks (Read / Seen by recipient)
    if (m.is_read) {
      return (
        <span title="Read" className="inline-flex items-center text-[#38bdf8] drop-shadow-xs">
          <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
      );
    }
    // 2. Double Grey/White Ticks (Delivered to recipient)
    if (m.is_delivered) {
      return (
        <span title="Delivered" className={`inline-flex items-center ${onBubble ? 'text-white/70' : 'text-ink-muted'}`}>
          <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
      );
    }
    // 1. Single Tick (Sent & stored on server)
    return (
      <span title="Sent" className={`inline-flex items-center ${onBubble ? 'text-white/70' : 'text-ink-muted'}`}>
        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
      </span>
    );
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
              const currentPartner = selectedConvId ? (activePartnerData || initialPartner) : null;
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
                const prevSig = prev.map(m => `${m.id}_${m.content}_${m.is_read}_${m.is_delivered}_${m.is_edited}`).join('|');
                const nextSig = data.messages.map(m => `${m.id}_${m.content}_${m.is_read}_${m.is_delivered}_${m.is_edited}`).join('|');
                if (prevSig !== nextSig) {
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
      const currentPartner = selectedConvId ? (activePartnerData || initialPartner) : (initialPartner || null);
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
      // Auto-select first conversation on initial load only if user hasn't explicitly closed the chat
      if (list.length > 0 && !selectedConvId && !hasUserClosedChatRef.current && !initialPartner && !initialBookingId) {
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
        const dmKey = `dm_${data.partner.id}`;
        if (convId !== dmKey && !convId.startsWith('dm_')) {
          setSelectedConvId(dmKey);
        }
        // Ensure this partner is visible in the conversations list!
        setConversations((prev) => {
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

      // Mark conversation read on server and update unread count badges everywhere
      api.markConversationRead(convId).catch(() => {});
      setConversations((prev) =>
        prev.map((c) =>
          isConvMatch(c, convId) || (data?.partner?.id && (c.partner_id === data.partner.id || c.conversation_id === `dm_${data.partner.id}`))
            ? { ...c, unread_count: 0 }
            : c
        )
      );
      window.dispatchEvent(new CustomEvent('rentu:messages-updated'));
      window.dispatchEvent(new CustomEvent('rentu:notifications-updated'));
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Close active chat from right side
  const handleCloseChat = () => {
    hasUserClosedChatRef.current = true;
    setSelectedConvId(null);
    setActivePartnerData(null);
    setActiveBookingData(null);
    setMessages([]);
    setShowMobileThread(false);
    setEditingMessageId(null);
  };

  // Open Custom Pop-up for Deleting Conversation
  const handleDeleteConversation = (convId: string, partnerName?: string) => {
    setDeleteTarget({
      type: 'CONVERSATION',
      id: convId,
      name: partnerName || 'Neighbor',
    });
  };

  // Open Custom Pop-up for Deleting Message
  const handleDeleteMessage = (messageId: string) => {
    setDeleteTarget({
      type: 'MESSAGE',
      id: messageId,
    });
  };

  // Execute Confirmed Deletion
  const confirmDelete = async () => {
    if (!deleteTarget || isDeletingChat) return;
    setIsDeletingChat(true);

    try {
      if (deleteTarget.type === 'CONVERSATION') {
        const convId = deleteTarget.id;
        await api.deleteConversation(convId);
        setConversations((prev) =>
          prev.filter((c) => !isConvMatch(c, convId) && c.conversation_id !== convId)
        );

        const isActive =
          Boolean(selectedConvId) && (
            selectedConvId === convId ||
            isConvMatch({ conversation_id: convId, booking_id: convId, partner_id: convId } as any, selectedConvId)
          );

        if (isActive) {
          handleCloseChat();
        }
      } else if (deleteTarget.type === 'MESSAGE') {
        const messageId = deleteTarget.id;
        await api.deleteMessage(messageId);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));

        // Update conversations if needed
        setConversations((prev) =>
          prev.map((c) => {
            const match = isConvMatch(c, selectedConvId);
            return match ? { ...c, last_message: 'Message deleted' } : c;
          })
        );
      }
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('Failed to delete:', err);
      alert(err.message || 'Failed to delete. Please try again.');
    } finally {
      setIsDeletingChat(false);
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
          const match = isConvMatch(c, selectedConvId);
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

  const activeConversation: Conversation | null = selectedConvId
    ? (conversations.find((c) => isConvMatch(c, selectedConvId)) ||
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
        : null))
    : null;

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
      is_delivered: false,
      is_read: false,
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
        const exists = prev.some((c) => isConvMatch(c, selectedConvId));
        if (exists) {
          return prev.map((c) => {
            const match = isConvMatch(c, selectedConvId);
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

  const handleProposalSubmit = async (proposalPayload: MessageProposalData, summaryText: string) => {
    if (!selectedConvId) return;

    const receiverId = activeConversation?.partner_id || (selectedConvId.startsWith('dm_') ? selectedConvId.replace('dm_', '') : '');
    if (!receiverId) return;

    setSendError(null);

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
      is_delivered: false,
      is_read: false,
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

      loadConversations();
    } catch (err: any) {
      console.error('Failed to create proposal:', err);
      setSendError(err.message || 'Failed to send custom proposal.');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw err;
    }
  };

  // WhatsApp-Style Attachment Senders
  const handleSendAttachmentMessage = async (opts: {
    content: string;
    message_type: 'IMAGE' | 'LOCATION' | 'CONTACT' | 'DOCUMENT' | string;
    proposal_data?: any;
  }) => {
    if (!selectedConvId) return;
    const receiverId = activeConversation?.partner_id || (selectedConvId.startsWith('dm_') ? selectedConvId.replace('dm_', '') : '');
    if (!receiverId) return;

    setSendError(null);
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      booking_id: activeConversation?.booking_id || undefined,
      sender_id: user?.id || 'me',
      sender_name: user?.name || 'You',
      receiver_id: receiverId,
      content: opts.content,
      message_type: opts.message_type as any,
      proposal_data: opts.proposal_data,
      created_at: new Date().toISOString(),
      is_delivered: false,
      is_read: false,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const realMsg = await api.sendMessage(
        activeConversation?.booking_id || null,
        receiverId,
        opts.content,
        opts.message_type,
        opts.proposal_data
      );

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...realMsg, sender_name: user?.name || 'You' } : m))
      );

      setConversations((prev) =>
        prev.map((c) => {
          const match = isConvMatch(c, selectedConvId);
          const label =
            opts.message_type === 'IMAGE'
              ? 'Photo'
              : opts.message_type === 'VIDEO'
              ? 'Video'
              : opts.message_type === 'FILE'
              ? (opts.proposal_data?.file_name || 'Document')
              : opts.message_type === 'LOCATION'
              ? 'Shared Location'
              : opts.message_type === 'CONTACT'
              ? 'Contact Card'
              : opts.message_type === 'DOCUMENT'
              ? 'Document Note'
              : opts.content;
          return match
            ? { ...c, last_message: label, last_message_at: new Date().toISOString() }
            : c;
        })
      );
    } catch (err: any) {
      console.error('Failed to send attachment message:', err);
      setSendError(err.message || 'Failed to send attachment.');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  // WhatsApp Attachment Handler 1: Photos & Videos
  const handleMediaSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 25 * 1024 * 1024) {
      alert('File is too large (maximum 25MB). Please choose a smaller file.');
      return;
    }

    const isVideo = file.type.startsWith('video/');
    try {
      setIsUploadingPhoto(true);
      const url = await uploadItemPhoto(file, isVideo ? 'chat_videos' : 'chat_photos');
      await handleSendAttachmentMessage({
        content: isVideo ? 'Video' : 'Photo',
        message_type: isVideo ? 'VIDEO' : 'IMAGE',
        proposal_data: {
          [isVideo ? 'video_url' : 'image_url']: url,
          file_name: file.name,
          file_size: file.size,
          media_type: isVideo ? 'video' : 'image',
        },
      });
    } catch (err: any) {
      console.error('Media upload failed:', err);
      alert(err.message || 'Failed to upload media. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // WhatsApp Attachment Handler 2: Documents & Files
  const handleDocumentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 25 * 1024 * 1024) {
      alert('File is too large (maximum 25MB). Please choose a smaller file.');
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const url = await uploadItemPhoto(file, 'chat_files');
      await handleSendAttachmentMessage({
        content: file.name,
        message_type: 'FILE',
        proposal_data: {
          file_url: url,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || 'document',
        },
      });
    } catch (err: any) {
      console.error('Document upload failed:', err);
      alert(err.message || 'Failed to upload document. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // WhatsApp Option 1: Send Exact Current GPS Location
  const handleShareCurrentLocation = async (locToUse?: ResolvedLocation) => {
    try {
      setIsSendingLocation(true);
      let loc = locToUse || detectedGpsLocation;
      if (!loc) {
        setIsDetectingLocation(true);
        loc = await detectCurrentLocation({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
        setDetectedGpsLocation(loc);
      }

      const addr = [loc.address_text, loc.locality, loc.city].filter(Boolean).join(', ') || 'Current Location';
      const mapsUrl = getGoogleMapsUrl(loc.latitude, loc.longitude, addr);
      const directionsUrl = getGoogleMapsDirectionsUrl(loc.latitude, loc.longitude, addr);

      await handleSendAttachmentMessage({
        content: `📍 Current Location: ${addr}`,
        message_type: 'LOCATION',
        proposal_data: {
          location_type: 'CURRENT',
          address: addr,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy || 12,
          locality: loc.locality || loc.city,
          google_maps_url: mapsUrl,
          directions_url: directionsUrl,
          shared_at: new Date().toISOString(),
        },
      });
      setIsLocationModalOpen(false);
    } catch (err: any) {
      console.error('Failed to detect GPS location:', err);
      alert(err.message || 'Could not acquire your precise GPS location. Please allow browser location permissions.');
    } finally {
      setIsSendingLocation(false);
      setIsDetectingLocation(false);
    }
  };

  // WhatsApp Option 2: Share Real-Time Live Location (15m, 1h, 8h)
  const handleShareLiveLocation = async (durationMins: number = liveDurationMinutes) => {
    try {
      setIsSendingLocation(true);
      let loc = detectedGpsLocation;
      if (!loc) {
        setIsDetectingLocation(true);
        loc = await detectCurrentLocation({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
        setDetectedGpsLocation(loc);
      }

      const addr = [loc.address_text, loc.locality, loc.city].filter(Boolean).join(', ') || 'Live Location';
      const expiresAt = new Date(Date.now() + durationMins * 60 * 1000).toISOString();
      const mapsUrl = getGoogleMapsUrl(loc.latitude, loc.longitude, addr);
      const directionsUrl = getGoogleMapsDirectionsUrl(loc.latitude, loc.longitude, addr);

      await handleSendAttachmentMessage({
        content: `🟢 Live Location (${durationMins >= 60 ? `${durationMins / 60}h` : `${durationMins}m`})`,
        message_type: 'LOCATION',
        proposal_data: {
          location_type: 'LIVE',
          is_live: true,
          duration_minutes: durationMins,
          started_at: new Date().toISOString(),
          expires_at: expiresAt,
          address: addr,
          locality: loc.locality || loc.city,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy || 10,
          comment: liveLocationComment.trim() || undefined,
          google_maps_url: mapsUrl,
          directions_url: directionsUrl,
        },
      });
      setIsLocationModalOpen(false);
      setLocationModalTab('options');
      setLiveLocationComment('');
    } catch (err: any) {
      console.error('Failed to start live location:', err);
      alert(err.message || 'Could not start live location sharing. Please check location permissions.');
    } finally {
      setIsSendingLocation(false);
      setIsDetectingLocation(false);
    }
  };

  // Stop Live Location Sharing
  const handleStopLiveLocation = async (messageId: string, currentProposalData: any) => {
    try {
      const updatedData = {
        ...currentProposalData,
        is_live: false,
        stopped_at: new Date().toISOString(),
      };
      await api.editMessage(messageId, undefined, updatedData);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, proposal_data: updatedData } : m
        )
      );
    } catch (err: any) {
      console.error('Failed to stop live location sharing:', err);
      alert('Could not update live location status.');
    }
  };

  // WhatsApp Option 3: Share Profile Saved Location or Custom Spot
  const handleShareSavedLocation = async (locText: string, lat?: number, lon?: number) => {
    if (!locText.trim()) return;
    try {
      setIsSendingLocation(true);
      const effectiveLat = typeof lat === 'number' && !isNaN(lat) ? lat : detectedGpsLocation?.latitude;
      const effectiveLon = typeof lon === 'number' && !isNaN(lon) ? lon : detectedGpsLocation?.longitude;
      const mapsUrl = getGoogleMapsUrl(effectiveLat, effectiveLon, locText.trim());
      const directionsUrl = getGoogleMapsDirectionsUrl(effectiveLat, effectiveLon, locText.trim());

      await handleSendAttachmentMessage({
        content: `📍 Meetup Spot: ${locText.trim()}`,
        message_type: 'LOCATION',
        proposal_data: {
          location_type: 'SAVED',
          address: locText.trim(),
          latitude: effectiveLat,
          longitude: effectiveLon,
          google_maps_url: mapsUrl,
          directions_url: directionsUrl,
          shared_at: new Date().toISOString(),
        },
      });
      setCustomLocationText('');
      setIsLocationModalOpen(false);
    } catch (err: any) {
      console.error('Failed to share saved location:', err);
      alert(err.message || 'Could not send location.');
    } finally {
      setIsSendingLocation(false);
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
            Sign In to Open Messages
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
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2 sm:py-6 h-[calc(100dvh-8rem)] sm:h-[calc(100dvh-8.5rem)] lg:h-[calc(100vh-4.5rem)] flex flex-col min-h-0">
      
      {/* Page Shell: Clean 2-Pane Messenger */}
      <div className="bg-surface border border-divider rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        
        {/* Top Header Bar */}
        <div className={`shrink-0 px-4 sm:px-6 py-2.5 sm:py-3.5 border-b border-divider flex items-center justify-between bg-surface/80 backdrop-blur-sm ${showMobileThread ? 'hidden md:flex' : 'flex'}`}>
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
                  const isSelected = isConvMatch(chat, selectedConvId);
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
                        if (isSelected) {
                          handleCloseChat();
                        } else {
                          hasUserClosedChatRef.current = false;
                          setSelectedConvId(chatKey);
                          setShowMobileThread(true);
                        }
                      }}
                      className={`p-3.5 sm:p-4 flex items-start gap-3 cursor-pointer transition-all group relative ${
                        isSelected 
                          ? 'bg-surface font-bold border-l-4 border-brand shadow-xs' 
                          : 'hover:bg-surface/70'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <img
                          src={partnerAvatar}
                          alt={chat.partner_name || 'Member'}
                          className="w-12 h-12 rounded-full object-cover shrink-0 border border-divider"
                        />
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-surface shrink-0" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="font-bold text-ink truncate text-sm">{chat.partner_name || 'Neighbor'}</span>
                          <div className="flex items-center gap-1.5 shrink-0 pl-1">
                            {chat.last_message_at && (
                              <span className="text-[10px] text-ink-muted">
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
                        <div className="flex items-center justify-between gap-1.5">
                          <p className={`text-xs truncate ${chat.unread_count && chat.unread_count > 0 ? 'font-bold text-ink' : 'text-ink-secondary font-medium'}`}>
                            {chat.last_message || 'Sent a message'}
                          </p>
                          {Boolean(chat.unread_count && chat.unread_count > 0) && (
                            <span className="min-w-[18px] h-4.5 px-1.5 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm animate-in zoom-in-75 duration-150">
                              {(chat.unread_count ?? 0) > 9 ? '9+' : chat.unread_count}
                            </span>
                          )}
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
                {/* Active Chat Header (Instagram Style) */}
                <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-divider flex items-center justify-between gap-3 bg-surface z-10">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setShowMobileThread(false)}
                      className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-canvas text-ink-secondary hover:text-ink cursor-pointer shrink-0"
                      title="Back to conversation list"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    
                    <div className="relative shrink-0">
                      <img
                        src={
                          activeConversation.partner_avatar ||
                          (activeConversation.partner_name
                            ? `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConversation.partner_name)}&background=0F172A&color=fff&bold=true`
                            : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')
                        }
                        alt={activeConversation.partner_name || 'Member'}
                        onClick={() => {
                          const target = activeConversation.partner_username || activeConversation.partner_id;
                          if (target) onOpenUserProfile?.(target);
                        }}
                        className="w-10 h-10 rounded-full object-cover border border-divider cursor-pointer hover:ring-2 hover:ring-brand hover:scale-105 transition-all"
                        title={`View ${activeConversation.partner_name || 'Member'}'s public profile`}
                      />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface shrink-0" title="Active now" />
                    </div>

                    <div 
                      onClick={() => {
                        const target = activeConversation.partner_username || activeConversation.partner_id;
                        if (target) onOpenUserProfile?.(target);
                      }}
                      className="min-w-0 cursor-pointer group"
                    >
                      <h2 
                        className="text-sm sm:text-base font-black text-ink truncate font-display group-hover:text-brand transition-colors"
                        title={`View ${activeConversation.partner_name || 'Member'}'s public profile`}
                      >
                        {activeConversation.partner_name || 'Neighbor'}
                      </h2>
                      <div className="text-[11px] text-ink-secondary flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>Active now</span>
                        {activeConversation.partner_username && (
                          <>
                            <span>•</span>
                            <span className="text-ink-muted">@{activeConversation.partner_username}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Header Right Actions (Custom Deal, Details, Close) */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    {/* Launch Personal Listing / Request Proposal Button */}
                    <button
                      type="button"
                      onClick={() => setIsCreateProposalOpen(true)}
                      className="btn-primary text-[11px] px-3 py-1.5 font-bold shadow-pink rounded-full inline-flex items-center gap-1 cursor-pointer transition-transform hover:scale-105"
                      title="Create Custom Deal / Rental Offer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span className="hidden sm:inline">Custom Deal</span>
                    </button>

                    {/* Instagram Details Button (i) - Where Delete Chat & Profile details live! */}
                    <button
                      type="button"
                      onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                        isDetailsOpen
                          ? 'bg-brand text-white border-brand'
                          : 'bg-canvas hover:bg-surface border-divider text-ink-secondary hover:text-ink'
                      }`}
                      title="Conversation Details"
                    >
                      <Info className="w-4 h-4" />
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
                  {/* Instagram Profile Hero Header at top of thread */}
                  <div className="pt-4 pb-6 text-center flex flex-col items-center justify-center space-y-2 border-b border-divider/40 mb-4">
                    <img
                      src={
                        activeConversation.partner_avatar ||
                        (activeConversation.partner_name
                          ? `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConversation.partner_name)}&background=0F172A&color=fff&bold=true`
                          : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')
                      }
                      alt={activeConversation.partner_name || 'Member'}
                      onClick={() => {
                        const target = activeConversation.partner_username || activeConversation.partner_id;
                        if (target) onOpenUserProfile?.(target);
                      }}
                      className="w-20 h-20 rounded-full object-cover border-2 border-divider cursor-pointer hover:scale-105 hover:ring-2 hover:ring-brand transition-all shadow-md"
                    />
                    <div>
                      <h3 
                        onClick={() => {
                          const target = activeConversation.partner_username || activeConversation.partner_id;
                          if (target) onOpenUserProfile?.(target);
                        }}
                        className="text-base font-black text-ink font-display cursor-pointer hover:underline"
                      >
                        {activeConversation.partner_name || 'Neighbor'}
                      </h3>
                      <p className="text-xs text-ink-secondary">
                        {activeConversation.partner_username ? `@${activeConversation.partner_username}` : 'Community Member'} • RentU
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const target = activeConversation.partner_username || activeConversation.partner_id;
                        if (target) onOpenUserProfile?.(target);
                      }}
                      className="px-4 py-1.5 rounded-full bg-surface hover:bg-canvas border border-divider text-xs font-bold text-ink transition-colors cursor-pointer shadow-xs"
                    >
                      View Profile
                    </button>
                  </div>

                  {isLoadingMessages ? (
                    <div className="py-20 text-center text-xs text-ink-secondary flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                      <span>Loading messages...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-8 text-center space-y-2 text-ink-secondary">
                      <div className="w-12 h-12 rounded-full bg-brand-soft text-brand flex items-center justify-center mx-auto mb-2">
                        <MessageSquare className="w-6 h-6 text-brand" />
                      </div>
                      <p className="text-sm font-bold text-ink">Say Hello</p>
                      <p className="text-xs max-w-sm mx-auto text-ink-secondary">
                        Send a message to start chatting with {activeConversation.partner_name || 'your neighbor'}.
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMe =
                        m.sender_id === (user?.id || 'me') ||
                        (Boolean(user?.id) && m.sender_id === user?.id) ||
                        (Boolean(user?.firebase_uid) && m.sender_id === user?.firebase_uid);

                      const formattedTime = m.created_at
                        ? new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                        : 'Just now';

                      const pData = m.proposal_data
                        ? (typeof m.proposal_data === 'string' ? (() => { try { return JSON.parse(m.proposal_data); } catch { return null; } })() : m.proposal_data)
                        : null;

                      const isSystemMessage =
                        m.message_type === 'SYSTEM' ||
                        m.content?.startsWith('Proposal accepted.') ||
                        m.content?.startsWith('Product received and handed over') ||
                        m.content?.startsWith('Product returned to owner') ||
                        m.content?.startsWith('Renter has sent the payment via');

                      // 1. SYSTEM Announcement Messages (Deal confirmation, milestones)
                      if (isSystemMessage) {
                        return (
                          <div key={m.id} className="flex justify-center my-3">
                            <div className="max-w-md bg-surface/90 border border-brand/20 rounded-2xl px-4 py-2.5 text-center text-xs text-ink shadow-xs">
                              <span className="font-semibold text-ink leading-relaxed">{m.content}</span>
                              <span className="block text-[10px] text-ink-secondary mt-1">{formattedTime}</span>
                            </div>
                          </div>
                        );
                      }

                      // 2. PROPOSAL Messages (Personal Listing or Custom Request Deal Card)
                      if (m.message_type === 'PROPOSAL' && pData) {
                        const linkedStatus = (m as any).linked_booking_status ||
                          (m.booking_id && m.booking_id === activeConversation?.booking_id ? activeConversation?.booking_status : undefined);

                        const isAccepted = pData.status === 'ACCEPTED' ||
                          linkedStatus === 'ACCEPTED' ||
                          linkedStatus === 'HANDED_OVER' ||
                          linkedStatus === 'COMPLETED';

                        const isDeclined = pData.status === 'DECLINED' ||
                          pData.status === 'REJECTED' ||
                          linkedStatus === 'REJECTED' ||
                          linkedStatus === 'CANCELLED';

                        const isPending = !isAccepted && !isDeclined;

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
                                    <span className="text-[10px] font-black uppercase tracking-wider text-brand block truncate">
                                      {pData.type === 'RENTAL_REQUEST'
                                        ? 'Rental Request'
                                        : pData.type === 'LISTING'
                                        ? 'Personal Gear Offer'
                                        : 'Custom Gear Request'}
                                    </span>
                                    <span className="text-[11px] font-bold text-ink-secondary truncate block">
                                      {pData.type === 'RENTAL_REQUEST' ? 'Listing Booking Proposal' : 'Direct Agreement Proposal'}
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
                                  {isAccepted ? 'Accepted & Booked' : isDeclined ? 'Declined' : 'Pending Review'}
                                </span>
                              </div>

                              {/* Title & Terms */}
                              <div className="py-3 space-y-2.5">
                                {(pData.image_url || (Array.isArray(pData.item_images) && pData.item_images[0])) && (
                                  <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden bg-black/10 border border-divider">
                                    <img
                                      src={pData.image_url || (Array.isArray(pData.item_images) && pData.item_images[0])}
                                      alt={pData.title || pData.item_title}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="text-sm font-black text-ink font-display leading-tight">
                                    {pData.title || pData.item_title || 'Rental Gear'}
                                  </h3>
                                  {pData.category && (
                                    <span className="text-[10px] font-bold text-ink-secondary bg-canvas px-2 py-0.5 rounded-full border border-divider shrink-0">
                                      {pData.category}
                                    </span>
                                  )}
                                </div>

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
                                    <span className="font-bold text-ink text-[11px] block truncate">
                                      {pData.start_date} {pData.start_time ? `(${formatTime12(pData.start_time)})` : ''}
                                    </span>
                                    <span className="text-[10px] text-ink-secondary block truncate">
                                      to {pData.end_date || 'End Date'} {pData.end_time ? `(${formatTime12(pData.end_time)})` : ''}
                                    </span>
                                  </div>
                                </div>

                                {/* Handover Preferences & Addresses */}
                                <div className="space-y-1.5">
                                  <div className="text-[11px] text-ink-secondary flex items-center gap-1.5 bg-canvas/60 px-3 py-1.5 rounded-xl border border-divider/40">
                                    <Truck className="w-3.5 h-3.5 text-brand shrink-0" />
                                    <span className="truncate">
                                      {pData.requires_delivery || pData.pickup_type === 'MY_LOCATION' || pData.delivery_option === 'LENDER_DELIVERY'
                                        ? `Owner Delivery (+₹${pData.delivery_fee || 0}) to ${pData.pickup_locality || pData.delivery_location || 'Recipient Location'}`
                                        : `Borrower Self Pickup at ${pData.pickup_locality || 'Lender Location'}`}
                                    </span>
                                  </div>

                                  {(pData.requires_pickup || pData.return_type === 'MY_LOCATION' || pData.collection_option === 'LENDER_COLLECT') && (
                                    <div className="text-[11px] text-ink-secondary flex items-center gap-1.5 bg-canvas/60 px-3 py-1.5 rounded-xl border border-divider/40">
                                      <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                      <span className="truncate">
                                        Return: Owner Collects (+₹${pData.pickup_fee || pData.collection_fee || 0}) from {pData.return_locality || pData.return_location || 'Location'}
                                      </span>
                                    </div>
                                  )}
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
                                              <span>Accept Request & Book</span>
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
                                {isMe && renderMessageTicks(m, false)}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 3. IMAGE / PHOTO MESSAGE (WhatsApp Style)
                      if (m.message_type === 'IMAGE' || (pData?.image_url && !pData.total_price)) {
                        const imgUrl = pData?.image_url || m.content;
                        return (
                          <div
                            key={m.id}
                            className={`flex items-end gap-2 my-1 group ${isMe ? 'justify-end' : 'justify-start'}`}
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

                            {isMe && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-all text-ink-muted mb-1 order-first cursor-pointer"
                                title="Delete photo"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}

                            <div className="rounded-2xl sm:rounded-3xl overflow-hidden max-w-[280px] sm:max-w-[340px] border border-divider/80 bg-surface shadow-xs">
                              <div
                                onClick={() => setPreviewImageUrl(imgUrl)}
                                className="relative group/img cursor-pointer overflow-hidden bg-black/10"
                              >
                                <img
                                  src={imgUrl}
                                  alt="Shared photo"
                                  className="w-full max-h-[320px] object-cover transition-transform duration-200 group-hover/img:scale-102"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                                    Click to expand
                                  </span>
                                </div>
                              </div>
                              {pData?.caption && (
                                <p className="px-3 pt-2 text-xs font-medium text-ink leading-relaxed">
                                  {pData.caption}
                                </p>
                              )}
                              <div className="px-3 py-1.5 flex items-center justify-end gap-1 text-[9px] text-ink-secondary">
                                <span>{formattedTime}</span>
                                {isMe && renderMessageTicks(m, false)}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 3b. VIDEO MESSAGE (WhatsApp Style)
                      if (m.message_type === 'VIDEO' || pData?.video_url) {
                        const videoUrl = pData?.video_url || m.content;
                        return (
                          <div
                            key={m.id}
                            className={`flex items-end gap-2 my-1 group ${isMe ? 'justify-end' : 'justify-start'}`}
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

                            {isMe && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-all text-ink-muted mb-1 order-first cursor-pointer"
                                title="Delete video"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}

                            <div className="rounded-2xl sm:rounded-3xl overflow-hidden max-w-[280px] sm:max-w-[340px] border border-divider/80 bg-surface shadow-xs">
                              <video
                                src={videoUrl}
                                controls
                                preload="metadata"
                                className="w-full max-h-[320px] bg-black object-contain"
                              />
                              {pData?.file_name && (
                                <p className="px-3 pt-2 text-xs font-medium text-ink truncate">
                                  {pData.file_name}
                                </p>
                              )}
                              <div className="px-3 py-1.5 flex items-center justify-end gap-1 text-[9px] text-ink-secondary">
                                <span>{formattedTime}</span>
                                {isMe && renderMessageTicks(m, false)}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 3c. DOCUMENT / FILE MESSAGE (WhatsApp Style)
                      if (m.message_type === 'FILE' || (pData?.file_url && !pData.total_price)) {
                        const fileUrl = pData?.file_url || m.content;
                        const fileName = pData?.file_name || m.content || 'Document';
                        const fileSize = pData?.file_size
                          ? pData.file_size / (1024 * 1024) >= 1
                            ? `${(pData.file_size / (1024 * 1024)).toFixed(1)} MB`
                            : `${Math.max(1, Math.round(pData.file_size / 1024))} KB`
                          : null;

                        return (
                          <div
                            key={m.id}
                            className={`flex items-end gap-2 my-1 group ${isMe ? 'justify-end' : 'justify-start'}`}
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

                            {isMe && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-all text-ink-muted mb-1 order-first cursor-pointer"
                                title="Delete file"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}

                            <div className="w-full max-w-[280px] sm:max-w-xs rounded-2xl sm:rounded-3xl p-3 border border-divider/80 bg-surface shadow-xs space-y-2">
                              <div className="flex items-center gap-2.5 bg-canvas/80 p-2.5 rounded-xl border border-divider">
                                <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-ink truncate" title={fileName}>
                                    {fileName}
                                  </p>
                                  {fileSize && (
                                    <span className="text-[10px] text-ink-secondary block">
                                      {fileSize}
                                    </span>
                                  )}
                                </div>
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={fileName}
                                  className="w-8 h-8 rounded-full bg-surface hover:bg-divider border border-divider flex items-center justify-center text-ink shrink-0 transition-colors"
                                  title="Download / Open file"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                              <div className="flex items-center justify-end gap-1 text-[9px] text-ink-secondary px-1">
                                <span>{formattedTime}</span>
                                {isMe && renderMessageTicks(m, false)}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 4. LOCATION MESSAGE (WhatsApp Style: Live, Current GPS, or Saved Meetup Spot)
                      if (m.message_type === 'LOCATION' || pData?.address) {
                        const addrText = pData?.address || m.content.replace(/^📍\s*(Current Location|Meetup Spot):\s*/i, '').replace(/^🟢\s*Live Location[^\n]*\n?/i, '').replace(/^Location:\s*/i, '');
                        const isLive = pData?.location_type === 'LIVE' || Boolean(pData?.is_live);
                        const isExpired = isLive && pData?.expires_at ? new Date(pData.expires_at).getTime() < Date.now() : false;
                        const isLiveActive = isLive && !pData?.stopped_at && !isExpired;
                        const isCurrentLocation = pData?.location_type === 'CURRENT';

                        const mapsUrl = pData?.google_maps_url || getGoogleMapsUrl(pData?.latitude, pData?.longitude, addrText);
                        const directionsUrl = pData?.directions_url || getGoogleMapsDirectionsUrl(pData?.latitude, pData?.longitude, addrText);
                        const hasCoords = typeof pData?.latitude === 'number' && typeof pData?.longitude === 'number' && !isNaN(pData.latitude) && !isNaN(pData.longitude) && (pData.latitude !== 0 || pData.longitude !== 0);

                        const formattedExpiresAt = pData?.expires_at ? new Date(pData.expires_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null;

                        return (
                          <div
                            key={m.id}
                            className={`flex items-end gap-2 my-1.5 group ${isMe ? 'justify-end' : 'justify-start'}`}
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

                            {isMe && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-all text-ink-muted mb-1 order-first cursor-pointer"
                                title="Delete location"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}

                            <div className="w-full max-w-[290px] sm:max-w-xs rounded-2xl sm:rounded-3xl border border-divider bg-surface shadow-xs overflow-hidden">
                              {/* Visual Map / Radar Header */}
                              <div className="relative h-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center overflow-hidden border-b border-divider">
                                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#22c55e_1px,transparent_1px)] [background-size:14px_14px]" />
                                <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-90" />

                                {isLiveActive ? (
                                  <div className="relative flex flex-col items-center justify-center text-center z-10 space-y-1">
                                    <div className="relative flex items-center justify-center">
                                      <span className="absolute w-12 h-12 rounded-full bg-emerald-500/20 animate-ping" />
                                      <span className="absolute w-8 h-8 rounded-full bg-emerald-500/40" />
                                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/50">
                                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1 shadow-xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                      Live Location
                                    </span>
                                  </div>
                                ) : isLive ? (
                                  <div className="relative flex flex-col items-center justify-center text-center z-10 space-y-1 text-ink-muted">
                                    <div className="w-8 h-8 rounded-full bg-canvas border border-divider flex items-center justify-center text-ink-muted">
                                      <Radio className="w-4 h-4 opacity-50" />
                                    </div>
                                    <span className="text-[10px] font-bold text-ink-secondary bg-canvas/80 px-2 py-0.5 rounded-full border border-divider">
                                      Live location ended
                                    </span>
                                  </div>
                                ) : (
                                  <div className="relative flex flex-col items-center justify-center text-center z-10 space-y-1">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg">
                                      <LocateFixed className="w-4 h-4 animate-pulse" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40">
                                      {isCurrentLocation ? 'Current GPS Location' : 'Meetup Spot'}
                                    </span>
                                  </div>
                                )}

                                {hasCoords && (
                                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
                                    {pData?.accuracy ? `±${pData.accuracy}m` : 'GPS Pin'}
                                  </div>
                                )}
                              </div>

                              {/* Card Body */}
                              <div className="p-3.5 space-y-2.5">
                                {pData?.comment && (
                                  <p className="text-xs font-semibold text-brand italic bg-brand-soft/40 px-2.5 py-1.5 rounded-xl border border-brand/20">
                                    "{pData.comment}"
                                  </p>
                                )}

                                <div className="space-y-1">
                                  <p className="text-xs text-ink font-semibold leading-relaxed line-clamp-2">
                                    {addrText}
                                  </p>
                                  {hasCoords && (
                                    <p className="text-[10px] text-ink-muted font-mono">
                                      {pData.latitude.toFixed(5)}, {pData.longitude.toFixed(5)}
                                    </p>
                                  )}
                                  {isLiveActive && formattedExpiresAt && (
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      Live until {formattedExpiresAt}
                                    </p>
                                  )}
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-1.5 pt-1">
                                  <a
                                    href={mapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                                  >
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span>Open in Google Maps</span>
                                    <ExternalLink className="w-3 h-3 opacity-80" />
                                  </a>

                                  {hasCoords && (
                                    <a
                                      href={directionsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl bg-canvas hover:bg-surface border border-divider text-ink text-[11px] font-bold transition-all cursor-pointer"
                                    >
                                      <Navigation className="w-3 h-3 text-emerald-500" />
                                      <span>Get Directions</span>
                                    </a>
                                  )}

                                  {isLiveActive && isMe && (
                                    <button
                                      type="button"
                                      onClick={() => handleStopLiveLocation(m.id, pData)}
                                      className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-extrabold border border-red-500/30 transition-all cursor-pointer"
                                    >
                                      <StopCircle className="w-3.5 h-3.5" />
                                      <span>Stop Sharing Live Location</span>
                                    </button>
                                  )}
                                </div>

                                {/* Timestamp & Status */}
                                <div className="text-[9px] flex items-center justify-between text-ink-secondary pt-1 border-t border-divider">
                                  <span className="text-[9px] text-ink-muted">
                                    {isLiveActive ? 'Live tracking' : isCurrentLocation ? 'Precise GPS' : 'Handover spot'}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <span>{formattedTime}</span>
                                    {isMe && renderMessageTicks(m, false)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 5. CONTACT CARD MESSAGE (WhatsApp Style)
                      if (m.message_type === 'CONTACT' || (pData?.phone && !pData.total_price)) {
                        const cName = pData?.name || m.sender_name || 'Neighbor';
                        const cPhone = pData?.phone || '';
                        return (
                          <div
                            key={m.id}
                            className={`flex items-end gap-2 my-1 group ${isMe ? 'justify-end' : 'justify-start'}`}
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

                            {isMe && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-all text-ink-muted mb-1 order-first cursor-pointer"
                                title="Delete contact"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}

                            <div className="w-full max-w-[280px] sm:max-w-xs rounded-2xl sm:rounded-3xl p-3.5 border border-blue-500/30 bg-surface shadow-xs space-y-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                  <UserIcon className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider block">
                                    Contact Card
                                  </span>
                                  <span className="text-xs font-black text-ink truncate block">
                                    {cName}
                                  </span>
                                  {pData?.locality && (
                                    <span className="text-[10px] text-ink-secondary truncate block">
                                      {pData.locality}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="p-2.5 bg-canvas rounded-xl border border-divider text-xs font-bold text-ink flex items-center justify-between">
                                <span>{cPhone || 'Phone shared'}</span>
                                {cPhone && (
                                  <a
                                    href={`tel:${cPhone}`}
                                    className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>Call</span>
                                  </a>
                                )}
                              </div>
                              <div className="text-[9px] flex items-center justify-end gap-1 text-ink-secondary">
                                <span>{formattedTime}</span>
                                {isMe && renderMessageTicks(m, false)}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 6. CONDITION / INSPECTION NOTE (WhatsApp Style)
                      if (m.message_type === 'DOCUMENT' || (pData?.notes && !pData.total_price)) {
                        return (
                          <div
                            key={m.id}
                            className={`flex items-end gap-2 my-1 group ${isMe ? 'justify-end' : 'justify-start'}`}
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

                            {isMe && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-all text-ink-muted mb-1 order-first cursor-pointer"
                                title="Delete document"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}

                            <div className="w-full max-w-[280px] sm:max-w-xs rounded-2xl sm:rounded-3xl p-3.5 border border-indigo-500/30 bg-surface shadow-xs space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                  <ClipboardCheck className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider block">
                                    Condition Check
                                  </span>
                                  <span className="text-xs font-bold text-ink truncate block">
                                    {pData?.title || 'Handover Inspection'}
                                  </span>
                                </div>
                              </div>
                              <div className="p-2.5 bg-canvas rounded-xl border border-divider text-xs text-ink-secondary leading-relaxed font-medium">
                                {pData?.notes || m.content}
                              </div>
                              <div className="text-[9px] flex items-center justify-end gap-1 text-ink-secondary">
                                <span>{formattedTime}</span>
                                {isMe && renderMessageTicks(m, false)}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 7. STANDARD CHAT TEXT MESSAGE (Instagram Style)
                      return (
                        <div
                          key={m.id}
                          className={`flex items-end gap-2 group my-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}
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

                          {/* Hover Actions: Edit/Delete for own messages */}
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
                            className={`relative max-w-[80%] sm:max-w-[70%] rounded-[20px] px-4 py-2.5 text-xs font-medium leading-relaxed shadow-xs break-words whitespace-pre-wrap ${
                              isMe
                                ? 'bg-brand text-white rounded-br-[4px]'
                                : 'bg-surface border border-divider text-ink rounded-bl-[4px]'
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
                                  {isMe && renderMessageTicks(m, true)}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Photo upload status banner if currently uploading */}
                {isUploadingPhoto && (
                  <div className="shrink-0 px-4 py-2 bg-brand/10 border-t border-brand/20 flex items-center justify-between text-xs font-bold text-brand animate-pulse">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading and sharing photo with neighbor...</span>
                    </div>
                  </div>
                )}

                {/* Reply Input Bar (WhatsApp Style) */}
                <form
                  onSubmit={handleSendMessage}
                  className="shrink-0 p-2.5 sm:p-3 border-t border-divider bg-surface flex items-center gap-2 relative"
                >
                  {/* WhatsApp Attachment Plus (+) Button & Popup Menu */}
                  <div className="relative shrink-0" ref={attachmentMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        isAttachmentMenuOpen
                          ? 'bg-brand text-white rotate-45 shadow-sm'
                          : 'bg-canvas hover:bg-divider/50 border border-divider text-ink-secondary hover:text-ink'
                      }`}
                      title="Attach Photos, Videos, Files or Location"
                    >
                      <Plus className="w-5 h-5 transition-transform" />
                    </button>

                    {/* WhatsApp Attachment Popup Menu */}
                    {isAttachmentMenuOpen && (
                      <div className="absolute bottom-12 sm:bottom-14 left-0 z-50 bg-surface/98 backdrop-blur-md border border-divider rounded-2xl p-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 w-56 space-y-1">
                        {/* Photos & Videos */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachmentMenuOpen(false);
                            mediaFileInputRef.current?.click();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-canvas text-ink transition-colors cursor-pointer text-left text-xs font-semibold group"
                        >
                          <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-ink">Photos & Videos</div>
                            <div className="text-[10px] text-ink-secondary">Share gear photos or clips</div>
                          </div>
                        </button>

                        {/* Document / Files */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachmentMenuOpen(false);
                            docFileInputRef.current?.click();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-canvas text-ink transition-colors cursor-pointer text-left text-xs font-semibold group"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-ink">Document / File</div>
                            <div className="text-[10px] text-ink-secondary">Share PDFs, notes, or receipts</div>
                          </div>
                        </button>

                        {/* Location */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachmentMenuOpen(false);
                            setIsLocationModalOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-canvas text-ink transition-colors cursor-pointer text-left text-xs font-semibold group"
                        >
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-ink">Location</div>
                            <div className="text-[10px] text-ink-secondary">Live GPS, current or meetup spot</div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Hidden file inputs */}
                  <input
                    ref={mediaFileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaSelected}
                    className="hidden"
                  />
                  <input
                    ref={docFileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.zip,.csv,.xlsx,application/*"
                    onChange={handleDocumentSelected}
                    className="hidden"
                  />

                  {/* WhatsApp Message Input Box Container */}
                  <div className="flex-1 bg-canvas border border-divider rounded-full px-3 sm:px-4 py-2 flex items-center gap-2 relative focus-within:border-brand/60 focus-within:ring-1 focus-within:ring-brand/30 transition-all min-w-0">
                    {/* Emoji Smile Button */}
                    <div className="relative shrink-0" ref={emojiPickerRef}>
                      <button
                        type="button"
                        onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                        className="p-1 rounded-full text-ink-muted hover:text-ink transition-colors cursor-pointer"
                        title="Add emoji"
                      >
                        <Smile className="w-5 h-5" />
                      </button>

                      {/* WhatsApp Quick Emoji Picker Popover */}
                      {isEmojiPickerOpen && (
                        <div className="absolute bottom-12 left-0 z-50 bg-surface/98 backdrop-blur-md border border-divider rounded-2xl p-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 flex items-center gap-1.5 flex-wrap w-60">
                          {['😀', '😂', '👍', '🤝', '🙌', '🎉', '📍', '✨', '🙏', '🔥', '👏', '✅'].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                setInputText((prev) => prev + emoji);
                                setIsEmojiPickerOpen(false);
                                inputRef.current?.focus();
                              }}
                              className="w-8 h-8 flex items-center justify-center text-base hover:scale-125 transition-transform rounded-lg hover:bg-canvas cursor-pointer"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Main Text Input */}
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent border-none outline-none text-xs font-semibold text-ink placeholder:text-ink-muted min-w-0"
                    />
                  </div>

                  {/* Dedicated WhatsApp Send Button on the Right Side */}
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      inputText.trim() && !isSending
                        ? 'bg-brand text-white shadow-pink hover:opacity-90 hover:scale-105 active:scale-95'
                        : 'bg-canvas border border-divider text-ink-muted/50 cursor-not-allowed opacity-60'
                    }`}
                    title="Send message"
                  >
                    {isSending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 sm:w-4.5 sm:h-4.5 translate-x-[-0.5px]" />
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 text-ink-secondary bg-surface">
                <div className="w-16 h-16 rounded-3xl bg-canvas border border-divider flex items-center justify-center text-ink-muted shadow-xs">
                  <MessageSquareOff className="w-8 h-8 text-ink-muted/80" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className="text-base font-black text-ink font-display">No Chats Are Open</h3>
                  <p className="text-xs leading-relaxed text-ink-secondary">
                    {conversations.length === 0
                      ? "You don't have any open conversations. Explore the marketplace or reach out to neighbors to start chatting."
                      : "All chats are currently closed. Select a conversation from the left to view messages, or start a new chat."}
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Modal: Create Personal Listing / Borrow Request Agreement */}
      <PersonalProposalModal
        isOpen={isCreateProposalOpen}
        onClose={() => setIsCreateProposalOpen(false)}
        partnerName={activeConversation?.partner_name || 'Neighbor'}
        partnerId={activeConversation?.partner_id || (selectedConvId?.startsWith('dm_') ? selectedConvId.replace('dm_', '') : '')}
        bookingId={activeConversation?.booking_id}
        onSubmitProposal={handleProposalSubmit}
        initialType={proposalType}
      />

      {/* Instagram Modal: Conversation Details (Where Delete Chat & Profile Live!) */}
      {isDetailsOpen && activeConversation && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-divider rounded-3xl w-full max-w-sm sm:max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
              <h3 className="text-sm font-extrabold text-ink font-display">Details</h3>
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="p-1.5 rounded-full hover:bg-canvas text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Member Profile Hero */}
              <div className="flex flex-col items-center justify-center text-center space-y-2 p-4 bg-canvas rounded-2xl border border-divider">
                <img
                  src={
                    activeConversation.partner_avatar ||
                    (activeConversation.partner_name
                      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConversation.partner_name)}&background=0F172A&color=fff&bold=true`
                      : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu')
                  }
                  alt={activeConversation.partner_name || 'Member'}
                  className="w-16 h-16 rounded-full object-cover border-2 border-divider shadow-sm"
                />
                <div>
                  <h4 className="text-sm font-bold text-ink">
                    {activeConversation.partner_name || 'Neighbor'}
                  </h4>
                  <p className="text-xs text-ink-secondary">
                    {activeConversation.partner_username ? `@${activeConversation.partner_username}` : 'RentU Member'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    const target = activeConversation.partner_username || activeConversation.partner_id;
                    if (target) onOpenUserProfile?.(target);
                  }}
                  className="px-4 py-1.5 rounded-full bg-surface hover:bg-surface/80 border border-divider text-xs font-bold text-ink transition-colors cursor-pointer shadow-xs"
                >
                  View Profile
                </button>
              </div>

              {/* Chat Controls / Actions */}
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-ink-secondary">
                  Chat Settings
                </div>

                {/* Mute Messages */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-canvas border border-divider">
                  <div className="flex items-center gap-2.5">
                    {isChatMuted ? (
                      <BellOff className="w-4 h-4 text-ink-secondary" />
                    ) : (
                      <Bell className="w-4 h-4 text-ink-secondary" />
                    )}
                    <span className="text-xs font-semibold text-ink">Mute messages</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChatMuted(!isChatMuted)}
                    className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                      isChatMuted ? 'bg-brand' : 'bg-canvas-darker border border-divider'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        isChatMuted ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Create Custom Proposal */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    setIsCreateProposalOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-canvas hover:bg-surface border border-divider text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <Package className="w-4 h-4 text-brand" />
                    <span className="text-xs font-semibold text-ink group-hover:text-brand transition-colors">
                      Create Custom Deal / Proposal
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-muted group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Privacy & Danger Zone (WHERE DELETE CHAT LIVES IN INSTAGRAM!) */}
              <div className="pt-2 border-t border-divider space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-red-500">
                  Danger Zone
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    if (selectedConvId) {
                      handleDeleteConversation(selectedConvId, activeConversation?.partner_name);
                    }
                  }}
                  className="w-full flex items-center gap-2.5 p-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Chat</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal 1: Location Share Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-divider rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
              <div className="flex items-center gap-2.5">
                {locationModalTab === 'live_duration' ? (
                  <button
                    type="button"
                    onClick={() => setLocationModalTab('options')}
                    className="p-1 rounded-full hover:bg-canvas text-ink-muted hover:text-ink transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <MapPin className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-extrabold text-ink font-display">
                    {locationModalTab === 'live_duration' ? 'Share Live Location' : 'Share Location'}
                  </h3>
                  <p className="text-[10px] text-ink-secondary">
                    {locationModalTab === 'live_duration'
                      ? 'Live real-time position'
                      : `Send to ${activeConversation?.partner_name || 'neighbor'}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsLocationModalOpen(false);
                  setLocationModalTab('options');
                }}
                className="p-1.5 rounded-full hover:bg-canvas text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            {locationModalTab === 'options' ? (
              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* GPS Status Card with Real-time satellite fix */}
                <div className="p-3 rounded-2xl bg-canvas border border-divider space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        {isDetectingLocation ? (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                        ) : detectedGpsLocation ? (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        ) : null}
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDetectingLocation ? 'bg-brand' : detectedGpsLocation ? 'bg-emerald-500' : 'bg-ink-muted'}`} />
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-ink-secondary">
                        {isDetectingLocation
                          ? 'Acquiring GPS Satellite Lock...'
                          : detectedGpsLocation
                          ? 'Precise GPS Satellite Fixed'
                          : 'GPS Coordinates'}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isDetectingLocation}
                      onClick={() => {
                        setIsDetectingLocation(true);
                        detectCurrentLocation({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })
                          .then((loc) => setDetectedGpsLocation(loc))
                          .catch((e) => alert(e.message || 'GPS detection failed.'))
                          .finally(() => setIsDetectingLocation(false));
                      }}
                      className="text-[10px] font-bold text-ink-muted hover:text-ink flex items-center gap-1 cursor-pointer transition-colors"
                      title="Refresh GPS satellite fix"
                    >
                      <RefreshCw className={`w-3 h-3 ${isDetectingLocation ? 'animate-spin' : ''}`} />
                      <span>Re-scan</span>
                    </button>
                  </div>

                  {detectedGpsLocation ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-ink leading-tight line-clamp-2">
                        {detectedGpsLocation.address_text || detectedGpsLocation.full_address}
                      </p>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold border border-emerald-500/20">
                          Accurate to {detectedGpsLocation.accuracy || 12} meters
                        </span>
                        <span className="text-ink-muted font-mono">
                          {detectedGpsLocation.latitude.toFixed(4)}, {detectedGpsLocation.longitude.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-muted">
                      {isDetectingLocation
                        ? 'Connecting to high-precision device sensors...'
                        : 'GPS not yet acquired. Click re-scan or choose a saved spot.'}
                    </p>
                  )}
                </div>

                {/* WhatsApp Option 1: Share Live Location */}
                <button
                  type="button"
                  onClick={() => setLocationModalTab('live_duration')}
                  className="w-full p-3.5 rounded-2xl bg-canvas hover:bg-surface border border-divider hover:border-emerald-500/40 text-left transition-all cursor-pointer group flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-ink group-hover:text-emerald-500 transition-colors">
                        Share live location
                      </div>
                      <div className="text-[11px] text-ink-secondary">
                        Update your location in real time as you move
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-muted group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* WhatsApp Option 2: Send Your Current Location */}
                <button
                  type="button"
                  onClick={() => handleShareCurrentLocation()}
                  disabled={isSendingLocation || isDetectingLocation}
                  className="w-full p-3.5 rounded-2xl bg-canvas hover:bg-surface border border-divider hover:border-emerald-500/40 text-left transition-all cursor-pointer group flex items-center justify-between disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {isSendingLocation ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <LocateFixed className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-black text-ink group-hover:text-emerald-500 transition-colors">
                        Send your current location
                      </div>
                      <div className="text-[11px] text-ink-secondary">
                        {detectedGpsLocation
                          ? `Accurate to ${detectedGpsLocation.accuracy || 12} meters`
                          : 'High-accuracy GPS satellite fix'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-muted group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Divider: NEARBY & SAVED PLACES */}
                <div className="pt-2 border-t border-divider space-y-2.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-ink-secondary">
                    Nearby & Saved Places
                  </div>

                  {getEffectiveSavedLocations(user).map((loc) => {
                    const full = formatSavedLocationFull(loc);
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleShareSavedLocation(full, loc.latitude, loc.longitude)}
                        disabled={isSendingLocation}
                        className="w-full text-left p-3 rounded-2xl bg-canvas hover:bg-surface border border-divider hover:border-emerald-500/40 transition-all cursor-pointer group space-y-0.5 disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-ink">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                            {loc.label}
                          </span>
                          {loc.is_default && (
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-brand-soft text-brand border border-brand/20">
                              Primary
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-ink-secondary truncate pl-5">
                          {full}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Meetup Spot Input */}
                <div className="space-y-2 pt-2 border-t border-divider">
                  <label className="text-[10px] font-black uppercase tracking-wider text-ink-secondary block">
                    Or Enter Custom Meetup Spot
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customLocationText}
                      onChange={(e) => setCustomLocationText(e.target.value)}
                      placeholder="e.g. Metro Station Gate 2, Bengaluru"
                      className="flex-1 bg-canvas border border-divider rounded-xl px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => handleShareSavedLocation(customLocationText)}
                      disabled={!customLocationText.trim() || isSendingLocation}
                      className="btn-primary text-xs px-3.5 py-2 font-bold disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      Share
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Tab 2: WhatsApp Live Location Duration Selector */
              <div className="p-5 space-y-5">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  Participants in this chat will see your real-time location. You can stop sharing at any time.
                </div>

                {/* Duration options */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-ink-secondary block">
                    Share For
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { minutes: 15 as const, label: '15 Minutes' },
                      { minutes: 60 as const, label: '1 Hour' },
                      { minutes: 480 as const, label: '8 Hours' },
                    ].map((opt) => {
                      const isSelected = liveDurationMinutes === opt.minutes;
                      return (
                        <button
                          key={opt.minutes}
                          type="button"
                          onClick={() => setLiveDurationMinutes(opt.minutes)}
                          className={`p-3 rounded-2xl border text-center font-extrabold text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                              : 'bg-canvas hover:bg-surface border-divider text-ink'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional comment */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-ink-secondary block">
                    Add a comment (Optional)
                  </label>
                  <input
                    type="text"
                    value={liveLocationComment}
                    onChange={(e) => setLiveLocationComment(e.target.value)}
                    placeholder="e.g. On my way with the camera gear..."
                    maxLength={100}
                    className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Start Sharing CTA */}
                <button
                  type="button"
                  disabled={isSendingLocation}
                  onClick={() => handleShareLiveLocation()}
                  className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSendingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Radio className="w-4 h-4" />
                  )}
                  <span>Start Sharing Live Location</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Image Lightbox */}
      {previewImageUrl && (
        <div 
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              title="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImageUrl}
              alt="Enlarged attachment"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                download="rentu-photo.jpg"
                className="px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Open / Download Original</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Custom Pop-up Modal: Delete Chat / Delete Message Confirmation */}
      {deleteTarget && (
        <div 
          onClick={() => !isDeletingChat && setDeleteTarget(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border border-divider rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-center relative"
          >
            {/* Close Button */}
            <button
              type="button"
              disabled={isDeletingChat}
              onClick={() => setDeleteTarget(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-ink-muted hover:text-ink hover:bg-canvas transition-colors cursor-pointer disabled:opacity-50"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Warning Trash Icon */}
            <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-8 h-8" />
            </div>

            {/* Title & Explanatory Body */}
            <div className="space-y-2">
              <h3 className="text-lg font-black text-ink font-display">
                {deleteTarget.type === 'CONVERSATION'
                  ? `Delete chat with ${deleteTarget.name || 'Neighbor'}?`
                  : 'Delete Message?'}
              </h3>
              <p className="text-xs text-ink-secondary leading-relaxed px-2">
                {deleteTarget.type === 'CONVERSATION'
                  ? `Are you sure you want to delete your conversation with ${deleteTarget.name || 'this person'}? All messages, shared media, and location history will be permanently deleted for you.`
                  : 'Are you sure you want to permanently delete this message? This action cannot be undone.'}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={isDeletingChat}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-canvas hover:bg-surface border border-divider text-xs font-bold text-ink transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingChat}
                onClick={confirmDelete}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeletingChat ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
