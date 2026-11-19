-- Execute este arquivo no SQL Editor do Supabase após aplicar a migração inicial.
-- Ele garante o grant da RPC de onboarding e recarrega o schema cache do PostgREST.

GRANT EXECUTE ON FUNCTION public.create_barbershop_for_current_user(text, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
