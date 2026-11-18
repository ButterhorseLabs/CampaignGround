import Link from "next/link";
import { BrandMark } from "@/components/marketing/brand-mark";

/** Shared frame for login, signup, and invite pages: brand home link over the civic grid. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-civic-grid flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <BrandMark className="size-8" />
        <span className="font-semibold text-[15px]">CampaignGround</span>
      </Link>
      {children}
    </div>
  );
}
