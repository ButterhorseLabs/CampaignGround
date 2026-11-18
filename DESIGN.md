---
name: CampaignGround
description: The campaign CRM built for city council, school board, and mayor.
colors:
  civic-emerald: "oklch(0.42 0.09 155)"
  civic-emerald-foreground: "oklch(0.99 0.005 120)"
  civic-emerald-ring: "oklch(0.5 0.09 155)"
  ballot-amber: "oklch(0.72 0.13 75)"
  ballot-amber-foreground: "oklch(0.22 0.04 75)"
  warm-parchment: "oklch(0.985 0.008 120)"
  paper-white: "oklch(1 0 0)"
  commons-ink: "oklch(0.18 0.02 150)"
  slate-sage: "oklch(0.48 0.02 150)"
  sage-wash: "oklch(0.96 0.012 130)"
  sidebar-sage: "oklch(0.97 0.01 130)"
  sidebar-sage-hover: "oklch(0.93 0.018 130)"
  hover-sage: "oklch(0.94 0.018 130)"
  meadow-line: "oklch(0.9 0.012 130)"
  field-line: "oklch(0.92 0.012 130)"
  alert-brick: "oklch(0.55 0.22 28)"
  night-commons: "oklch(0.16 0.015 150)"
  night-card: "oklch(0.21 0.018 150)"
  night-emerald: "oklch(0.72 0.13 155)"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "\"ss01\", \"cv11\""
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  stat:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
    fontFeature: "\"ss01\", \"cv11\""
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.05em"
  wordmark:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.25
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.625rem"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.civic-emerald}"
    textColor: "{colors.civic-emerald-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.warm-parchment}"
    textColor: "{colors.commons-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.hover-sage}"
    textColor: "{colors.commons-ink}"
  button-secondary:
    backgroundColor: "{colors.sage-wash}"
    textColor: "{colors.commons-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.alert-brick}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.commons-ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.commons-ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  badge:
    backgroundColor: "{colors.civic-emerald}"
    textColor: "{colors.civic-emerald-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  nav-item:
    textColor: "{colors.commons-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  nav-item-active:
    backgroundColor: "{colors.civic-emerald}"
    textColor: "{colors.civic-emerald-foreground}"
  nav-item-hover:
    backgroundColor: "{colors.sidebar-sage-hover}"
---

# Design System: CampaignGround

## Overview

**Creative North Star: "The Civic Commons"**

CampaignGround should feel like a well-kept public space: open, welcoming, and owned by the community that uses it. A first-time candidate should walk in and immediately know where things are. The world is warm paper and civic green, never glossy, never partisan, never the slick dashboard of a well-funded operation. Trust comes from calm order, not from spectacle.

Surfaces are quiet and dependable. The interface leans flat: hairline sage borders separate regions, and shadows appear only as a soft lift under cards and pressed controls. Color is reserved for meaning: emerald marks the current place and the primary action, amber marks a highlight in data, and the status ramp carries voter support and task state. Hover and focus answer in a quiet sage tint. Everything else is ink on parchment.

Density is moderate. Operate screens (dashboard, voters, canvassing) carry real data in compact type with tabular numbers; the public landing page opens up with larger type, centered composition, and the civic grid texture behind it.

**Key Characteristics:**
- Warm parchment ground with green-tinted neutrals; pure white only on cards and popovers.
- One civic emerald for identity, active navigation, and primary actions.
- Ballot amber as the sole secondary hue, for highlights in data, never for hover or large fills.
- Hairline borders and soft, small shadows; no heavy elevation.
- Geist throughout, with small uppercase labels for section and metadata text.
- Full light and dark themes driven by the same token names.

## Colors

A green-tinted civic palette: one deep emerald, one warm amber, and parchment neutrals that all lean toward hue 120–155 so nothing reads as cold gray.

### Primary
- **Civic Emerald**: the brand and the "you are here" color. Primary buttons, the active sidebar item, the brand-mark tile, primary badges, focus rings (as Civic Emerald Ring), text selection, and the landing page CTA band. In dark mode it lifts to Night Emerald for contrast.

### Secondary
- **Ballot Amber**: the warm counterpoint, exposed as the `highlight` token. The "contacted" series in precinct progress and the second chart series. Small areas only; it reads as a highlight, not a surface.

### Tertiary
- **Alert Brick**: destructive buttons, invalid field borders and rings, and error states. Never decorative.

