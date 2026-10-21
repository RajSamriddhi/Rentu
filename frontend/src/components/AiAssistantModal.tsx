import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  RotateCcw, 
  ArrowRight,
  Maximize2,
  Minimize2,
  Tag,
  Calendar,
  ShieldCheck,
  Heart,
  Copy,
  Check
} from 'lucide-react';
import { Item, AiChatMessage, AiChatContext } from '../lib/types';
import { api } from '../lib/api';
import { CuteBotAvatar, BotExpression } from './CuteBotAvatar';
import { AiListingCard } from './AiListingCard';

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(true);
  const [botExpression, setBotExpression] = useState<BotExpression>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, isOpen, isLoading]);

  // Expression transitions
  useEffect(() => {
    if (isLoading) {
      setBotExpression('thinking');
    } else if (errorMsg) {
      setBotExpression('concerned');
    } else if (messages.length > 0 && messages[messages.length - 1]?.items?.length) {
      setBotExpression('happy');
      const timer = setTimeout(() => setBotExpression('idle'), 4000);
      return () => clearTimeout(timer);
    } else {
      setBotExpression('idle');
    }
  }, [isLoading, errorMsg, messages]);

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
      const apiPayload = newHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.sendAiChatMessage(apiPayload, context);

      const assistantMessage: AiChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply || 'Here is what I found in the marketplace! ✨',
        items: res.items || [],
        suggestions: res.suggestions || [],
        mode: res.mode || 'fallback',
        provider: res.provider || (res.mode === 'ai' ? 'Google Gemini 1.5' : 'Rentu Smart Search'),
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
    setBotExpression('idle');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 text-xs sm:text-[13px] leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} className="h-1.5" />;
          }

          const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
          const cleanLine = isBullet ? line.trim().replace(/^[•\-]\s*/, '') : line;

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
                <span className="text-[#E11D74] font-black text-xs leading-5">💗</span>
                <span className="flex-1">{parsedContent}</span>
              </div>
            );
          }

          return <p key={idx}>{parsedContent}</p>;
        })}
      </div>
    );
  };

  const activeProvider = messages.length > 0 
    ? messages[messages.length - 1]?.provider || 'Rentu Smart Search'
    : 'Online • Real Marketplace Data';

  return (
    <>
      {/* 1. Adorable Floating Launcher Button */}
      {!isOpen && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-3">
          
          {/* Cute Greeting Speech Tooltip */}
          {showTooltip && (
            <div className="hidden md:flex items-center gap-2 bg-surface border border-pink-200 dark:border-pink-900/40 text-ink text-xs font-semibold px-3.5 py-2 rounded-2xl shadow-pink animate-in fade-in slide-in-from-right-4 duration-300">
              <span>Need help finding gear? 💗</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTooltip(false);
                }}
                className="text-ink-muted hover:text-ink cursor-pointer ml-1"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            onClick={onOpen}
            id="rentu-ai-launcher-btn"
            aria-label="Open Rentu AI Assistant"
            className="group relative bg-white dark:bg-[#181924] border-2 border-[#E11D74] hover:border-[#C2185B] p-1.5 pr-4 sm:pr-5 rounded-full shadow-pink hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 cursor-pointer"
          >
            {/* Mascot Avatar with gentle floating bounce */}
            <div className="group-hover:animate-bounce">
              <CuteBotAvatar size="sm" expression="happy" showSparkle />
            </div>

            <div className="text-left">
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-xs sm:text-sm text-ink font-display tracking-tight">
                  Rentu AI
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="text-[10px] text-brand font-bold block -mt-0.5">
                Ask anything ✨
              </span>
            </div>
          </button>
        </div>
      )}

      {/* 2. Floating AI Assistant Chat Panel */}
      {isOpen && (
        <div 
          className={`fixed z-50 transition-all duration-200 ease-out flex flex-col bg-surface border border-divider shadow-2xl overflow-hidden ${
            isExpanded
              ? 'inset-2 sm:inset-6 rounded-3xl'
              : 'bottom-20 sm:bottom-6 right-3 sm:right-6 w-[calc(100vw-24px)] sm:w-[460px] h-[600px] sm:h-[660px] max-h-[85vh] rounded-3xl'
          }`}
        >
          {/* Header */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-divider bg-canvas/70 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <CuteBotAvatar size="sm" expression={botExpression} showSparkle />
              
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-sm text-ink font-display">Rentu AI</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-soft text-brand border border-brand/20">
                    {activeProvider.includes('Gemini') ? '✨ Gemini Active' : '🌸 Smart Search'}
                  </span>
                </div>
                <p className="text-[11px] text-ink-secondary truncate max-w-[210px] sm:max-w-xs">
                  {activeProvider}
                </p>
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
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-canvas/40">
            
            {/* Initial Welcome Greeting */}
            {messages.length === 0 && (
              <div className="space-y-4 py-2 animate-in fade-in duration-300">
                <div className="bg-surface border border-pink-100 dark:border-pink-950/40 rounded-3xl p-5 shadow-xs space-y-3 relative overflow-hidden">
                  
                  {/* Decorative soft pastel glow */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-pink-100 dark:bg-pink-950/20 blur-2xl pointer-events-none" />

                  <div className="flex items-center gap-3">
                    <CuteBotAvatar size="lg" expression="happy" showSparkle />
                    <div>
                      <h4 className="text-sm font-black text-ink font-display">
                        Hi neighbor! I'm Rentu AI 💗
                      </h4>
                      <p className="text-xs text-brand font-bold mt-0.5">
                        Your cute peer-to-peer gear finder
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-ink-secondary leading-relaxed font-medium">
                    I scan real listings across the Rentu community to help you discover equipment, calculate rental savings, and book gear:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-ink font-semibold">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-canvas border border-divider/60">
                      <Tag className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>Search by daily budget</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-canvas border border-divider/60">
                      <Sparkles className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>Cheaper alternatives</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-canvas border border-divider/60">
                      <Calendar className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>Check weekend availability</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-canvas border border-divider/60">
                      <Heart className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>Free borrowing tips</span>
                    </div>
                  </div>
                </div>

                {/* Suggested Prompts */}
                <div className="space-y-2">
                  <p className="text-[11px] font-extrabold text-ink-secondary uppercase tracking-wider pl-1">
                    Try asking:
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {DEFAULT_SUGGESTIONS.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(prompt)}
                        className="text-left text-xs font-semibold px-3.5 py-2.5 rounded-2xl bg-surface hover:bg-surface-hover border border-divider hover:border-brand/40 text-ink transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
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
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in duration-200`}
                >
                  {/* Avatar next to message */}
                  {!isUser && (
                    <div className="mt-1">
                      <CuteBotAvatar size="xs" expression="idle" />
                    </div>
                  )}

                  <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%] space-y-2`}>
                    
                    {/* Bubble */}
                    <div
                      className={`relative rounded-3xl px-4 py-3 text-xs leading-relaxed shadow-xs group ${
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

                      <div className="flex items-center justify-end gap-2 mt-1.5 text-[9px] opacity-70">
                        <span>
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        {!isUser && (
                          <button
                            onClick={() => handleCopy(m.id, m.content)}
                            className="hover:opacity-100 cursor-pointer"
                            title="Copy reply"
                          >
                            {copiedId === m.id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Embedded Marketplace Item Cards */}
                    {!isUser && m.items && m.items.length > 0 && (
                      <div className="w-full space-y-2 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-black text-ink-secondary uppercase tracking-wider pl-1">
                          <span>Verified Listings ({m.items.length})</span>
                          <span className="text-brand font-bold lowercase">tap to view full specs</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {m.items.map((item) => (
                            <AiListingCard
                              key={item.id}
                              item={item}
                              onSelectItem={(it) => {
                                onSelectItem(it);
                              }}
                            />
                          ))}
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
                            className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-surface hover:bg-surface-hover border border-divider hover:border-brand text-ink hover:text-brand transition-colors cursor-pointer shadow-2xs"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}

                  </div>
                </div>
              );
            })}

            {/* Cute Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-3 text-ink-secondary text-xs bg-surface border border-pink-100 dark:border-pink-950/40 rounded-2xl px-4 py-3 w-fit animate-pulse shadow-xs">
                <CuteBotAvatar size="xs" expression="thinking" showSparkle />
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-ink">Rentu AI is checking the marketplace</span>
                  <span className="flex gap-1 ml-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CuteBotAvatar size="xs" expression="concerned" />
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
            className="p-3 sm:p-4 border-t border-divider bg-surface flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Rentu AI (e.g. Find DSLR under ₹400)..."
              disabled={isLoading}
              className="flex-1 bg-canvas border border-divider focus:border-brand rounded-full px-4 py-2.5 text-xs sm:text-sm font-medium text-ink outline-none placeholder:text-ink-muted transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="w-10 h-10 rounded-full bg-[#E11D74] hover:bg-[#C2185B] text-white flex items-center justify-center shrink-0 shadow-pink hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all cursor-pointer"
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
