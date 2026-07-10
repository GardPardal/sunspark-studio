import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const TZ = "America/Sao_Paulo";

function gwHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error("Google Agenda não está conectado. Reconecte o conector nas configurações.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function gwFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...gwHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[google_calendar] ${init.method || "GET"} ${path} → ${res.status}: ${text}`);
    throw new Error(`Google Agenda retornou ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

type AppointmentRow = {
  id: string;
  consultor_id: string;
  title: string;
  type: string | null;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  status: string;
  google_event_id: string | null;
};

function buildEventBody(appt: AppointmentRow, consultorName?: string | null) {
  const description = [
    appt.notes || "",
    "",
    `Tipo: ${appt.type ?? "outro"}`,
    consultorName ? `Consultor: ${consultorName}` : "",
    `LZ7 CRM — ID ${appt.id}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    summary: appt.title,
    description,
    start: { dateTime: appt.starts_at, timeZone: TZ },
    end: { dateTime: appt.ends_at, timeZone: TZ },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 },
        { method: "email", minutes: 60 },
      ],
    },
  };
}

/**
 * Sincroniza todos os compromissos futuros do usuário logado com o Google Agenda "primary".
 * Cria eventos novos ou atualiza os já sincronizados (via google_event_id).
 */
export const syncMyAppointmentsToGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", userId)
      .maybeSingle();

    const { data: appts, error } = await supabase
      .from("agenda_appointments")
      .select("id,consultor_id,title,type,starts_at,ends_at,notes,status,google_event_id")
      .eq("consultor_id", userId)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);

    let created = 0;
    let updated = 0;
    let cancelled = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const raw of (appts ?? []) as AppointmentRow[]) {
      try {
        const body = buildEventBody(raw, profile?.full_name ?? profile?.email ?? null);

        if (raw.status === "cancelado" && raw.google_event_id) {
          await gwFetch(`/calendars/primary/events/${raw.google_event_id}`, { method: "DELETE" });
          await supabase
            .from("agenda_appointments")
            .update({ google_event_id: null })
            .eq("id", raw.id);
          cancelled++;
          continue;
        }
        if (raw.status === "cancelado") continue;

        if (raw.google_event_id) {
          await gwFetch(`/calendars/primary/events/${raw.google_event_id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          });
          updated++;
        } else {
          const evt = await gwFetch(`/calendars/primary/events`, {
            method: "POST",
            body: JSON.stringify(body),
          });
          await supabase
            .from("agenda_appointments")
            .update({ google_event_id: evt.id })
            .eq("id", raw.id);
          created++;
        }
      } catch (e) {
        failed++;
        errors.push(`${raw.title}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return {
      total: appts?.length ?? 0,
      created,
      updated,
      cancelled,
      failed,
      errors: errors.slice(0, 5),
    };
  });
