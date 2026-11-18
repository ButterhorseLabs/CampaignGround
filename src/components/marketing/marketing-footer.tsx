import Link from "next/link";
import { BrandMark } from "@/components/marketing/brand-mark";
import { LICENSE_URL, REPO_URL, SELF_HOST_URL } from "@/components/marketing/links";

const linkClass =
  "inline-flex min-h-10 sm:min-h-6 items-center rounded-sm hover:text-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-10 flex flex-col gap-8 md:flex-row md:items-start md:justify-between text-sm text-muted-foreground">
        <div className="flex flex-col gap-2 max-w-xs">
          <div className="flex items-center gap-2 text-foreground">
            <BrandMark className="size-5" />
            <span className="font-medium">CampaignGround</span>
          </div>
          <p className="text-pretty">
            Free, open-source campaign software for local races. Released under
            the MIT License.
          </p>
          <p>Maintained by ButterhorseLabs.</p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-1 sm:gap-y-2">
          <a href={REPO_URL} className={linkClass}>GitHub</a>
          <Link href="/signup" className={linkClass}>Start your campaign</Link>
          <a href={SELF_HOST_URL} className={linkClass}>Run your own copy</a>
          <Link href="/login" className={linkClass}>Log in</Link>
          <a href={LICENSE_URL} className={linkClass}>MIT License</a>
        </nav>
      </div>
    </footer>
  );
}
