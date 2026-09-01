import { createHmac, timingSafeEqual } from "crypto";
import { getCookie, setCookie } from "@tanstack/react-start/server";

export const VENDAS_COOKIE = "lz7_vendas_session";
const SETTING_KEY = "vendas_portal_password";
const DEFAULT_PASSWORD = "LZ7vendas@2026";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function secret() {
  return (
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    "lz7-vendas-fallback-secret"
  );
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function getVendasPassword(): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();
    const value = (data as any)?.value;
    if (typeof value === "string" && value.trim()) return value.trim();
  } catch {
    /* usa o padrão */
  }
  return process.env["VENDAS_PORTAL_PASSWORD"] || DEFAULT_PASSWORD;
}

export async function setVendasPassword(next: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("site_settings")
    .upsert({ key: SETTING_KEY, value: next }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export function issueVendasSession() {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `v1.${exp}`;
  const token = `${payload}.${sign(payload)}`;
  setCookie(VENDAS_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearVendasSession() {
  setCookie(VENDAS_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
}

export function hasVendasSession(): boolean {
  const token = getCookie(VENDAS_COOKIE);
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [v, exp, mac] = parts;
  if (v !== "v1") return false;
  if (!Number(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(mac, sign(`${v}.${exp}`));
}

export function requireVendasSession() {
  if (!hasVendasSession())
    throw new Error("Sessão do portal de vendas expirada. Faça login novamente.");
}
