import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { purgeLocalAccountData } from "@/lib/account-deletion";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest) {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) return new Response("Webhook not configured", { status: 503 });
  let event;
  try { event = await verifyWebhook(request); }
  catch { return new Response("Invalid webhook signature", { status: 400 }); }
  if (event.type === "user.deleted" && event.data.id) {
    await purgeLocalAccountData(event.data.id);
    await prisma.accountDeletion.deleteMany({ where: { clerkId: event.data.id } });
  }
  return new Response("OK");
}
