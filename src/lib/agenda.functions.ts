import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const apptTypes = ["ligacao", "visita_tecnica", "reuniao", "outro"] as const;

/** Lista compromissos do consultor logado (ou do _userId se SDR/coord/admin). */
export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const target = data.userId ?? userId;
    const from = data.from ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const to = data.to ?? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from("agenda_appointments")
      .select("id,consultor_id,lead_id,title,type,starts_at,ends_at,notes,status,reminder_sent_at,created_by,created_at")
      .eq("consultor_id", target)
      .gte("starts_at", from)
      .lte("starts_at", to)
      .order("starts_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        consultorId: z.string().uuid().optional(),
        leadId: z.string().uuid().nullable().optional(),
        title: z.string().min(1).max(160),
        type: z.enum(apptTypes),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const target = data.consultorId ?? userId;
    const { data: id, error } = await supabase.rpc("book_appointment", {
      _consultor_id: target,
      _lead_id: data.leadId ?? null,
      _title: data.title,
      _type: data.type,
      _starts_at: data.startsAt,
      _ends_at: data.endsAt,
      _notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["agendado", "concluido", "cancelado"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { error } = await supabase.from("agenda_appointments").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { error } = await supabase.from("agenda_appointments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Disponibilidade recorrente (weekday 0-6) */
export const getMyAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const target = data.userId ?? userId;
    const { data: rows, error } = await supabase
      .from("agenda_availability")
      .select("id,user_id,weekday,start_time,end_time")
      .eq("user_id", target)
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid().optional(),
        windows: z
          .array(
            z.object({
              weekday: z.number().int().min(0).max(6),
              start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
              end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
            }),
          )
          .max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const target = data.userId ?? userId;
    // Replace all windows for user
    const { error: delErr } = await supabase.from("agenda_availability").delete().eq("user_id", target);
    if (delErr) throw new Error(delErr.message);
    if (data.windows.length) {
      const { error } = await supabase
        .from("agenda_availability")
        .insert(data.windows.map((w) => ({ user_id: target, ...w })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Slots livres do consultor (para SDR marcar visita técnica). */
export const listFreeSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        from: z.string().datetime(),
        to: z.string().datetime(),
        slotMinutes: z.number().int().min(15).max(240).default(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: rows, error } = await supabase.rpc("get_agenda_free_slots", {
      _user_id: data.userId,
      _from: data.from,
      _to: data.to,
      _slot_minutes: data.slotMinutes,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as { slot_start: string; slot_end: string }[];
  });
