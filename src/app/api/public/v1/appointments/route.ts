import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, preflight, validateApiKey } from "@/lib/api";
import { publicSupabase } from "@/lib/public-supabase";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

const schema = z.object({
  shopId: uuid,
  clientName: z.string().trim().min(2).max(120),
  clientPhone: z.string().trim().max(30).optional().nullable(),
  clientWhatsapp: z.string().trim().max(30).optional().nullable(),
  barberId: uuid,
  serviceId: uuid.optional().nullable(),
  planId: uuid.optional().nullable(),
  startAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(1000).optional().nullable(),
}).refine((v) => Boolean(v.serviceId) !== Boolean(v.planId), {
  message: "Informe exatamente um serviço ou um plano",
});

export function OPTIONS() {
  return preflight();
}

export async function POST(request: NextRequest) {
  const unauthorized = validateApiKey(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Corpo da requisição inválido", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 422);
  }

  const input = parsed.data;
  try {
    const { data, error } = await publicSupabase().rpc("public_create_appointment", {
      p_shop: input.shopId,
      p_client_name: input.clientName,
      p_client_phone: input.clientPhone ?? null,
      p_client_whatsapp: input.clientWhatsapp ?? null,
      p_barber: input.barberId,
      p_service_id: input.serviceId ?? null,
      p_plan_id: input.planId ?? null,
      p_start_at: input.startAt,
      p_notes: input.notes ?? null,
    });
    if (error) {
      const conflict = error.code === "23P01" || /ocupado|bloqueado/i.test(error.message);
      return apiError(error.message, conflict ? 409 : 422);
    }
    return apiSuccess({ data, message: "Agendamento criado com sucesso." }, 201);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Erro interno", 500);
  }
}
