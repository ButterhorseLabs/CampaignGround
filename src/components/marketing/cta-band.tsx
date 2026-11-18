import Link from "next/link";
import { Button } from "@/components/ui/button";

// Light: a deep emerald band. Dark: the night-emerald primary is too bright for
// a full-bleed surface, so the band becomes a card surface and the button
// carries the emerald.
export function CtaBand() {
  return (
    <section className="bg-primary text-primary-foreground dark:bg-card dark:text-card-foreground dark:border-y">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-16 text-center flex flex-col items-center gap-5">
        <h2 className="text-3xl font-semibold tracking-tight text-balance">
          Ready to run your campaign?
        </h2>
        <p className="text-primary-foreground/80 dark:text-muted-foreground max-w-xl text-balance">
          Create your campaign, import your voter list, and invite your team.
          Free, with no credit card.
        </p>
        <Button
          size="lg"
          variant="secondary"
          className="h-11 sm:h-10 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
          asChild
        >
          <Link href="/signup">Start your campaign</Link>
        </Button>
      </div>
    </section>
  );
}
