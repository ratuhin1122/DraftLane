import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MapAnnotations } from "./_components/MapAnnotations";
import { CanvasMock, DocsMock } from "./_components/SurfaceVisuals";
import { PricingPlans } from "@/components/PricingPlans";
import { AUDIENCES, STEPS, SURFACES } from "./_data/landing";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* DraftLane hero, framed by a quiet drafting grid */}
      <section className="topo-bg px-6 pt-10 pb-24 md:px-10 md:pt-16">
        <MapAnnotations />
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <SectionLabel>From first draft to shared direction</SectionLabel>

          <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            Your next idea.
            <br /><span className="text-primary">A clearer way forward.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Sketch the possibilities. Shape the plan. DraftLane brings your
            canvas, documents, and AI collaborator into one shared workspace.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2 text-base">
              <Link href="/sign-up">
                Start building free <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base">
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-2xl shadow-primary/5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
            <span className="text-sm font-medium">The next big idea / Product launch</span>
            <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs text-primary">DRAFT → REFINE → ALIGN</span>
          </div>
          <div className="grid gap-px bg-white/10 md:grid-cols-2">
            <div className="bg-card p-5"><p className="mb-4 font-mono text-xs text-muted-foreground">01 / MAP THE POSSIBILITIES</p><CanvasMock /></div>
            <div className="bg-card p-5"><p className="mb-4 font-mono text-xs text-muted-foreground">02 / MAKE THE PLAN CLEAR</p><DocsMock /></div>
          </div>
          <p className="border-t border-white/10 px-6 py-3 text-xs text-muted-foreground">A preview of your workspace: connected thinking, from sketch to spec.</p>
        </div>
      </section>

      {/* Social proof — short and factual since there's no real customer logos yet at early access */}
      <section className="border-t border-white/10 px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm text-muted-foreground">
            Built for teams who sketch first and write specs second
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-muted-foreground/70">
            {AUDIENCES.map((audience) => (
              <span key={audience}>{audience}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Canvas + docs + team — the proof that this is a "workspace," not just a canvas app.
          The rows' copy lives in _data/landing.ts. */}
      <section
        id="product"
        className="border-t border-white/10 px-6 py-24 md:px-10"
      >
        <div className="mx-auto max-w-5xl">
          <div className="max-w-xl">
            <SectionLabel>01 · Surfaces</SectionLabel>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              One agent, one workspace, your whole team
            </h2>
            <p className="mt-4 text-muted-foreground">
              Keep the thinking connected. Your workspace agent
              reasons across your canvas and your docs, turning a rough sketch
              into a written spec without you copying anything by hand. And your
              team is right there with you.
            </p>
          </div>

          <div className="mt-16 flex flex-col gap-20">
            {SURFACES.map(({ icon: Icon, visual: Visual, ...surface }, i) => (
              <SurfaceRow
                key={surface.title}
                reverse={i % 2 === 1}
                icon={<Icon className="size-5" />}
                visual={<Visual />}
                {...surface}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How it works — sets expectations for the shape-by-shape drawing before the CTA */}
      <section
        id="how-it-works"
        className="border-t border-white/10 px-6 py-24 md:px-10"
      >
        <div className="mx-auto max-w-5xl">
          <SectionLabel>02 · The route</SectionLabel>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            A little direction. A lot of possibility.
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Step
                key={step.title}
                number={String(i + 1).padStart(2, "0")}
                title={step.title}
              >
                {step.body}
              </Step>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing: the same plans, prices and checkout as the pricing page, straight from Clerk */}
      <section
        id="pricing"
        className="border-t border-white/10 px-6 py-24 md:px-10"
      >
        <div className="mx-auto mb-12 max-w-5xl text-center">
          <SectionLabel>03 · Pricing</SectionLabel>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Start free, upgrade when it clicks
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Upgrade just yourself, or your whole team, billed per member.
          </p>
        </div>
        <PricingPlans />
      </section>

      {/* Closing CTA, back over the map so the page opens and closes on it */}
      <section className="topo-bg border-t border-white/10 px-6 py-28 md:px-10">
        <MapAnnotations />
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <Image
            src="/brand/mascot-dark.png"
            alt=""
            width={40}
            height={40}
            className="opacity-80"
          />
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Take the idea out of your head.
          </h2>
          <Button asChild size="lg" className="gap-2 text-base">
            <Link href="/sign-up">
              Get started free <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-muted-foreground md:px-10">
        DraftLane · Space to think. Direction to build.
      </footer>
    </div>
  );
}

function SurfaceRow({
  icon,
  title,
  description,
  bullets,
  reverse,
  visual,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  bullets: string[];
  reverse?: boolean;
  visual: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-10 md:flex-row md:items-center ${
        reverse ? "md:flex-row-reverse" : ""
      }`}
    >
      <div className="flex-1">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {icon}
        </div>
        <h3 className="mt-4 text-xl font-medium">{title}</h3>
        <p className="mt-2 text-muted-foreground">{description}</p>
        <ul className="mt-5 space-y-2.5">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-2.5 text-sm text-muted-foreground"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              {bullet}
            </li>
          ))}
        </ul>
      </div>
      {/* Static mock UI for each surface */}
      <div className="flex-1">{visual}</div>
    </div>
  );
}

// Map-legend style eyebrow above a heading, matching the corner annotations.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary/80">
      <span className="size-1.5 rotate-45 border border-primary/70" />
      {children}
    </p>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* Waypoint on a dashed trail, so the steps read as one route */}
      <div className="flex items-center gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/60 font-mono text-[10px] text-primary">
          {number}
        </span>
        <span className="h-px flex-1 border-t border-dashed border-white/15" />
      </div>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
