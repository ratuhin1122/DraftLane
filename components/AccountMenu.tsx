"use client";
import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
export function AccountMenu() {
  const router = useRouter();
  return <UserButton userProfileProps={{ appearance: { elements: { profileSection__danger: { display: "none" } } } }}>
    <UserButton.MenuItems>
      <UserButton.Action label="Delete account" labelIcon={<Trash2 className="size-4" />} onClick={() => router.push("/account")} />
    </UserButton.MenuItems>
  </UserButton>;
}
