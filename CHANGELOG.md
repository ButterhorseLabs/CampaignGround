# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Voter list import: upload a CSV, check the detected column mapping, and
  import. Precincts and households are created from the file and duplicates
  are skipped (`POST /api/voters/import`, owners only).
- Add voter, volunteer, and donor forms (`POST /api/voters`,
  `/api/volunteers`, `/api/donors`), plus a first-run checklist on the
  dashboard and empty states on each list.
- Password reset by email (`/forgot-password`, `/reset-password/[token]`);
  tokens are stored hashed and expire after one hour.
- Volunteers can be linked to a login (`Volunteer.userId`). Accepting an
  invite links or creates the new member's roster entry.
- `GET /api/signup` reports whether signups are open, so the signup page can
  say so before the form.

### Changed

- Canvass claims now cover the whole household, renew every minute while a
  door is open, and release when the tab closes.
- Members can only canvass, call, or hold claims as their own volunteer
  entry; owners can still act for anyone.
- Members no longer receive donation counts or fundraising totals from the
  voters and dashboard APIs.
- Landing page, auth pages, and app shell redesigned against `DESIGN.md`.

## [1.0.0-rc.1] - 2026-07-02

First release candidate. CampaignGround has grown from a single-tenant demo
into a multi-tenant, production-hardened campaign CRM with a real automated
test suite backing it.

### Added

- Automated test suite (`bun test`): unit tests for validation schemas and
  the rate limiter, plus integration tests run against a real standalone
  build and a dedicated test Postgres database — covering cross-campaign
  IDOR regressions, login brute-force lockout, the Postmark bounce webhook's
  auth, the full signup/invite/login/platform-owner-transfer flows, and CRUD
  smoke tests for every module. Wired into CI as a required step.
- `GET /api/health` — public liveness check for uptime monitoring and
  deployment readiness probes.
- Branded `error.tsx` and `not-found.tsx` pages.
- Multi-campaign / multi-tenant support: users can belong to multiple
  campaigns via `CampaignMembership` (owner/member roles).
- Deployment-wide platform owner role (`User.isPlatformOwner`), separate
  from per-campaign roles — auto-assigned to the first user in a
  deployment, transferable via `POST /api/platform/transfer`. A read-only
  cross-campaign admin view at `/platform-admin`.
- Self-service signup (`POST /api/signup`) and team-member invites over
  email (`POST /api/invites`, accept flow at `/invite/[token]`), with
  Postmark bounce tracking to mark addresses that hard-bounce.
- Duplicate-contact prevention and live UI updates.
- Docker/Railway deployment support (`Dockerfile`, `railway.json`,
  `docker-compose.yml`).

### Changed

- Migrated the primary datastore from SQLite to Postgres.
- Hardened every API route with consistent campaign-scoped authorization
  (`requireCampaignAccess`) and foreign-key ownership checks
  (`assertBelongsToCampaign`).
- Split several oversized view components into focused view + dialog
  components; removed dead dependencies; fixed a dashboard N+1 query.

### Fixed

- Two critical cross-campaign IDOR vulnerabilities allowing one campaign to
  reference another campaign's records via foreign-key fields (donations,
  canvass/call logs, tasks, claims) — now regression-tested.
- Login brute-force: added rate limiting per email and per IP, with
  timing-safe handling of unknown-email attempts.
- Various `any`-typed code paths tightened to proper types.

## [0.2.0] and earlier

Pre-release iteration: initial CRM scaffold (voters, volunteers, donors,
events, tasks, canvassing, call logs), roadmap-driven feature build-out, and
early build/auth hardening. See git history for full detail.
