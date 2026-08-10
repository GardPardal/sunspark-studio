import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Endpoint público (BI aberto): retorna apenas números agregados do funil comercial.
const schema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  origemId: z.number().int().nullable().optional(),
});

export const getPublicFunnel = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { getSolarFunnel } = await import("./ploomes-funnel.server");
    return await getSolarFunnel(data.from, data.to, data.origemId ?? null);
  });
