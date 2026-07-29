import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PLOOMES_FORM_ID = "fc069cda7a6243dfa9359a00e40b29ba";
export const PLOOMES_FORM_ENDPOINT = `https://public-forms-api.ploomes.com/${PLOOMES_FORM_ID}/form`;

export type PloomesOption = { name: string; value: number };
export type PloomesFormSchema = {
  origem: PloomesOption[]; // filial
  captacao: PloomesOption[];
  produto: PloomesOption[];
  owners: PloomesOption[];
  keys: {
    contact_name: string;
    contact_phones: string;
    origem: string;
    captacao: string;
    produto: string;
    gasto: string;
    observacao: string;
    owner: string;
  };
};

let cache: { at: number; data: PloomesFormSchema } | null = null;
const TTL_MS = 5 * 60 * 1000;

async function fetchSchema(): Promise<PloomesFormSchema> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const r = await fetch(PLOOMES_FORM_ENDPOINT, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Ploomes form ${r.status}`);
  const j: any = await r.json();
  const byLabel = (label: string) => j.Fields.find((f: any) => (f.Label || "").toLowerCase().includes(label.toLowerCase()));
  const opts = (f: any): PloomesOption[] =>
    (f?.Options ?? []).map((o: any) => ({ name: o.Name, value: o.IntegerValue }));

  const fOrigem = byLabel("Origem do Lead");
  const fCaptacao = byLabel("captação");
  const fProduto = byLabel("Produto de interesse");
  const fOwner = byLabel("Responsável");
  const fName = byLabel("Nome");
  const fPhone = byLabel("Telefone");
  const fGasto = byLabel("Gasto");
  const fObs = byLabel("Observação");

  const data: PloomesFormSchema = {
    origem: opts(fOrigem),
    captacao: opts(fCaptacao),
    produto: opts(fProduto),
    owners: opts(fOwner).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    keys: {
      contact_name: fName?.ObjectKey,
      contact_phones: fPhone?.ObjectKey,
      origem: fOrigem?.ObjectKey,
      captacao: fCaptacao?.ObjectKey,
      produto: fProduto?.ObjectKey,
      gasto: fGasto?.ObjectKey,
      observacao: fObs?.ObjectKey,
      owner: fOwner?.ObjectKey,
    },
  };
  cache = { at: Date.now(), data };
  return data;
}

export const getPloomesFormSchema = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => fetchSchema());

export async function _internalFetchSchema() {
  return fetchSchema();
}
