import { z } from "zod";
import { paginationSchema } from "./shared";

// precinctId NO_PRECINCT ("none") is the "No precinct" walk list.
export const walkListDoorsQuerySchema = paginationSchema.extend({
  campaignId: z.string().optional(),
  precinctId: z.string().min(1),
});
