"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function PwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error("Service Worker konnte nicht registriert werden.", error);
      });
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setShowIosHint(isIos && !isStandalone());
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  async function install() {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  }

  if (!deferredPrompt && !showIosHint) return null;

  return (
    <aside className="pwa-install" aria-label="App installieren">
      {deferredPrompt ? (
        <button className="pwa-install-button" type="button" onClick={install}>
          App installieren
        </button>
      ) : (
        <p>
          Diese App im Browser teilen und <strong>„Zum Home-Bildschirm“</strong> wählen.
        </p>
      )}
    </aside>
  );
}
