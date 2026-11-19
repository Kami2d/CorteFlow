import { NextResponse } from "next/server";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Max-Age": "86400",
};

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: CORS_HEADERS });
}

export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

/** A chave anônima é pública por design: identifica o projeto e aplica as policies. */
export function validateApiKey(request: Request) {
  const expected = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!expected) return apiError("Servidor não configurado", 503);
  const provided = request.headers.get("apikey") ?? request.headers.get("x-api-key");
  if (provided !== expected) return apiError("Chave de API inválida ou ausente (header 'apikey')", 401);
  return null;
}

export function getUuidParam(url: URL, name: string) {
  const value = url.searchParams.get(name);
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return null;
  }
  return value;
}
