import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share, PlusSquare, CheckCircle2, QrCode } from 'lucide-react';
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
  const [currentUrl, setCurrentUrl] = useState<string>('https://www.rentu.site');

  useEffect(() => {
    // 1. Check if already installed & running in standalone PWA mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      return; // Never show if already running inside installed PWA
    }

    // 2. Check if user already dismissed the banner
    const dismissed = localStorage.getItem(DISMISS_KEY) === 'true';
    if (dismissed) {
      return;
    }

    // Detect device type
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    const isMobile = isIos || /android|webos|blackberry|iemobile|opera mini/i.test(ua);

    setIsIosDevice(isIos);
    setIsMobileDevice(isMobile);
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.origin || 'https://www.rentu.site');
    }

    // Show banner
    setIsDismissed(false);

    // 3. Listen for browser install prompt (Chrome/Android/Edge/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
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
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          handleDismiss();
        }
      } catch (err) {
        console.error('Install prompt failed:', err);
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  if (isDismissed) {
    return null;
  }

  const qrUri = generateQrDataUri(currentUrl);

  return (
    <>
      {/* Topmost PWA Install Banner */}
      <aside
        aria-label="Install Rentu Application"
        className="w-full bg-gradient-to-r from-brand/15 via-purple-600/10 to-brand/20 dark:from-brand/25 dark:via-purple-950/40 dark:to-brand/20 border-b border-brand/20 text-ink backdrop-blur-md relative z-40 transition-all duration-200"
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
                <span className="truncate">Add to your phone for instant bookings & alerts</span>
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

      {/* Guidance Modal when native prompt is not directly available */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-divider rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-ink-muted hover:text-ink hover:bg-surface-elevated transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-ink text-base">Install Rentu App</h3>
                <p className="text-xs text-ink-muted">Follow the steps below to add Rentu to your phone</p>
              </div>
            </div>

            {isIosDevice ? (
              /* iOS Safari instructions */
              <div className="space-y-3 bg-surface-elevated/60 p-3.5 rounded-2xl border border-divider text-xs text-ink">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-brand/15 text-brand flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-ink">Tap Share in Safari</p>
                    <p className="text-ink-secondary text-[11px] mt-0.5 flex items-center gap-1">
                      Tap the <Share className="w-3.5 h-3.5 text-brand inline" /> share icon at the bottom of Safari.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-brand/15 text-brand flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-ink">Add to Home Screen</p>
                    <p className="text-ink-secondary text-[11px] mt-0.5 flex items-center gap-1">
                      Scroll down and tap <PlusSquare className="w-3.5 h-3.5 text-brand inline" /> <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <p className="font-semibold text-ink">Instant Access</p>
                    <p className="text-ink-secondary text-[11px] mt-0.5">
                      Launch Rentu directly from your home screen just like an app!
                    </p>
                  </div>
                </div>
              </div>
            ) : isMobileDevice ? (
              /* Android Chrome or other mobile instructions */
              <div className="space-y-3 bg-surface-elevated/60 p-3.5 rounded-2xl border border-divider text-xs text-ink">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-brand/15 text-brand flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-ink">Open Browser Menu</p>
                    <p className="text-ink-secondary text-[11px] mt-0.5">
                      Tap the three dots (⋮) in the top-right corner of your browser.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-brand/15 text-brand flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-ink">Install or Add to Phone</p>
                    <p className="text-ink-secondary text-[11px] mt-0.5">
                      Tap <strong>Install App</strong> or <strong>Add to Home screen</strong>.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Desktop user viewing the site: show QR Code to scan with phone */
              <div className="space-y-3 bg-surface-elevated/60 p-4 rounded-2xl border border-divider text-center">
                <p className="text-xs text-ink-secondary">
                  Scan this QR code with your phone's camera to open Rentu and install it:
                </p>
                <div className="bg-white p-3 rounded-2xl border border-divider w-44 h-44 mx-auto flex items-center justify-center shadow-inner">
                  {qrUri ? (
                    <img src={qrUri} alt="Scan to install on phone" className="w-full h-full object-contain" />
                  ) : (
                    <QrCode className="w-20 h-20 text-zinc-400" />
                  )}
                </div>
                <p className="text-[11px] text-ink-muted">
                  Open on your mobile phone browser to install directly to your home screen.
                </p>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-brand hover:bg-brand/90 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
