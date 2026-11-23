import Link from "next/link";
import { BrandMark } from "@/components/marketing/brand-mark";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Text links on auth pages: a 44px tap area on phones, inline on desktop. */
export const authLinkClass =
  "inline-flex min-h-11 items-center text-primary underline underline-offset-2 md:min-h-0";

/**
 * Shared frame for login, signup, password reset, and invite pages: brand home
 * link over the civic grid, then one card whose title is the page's h1.
 */
export function AuthShell({ title, description, footer, wide, children }: {
  title: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  /** Signup's two-column fields need more room than a single sign-in form. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-civic-grid flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <Link
        href="/"
        className="flex min-h-11 items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <BrandMark className="size-8" />
        <span className="font-semibold text-[15px]">CampaignGround</span>
      </Link>
      <main className={cn("w-full", wide ? "max-w-lg" : "max-w-sm")}>
        <Card>
          <CardHeader>
            <CardTitle>
              <h1>{title}</h1>
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">{children}</CardContent>
          {footer && (
            <CardFooter>
              <p className="text-sm text-muted-foreground">{footer}</p>
            </CardFooter>
          )}
        </Card>
      </main>
    </div>
  );
}
