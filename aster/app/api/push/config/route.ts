import { NextResponse } from "next/server";
import { getPushPublicConfig } from "@/lib/push-notifications";

export async function GET() {
  return NextResponse.json(getPushPublicConfig());
}
