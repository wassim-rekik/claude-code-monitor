import { z } from "zod";
import { MAX_RANGE_DAYS, MIN_RANGE_DAYS, DEFAULT_RANGE_DAYS, ALL_USERS_ID } from "@/lib/config";

export const usageRecordSchema = z.object({
  sessionId:     z.string().min(1),
  model:         z.string().min(1),
  inputTokens:   z.number().nonnegative(),
  outputTokens:  z.number().nonnegative(),
  cacheRead:     z.number().nonnegative(),
  cacheCreation: z.number().nonnegative(),
  project:       z.string().min(1).optional(),
  timestamp:     z.string().min(1),
});

export const usagePayloadSchema = z.object({
  user:    z.string().min(1),
  records: z.array(usageRecordSchema),
});

export type UsagePayload = z.infer<typeof usagePayloadSchema>;

export const statsQuerySchema = z.object({
  user: z.string().min(1).default(ALL_USERS_ID),
  range: z
    .string()
    .default(String(DEFAULT_RANGE_DAYS))
    .transform((v) => Number(v))
    .pipe(z.number().int().min(MIN_RANGE_DAYS).max(MAX_RANGE_DAYS)),
});
