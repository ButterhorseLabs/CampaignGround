import { z } from "zod";
import { supportLevelEnum } from "./shared";

const optionalText = z.string().trim().max(500).nullable().optional();
const name = z.string().trim().min(1).max(100);

export const voterIdSchema = z.object({ id: z.string().min(1) });

export const voterPatchSchema = voterIdSchema.extend({
  firstName: name.optional(),
  lastName: name.optional(),
  phone: optionalText,
  email: optionalText,
  registeredAddress: optionalText,
  supportLevel: supportLevelEnum.optional(),
  notes: z.string().nullable().optional(),
  volunteer: z.boolean().optional(),
  hasYardSign: z.boolean().optional(),
  hasBumperSticker: z.boolean().optional(),
  tags: z.string().nullable().optional(),
});

export const voterCreateSchema = z.object({
  campaignId: z.string().min(1),
  firstName: name,
  lastName: name,
  email: optionalText,
  phone: optionalText,
  partyAffiliation: optionalText,
  registeredAddress: optionalText,
  supportLevel: supportLevelEnum.optional(),
  notes: z.string().max(5000).nullable().optional(),
  tags: optionalText,
  precinctId: z.string().nullable().optional(),
});

export const VOTER_IMPORT_MAX_ROWS = 5000;

const importCell = z.string().max(500).optional();

export const voterImportRowSchema = z.object({
  firstName: importCell,
  lastName: importCell,
  countyVoterId: importCell,
  email: importCell,
  phone: importCell,
  partyAffiliation: importCell,
  address: importCell,
  city: importCell,
  state: importCell,
  zip: importCell,
  precinct: importCell,
  birthYear: importCell, // a year or date of birth; the year is extracted
  supportLevel: importCell,
});

export type VoterImportRow = z.infer<typeof voterImportRowSchema>;

export const voterImportSchema = z.object({
  campaignId: z.string().min(1),
  rows: z.array(voterImportRowSchema).min(1).max(VOTER_IMPORT_MAX_ROWS),
});
