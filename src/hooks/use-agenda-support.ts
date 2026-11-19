"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase";
import { zonedDateTime } from "@/lib/datetime";
import type { Interval } from "@/lib/availability";
import type { BarberSchedule as Schedule } from "@/lib/types";

export function useBarberSchedules(barbers: { id: string }[]) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const ids = barbers.map((b) => b.id).join(",");

  useEffect(() => {
    let cancelled = false;
    if (!ids) {
      setSchedules([]);
      return;
    }
    void getSupabase()
      .from("barber_schedules")
      .select("*")
      .in("barber_id", ids.split(","))
      .then(({ data, error }) => {
        if (!cancelled && !error) setSchedules((data ?? []) as Schedule[]);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return schedules;
}

/** Busy intervals de um dia específico, já no formato usado pelo motor de disponibilidade. */
export function useDayBusy(dateKey: string, excludeId?: string) {
  const { shop } = useAuth();
  const [intervals, setIntervals] = useState<Interval[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!shop) return;
    setLoading(true);
    const from = zonedDateTime(dateKey, "00:00").toISOString();
    const to = zonedDateTime(dateKey, "23:59").toISOString();
    const { data, error } = await getSupabase()
      .from("appointments")
      .select("id,barber_id,start_at,end_at")
      .eq("barbershop_id", shop.id)
      .lt("start_at", to)
      .gt("end_at", from)
      .in("status", ["pending", "confirmed", "arrived", "in_progress"]);
    if (!error) {
      setIntervals(
        (data ?? [])
          .filter((row) => row.id !== excludeId)
          .map((row) => ({
            barber_id: row.barber_id,
            starts_at: row.start_at,
            ends_at: row.end_at,
          }))
      );
    }
    setLoading(false);
  }, [shop, dateKey, excludeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { intervals, loading, reload: load };
}
