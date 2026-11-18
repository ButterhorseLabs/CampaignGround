import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REPO_URL, SELF_HOST_URL } from "@/components/marketing/links";

// Every line here must stay true in the code: owner-only donor routes,
// per-campaign membership checks, and validated, rate-limited writes.
const DATA_FACTS = [
  "Each campaign's voters and contact notes are visible only to people you invite to it.",
  "Donors, donations, and fundraising totals are visible only to campaign owners.",
  "Every change is checked against your role in that campaign before it is saved.",
  "Prefer to hold the data yourself? Run your own copy and nothing leaves your server.",
];

export function OpenSection() {
  return (
    <section
      id="free-and-open-source"
      aria-labelledby="open-title"
      className="mx-auto max-w-6xl px-4 md:px-6 py-16 md:py-24 grid gap-12 lg:grid-cols-2 lg:gap-20 scroll-mt-16"
    >
      <div className="max-w-lg">
        <h2 id="open-title" className="text-3xl font-semibold tracking-tight text-balance">
          Free, open source, and nonpartisan
        </h2>
        <div className="mt-4 space-y-3 text-muted-foreground text-pretty">
          <p>
            CampaignGround costs nothing to use. The code is public under the
            MIT License, so anyone can check how it handles your data, and
            your campaign never depends on a vendor staying in business.
          </p>
          <p>
            Every candidate gets the same tool, whatever their party.
            Maintained by ButterhorseLabs.
          </p>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button variant="outline" className="h-11 sm:h-9" asChild>
            <a href={REPO_URL}>
              <Github aria-hidden />
              Read the code on GitHub
            </a>
          </Button>
          <Button variant="ghost" className="h-11 sm:h-9" asChild>
            <a href={SELF_HOST_URL}>Run your own copy</a>
          </Button>
        </div>
      </div>

      <div className="max-w-lg">
        <h3 className="text-lg font-semibold tracking-tight text-balance">Who can see your campaign&apos;s data</h3>
        <ul className="mt-4 divide-y border-y text-sm">
          {DATA_FACTS.map((fact) => (
            <li key={fact} className="py-3 text-pretty">{fact}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
