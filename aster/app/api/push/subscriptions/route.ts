import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: NextRequest) {
  const denied = await guard(request);
  if (denied) return denied;

  const subscription = subscriptionSchema.parse(await request.json());
  const saved = await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: request.headers.get("user-agent"),
    },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: request.headers.get("user-agent"),
    },
  });

  return NextResponse.json({ success: true, id: saved.id });
}

export async function DELETE(request: NextRequest) {
  const denied = await guard(request);
  if (denied) return denied;

  const { endpoint } = z.object({ endpoint: z.string().url() }).parse(await request.json());
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });

  return NextResponse.json({ success: true });
}
