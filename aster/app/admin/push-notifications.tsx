"use client";

import { useEffect, useState } from "react";

type PushConfig = {
  enabled: boolean;
  publicKey: string | null;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function PushNotifications() {
  const [status, setStatus] = useState("Push wird geprüft...");
  const [canSubscribe, setCanSubscribe] = useState(false);

  useEffect(() => {
    async function load() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setStatus("Push wird von diesem Browser nicht unterstützt.");
        return;
      }

      const response = await fetch("/api/push/config", { cache: "no-store" });
      const config = (await response.json()) as PushConfig;
      if (!config.enabled || !config.publicKey) {
        setStatus("Push ist serverseitig noch nicht konfiguriert.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setCanSubscribe(true);
      setStatus(existing ? "Push ist auf diesem Gerät aktiv." : "Push ist verfügbar.");
    }

    void load().catch((error: unknown) => {
      console.error("Push-Status konnte nicht geladen werden.", error);
      setStatus("Push-Status konnte nicht geladen werden.");
    });
  }, []);

  async function subscribe() {
    const response = await fetch("/api/push/config", { cache: "no-store" });
    const config = (await response.json()) as PushConfig;
    if (!config.enabled || !config.publicKey) {
      setStatus("Push ist serverseitig noch nicht konfiguriert.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("Benachrichtigungen wurden nicht erlaubt.");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });

    const saveResponse = await fetch("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });

    if (!saveResponse.ok) {
      setStatus("Push-Abo konnte nicht gespeichert werden.");
      return;
    }

    await fetch("/api/admin/push/test", { method: "POST" });
    setStatus("Push ist auf diesem Gerät aktiv.");
  }

  return (
    <div className="admin-push-card" aria-live="polite">
      <div>
        <strong>Push-Benachrichtigungen</strong>
        <small>{status}</small>
      </div>
      <button type="button" onClick={subscribe} disabled={!canSubscribe}>
        Aktivieren
      </button>
    </div>
  );
}
