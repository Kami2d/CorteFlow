import { getErrorMessage } from "@/lib/errors";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, preflight, validateApiKey } from "@/lib/api";
import { publicSupabase } from "@/lib/public-supabase";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().uuid() });

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
  if (!parsed.success) return apiError("Token inválido", 422);

  try {
    const { data, error } = await publicSupabase().rpc("public_cancel_appointment", {
      p_token: parsed.data.token,
    });
    if (error) return apiError(error.message, 422);
    if (!data) return apiError("Agendamento não encontrado ou já encerrado", 404);
    return apiSuccess({ message: "Agendamento cancelado." });
  } catch (err) {
    console.error("[CorteFlow API] falha ao cancelar agendamento", err);
    return apiError(getErrorMessage(err, "Erro interno"), 500);
  }
}
