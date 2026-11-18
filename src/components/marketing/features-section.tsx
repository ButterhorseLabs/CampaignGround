import {
  LayoutDashboard,
  Users,
  HeartHandshake,
  DollarSign,
  CalendarDays,
  ListTodo,
} from "lucide-react";
import { ThemedShot } from "@/components/marketing/themed-shot";
import walklistLight from "@/components/marketing/screenshots/walklist-light.webp";
import walklistDark from "@/components/marketing/screenshots/walklist-dark.webp";
import mobileCanvassLight from "@/components/marketing/screenshots/mobile-canvass-light.webp";
import mobileCanvassDark from "@/components/marketing/screenshots/mobile-canvass-dark.webp";

// Canvassing and phone banking are covered by the rows above, so the module
// list only carries the rest.
const MODULES = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "Days to election, fundraising progress, and contact totals at a glance.",
  },
  {
    icon: Users,
    title: "Voters",
    description: "Import your voter list from a spreadsheet and track support for every contact.",
  },
  {
    icon: HeartHandshake,
    title: "Volunteers",
    description: "Keep your roster: who's helping, their role, and the hours they've put in.",
  },
  {
    icon: DollarSign,
    title: "Donors",
    description: "Record contributions and see progress toward your fundraising goal.",
  },
  {
    icon: CalendarDays,
    title: "Events",
    description: "Plan town halls and meet-and-greets, and track who's coming.",
  },
  {
    icon: ListTodo,
    title: "Tasks",
    description: "Assign follow-ups and see who is doing what.",
  },
];

export function FeaturesSection() {
  return (
    <>
      <section
        id="how-it-works"
        aria-labelledby="how-it-works-title"
        className="mx-auto max-w-6xl px-4 md:px-6 py-16 md:py-24 scroll-mt-16"
      >
        <h2 id="how-it-works-title" className="text-3xl font-semibold tracking-tight max-w-xl text-balance">
          Made for the way small campaigns actually work
        </h2>

        <div className="mt-12 md:mt-16 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:gap-20 items-center">
          <div className="max-w-lg">
            <h3 className="text-xl font-semibold tracking-tight text-balance">No two volunteers knock the same door</h3>
            <p className="mt-3 text-muted-foreground text-pretty">
              When a canvasser opens a door from the walk list, CampaignGround
              holds that address for them, including everyone who lives there.
              Teammates see who is already knocking, so volunteers spread out
              instead of doubling up. Phone banking holds each call the same way.
            </p>
          </div>
          <div className="w-full max-w-[26rem] md:justify-self-end">
            <ThemedShot
              light={walklistLight}
              dark={walklistDark}
              alt="A Lincoln Square walk list where two doors are marked as already being knocked by other volunteers."
              sizes="(min-width: 768px) 416px, 100vw"
              className="w-full h-auto rounded-xl"
            />
          </div>
        </div>

        <div className="mt-16 md:mt-24 grid gap-10 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-20 items-center">
          <div className="max-w-lg md:order-2">
            <h3 className="text-xl font-semibold tracking-tight text-balance">Works on the phone in a volunteer&apos;s hand</h3>
            <p className="mt-3 text-muted-foreground text-pretty">
              Canvassers log each knock from the sidewalk: who answered, where
              they stand, and whether they want a yard sign. Invite volunteers
              by email. Each one gets their own login, at no cost, and logs
              contacts as themselves.
            </p>
          </div>
          <div className="md:order-1 justify-self-center md:justify-self-start w-full max-w-[16rem] rounded-[1.75rem] border-[6px] border-foreground/85 dark:border-muted shadow-sm overflow-hidden">
            <ThemedShot
              light={mobileCanvassLight}
              dark={mobileCanvassDark}
              alt="Logging a door knock on a phone: outcome, support level, and yard sign for one voter."
              sizes="256px"
              className="w-full h-auto"
            />
          </div>
        </div>

        <div className="mt-16 md:mt-24 grid gap-10 md:grid-cols-3 md:gap-12 border-t pt-10 md:pt-12">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-balance">Bring the voter list you already have</h3>
            <p className="mt-2 text-muted-foreground text-pretty">
              Upload a CSV from your county or a spreadsheet. CampaignGround
              matches the columns, groups voters by address and precinct, and
              skips duplicates.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-balance">Donor records stay with the candidate&apos;s team</h3>
            <p className="mt-2 text-muted-foreground text-pretty">
              Only campaign owners can see donors, donations, and fundraising
              totals. Members get everything else they need to knock, call, and
              organize.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-balance">One login, more than one race</h3>
            <p className="mt-2 text-muted-foreground text-pretty">
              Help with several campaigns from a single account. Each campaign
              keeps its own voters, team, and roles.
            </p>
          </div>
        </div>
      </section>

      <section
        id="features"
        aria-labelledby="features-title"
        className="border-t bg-sidebar/60 scroll-mt-16"
      >
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-16 md:py-20">
          <h2 id="features-title" className="text-2xl font-semibold tracking-tight text-balance">
            Everything else a local campaign runs on
          </h2>
          <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <li key={m.title}>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <m.icon className="size-4 text-primary shrink-0" aria-hidden />
                  {m.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{m.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
