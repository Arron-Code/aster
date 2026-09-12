import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-api";
import { sendAdminPushNotification } from "@/lib/push-notifications";

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return unauthorized();

  const result = await sendAdminPushNotification({
    title: "Zema Push ist aktiv",
    body: "Dieses Gerät empfängt jetzt Restaurant-Benachrichtigungen.",
    url: "/admin/orders",
  });

  return NextResponse.json({ success: true, ...result });
}
