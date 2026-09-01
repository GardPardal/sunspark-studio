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
    city: string;
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
  const byLabel = (label: string) =>
    j.Fields.find((f: any) => (f.Label || "").toLowerCase().includes(label.toLowerCase()));
  const opts = (f: any): PloomesOption[] =>
    (f?.Options ?? []).map((o: any) => ({
      name: o.Name,
      value: o.IntegerValue ?? o.Id ?? o.Value,
    }));

  const fName = byLabel("Nome");
  const fCity = byLabel("Cidade");
  const fPhone = byLabel("Telefone");
  const fOrigem = byLabel("Origem do Lead");
  const fCaptacao = byLabel("captação");
  const fProduto = byLabel("Produto de interesse");
  const fGasto = byLabel("Gasto");
  const fObs = byLabel("Observação");
  const fOwner = byLabel("Responsável");

  const data: PloomesFormSchema = {
    origem: opts(fOrigem),
    captacao: opts(fCaptacao),
    produto: opts(fProduto),
    owners: opts(fOwner).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    keys: {
      contact_name: fName?.ObjectKey || "ac23c3e37e9c411fae5bbe85b31eee72",
      city: fCity?.ObjectKey || "975f6183e02f4855b007529506dc97c7",
      contact_phones: fPhone?.ObjectKey || "68faff25405a4f2298c71d05134f25af",
      origem: fOrigem?.ObjectKey || "704adc1b5c694bd4b64b707aa70c128e",
      captacao: fCaptacao?.ObjectKey || "fb00befa20c74d3995b5ce44bd2306b8",
      produto: fProduto?.ObjectKey || "237479c64d5245fca6dacf5bf0513249",
      gasto: fGasto?.ObjectKey || "5262204eb35e4dc8b381d9d1f1f93ed7",
      observacao: fObs?.ObjectKey || "41e77eae02d34440b8a558400492ca1e",
      owner: fOwner?.ObjectKey || "300fb5e9f867471499e3fa93c0467696",
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
