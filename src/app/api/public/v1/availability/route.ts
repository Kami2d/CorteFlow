import { getErrorMessage } from "@/lib/errors";
import type { NextRequest } from "next/server";
import { computeAvailableSlots, type Interval } from "@/lib/availability";
import { apiError, apiSuccess, getUuidParam, preflight, validateApiKey } from "@/lib/api";
import { zonedDateTime } from "@/lib/datetime";
import { publicSupabase } from "@/lib/public-supabase";
import { DEFAULT_SETTINGS, type Barber, type BarberSchedule, type BreakInterval, type OpeningHour, type ShopSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: NextRequest) {
  const unauthorized = validateApiKey(request);
  if (unauthorized) return unauthorized;

  const url = request.nextUrl;
  const shopId = getUuidParam(url, "shopId");
  const serviceId = getUuidParam(url, "serviceId");
  const planId = getUuidParam(url, "planId");
  const barberId = getUuidParam(url, "barberId");
  const dateKey = url.searchParams.get("date") ?? "";

  if (!shopId) return apiError("Parâmetro shopId inválido", 400);
  if (!serviceId && !planId) return apiError("Informe serviceId ou planId", 400);
  if (serviceId && planId) return apiError("Informe apenas um: serviceId ou planId", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return apiError("Parâmetro date inválido (YYYY-MM-DD)", 400);

  try {
    const supabase = publicSupabase();
    const from = zonedDateTime(dateKey, "00:00").toISOString();
    const to = zonedDateTime(dateKey, "23:59").toISOString();

    const [settingsRes, barbersRes, breaksRes, schedulesRes, blockedRes, busyRes, permissionsRes] = await Promise.all([
      supabase.rpc("public_get_shop_settings", { p_shop: shopId }),
      supabase.rpc("public_get_barbers", { p_shop: shopId }),
      supabase.rpc("public_get_barber_breaks", { p_shop: shopId }),
      supabase.rpc("public_get_barber_schedules", { p_shop: shopId }),
      supabase.rpc("public_get_blocked_times", { p_shop: shopId, p_from: from, p_to: to }),
      supabase.rpc("public_get_busy_intervals", { p_shop: shopId, p_from: from, p_to: to }),
      supabase.rpc("public_get_service_barbers", { p_shop: shopId, p_service: serviceId ?? null }),
    ]);

    const error = [settingsRes.error, barbersRes.error, breaksRes.error, schedulesRes.error, blockedRes.error, busyRes.error, permissionsRes.error].find(Boolean);
    if (error) return apiError(error.message, 400);

    const details = settingsRes.data as { hours: OpeningHour[]; settings: ShopSettings } | null;
    if (!details) return apiError("Configurações da loja não encontradas", 404);

    let duration = 0;
    if (serviceId) {
      const { data } = await supabase.rpc("public_get_services", { p_shop: shopId });
      duration = (data as { id: string; duration_minutes: number }[])?.find((s) => s.id === serviceId)?.duration_minutes ?? 0;
    } else {
      const { data } = await supabase.rpc("public_get_plans", { p_shop: shopId });
      duration = (data as { id: string; duration_minutes: number }[])?.find((p) => p.id === planId)?.duration_minutes ?? 0;
    }
    if (!duration) return apiError("Serviço ou plano não encontrado/inativo", 404);

    const permitted = (permissionsRes.data as { barber_id: string }[] | null) ?? [];
    const barbers: Barber[] = (barbersRes.data as { id: string; name: string; photo_url: string | null; specialties: string[] }[])
      .filter((b) => (!serviceId || permitted.length === 0 || permitted.some((p) => p.barber_id === b.id)))
      .filter((b) => !barberId || b.id === barberId)
      .map((b) => ({
        id: b.id,
        barbershop_id: shopId,
        name: b.name,
        phone: null,
        whatsapp: null,
        photo_url: b.photo_url,
        specialties: b.specialties,
        bio: null,
        active: true,
        breaks: ((breaksRes.data as { barber_id: string; breaks: BreakInterval[] }[])?.find((x) => x.barber_id === b.id)?.breaks) ?? [],
        created_at: "",
        updated_at: "",
      }));

    if (barberId && barbers.length === 0) return apiError("Barbeiro indisponível", 404);

    const slots = computeAvailableSlots({
      dateKey,
      shopHours: details.hours ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(details.settings ?? {}) } as ShopSettings,
      barbers,
      schedules: (schedulesRes.data ?? []) as BarberSchedule[],
      blockedTimes: (blockedRes.data ?? []) as Interval[],
      busy: (busyRes.data ?? []) as Interval[],
      durationMinutes: duration,
    });

    return apiSuccess({
      data: slots.map((slot) => ({
        barberId: slot.barberId,
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
      })),
      meta: { durationMinutes: duration, total: slots.length },
    });
  } catch (err) {
    console.error("[CorteFlow API] falha ao calcular disponibilidade", err);
    return apiError(getErrorMessage(err, "Erro interno"), 500);
  }
}
