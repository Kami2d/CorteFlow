/** Exibe mensagens de Error nativos e de objetos de erro do Supabase/PostgREST. */
export function getErrorMessage(err: unknown, fallback = "Erro inesperado") {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object") {
    const candidate = (err as { message?: unknown; details?: unknown; hint?: unknown }).message;
    if (typeof candidate === "string" && candidate) {
      const details = (err as { details?: unknown }).details;
      return typeof details === "string" && details ? `${candidate} (${details})` : candidate;
    }
  }
  if (typeof err === "string" && err) return err;
  return fallback;
}

/** Serializa erros do Supabase/PostgREST para exibição em "detalhes técnicos". */
export function formatErrorLog(err: unknown) {
  let value: Record<string, unknown>;
  if (err instanceof Error) {
    value = { name: err.name, message: err.message, stack: err.stack };
  } else if (err && typeof err === "object") {
    value = { ...(err as Record<string, unknown>) };
  } else {
    value = { value: String(err) };
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(err);
  }
}
