"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Barbershop, Profile } from "@/lib/types";

interface AuthContextValue {
  loading: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  shop: Barbershop | null;
  needsOnboarding: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ message: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shop, setShop] = useState<Barbershop | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    setSession(data.session);

    if (!data.session) {
      setProfile(null);
      setShop(null);
      setNeedsOnboarding(false);
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("users")
      .select("id, barbershop_id, full_name, role")
      .eq("id", data.session.user.id)
      .maybeSingle();

    if (profileError && profileError.code !== "PGRST116") setError(profileError.message);

    if (!profileData) {
      setProfile(null);
      setShop(null);
      setNeedsOnboarding(true);
      setLoading(false);
      return;
    }

    setProfile(profileData as Profile);
    setNeedsOnboarding(false);
    const { data: shopData } = await supabase
      .from("barbershops")
      .select("*")
      .eq("id", profileData.barbershop_id)
      .maybeSingle();
    setShop((shopData as Barbershop) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    if (!isSupabaseConfigured) return;
    const { data } = getSupabase().auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const signIn = async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
    await refresh();
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw error;
    return {
      message: "Cadastro realizado. Verifique seu e-mail para confirmar a conta antes de entrar.",
    };
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
    setSession(null);
    setProfile(null);
    setShop(null);
  };

  const value = useMemo(
    () => ({
      loading,
      configured: isSupabaseConfigured,
      session,
      user: session?.user ?? null,
      profile,
      shop,
      needsOnboarding,
      error,
      refresh,
      signIn,
      signUp,
      signOut,
    }),
    [loading, session, profile, shop, needsOnboarding, error, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
