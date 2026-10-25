import { auth } from "@clerk/nextjs/server";
import { startAccountDeletion } from "@/lib/account-deletion";
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in to delete your account." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.accountId !== userId) return Response.json({ error: "The signed-in account changed. Reload and confirm again." }, { status: 409 });
  if (body?.confirmation !== "DELETE") return Response.json({ error: "Type DELETE to confirm permanent account deletion." }, { status: 400 });
  return Response.json(await startAccountDeletion(userId), { headers: { "Cache-Control": "no-store" } });
}
