"use server";

import { currentUser } from "@clerk/nextjs/server";
import { lockAccount } from "@/lib/account-deletion";
import { prisma } from "@/lib/prisma";

// Looks up the local User row by clerkId, creating it on first sight.
// Plans and subscriptions live in Clerk, not here.
export async function checkUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  return prisma.$transaction(async tx => {
    await lockAccount(tx, clerkUser.id);
    if (await tx.accountDeletion.findUnique({ where: { clerkId: clerkUser.id } })) return null;
    return tx.user.upsert({
      where: { clerkId: clerkUser.id },
      create: { clerkId: clerkUser.id, email, name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || null, imageUrl: clerkUser.imageUrl },
      update: {},
    });
  });
}