### Neutral
- **Warm Parchment**: the app and page background. Faintly yellow-green, never pure white.
- **Paper White**: cards, popovers, and dialogs, so content sits slightly above the parchment.
- **Commons Ink**: body and heading text, a near-black with a green undertone.
- **Slate Sage**: muted text, descriptions, metadata, placeholder text, and inactive icons.
- **Sage Wash**: secondary buttons and muted fills.
- **Hover Sage**: the shared hover and keyboard-focus surface (shadcn's `accent` token) for outline and ghost buttons, menu items, select options, and table rows.
- **Sidebar Sage** / **Sidebar Sage Hover**: the sidebar panel and its hover state.
- **Meadow Line**: all borders and dividers. **Field Line**: input borders, a touch lighter.
- **Night Commons** / **Night Card**: dark-theme background and card surfaces; dark borders are white at 10% (inputs at 15%).

### Status and Data Colors
Support levels, task priority, and stat-card icon tiles use the standard Tailwind hue ramps (emerald, lime, amber, orange, red, slate, violet) as tinted pills: a 100-step fill, 800-step text, and 200-step border in light mode; a 950-step fill at 50%, 300-step text, and 900-step border in dark mode, with a 500-step dot. Charts use five fixed series: emerald, amber, red, teal, magenta.

### Named Rules
**The Earned Color Rule.** Emerald and amber only mean something: the current location, the primary action, a highlight in data. Hover is never a hue; it is Hover Sage. If a fill is not one of those, it is a neutral.

**The Nonpartisan Palette Rule.** Never pair red and blue as a brand or emphasis pairing, and never use a party color as identity. Red exists only as Alert Brick and in the status ramp.

## Typography

**Display Font:** Geist (with ui-sans-serif, system-ui)
**Body Font:** Geist (with ui-sans-serif, system-ui)
**Label/Mono Font:** Geist Mono, for version tags and small codes

**Character:** One neutral, modern sans for everything, sharpened by stylistic sets `ss01` and `cv11`. Hierarchy comes from weight (400 vs 600), tight tracking on headings, and small uppercase labels, not from a second typeface.

### Hierarchy
- **Display**: landing hero headline only; steps down to 2.25rem on small screens. Max width about 48rem.
- **Headline**: landing section headings and the CTA band.
- **Stat**: dashboard metrics. Always tabular numerals so columns of figures align.
- **Title**: card titles and page titles in the top bar.
- **Body**: the default UI size for lists, tables, nav, buttons, and inputs. Long marketing copy steps up to 1.125rem with Slate Sage color and a max width of about 42rem.
- **Label**: uppercase, widely tracked metadata: sidebar group labels (10.5px), the brand subtitle, campaign chips, stat captions (11–12px).
- **Wordmark**: the "CampaignGround" name beside the brand mark in the sidebar, marketing nav, and auth pages. Logo use only.

### Named Rules
**The Tabular Figures Rule.** Any number a volunteer might compare (counts, money, percentages, days to election) uses tabular numerals.

## Layout

The app shell is a fixed 256px sidebar on the left (hidden below 768px, replaced by a mobile nav sheet) and a 64px top bar holding the page title, campaign actions, and the user. Content sits on Warm Parchment with 24px gutters. The dashboard leads with a full-width campaign summary card, then a row of six stat cards that reflow from six columns to two on small screens, then two-column chart and list panels.

The public landing page uses a centered 72rem container with 16px side padding (24px from 768px). The hero is a two-column split from 1024px: copy on the left (max 26rem), a real dashboard screenshot on the right that bleeds past the container edge; below 768px the copy stacks above a phone-sized dashboard crop, served through `<picture>` art direction so phones never download the desktop capture. Feature rows alternate copy and screenshot, separated by 64–96px. The sticky marketing nav is 64px tall with a translucent parchment background and backdrop blur; below 768px it keeps only the brand mark, Log in, and the primary action, all 44px tall, with no menu sheet. Landing copy never shows terminal commands; open source is a trust line with links to the code and the self-hosting guide.

Spacing follows the 4px Tailwind scale. Cards use 24px internal padding and 24px gaps between header, content, and footer; compact lists and nav use 8–12px.

## Elevation & Depth

The system is flat-leaning. Depth comes mainly from tone (Paper White cards on Warm Parchment) and hairline Meadow Line borders. Shadows are small and soft, used to lift cards, the active nav item, the brand-mark tile, and buttons slightly off the page. The sticky marketing nav uses backdrop blur over 80% parchment instead of a shadow.

### Shadow Vocabulary
- **Hairline lift** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): buttons and inputs at rest.
- **Card lift** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): cards, the active sidebar item, the brand-mark tile.

### Named Rules
**The Quiet Surface Rule.** Nothing goes above card lift at rest. Dialogs and popovers may float higher; page content never does.

## Shapes

Gently rounded throughout, from a 10px base radius. Controls (buttons, inputs, badges, nav items) use 8px; cards use 14px; the brand-mark tile uses 10px; counters and the custom scrollbar thumb are fully round. Borders are always 1px. The signature texture is the civic grid: a 32px square grid of faint Meadow Line strokes (white at 6% in dark mode) behind auth screens, empty states, and the landing hero.

