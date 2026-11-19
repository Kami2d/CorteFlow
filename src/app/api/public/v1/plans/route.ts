import type { NextRequest } from "next/server";
import { apiError, apiSuccess, getUuidParam, preflight, validateApiKey } from "@/lib/api";
import { publicSupabase } from "@/lib/public-supabase";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: NextRequest) {
  const unauthorized = validateApiKey(request);
  if (unauthorized) return unauthorized;

  const shopId = getUuidParam(request.nextUrl, "shopId");
  if (!shopId) return apiError("Parâmetro shopId inválido", 400);

  try {
    const { data, error } = await publicSupabase().rpc("public_get_plans", { p_shop: shopId });
    if (error) return apiError(error.message, 400);
    return apiSuccess({ data });
  } catch {
    return apiError("Erro interno", 500);
  }
}
