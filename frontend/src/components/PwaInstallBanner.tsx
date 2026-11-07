import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share, PlusSquare, CheckCircle2, QrCode, MoreHorizontal, MoreVertical, Copy, Check, ExternalLink, ArrowDown } from 'lucide-react';
import { generateQrDataUri } from '../lib/qr';

const DISMISS_KEY = 'rentu_pwa_banner_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(true);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [isIosDevice, setIsIosDevice] = useState<boolean>(false);
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(false);
  const [browserTab, setBrowserTab] = useState<'chrome' | 'safari' | 'android'>('chrome');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [currentUrl, setCurrentUrl] = useState<string>('https://www.rentu.site');

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      return; // Never show inside installed PWA
    }

    // 2. Check if user dismissed the banner
    const dismissed = localStorage.getItem(DISMISS_KEY) === 'true';
    if (dismissed) {
      return;
    }

    // Detect device type & browser
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /android/i.test(ua);
    const isMobile = isIos || isAndroid || /webos|blackberry|iemobile|opera mini/i.test(ua);
    const isSafariOnly = isIos && /safari/.test(ua) && !/crios|chrome|chromium|fxios/.test(ua);

    setIsIosDevice(isIos);
    setIsMobileDevice(isMobile);

    if (isAndroid) {
      setBrowserTab('android');
    } else if (isSafariOnly) {
      setBrowserTab('safari');
    } else {
      setBrowserTab('chrome');
    }

    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.origin || 'https://www.rentu.site');
    }

    // Show banner
    setIsDismissed(false);

    // 3. Check for early-captured prompt in index.html
    const earlyPrompt = (window as any).__pwaInstallPrompt;
    if (earlyPrompt) {
      setDeferredPrompt(earlyPrompt as BeforeInstallPromptEvent);
    }

    // 4. Listen for browser install prompt (Chrome/Android/Edge/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      (window as any).__pwaInstallPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch (e) {
      // Ignore localStorage errors
    }
  };

  const handleInstallClick = async () => {
    const prompt = deferredPrompt || (window as any).__pwaInstallPrompt;
    if (prompt) {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === 'accepted') {
          handleDismiss();
          return;
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }
    // If native prompt is not directly available (e.g. iOS Safari / iOS Chrome / Firefox)
    setShowGuideModal(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(currentUrl).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  if (isDismissed) {
    return null;
  }

  const qrUri = generateQrDataUri(currentUrl);
  const displayHost = typeof window !== 'undefined' ? window.location.host : 'rentu.site';

  return (
    <>
      {/* Topmost PWA Install Banner */}
      <aside
        aria-label="Install Rentu Application"
        className="w-full bg-gradient-to-r from-brand/15 via-purple-600/10 to-brand/20 dark:from-brand/25 dark:via-purple-950/40 dark:to-brand/20 border-b border-brand/20 text-ink backdrop-blur-md relative z-40 transition-all duration-200"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2.5 sm:gap-4">
          {/* Left badge & text */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-brand text-white flex items-center justify-center shadow-sm shadow-brand/30 shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0 truncate">
              <p className="text-xs sm:text-sm font-semibold text-ink flex items-center gap-1.5 truncate">
                <span className="font-bold text-brand">Install Rentu</span>
                <span className="hidden xs:inline text-ink-muted">·</span>
                <span className="truncate">Add to your phone for instant rentals & alerts</span>
              </p>
            </div>
          </div>

          {/* Right action & cross button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3 sm:px-4 py-1.5 rounded-full bg-brand hover:bg-brand/90 text-white font-bold text-xs sm:text-sm shadow-sm shadow-brand/25 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Install Rentu on phone"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Install on Phone</span>
            </button>

            <button
              onClick={handleDismiss}
              className="p-1 sm:p-1.5 rounded-full text-ink-muted hover:text-ink hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Remove install banner"
              title="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Native-Style App Installation Modal (Modeled exactly after Chrome Native Install Dialog) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#1C1D24] border border-zinc-700/80 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative space-y-5 text-white">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Top Illustration Matching Chrome Native Dialog */}
            <div className="flex flex-col items-center justify-center pt-2">
              <div className="relative w-40 h-24 bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-2xl border border-zinc-700/60 p-2 flex flex-col items-center justify-between shadow-inner">
                {/* Device Screen Header */}
                <div className="w-full flex items-center justify-between px-1">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/80" />
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500/80" />
                  </div>
                  <div className="h-1.5 w-16 bg-zinc-700 rounded-full" />
                </div>

                {/* Animated Arrow Dropping App into Screen */}
                <div className="flex flex-col items-center animate-bounce">
                  <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-brand/40">
                    <span className="font-extrabold text-white text-xs">R⁺</span>
                  </div>
                  <ArrowDown className="w-3.5 h-3.5 text-brand mt-0.5" />
                </div>

                {/* Device Bottom Dock */}
                <div className="w-20 h-1.5 bg-zinc-600 rounded-full" />
              </div>

              {/* Title & Description Matching Native Dialog */}
              <div className="text-center mt-4 space-y-1">
                <h3 className="font-extrabold text-white text-lg tracking-tight">Install app</h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                  Access this site in a dedicated window on your device with full offline support.
                </p>
              </div>
            </div>

            {/* App Card Preview Matching Native Dialog */}
            <div className="bg-zinc-800/90 border border-zinc-700/80 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand to-pink-600 flex items-center justify-center text-white shadow-md shadow-brand/20 shrink-0 font-extrabold text-base">
                R⁺
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-white flex items-center gap-2">
                  <span>Rentu</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                    Verified
                  </span>
                </div>
                <div className="text-xs text-zinc-400 truncate">{displayHost}</div>
              </div>
            </div>

            {/* Browser Selector Tabs */}
            {isMobileDevice && (
              <div className="flex items-center p-1 bg-zinc-800/80 rounded-xl border border-zinc-700/60 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setBrowserTab('chrome')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    browserTab === 'chrome'
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Chrome
                </button>
                <button
                  type="button"
                  onClick={() => setBrowserTab('safari')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    browserTab === 'safari'
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Safari
                </button>
                <button
                  type="button"
                  onClick={() => setBrowserTab('android')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    browserTab === 'android'
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Android
                </button>
              </div>
            )}

            {/* Step-by-Step Native-Install Guidance */}
            {browserTab === 'chrome' && isMobileDevice && (
              <div className="space-y-2.5 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 text-xs text-zinc-200">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-brand/20 text-brand flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-white">In Chrome, tap Share or Menu</p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Tap the <Share className="w-3 h-3 text-brand inline mx-0.5" /> <strong>Share</strong> icon in the top address bar (or tap <MoreHorizontal className="w-3 h-3 text-brand inline mx-0.5" /> <strong>(⋯)</strong> at the bottom right).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-brand/20 text-brand flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-white">Tap "Add to Home Screen"</p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Scroll down and tap <PlusSquare className="w-3 h-3 text-brand inline mx-0.5" /> <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {browserTab === 'safari' && isMobileDevice && (
              <div className="space-y-2.5 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 text-xs text-zinc-200">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-brand/20 text-brand flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-white">Tap Share at the bottom</p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Tap the <Share className="w-3 h-3 text-brand inline mx-0.5" /> <strong>Share</strong> button in the bottom Safari bar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-brand/20 text-brand flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-white">Tap "Add to Home Screen"</p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Scroll down and tap <PlusSquare className="w-3 h-3 text-brand inline mx-0.5" /> <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {browserTab === 'android' && isMobileDevice && (
              <div className="space-y-2.5 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 text-xs text-zinc-200">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-brand/20 text-brand flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-white">Open Chrome Menu</p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Tap the <MoreVertical className="w-3 h-3 text-brand inline mx-0.5" /> <strong>three dots (⋮)</strong> in the top-right corner.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-brand/20 text-brand flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-white">Tap "Install App"</p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop instructions: Scan with Phone Camera */}
            {!isMobileDevice && (
              <div className="space-y-3 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 text-center">
                <p className="text-xs text-zinc-300">
                  Scan this QR code with your phone camera to open Rentu and install it:
                </p>
                <div className="bg-white p-2.5 rounded-2xl w-40 h-40 mx-auto flex items-center justify-center shadow-lg">
                  {qrUri ? (
                    <img src={qrUri} alt="Scan to install Rentu on phone" className="w-full h-full object-contain" />
                  ) : (
                    <QrCode className="w-20 h-20 text-zinc-400" />
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons Matching Native Dialog */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const prompt = deferredPrompt || (window as any).__pwaInstallPrompt;
                  if (prompt) {
                    prompt.prompt().catch(() => {});
                  }
                  setShowGuideModal(false);
                }}
                className="px-5 py-2 rounded-xl bg-brand hover:bg-brand/90 text-white font-bold text-xs shadow-md shadow-brand/30 transition-all cursor-pointer"
              >
                {deferredPrompt || (window as any).__pwaInstallPrompt ? 'Install Now' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
