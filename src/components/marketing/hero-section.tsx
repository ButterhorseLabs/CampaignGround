import Link from "next/link";
import { getImageProps, type StaticImageData } from "next/image";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import dashboardLight from "@/components/marketing/screenshots/dashboard-light.webp";
import dashboardDark from "@/components/marketing/screenshots/dashboard-dark.webp";
import mobileDashboardLight from "@/components/marketing/screenshots/mobile-dashboard-light.webp";
import mobileDashboardDark from "@/components/marketing/screenshots/mobile-dashboard-dark.webp";

const SHOT_ALT =
  "The CampaignGround dashboard: a city council campaign 47 days from election, with voter and volunteer totals.";

const PROOF = ["Free to use", "Open source (MIT)", "Self-host anytime", "Nonpartisan"];

// The hero is the LCP image, so it loads eagerly. <picture> art direction
// means a phone downloads only the small crop, never the hidden desktop shot.
function HeroShot({ desktop, mobile, className }: { desktop: StaticImageData; mobile: StaticImageData; className: string }) {
  const common = { alt: SHOT_ALT, loading: "eager", fetchPriority: "high" } as const;
  const desktopProps = getImageProps({ ...common, src: desktop, sizes: "(min-width: 1024px) 760px, 100vw" }).props;
  const mobileProps = getImageProps({ ...common, src: mobile, sizes: "384px" }).props;
  return (
    <picture className={className}>
      <source media="(min-width: 768px)" srcSet={desktopProps.srcSet} sizes={desktopProps.sizes} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
      <img
        {...mobileProps}
        style={{ "--desktop-ar": `${desktop.width} / ${desktop.height}` } as React.CSSProperties}
        className="w-full h-auto md:aspect-(--desktop-ar)"
      />
    </picture>
  );
}

export function HeroSection() {
  return (
    <section className="bg-civic-grid border-b overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 md:px-6 pt-16 pb-12 md:pt-24 md:pb-20 grid gap-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14 items-center">
        <div className="flex flex-col items-start gap-6">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-balance">
            Built for local races, not federal PACs.
          </h1>
          <p className="text-lg text-muted-foreground text-pretty">
            CampaignGround is a free campaign tool for city council, school
            board, and mayor races. Track voters, volunteers, donors, door
            knocks, and calls in one place, without the bloat of a generic
            sales CRM.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button size="lg" className="h-11 sm:h-10" asChild>
              <Link href="/signup">Start your campaign</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-11 sm:h-10" asChild>
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-foreground/80">
            {PROOF.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="size-4 text-primary shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <figure className="lg:-mr-24 xl:-mr-40">
          <div className="mx-auto max-w-sm md:max-w-none rounded-xl border bg-card shadow-sm overflow-hidden">
            <HeroShot desktop={dashboardLight} mobile={mobileDashboardLight} className="block dark:hidden" />
            <HeroShot desktop={dashboardDark} mobile={mobileDashboardDark} className="hidden dark:block" />
          </div>
          <figcaption className="mt-3 text-xs text-muted-foreground">
            The dashboard for a sample campaign.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
