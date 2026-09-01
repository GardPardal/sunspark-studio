import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- GLOBAL SEARCH (Cmd+K) ----------
export type SearchHit = {
  entity_type: string;
  entity_id: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  ts: string | null;
  rank: number | null;
};

export const solarSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { q: string; limit?: number }) => ({
    q: String(input?.q ?? "").slice(0, 100),
    limit: Math.min(50, Math.max(1, Number(input?.limit ?? 20))),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!data.q.trim()) return [] as SearchHit[];
    const { data: rows, error } = await supabase.rpc("global_search", {
      _q: data.q,
      _limit: data.limit,
    });
    if (error) throw error;
    return (rows ?? []) as SearchHit[];
  });

// ---------- TIMELINE UNIVERSAL ----------
export type TimelineEvent = {
  id: string;
  entity_type: string;
  entity_id: string;
  ts: string;
  actor_id: string | null;
  actor_name: string | null;
  kind: string;
  source: string;
  title: string;
  summary: string | null;
  payload: any;
};

export const getTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entity_type: string; entity_id: string; limit?: number }) => ({
    entity_type: String(input.entity_type),
    entity_id: String(input.entity_id),
    limit: Math.min(200, Math.max(1, Number(input.limit ?? 50))),
  }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("timeline_events")
      .select("*")
      .eq("entity_type", data.entity_type)
      .eq("entity_id", data.entity_id)
      .order("ts", { ascending: false })
      .limit(data.limit);
    if (error) throw error;
    return (rows ?? []) as TimelineEvent[];
  });

export const recordTimelineEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      entity_type: string;
      entity_id: string;
      kind: string;
      title: string;
      summary?: string;
      source?: string;
      payload?: any;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("record_event", {
      _entity_type: data.entity_type,
      _entity_id: data.entity_id,
      _kind: data.kind,
      _title: data.title,
      _summary: data.summary ?? undefined,
      _source: data.source ?? "manual",
      _payload: (data.payload ?? {}) as any,
    });
    if (error) throw error;
    return { id };
  });

// ---------- SYSTEM HEALTH ----------
export type HealthRow = {
  id: string;
  service: string;
  status: "ok" | "warn" | "down" | "unknown" | string;
  message: string | null;
  latency_ms: number | null;
  meta: any;
  last_checked_at: string;
  updated_at: string;
};

export const listSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("system_health")
      .select("*")
      .order("service");
    if (error) throw error;
    return (data ?? []) as HealthRow[];
  });

// ---------- WORKFLOWS ----------
export type Workflow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  trigger: any;
  steps: any;
  version: number;
  created_at: string;
  updated_at: string;
};

export const listWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("workflows")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Workflow[];
  });

// ---------- AI INSIGHTS ----------
export type AiInsight = {
  id: string;
  category: string;
  severity: "info" | "warn" | "critical" | string;
  title: string;
  narrative: string | null;
  evidence: any;
  recommendation: string | null;
  status: "open" | "resolved" | "ignored" | string;
  created_at: string;
};

export const listInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_insights")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return (data ?? []) as AiInsight[];
  });

export const setInsightStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "open" | "resolved" | "ignored" }) => input)
  .handler(async ({ data, context }) => {
    const patch: any = { status: data.status };
    if (data.status !== "open") {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by = context.userId;
    }
    const { error } = await context.supabase.from("ai_insights").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- CLIENT TICKETS ----------
export type ClientTicket = {
  id: string;
  client_ref: string;
  client_name: string;
  client_email: string | null;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | string;
  priority: "low" | "normal" | "high" | "urgent" | string;
  assigned_to: string | null;
  created_at: string;
};

export const listClientTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("client_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as ClientTicket[];
  });
