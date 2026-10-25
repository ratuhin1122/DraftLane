"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, SignInButton, SignUpButton, OrganizationSwitcher } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/AccountMenu";
import { PlanButton } from "@/components/PlanButton";

// Shared across every route (root layout). The landing page gets its section links and a way into
// the app. This shared header logo always leads to the public home page.
export function SiteHeader() {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  return (
    <header className="fixed inset-x-0 top-0 z-20 flex h-18 items-center justify-between border-b border-white/6 bg-background/70 gap-2 px-4 sm:px-6 backdrop-blur-md md:px-10">
      <Link href="/" aria-label="DraftLane home" className="flex shrink-0 items-center">
        <Image src="/brand/logo-navbar-dark.png" alt="DraftLane" width={440} height={100} className="h-7 w-auto sm:h-9" preload />
      </Link>
      {isLandingPage && (
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link href="#product" className="transition-colors hover:text-foreground">Product</Link>
          <Link href="#how-it-works" className="transition-colors hover:text-foreground">How it works</Link>
          <Link href="#pricing" className="transition-colors hover:text-foreground">Pricing</Link>
        </nav>
      )}
      <div className="flex min-w-0 items-center gap-1 sm:gap-3">
        {/* <Show> swaps branches once Clerk resolves the session, so the header reflects real auth state */}
        {/* Modal mode opens Clerk's form over the page; /sign-in and /sign-up stay for redirects. */}
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button variant="ghost" size="sm">Sign in</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button size="sm">Get started</Button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          {/* Membership-optional: hidePersonal=false lets a solo user stay on their personal
              account instead of being forced to create/join an org. */}
          {process.env.NEXT_PUBLIC_CLERK_ORGANIZATIONS_ENABLED === "true" && (
            <OrganizationSwitcher afterCreateOrganizationUrl="/dashboard" afterSelectOrganizationUrl="/dashboard" />
          )}
          {isLandingPage ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <PlanButton />
          )}
          <AccountMenu />
        </Show>
      </div>
    </header>
  );
}
