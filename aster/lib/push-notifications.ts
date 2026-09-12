import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { prisma } from "@/lib/prisma";

type PushMessage = {
  title: string;
  body: string;
  url?: string;
};

function pushConfig() {
  const subject = process.env.VAPID_SUBJECT || process.env.APP_URL || "mailto:admin@example.com";
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  return {
    enabled: Boolean(publicKey && privateKey),
    publicKey,
    privateKey,
    subject,
  };
}

export function getPushPublicConfig() {
  const config = pushConfig();
  return {
    enabled: config.enabled,
    publicKey: config.publicKey ?? null,
  };
}

function configureWebPush() {
  const config = pushConfig();
  if (!config.enabled || !config.publicKey || !config.privateKey) return false;

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return true;
}

export async function sendAdminPushNotification(message: PushMessage) {
  if (!configureWebPush()) return { sent: 0, skipped: true };

  const subscriptions = await prisma.pushSubscription.findMany();
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const pushSubscription: WebPushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, JSON.stringify(message));
        sent += 1;
      } catch (error) {
        if (
          error instanceof webpush.WebPushError
          && (error.statusCode === 404 || error.statusCode === 410)
        ) {
          await prisma.pushSubscription.delete({ where: { endpoint: subscription.endpoint } });
          return;
        }

        console.error("Push-Benachrichtigung konnte nicht gesendet werden.", error);
      }
    }),
  );

  return { sent, skipped: false };
}
