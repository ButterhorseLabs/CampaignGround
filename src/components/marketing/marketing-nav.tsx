import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/marketing/brand-mark";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#free-and-open-source", label: "Free & open source" },
];

// Phones get Log in and the primary action only; the section links are a
// scroll away, so no menu sheet is needed.
export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
        <Link
          href="/"
          aria-label="CampaignGround home"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <BrandMark className="size-8" />
          <span className="hidden sm:inline font-semibold text-[15px]">CampaignGround</span>
        </Link>

        <nav aria-label="Main" className="hidden md:flex items-center gap-2">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" className="h-11 md:h-9" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button className="h-11 md:h-9" asChild>
            <Link href="/signup">Start your campaign</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
