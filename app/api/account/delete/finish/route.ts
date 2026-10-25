import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { finishAccountDeletion } from "@/lib/account-deletion";
const receipt = z.object({ jobId: z.string().min(1).max(100), token: z.string().regex(/^[a-f0-9]{64}$/) });
export async function POST(request: Request) {
  const input = receipt.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Invalid deletion receipt." }, { status: 400 });
  try {
    const result = await finishAccountDeletion(input.data.jobId, input.data.token, async userId => {
      const clerk = await clerkClient();
      try { await clerk.users.deleteUser(userId); }
      catch (error) { if ((error as { status?: number }).status !== 404) throw error; }
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid deletion receipt") return Response.json({ error: "Invalid deletion receipt." }, { status: 403 });
    console.error("Account deletion needs retry", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ error: "Deletion could not finish. Retry to complete cleanup. If Clerk blocks deletion, check your organization ownership and billing settings." }, { status: 503 });
  }
}