## Components

### Buttons
Calm and solid, never loud.
- **Shape:** gently rounded (8px); 36px tall by default, 32px small, 40px large; 16px horizontal padding. Icons are 16px with an 8px gap.
- **Primary:** Civic Emerald with near-white text and hairline lift; hover drops to 90% opacity.
- **Outline / Ghost:** a 1px border on parchment (outline) or no border (ghost); hover fills with Hover Sage.
- **Secondary:** Sage Wash fill; hover at 80%.
- **Destructive:** Alert Brick fill with white text.
- **Focus:** the border shifts to Civic Emerald Ring with a 3px ring at 50% opacity.
- **Disabled:** 50% opacity, no pointer events.

### Chips
- **Style:** small tinted pills with a 1px border in the status ramp (support level, priority, status), optionally with a leading dot. Neutral metadata chips (NONPARTISAN, DISTRICT 4) use an outline badge with uppercase label type.
- **Count badges:** in the sidebar, 10px fully rounded pills with a border; inverted on the active item.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** Paper White (Night Card in dark mode).
- **Shadow Strategy:** card lift (see Elevation & Depth).
- **Border:** 1px Meadow Line.
- **Internal Padding:** 24px, with a 24px vertical gap between header, content, and footer. The title is semibold; the description is Slate Sage body text.
- **Stat card:** a 36px rounded icon tile in a tinted status hue, the stat figure, a caption, and a muted sub-caption.

### Inputs / Fields
- **Style:** transparent background, 1px Field Line border, 8px radius, 36px tall, hairline lift. Placeholder text in Slate Sage.
- **Focus:** the border shifts to Civic Emerald Ring with a 3px ring at 50%.
- **Error / Disabled:** Alert Brick border with a 20% ring; disabled at 50% opacity.

### Navigation
- **Sidebar:** Sidebar Sage panel with a right border. Groups (Overview, People, Outreach, Plan) are introduced by 10.5px uppercase labels. Items are body-size with a 16px icon; hover fills with Sidebar Sage Hover; the active item fills Civic Emerald with near-white text, medium weight, and card lift.
- **Top bar:** 64px tall, holding the page title and subtitle, the campaign switcher, invite and admin actions, and the user's avatar and role. Icon actions are all 36px. Below 640px the avatar and name hide, but theme and sign-out stay.
- **Mobile:** below 768px the same grouped navigation and footer open in a left sheet; choosing a module closes it.
- **Marketing nav:** sticky, translucent parchment with blur; links in Slate Sage, darkening to Commons Ink on hover.

### Product Screenshots
Marketing surfaces show the real product, never illustrations or mock UI. Screenshots are captured at 2× device pixel ratio from the seeded demo campaign in both themes and swap with the active theme. Desktop captures are cropped to the part of the screen the copy talks about, so text stays legible at display size. Full-screen captures sit in a 14px-radius card frame with a hairline border and card lift; captures that already show a card (a cropped panel) carry no extra frame. Phone captures sit in a 28px-radius bezel (Commons Ink at 85%, the dark muted surface in dark mode). Captions state that the data is a sample campaign.

### Auth Shell
Login, signup, and invite pages share one frame: the civic grid full-bleed, the brand mark and wordmark linking home, and a single Paper White card. Labels match the landing page exactly ("Start your campaign", "Log in").

### Campaign Summary Card
The dashboard's signature component: a wide card with neutral metadata chips, the candidate's name at headline size, the race and election date, and large emerald countdown figures (days to election, supporters) separated by a vertical hairline.

## Do's and Don'ts

### Do:
- **Do** use the semantic tokens (primary, accent, muted, border, card) so light and dark themes stay in sync.
- **Do** keep Civic Emerald for the active location and the one primary action per view.
- **Do** use tabular numerals for every comparable figure.
- **Do** use the civic grid texture only behind auth screens, empty states, and the landing hero.
- **Do** keep status colors on the documented tinted-pill recipe, with both light and dark variants.

### Don't:
- **Don't** use red and blue together as an emphasis pairing, or any party color as identity.
- **Don't** add shadows heavier than card lift to page content.
- **Don't** use pure white as a page background; pages sit on Warm Parchment.
- **Don't** introduce a second typeface; hierarchy comes from Geist's weights, tracking, and case.
- **Don't** fill large areas with Ballot Amber.
- **Don't** fill a full-width band with the dark-theme emerald; in dark mode a call-to-action band becomes Night Card with an emerald button.
- **Don't** put a kicker or badge above a heading; the heading carries the line.
