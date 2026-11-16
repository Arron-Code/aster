import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/admin-api";
import { sendAdminPushNotification } from "@/lib/push-notifications";

export async function POST(request: NextRequest) {
  const denied = await guard(request);
  if (denied) return denied;

  const result = await sendAdminPushNotification({
    title: "Zema Push ist aktiv",
    body: "Dieses Gerät empfängt jetzt Restaurant-Benachrichtigungen.",
    url: "/admin/orders",
  });

  return NextResponse.json({ success: true, ...result });
}
