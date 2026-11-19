"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase";

interface Options {
  orderBy?: string;
  ascending?: boolean;
  enabled?: boolean;
}

/**
 * Hook genérico de leitura/escrita para tabelas isoladas por barbershop_id.
 * Toda permissão é validada pelas políticas RLS do Supabase.
 */
export function useCrudTable<T extends { id: string }>(
  table: string,
  options: Options = {}
) {
  const { shop } = useAuth();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { orderBy = "created_at", ascending = false, enabled = true } = options;

  const load = useCallback(async () => {
    if (!shop || !enabled) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await getSupabase()
      .from(table)
      .select("*")
      .eq("barbershop_id", shop.id)
      .order(orderBy, { ascending });
    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as T[]);
    }
    setLoading(false);
  }, [shop, table, orderBy, ascending, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const insert = async (values: Record<string, unknown>) => {
    const { data, error } = await getSupabase()
      .from(table)
      .insert({ ...values, barbershop_id: shop?.id })
      .select("*")
      .single();
    if (error) throw error;
    await load();
    return data as T;
  };

  const update = async (id: string, values: Record<string, unknown>) => {
    const { error } = await getSupabase().from(table).update(values).eq("id", id);
    if (error) throw error;
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await getSupabase().from(table).delete().eq("id", id);
    if (error) throw error;
    await load();
  };

  return { rows, loading, error, reload: load, insert, update, remove };
}
