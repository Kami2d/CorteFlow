"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase";
import type { Appointment } from "@/lib/types";

export interface AppointmentWindow {
  from?: string;
  to?: string;
}

export function useAppointments(window: AppointmentWindow = {}) {
  const { shop } = useAuth();
  const [rows, setRows] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const from = window.from;
  const to = window.to;

  const load = useCallback(async () => {
    if (!shop) return;
    setLoading(true);
    setError(null);
    let query = getSupabase()
      .from("appointments")
      .select(
        "*, client:clients(id,name,phone,whatsapp), barber:barbers(id,name,photo_url), service:services(id,name,price,duration_minutes), plan:service_plans(id,name,price,duration_minutes)"
      )
      .eq("barbershop_id", shop.id)
      .order("start_at", { ascending: true });
    if (from) query = query.gte("start_at", from);
    if (to) query = query.lt("start_at", to);

    const { data, error } = await query;
    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as Appointment[]);
    }
    setLoading(false);
  }, [shop, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, error, reload: load };
}
