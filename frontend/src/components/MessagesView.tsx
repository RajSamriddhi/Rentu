import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, Search, ArrowLeft, Check, CheckCheck, AlertCircle, 
  Clock, MapPin, Sparkles, User as UserIcon, ShieldCheck, ChevronRight,
  Plus, X, Package, Calendar, DollarSign, Truck, FileText, CheckCircle2, XCircle,
  Trash2, Pencil, Image as ImageIcon, Phone, ExternalLink, Download, Loader2, Navigation,
  ClipboardCheck, Copy
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { Conversation, Message, MessageProposalData } from '../lib/types';
import { PersonalProposalModal } from './PersonalProposalModal';
import { uploadItemPhoto } from '../lib/supabase';
import { detectCurrentLocation, getEffectiveSavedLocations, formatSavedLocationFull } from '../lib/location';

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

  // WhatsApp-style Attachment Tray State
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [customLocationText, setCustomLocationText] = useState('');
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactLocality, setContactLocality] = useState('');
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('Pre-handover Equipment Inspection');
  const [docNotes, setDocNotes] = useState('Item inspected and verified in clean working condition before handover. All cables and accessories accounted for.');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Close attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setIsAttachMenuOpen(false);
      }
    };
    if (isAttachMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAttachMenuOpen]);

  // Scroll to bottom cleanly within the thread container
  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  // Status ticks: 1 tick = sent, 2 ticks = reached recipient (delivered), 2 blue ticks = read
  const renderMessageTicks = (m: Message, onBubble = true) => {
    if (m.is_read) {
      return (
        <span title="Read" className="inline-flex items-center text-sky-400 drop-shadow-xs">
          <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
      );
    }
    if (m.is_delivered) {
      return (
        <span title="Delivered" className={`inline-flex items-center ${onBubble ? 'text-white/75' : 'text-ink-muted'}`}>
          <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
      );
    }
    return (
      <span title="Sent" className={`inline-flex items-center ${onBubble ? 'text-white/75' : 'text-ink-muted'}`}>
        <Check className="w-3 h-3 stroke-[2.5]" />
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
          const match =
            c.conversation_id === selectedConvId ||
            c.booking_id === selectedConvId ||
            `dm_${c.partner_id}` === selectedConvId;
          const label =
            opts.message_type === 'IMAGE'
              ? 'Photo'
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

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 15 * 1024 * 1024) {
      alert('Photo is too large (maximum 15MB). Please choose a smaller photo.');
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const url = await uploadItemPhoto(file, 'chat');
      await handleSendAttachmentMessage({
        content: 'Photo',
        message_type: 'IMAGE',
        proposal_data: { image_url: url, file_name: file.name },
      });
    } catch (err: any) {
      console.error('Photo upload failed:', err);
      alert(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleShareCurrentLocation = async () => {
    try {
      setIsDetectingLocation(true);
      const loc = await detectCurrentLocation();
      const addr = [loc.address_text, loc.locality, loc.city].filter(Boolean).join(', ') || 'Current Location';
      await handleSendAttachmentMessage({
        content: `Location: ${addr}`,
        message_type: 'LOCATION',
        proposal_data: {
          address: addr,
          latitude: loc.latitude,
          longitude: loc.longitude,
          locality: loc.locality || loc.city,
        },
      });
      setIsLocationModalOpen(false);
    } catch (err: any) {
      console.error('Failed to detect GPS location:', err);
      alert(err.message || 'Could not detect your GPS location. Please choose a saved address below.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleShareSavedLocation = async (locText: string) => {
    if (!locText.trim()) return;
    await handleSendAttachmentMessage({
      content: `Location: ${locText.trim()}`,
      message_type: 'LOCATION',
      proposal_data: {
        address: locText.trim(),
      },
    });
    setCustomLocationText('');
    setIsLocationModalOpen(false);
  };

  const handleShareContact = async () => {
    const name = contactName.trim() || user?.name || 'Neighbor';
    const phone = contactPhone.trim() || user?.phone || '';
    if (!phone) {
      alert('Please enter a phone number to share.');
      return;
    }
    await handleSendAttachmentMessage({
      content: `Contact: ${name} (${phone})`,
      message_type: 'CONTACT',
      proposal_data: {
        name,
        phone,
        locality: contactLocality.trim() || user?.locality || undefined,
      },
    });
    setIsContactModalOpen(false);
  };

  const handleShareDocument = async () => {
    const title = docTitle.trim() || 'Gear Handover Inspection';
    const notes = docNotes.trim();
    if (!notes) {
      alert('Please enter your condition inspection notes.');
      return;
    }
    await handleSendAttachmentMessage({
      content: `Condition Note: ${title}`,
      message_type: 'DOCUMENT',
      proposal_data: {
        title,
        notes,
      },
    });
    setIsDocumentModalOpen(false);
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
                        <div className="flex items-center justify-between gap-1.5 mt-1.5">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border truncate max-w-[160px] ${
                            isDirect 
                              ? 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20' 
                              : 'text-brand bg-brand-soft border-brand/20'
                          }`}>
                            {isDirect ? 'Direct Message' : chat.item_title}
                          </span>
                          {Boolean(chat.unread_count && chat.unread_count > 0) && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm leading-none">
                              {chat.unread_count}
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
                          Direct Message
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

                      const pData = m.proposal_data
                        ? (typeof m.proposal_data === 'string' ? (() => { try { return JSON.parse(m.proposal_data); } catch { return null; } })() : m.proposal_data)
                        : null;

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
                      if (m.message_type === 'PROPOSAL' && pData) {
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
                                      {pData.start_date} {pData.start_time ? `(${pData.start_time})` : ''}
                                    </span>
                                    <span className="text-[10px] text-ink-secondary block truncate">
                                      to {pData.end_date || 'End Date'} {pData.end_time ? `(${pData.end_time})` : ''}
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

                                {/* Security Pickup Code Badge (shown when accepted) */}
                                {isAccepted && pData.pickup_code && (
                                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                      <span className="text-[11px] font-bold text-ink">Handover Verification Code:</span>
                                    </div>
                                    <span className="font-mono font-black text-sm tracking-wider text-emerald-600 dark:text-emerald-400">
                                      {pData.pickup_code}
                                    </span>
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

                      // 4. LOCATION MESSAGE (WhatsApp Style)
                      if (m.message_type === 'LOCATION' || pData?.address) {
                        const addrText = pData?.address || m.content.replace(/^Location:\s*/i, '');
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
                                title="Delete location"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}

                            <div className="w-full max-w-[280px] sm:max-w-xs rounded-2xl sm:rounded-3xl p-3.5 border border-emerald-500/30 bg-surface shadow-xs space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                  <MapPin className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider block">
                                    Shared Location
                                  </span>
                                  <span className="text-xs font-bold text-ink truncate block">
                                    Meetup Handover Spot
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-ink font-medium leading-relaxed bg-canvas p-2 rounded-xl border border-divider">
                                {addrText}
                              </p>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addrText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors cursor-pointer"
                              >
                                <span>Open in Google Maps</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              <div className="text-[9px] flex items-center justify-end gap-1 text-ink-secondary pt-0.5">
                                <span>{formattedTime}</span>
                                {isMe && renderMessageTicks(m, false)}
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

                      // 7. STANDARD CHAT TEXT MESSAGE
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

                {/* Reply Input Bar with WhatsApp-style + Button */}
                <form
                  onSubmit={handleSendMessage}
                  className="shrink-0 p-3 sm:p-4 border-t border-divider bg-surface flex items-center gap-2 sm:gap-3 relative"
                >
                  {/* WhatsApp-Style Attachment Menu + Button */}
                  <div className="relative" ref={attachMenuRef}>
                    {isAttachMenuOpen && (
                      <div className="absolute bottom-14 left-0 mb-1 z-40 w-64 bg-surface/98 backdrop-blur-md border border-divider rounded-3xl p-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 space-y-1">
                        <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-ink-secondary border-b border-divider/60">
                          Share Attachment
                        </div>

                        {/* 1. Photos & Videos */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachMenuOpen(false);
                            fileInputRef.current?.click();
                          }}
                          className="w-full text-left p-2 rounded-2xl hover:bg-canvas flex items-center gap-3 transition-colors cursor-pointer group"
                        >
                          <div className="w-9 h-9 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-ink">Photos & Videos</div>
                            <div className="text-[10px] text-ink-secondary">Share gear photos or handoff proof</div>
                          </div>
                        </button>

                        {/* 2. Share Location */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachMenuOpen(false);
                            setIsLocationModalOpen(true);
                          }}
                          className="w-full text-left p-2 rounded-2xl hover:bg-canvas flex items-center gap-3 transition-colors cursor-pointer group"
                        >
                          <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-ink">Location</div>
                            <div className="text-[10px] text-ink-secondary">Share meetup spot or saved address</div>
                          </div>
                        </button>

                        {/* 3. Contact Card */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachMenuOpen(false);
                            setContactName(user?.name || '');
                            setContactPhone(user?.phone || '');
                            setContactLocality(user?.locality || '');
                            setIsContactModalOpen(true);
                          }}
                          className="w-full text-left p-2 rounded-2xl hover:bg-canvas flex items-center gap-3 transition-colors cursor-pointer group"
                        >
                          <div className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Phone className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-ink">Contact Card</div>
                            <div className="text-[10px] text-ink-secondary">Share your phone number for meetup</div>
                          </div>
                        </button>

                        {/* 4. Condition / Inspection Note */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachMenuOpen(false);
                            setIsDocumentModalOpen(true);
                          }}
                          className="w-full text-left p-2 rounded-2xl hover:bg-canvas flex items-center gap-3 transition-colors cursor-pointer group"
                        >
                          <div className="w-9 h-9 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-ink">Condition Note</div>
                            <div className="text-[10px] text-ink-secondary">Gear inspection & handover checklist</div>
                          </div>
                        </button>
                      </div>
                    )}

                    {/* Hidden file input for Photo Upload */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelected}
                      className="hidden"
                    />

                    {/* WhatsApp-style Plus Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border transition-all flex items-center justify-center shrink-0 shadow-xs cursor-pointer ${
                        isAttachMenuOpen
                          ? 'bg-brand text-white border-brand rotate-45'
                          : 'bg-canvas hover:bg-brand-soft border-divider hover:border-brand text-ink-secondary hover:text-brand'
                      }`}
                      title="Attach photo, location, contact, or condition note"
                      aria-label="Attachment options"
                    >
                      <Plus className="w-5 h-5 transition-transform duration-200" />
                    </button>
                  </div>

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
      <PersonalProposalModal
        isOpen={isCreateProposalOpen}
        onClose={() => setIsCreateProposalOpen(false)}
        partnerName={activeConversation?.partner_name || 'Neighbor'}
        partnerId={activeConversation?.partner_id || (selectedConvId?.startsWith('dm_') ? selectedConvId.replace('dm_', '') : '')}
        bookingId={activeConversation?.booking_id}
        onSubmitProposal={handleProposalSubmit}
        initialType={proposalType}
      />

      {/* WhatsApp Modal 1: Location Share Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-divider rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-ink font-display">Share Meetup Location</h3>
                  <p className="text-[10px] text-ink-secondary">Send location to {activeConversation?.partner_name || 'neighbor'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-canvas text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Option A: 1-Click GPS Location */}
              <button
                type="button"
                onClick={handleShareCurrentLocation}
                disabled={isDetectingLocation}
                className="w-full p-3.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-between transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  {isDetectingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  ) : (
                    <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                  )}
                  <span>{isDetectingLocation ? 'Detecting GPS coordinates...' : 'Share Current GPS Location'}</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Option B: Profile Saved Locations */}
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-ink-secondary">
                  Or Pick Saved Address from Profile
                </div>
                {getEffectiveSavedLocations(user).map((loc) => {
                  const full = formatSavedLocationFull(loc);
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => handleShareSavedLocation(full)}
                      className="w-full text-left p-3 rounded-2xl bg-canvas hover:bg-surface border border-divider hover:border-emerald-500/40 transition-all cursor-pointer group space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-ink">
                        <span>{loc.label}</span>
                        {loc.is_default && (
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-brand-soft text-brand border border-brand/20">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-ink-secondary truncate">
                        {full}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Option C: Custom Address Input */}
              <div className="space-y-2 pt-2 border-t border-divider">
                <label className="text-[10px] font-black uppercase tracking-wider text-ink-secondary block">
                  Or Enter Specific Meetup Spot
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
                    disabled={!customLocationText.trim()}
                    className="btn-primary text-xs px-3 py-2 font-bold disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal 2: Contact Card Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-divider rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-ink font-display">Share Contact Card</h3>
                  <p className="text-[10px] text-ink-secondary">Direct handover contact info</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-canvas text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-ink-secondary block mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2 text-xs font-semibold text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-ink-secondary block mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2 text-xs font-semibold text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-ink-secondary block mb-1">
                  Locality / Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={contactLocality}
                  onChange={(e) => setContactLocality(e.target.value)}
                  placeholder="e.g. BEML Layout 7th Phase, Bengaluru"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2 text-xs font-semibold text-ink outline-none focus:border-brand"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-divider">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-ink-secondary hover:text-ink rounded-xl border border-divider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleShareContact}
                  disabled={!contactPhone.trim()}
                  className="btn-primary text-xs px-5 py-2 font-extrabold shadow-pink disabled:opacity-50 cursor-pointer"
                >
                  Share Contact Card
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal 3: Condition & Inspection Note Modal */}
      {isDocumentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-divider rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-ink font-display">Gear Condition & Check Note</h3>
                  <p className="text-[10px] text-ink-secondary">Record pre-handover or return inspection</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDocumentModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-canvas text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              {/* Presets */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-ink-secondary block mb-1.5">
                  Quick Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Clean & Fully Operational',
                    'Minor Existing Scratches Noted',
                    'All Cables & Case Included',
                    'Battery at 100% Charged',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDocNotes((prev) => (prev ? `${prev}\n• ${preset}` : `• ${preset}`))}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-canvas hover:bg-indigo-500/10 hover:text-indigo-600 border border-divider transition-colors cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-ink-secondary block mb-1">
                  Note Title
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Handover Inspection Note"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2 text-xs font-semibold text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-ink-secondary block mb-1">
                  Inspection Details *
                </label>
                <textarea
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  placeholder="Describe gear working state, inclusions, or inspection agreement..."
                  rows={4}
                  className="w-full bg-canvas border border-divider rounded-xl p-3 text-xs font-medium text-ink outline-none focus:border-brand resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-divider">
                <button
                  type="button"
                  onClick={() => setIsDocumentModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-ink-secondary hover:text-ink rounded-xl border border-divider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleShareDocument}
                  disabled={!docNotes.trim()}
                  className="btn-primary text-xs px-5 py-2 font-extrabold shadow-pink disabled:opacity-50 cursor-pointer"
                >
                  Share Condition Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal 4: Fullscreen Image Lightbox */}
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

    </div>
  );
};
