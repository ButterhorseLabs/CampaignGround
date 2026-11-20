import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCampaignAccess } from "@/lib/api-auth";
import { parseBody } from "@/lib/api-validate";
import { birthYearOf } from "@/lib/csv";
import { supportLevelEnum } from "@/lib/validation/shared";
import { voterImportSchema, type VoterImportRow } from "@/lib/validation/voter";

const MAX_REASONS = 100;

// Lowercase, strip punctuation, collapse whitespace: "12 Main St." == "12  main st".
const normalizeText = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();

/**
 * Bulk voter import (owners only: it writes voter PII in bulk). Rows are
 * deduplicated against the campaign and within the batch: when both voters
 * have a County voter ID they match only on that ID; otherwise they match on
 * first name, last name, and normalized street address. `skipped[].row` is the
 * 1-based index into this request's `rows`.
 */
export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, voterImportSchema);
  if ("error" in parsed) return parsed.error;
  const access = await requireCampaignAccess(parsed.data.campaignId, { role: "owner" });
  if ("error" in access) return access.error;
  const campaignId = access.campaignId;

  const skipped: { row: number; reason: string }[] = [];
  let skippedCount = 0;
  const skip = (row: number, reason: string) => {
    skippedCount++;
    if (skipped.length < MAX_REASONS) skipped.push({ row, reason });
  };

  const rows = parsed.data.rows.map(
    (raw) => Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v?.trim() || undefined])) as VoterImportRow
  );
  const distinct = (values: (string | undefined)[]) => [...new Set(values.filter((v): v is string => !!v))];

  const created = await db.$transaction(
    async (tx) => {
      // Load only what this request's rows could match, not the whole campaign.
      const [existingVoters, existingPrecincts, existingHouseholds] = await Promise.all([
        tx.voter.findMany({
          where: {
            campaignId,
            OR: [
              { countyVoterId: { in: distinct(rows.map((r) => r.countyVoterId)) } },
              { lastName: { in: distinct(rows.map((r) => r.lastName)), mode: "insensitive" } },
            ],
          },
          select: { firstName: true, lastName: true, registeredAddress: true, countyVoterId: true },
        }),
        tx.precinct.findMany({ where: { campaignId }, select: { id: true, name: true } }),
        tx.household.findMany({
          where: { campaignId, zip: { in: [...new Set(rows.map((r) => r.zip ?? ""))] } },
          select: { id: true, address: true, zip: true },
        }),
      ]);

      const voterKey = (first: string, last: string, address: string | null | undefined) =>
        `${first.toLowerCase()}|${last.toLowerCase()}|${normalizeText(address ?? "")}`;
      const householdKey = (address: string, zip: string) => `${normalizeText(address)}|${zip}`;

      const seenKeys = new Set<string>();
      const seenKeysWithoutId = new Set<string>();
      const seenIds = new Set<string>();
      const remember = (key: string, countyVoterId: string | null | undefined) => {
        seenKeys.add(key);
        if (countyVoterId) seenIds.add(countyVoterId);
        else seenKeysWithoutId.add(key);
      };
      for (const v of existingVoters) remember(voterKey(v.firstName, v.lastName, v.registeredAddress), v.countyVoterId);
      const precinctIds = new Map(existingPrecincts.map((p) => [p.name.toLowerCase(), p.id]));
      const householdIds = new Map(existingHouseholds.map((h) => [householdKey(h.address, h.zip), h.id]));

      const accepted: (VoterImportRow & { firstName: string; lastName: string })[] = [];
      for (const [i, r] of rows.entries()) {
        if (!r.firstName || !r.lastName) {
          skip(i + 1, "Missing first or last name");
          continue;
        }
        const key = voterKey(r.firstName, r.lastName, r.address);
        const duplicate = r.countyVoterId
          ? seenIds.has(r.countyVoterId) || seenKeysWithoutId.has(key)
          : seenKeys.has(key);
        if (duplicate) {
          skip(i + 1, "Duplicate of an existing voter");
          continue;
        }
        remember(key, r.countyVoterId);
        accepted.push({ ...r, firstName: r.firstName, lastName: r.lastName });
      }

      // First spelling seen in the file wins ("Ward 1" over a later "ward 1").
      const newPrecinctByKey = new Map<string, string>();
      for (const r of accepted) {
        const key = r.precinct?.toLowerCase();
        if (key && !precinctIds.has(key) && !newPrecinctByKey.has(key)) newPrecinctByKey.set(key, r.precinct!);
      }
      const newPrecinctNames = [...newPrecinctByKey.values()];
      if (newPrecinctNames.length) {
        const rows = await tx.precinct.createManyAndReturn({
          data: newPrecinctNames.map((name) => ({ name, code: name, campaignId })),
          select: { id: true, name: true },
        });
        for (const p of rows) precinctIds.set(p.name.toLowerCase(), p.id);
      }
      const precinctIdOf = (name: string | undefined) => (name ? precinctIds.get(name.toLowerCase()) ?? null : null);

      const newHouseholds = new Map<string, { address: string; city: string; state: string; zip: string; precinctId: string | null }>();
      for (const r of accepted) {
        if (!r.address) continue;
        const key = householdKey(r.address, r.zip ?? "");
        if (householdIds.has(key) || newHouseholds.has(key)) continue;
        newHouseholds.set(key, {
          address: r.address,
          city: r.city ?? "",
          state: r.state ?? "",
          zip: r.zip ?? "",
          precinctId: precinctIdOf(r.precinct),
        });
      }
      if (newHouseholds.size) {
        const rows = await tx.household.createManyAndReturn({
          data: [...newHouseholds.values()].map((h) => ({ ...h, campaignId })),
          select: { id: true, address: true, zip: true },
        });
        for (const h of rows) householdIds.set(householdKey(h.address, h.zip), h.id);
      }

      const result = await tx.voter.createMany({
        data: accepted.map((r) => {
          const support = supportLevelEnum.safeParse(r.supportLevel?.toLowerCase().replace(/[\s_]+/g, "-"));
          return {
            firstName: r.firstName,
            lastName: r.lastName,
            email: r.email ?? null,
            phone: r.phone ?? null,
            partyAffiliation: r.partyAffiliation ?? null,
            registeredAddress: r.address ?? null,
            countyVoterId: r.countyVoterId ?? null,
            birthYear: r.birthYear ? birthYearOf(r.birthYear) : null,
            supportLevel: support.success ? support.data : "unknown",
            precinctId: precinctIdOf(r.precinct),
            householdId: r.address ? householdIds.get(householdKey(r.address, r.zip ?? "")) ?? null : null,
            campaignId,
          };
        }),
      });
      return result.count;
    },
    // ponytail: one transaction per request (<= 5000 rows); concurrent imports into the same campaign can race past dedupe.
    { timeout: 60_000 }
  );

  return NextResponse.json({ created, skipped, skippedCount });
}
