import React, { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { CloudOff, Download, RefreshCw, Share, X } from 'lucide-react';

/**
 * Événement propriétaire Chromium déclenché lorsque l'application satisfait
 * les critères d'installabilité. Non typé par la lib DOM standard.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 h

const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // Safari iOS n'expose pas display-mode avant iOS 16.4.
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIosSafari = (): boolean => {
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ se présente comme un Mac tactile.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iOS && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
};

/**
 * Pilotage du cycle de vie PWA : enregistrement du service worker, proposition
 * d'installation, notification de mise à jour et état de connectivité.
 */
export const PwaManager: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Recherche périodique d'une nouvelle version (onglet resté ouvert).
      window.setInterval(() => {
        registration.update().catch(() => undefined);
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setShowIosHint(false);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    // iOS ne propose aucune API d'installation : on affiche la marche à suivre.
    if (isIosSafari() && !isStandalone()) {
      const dismissed = window.localStorage.getItem('mbt-ios-install-dismissed');
      if (!dismissed) setShowIosHint(true);
    }
  }, []);

  useEffect(() => {
    if (!offlineReady) return;
    const timer = window.setTimeout(() => setOfflineReady(false), 6000);
    return () => window.clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  const handleInstall = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setInstallEvent(null);
  }, [installEvent]);

  const dismissIosHint = useCallback(() => {
    window.localStorage.setItem('mbt-ios-install-dismissed', '1');
    setShowIosHint(false);
  }, []);

  return (
    <div className="fixed bottom-12 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">
      {isOffline && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-mono text-amber-800 shadow-lg">
          <CloudOff className="w-3.5 h-3.5" />
          Mode hors-ligne : calculs et exports restent disponibles
        </div>
      )}

      {offlineReady && !needRefresh && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-[11px] font-mono text-emerald-800 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Application disponible hors-ligne
        </div>
      )}

      {needRefresh && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-xl">
          <div className="text-[11px] text-slate-700">
            <p className="font-semibold text-slate-900">Nouvelle version disponible</p>
            <p className="font-mono text-[10px] text-slate-500">Le modèle en cours n'est pas conservé.</p>
          </div>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Mettre à jour
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            aria-label="Plus tard"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {installEvent && (
        <button
          type="button"
          onClick={() => void handleInstall()}
          className="pointer-events-auto flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-800 shadow-xl hover:bg-slate-50"
        >
          <Download className="w-3.5 h-3.5 text-red-600" />
          Installer l'application
        </button>
      )}

      {showIosHint && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] text-slate-700 shadow-xl">
          <Share className="w-3.5 h-3.5 text-red-600" />
          <span>
            Pour installer : <span className="font-semibold">Partager</span> puis{' '}
            <span className="font-semibold">Sur l'écran d'accueil</span>
          </span>
          <button
            type="button"
            onClick={dismissIosHint}
            aria-label="Fermer"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
