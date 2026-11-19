import type { NextRequest } from "next/server";
import { apiSuccess, preflight, validateApiKey } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: NextRequest) {
  const unauthorized = validateApiKey(request);
  if (unauthorized) return unauthorized;

  return apiSuccess({
    name: "CorteFlow Public API",
    version: "1.0",
    authentication: "Header 'apikey' com a chave anônima do Supabase",
    endpoints: [
      { method: "GET", path: "/services?shopId=", description: "Serviços ativos" },
      { method: "GET", path: "/plans?shopId=", description: "Planos ativos" },
      { method: "GET", path: "/barbers?shopId=", description: "Barbeiros ativos" },
      { method: "GET", path: "/availability?shopId=&serviceId=&date=[&barberId]", description: "Horários disponíveis" },
      { method: "POST", path: "/appointments", description: "Criar agendamento" },
      { method: "POST", path: "/appointments/cancel", description: "Cancelar pelo token público" },
    ],
  });
}
