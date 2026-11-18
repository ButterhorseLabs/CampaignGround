# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: a first-time candidate or volunteer campaign manager running for local office (city council, school board, mayor). Small team, little or no paid staff, limited budget. Runs the campaign mostly from a laptop and needs one place to track voters, volunteers, donors, and outreach.

Secondary: campaign members (volunteers) doing canvassing and phone banking, often on a phone in the field. Platform administrators operate the hosted deployment.

## Product Purpose

CampaignGround is a voter, volunteer, donor, and outreach CRM built specifically for local-office campaigns. It exists so small campaigns can organize their work without paying for, or fighting, a generic sales CRM or a tool built for federal races and PACs. Success: a campaign with no technical staff can sign up, invite its team, and run day-to-day outreach entirely in CampaignGround.

## Positioning

Built for local races, not federal PACs. Open source (MIT), free to use on the hosted service, and self-hostable by anyone. Scoped to what a local campaign actually does, without generic-CRM bloat. Nonpartisan: serves any candidate regardless of party or position.

## Operating Context

- Self-service signup at `/signup` creates an account and a new campaign; owners invite teammates by email (Postmark).
- One deployment hosts many campaigns; each has `owner` (full access, including donors/donations) and `member` (everything else) roles.
- Door-to-door canvassing and phone banking happen concurrently across volunteers; a claim/lock system prevents two volunteers from contacting the same voter at once.
- Desktop for planning and management; mobile views exist for field use.
- Public marketing landing page at `/`; signed-in users go to `/dashboard`.

## Capabilities and Constraints

- Eight modules: Dashboard, Voters, Volunteers, Donors, Canvassing, Phone Banking, Events, Tasks.
- Multi-campaign, multi-user, duplicate-contact prevention, team invites with bounce handling.
- Every mutating API route is zod-validated and rate-limited.
- Stack: Next.js 16 (App Router), React 19, TypeScript, Prisma/PostgreSQL, Tailwind CSS 4 + shadcn/ui, Bun, Docker on Railway.
- Must stay easy for anyone to deploy and run ("white-glove" openness): avoid features or dependencies that make self-hosting hard.
- Open: specific campaign-finance and election compliance obligations are not yet defined. Do not claim compliance with any regulation until confirmed.

## Brand Commitments

- Name: CampaignGround. Brand icon: the app's Vote mark (`src/components/marketing/brand-mark.tsx`).
- Voice is plain and practical, aimed at local candidates (e.g. "Built for local races, not federal PACs").
- Nonpartisan in all copy, examples, and imagery: no party colors, slogans, or ideological framing.

## Evidence on Hand

- Product screenshots: `docs/screenshots/` (dashboard, voter detail, canvass, phone bank, donors, events, tasks, volunteers, mobile dashboard, mobile voters).
- Architecture and domain model: `docs/ARCHITECTURE.md`. Changelog: `CHANGELOG.md`.
- No testimonials, customer names, logos, usage numbers, or press exist. Never fabricate them.

## Product Principles

1. Local first: design for a small, under-resourced team, not a professional political operation.
2. Open and easy: anyone can use it free or deploy it themselves without expert help.
3. Nonpartisan by default: the tool serves every candidate equally.
4. Protect voter and donor data: privacy and least-privilege access over convenience.
5. Prevent wasted effort: features exist to keep volunteers from duplicating or losing work.

## Accessibility & Inclusion

An accessibility standard is required; the exact level is not yet chosen (WCAG 2.2 AA is the working assumption until confirmed). Volunteers span ages and technical comfort and often work outdoors on phones, so field flows must stay legible and usable on small screens.
