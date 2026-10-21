import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  RotateCcw, 
  MapPin, 
  Calendar, 
  Tag, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Item, AiChatMessage, AiChatContext } from '../lib/types';
import { api } from '../lib/api';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  onSelectItem: (item: Item) => void;
  context?: AiChatContext;
}

const DEFAULT_SUGGESTIONS = [
  'Find cameras under ₹400/day',
  'Can I borrow gear for free?',
  'Find cheaper alternatives',
  'Check camera availability for this weekend',
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  onOpen,
  onSelectItem,
  context,
}) => {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    const cleanText = textToSend.trim();
    if (!cleanText || isLoading) return;

    setErrorMsg(null);
    setInputValue('');

    const userMessage: AiChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: cleanText,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      // Build API messages payload (role & content only)
      const apiPayload = newHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.sendAiChatMessage(apiPayload, context);

      const assistantMessage: AiChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply || 'Here is what I found in the marketplace:',
        items: res.items || [],
        suggestions: res.suggestions || [],
        mode: res.mode || 'fallback',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Rentu AI chat error:', err);
      setErrorMsg(err.message || 'Could not connect to Rentu AI. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  const handleClearChat = () => {
    setMessages([]);
    setErrorMsg(null);
  };

  const renderFormattedText = (text: string) => {
    // Basic Markdown parser for bold and bullet points
    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 text-xs sm:text-[13px] leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} className="h-1.5" />;
          }

          // Bullet point
          const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
          const cleanLine = isBullet ? line.trim().replace(/^[•\-]\s*/, '') : line;

          // Parse bold **text**
          const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
          const parsedContent = parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-extrabold text-ink">{part.slice(2, -2)}</strong>;
            }
            return part;
          });

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1">
                <span className="text-brand font-black text-xs leading-5">•</span>
                <span className="flex-1">{parsedContent}</span>
              </div>
            );
          }

          return <p key={idx}>{parsedContent}</p>;
        })}
      </div>
    );
  };

  return (
    <>
      {/* 1. Floating Launcher Button (Fixed on bottom right, above mobile nav) */}
      {!isOpen && (
        <button
          onClick={onOpen}
          id="rentu-ai-launcher-btn"
          aria-label="Open Rentu AI Assistant"
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 bg-gradient-to-r from-[#E11D74] to-[#C2185B] text-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-full font-extrabold text-xs sm:text-sm shadow-pink hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-white/20 group"
        >
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display tracking-tight">Rentu AI</span>
          <span className="hidden sm:inline text-[11px] font-normal text-white/80 border-l border-white/30 pl-2">
            Smart Finder
          </span>
        </button>
      )}

      {/* 2. Floating AI Assistant Chat Panel */}
      {isOpen && (
        <div 
          className={`fixed z-50 transition-all duration-200 ease-out flex flex-col bg-surface border border-divider shadow-2xl overflow-hidden ${
            isExpanded
              ? 'inset-2 sm:inset-6 rounded-3xl'
              : 'bottom-20 sm:bottom-6 right-3 sm:right-6 w-[calc(100vw-24px)] sm:w-[440px] h-[580px] sm:h-[640px] max-h-[85vh] rounded-3xl'
          }`}
        >
          {/* Header */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-divider bg-canvas/60 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-sm text-ink font-display">Rentu AI</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-soft text-brand border border-brand/20">
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-ink-secondary">Search, compare prices & check availability</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-full hover:bg-surface-hover text-ink-secondary hover:text-ink transition-colors cursor-pointer"
                title="Start new conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="hidden sm:flex p-1.5 rounded-full hover:bg-surface-hover text-ink-secondary hover:text-ink transition-colors cursor-pointer"
                title={isExpanded ? 'Minimize' : 'Expand'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-surface-hover text-ink-secondary hover:text-ink transition-colors cursor-pointer"
                title="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Conversation Body */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-canvas/30">
            
            {/* Initial Welcome Greeting */}
            {messages.length === 0 && (
              <div className="space-y-4 py-2 animate-in fade-in duration-300">
                <div className="bg-surface border border-divider rounded-2xl p-4 shadow-xs space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-ink">
                      Welcome to Rentu AI
                    </h4>
                  </div>
                  <p className="text-xs text-ink-secondary leading-relaxed">
                    I scan real listings across the Rentu community to help you save money and rent smart. Here is what I can do:
                  </p>
                  <ul className="text-xs text-ink space-y-1.5 font-medium">
                    <li className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>Find gear matching your daily budget.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>Compare prices & recommend cheaper alternatives.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>Check real calendar dates against booked schedules.</span>
                    </li>
                  </ul>
                </div>

                {/* Suggested Prompts */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider">
                    Try asking:
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {DEFAULT_SUGGESTIONS.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(prompt)}
                        className="text-left text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-divider hover:border-brand/40 text-ink transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
                      >
                        <span>{prompt}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Rendered Messages */}
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2 animate-in fade-in duration-200`}
                >
                  {/* Bubble */}
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-[#E11D74] text-white rounded-br-xs font-medium'
                        : 'bg-surface border border-divider text-ink rounded-bl-xs'
                    }`}
                  >
                    {isUser ? (
                      <p>{m.content}</p>
                    ) : (
                      renderFormattedText(m.content)
                    )}

                    <div
                      className={`text-[9px] mt-1 text-right ${
                        isUser ? 'text-white/70' : 'text-ink-secondary'
                      }`}
                    >
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Embedded Marketplace Item Cards */}
                  {!isUser && m.items && m.items.length > 0 && (
                    <div className="w-full space-y-2 pt-1">
                      <p className="text-[10px] font-black text-ink-secondary uppercase tracking-wider pl-1">
                        Marketplace Listings ({m.items.length})
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {m.items.map((item) => {
                          const thumbUrl = (item.image_urls && item.image_urls.length > 0)
                            ? item.image_urls[0]
                            : 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80';

                          return (
                            <div
                              key={item.id}
                              className="clean-card p-3 flex items-center justify-between gap-3 bg-surface hover:border-brand transition-all shadow-xs group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={thumbUrl}
                                  alt={item.title}
                                  className="w-12 h-12 rounded-xl object-cover shrink-0 border border-divider"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                                <div className="min-w-0">
                                  <h5 className="text-xs font-black text-ink truncate group-hover:text-brand transition-colors">
                                    {item.title}
                                  </h5>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-ink-secondary">
                                    <span className="font-extrabold text-ink">
                                      ₹{Number(item.price_per_day)}/day
                                    </span>
                                    <span>•</span>
                                    <span className="truncate">{item.locality || 'Nearby'}</span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => {
                                  onSelectItem(item);
                                }}
                                className="px-3 py-1.5 rounded-full bg-brand-soft hover:bg-brand text-brand hover:text-white text-[11px] font-extrabold shrink-0 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <span>View</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Follow-up Suggestion Chips */}
                  {!isUser && m.suggestions && m.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {m.suggestions.map((sug, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => handleSendMessage(sug)}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-canvas hover:bg-surface border border-divider hover:border-brand/50 text-ink transition-colors cursor-pointer"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}

                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-ink-secondary text-xs bg-surface border border-divider rounded-2xl px-4 py-3 w-fit animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-brand animate-spin" />
                <span className="font-medium">Rentu AI is checking the marketplace...</span>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button
                  onClick={() => handleSendMessage(inputValue || 'Show available listings')}
                  className="font-bold underline shrink-0 hover:opacity-80 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleFormSubmit}
            className="p-3 sm:p-3.5 border-t border-divider bg-surface flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Rentu AI (e.g. Find DSLR under ₹400)..."
              disabled={isLoading}
              className="flex-1 bg-canvas border border-divider focus:border-brand rounded-full px-4 py-2 text-xs sm:text-sm font-medium text-ink outline-none placeholder:text-ink-muted transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-brand text-white flex items-center justify-center shrink-0 shadow-pink hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all cursor-pointer"
              title="Send question"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>

        </div>
      )}
    </>
  );
};
