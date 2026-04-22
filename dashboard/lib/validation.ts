/**
 * Zod schemas and helpers for validating all /api/* inputs.
 *
 * Usage in a route handler:
 *
 *   import { parseJson, AppointmentCreateSchema } from "@/lib/validation";
 *
 *   export async function POST(req: NextRequest) {
 *     const parsed = await parseJson(req, AppointmentCreateSchema);
 *     if (!parsed.ok) return parsed.response;     // 400 with details
 *     const body = parsed.data;                   // typed + valid
 *     …
 *   }
 *
 * Usage for query params:
 *
 *   const parsed = parseSearchParams(req, BusinessIdSchema);
 *   if (!parsed.ok) return parsed.response;
 */

import { NextRequest, NextResponse } from "next/server";
import { z, type ZodType } from "zod";

// ───────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ───────────────────────────────────────────────────────────────────────────────

export const UuidSchema = z.string().uuid();

/** DD/MM/YYYY → normalised to YYYY-MM-DD for Postgres `date` columns. */
export const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

/** HH:MM or HH:MM:SS. */
export const TimeStringSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Time must be HH:MM or HH:MM:SS");

export const PhoneSchema = z
  .string()
  .trim()
  .min(4)
  .max(32)
  .regex(/^[+\d\s\-().]+$/, "Phone may only contain digits, spaces, +, -, ., (, )");

export const NonEmptyTrimmed = (max = 200) => z.string().trim().min(1).max(max);

// ───────────────────────────────────────────────────────────────────────────────
// Appointment schemas (POST/GET /api/appointments)
// ───────────────────────────────────────────────────────────────────────────────

export const ServiceLineSchema = z.object({
  service: NonEmptyTrimmed(60),
  barber: NonEmptyTrimmed(60).optional(),
  price: z.number().nonnegative().optional(),
  duration_minutes: z.number().int().positive().optional(),
});

export const AppointmentSourceSchema = z.enum(["walk-in", "manual", "website", "human-call", "ai-call"]);

export const AppointmentCreateSchema = z.object({
  business_id: UuidSchema,
  client_name: NonEmptyTrimmed(120).optional(),
  phone_number: PhoneSchema.optional(),
  service_type: NonEmptyTrimmed(120).optional(),
  barber_name: NonEmptyTrimmed(60).optional(),
  appointment_date: DateStringSchema.optional(),
  appointment_time: TimeStringSchema.optional(),
  duration_minutes: z.number().int().positive().max(600).optional(),
  price: z.number().nonnegative().max(10_000).optional(),
  notes: z.string().max(1_000).optional(),
  source: AppointmentSourceSchema.optional(),
  services: z.array(ServiceLineSchema).max(20).optional(),
});

export const BusinessIdQuerySchema = z.object({
  business_id: UuidSchema,
});

// ───────────────────────────────────────────────────────────────────────────────
// ElevenLabs webhook (POST /api/elevenlabs/webhook)
// ───────────────────────────────────────────────────────────────────────────────

// Loose schema — we only use a subset of the payload; unknown keys pass through.
export const ElevenLabsWebhookSchema = z
  .object({
    type: z.string(),
    event_timestamp: z.number().optional(),
    data: z
      .object({
        agent_id: z.string().optional(),
        conversation_id: z.string(),
        status: z.string().optional(),
        transcript: z.array(z.unknown()).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        analysis: z
          .object({
            transcript_summary: z.string().nullable().optional(),
            call_summary_title: z.string().nullable().optional(),
            call_successful: z.string().optional(),
            data_collection_results: z.record(z.string(), z.unknown()).optional(),
            evaluation_criteria_results: z.record(z.string(), z.unknown()).optional(),
          })
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type ElevenLabsWebhookPayload = z.infer<typeof ElevenLabsWebhookSchema>;

// ───────────────────────────────────────────────────────────────────────────────
// Demo bookings (POST /api/demo-bookings)
// ───────────────────────────────────────────────────────────────────────────────

export const DemoBookingsRequestSchema = z.object({
  business_id: UuidSchema,
  shop_name: NonEmptyTrimmed(120).optional(),
  regenerate: z.boolean().optional(),
  barber_names: z.array(z.string().trim().min(2).max(60)).max(20).optional(),
});

// ───────────────────────────────────────────────────────────────────────────────
// Admin approve (POST /api/admin/approve)
// ───────────────────────────────────────────────────────────────────────────────

export const AdminApproveSchema = z.object({
  user_id: UuidSchema,
  approved: z.boolean(),
});

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

type ParsedOk<T> = { ok: true; data: T };
type ParsedErr = { ok: false; response: NextResponse };

/**
 * Parse + validate a JSON body. Returns either:
 *  - { ok: true, data }  — body is valid and typed
 *  - { ok: false, response } — ready-made 400 response with error details
 */
export async function parseJson<T>(req: NextRequest, schema: ZodType<T>): Promise<ParsedOk<T> | ParsedErr> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Validation failed", issues: result.error.issues.map((i) => ({ path: i.path, message: i.message })) },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: result.data };
}

/**
 * Validate URL search params. Returns either:
 *  - { ok: true, data } — all params valid and typed
 *  - { ok: false, response } — ready-made 400 response
 */
export function parseSearchParams<T>(req: NextRequest, schema: ZodType<T>): ParsedOk<T> | ParsedErr {
  const { searchParams } = new URL(req.url);
  const raw = Object.fromEntries(searchParams.entries());

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: result.error.issues.map((i) => ({ path: i.path, message: i.message })),
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: result.data };
}
