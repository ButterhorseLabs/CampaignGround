import { MarketingNav } from "@/components/marketing/marketing-nav";
import { HeroSection } from "@/components/marketing/hero-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { OpenSection } from "@/components/marketing/open-section";
import { CtaBand } from "@/components/marketing/cta-band";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-sm focus:ring-[3px] focus:ring-ring/50"
      >
        Skip to content
      </a>
      <MarketingNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <HeroSection />
        <FeaturesSection />
        <OpenSection />
        <CtaBand />
      </main>
      <MarketingFooter />
    </div>
  );
}
