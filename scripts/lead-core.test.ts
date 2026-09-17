import { describe, expect, it } from "bun:test";
import {
  computeQualification,
  isGenericName,
  normalizePhone,
  parseMoneyBR,
  phoneVariants,
} from "../src/lib/leads/lead-core.server";
import { classifyOrigin } from "../src/lib/leads/ploomes-sync.server";

const rules = { minFatura: 200, exigirFatura: false, defaultOwnerId: 60022664 };

describe("normalizePhone", () => {
  it("normaliza formatos diferentes para o mesmo E.164", () => {
    const expected = "+5543996036125";
    for (const v of [
      "43996036125",
      "(43) 99603-6125",
      "+55 43 99603-6125",
      "5543996036125",
      "043 99603 6125",
      "554396036125",
    ]) {
      expect(normalizePhone(v)).toBe(expected);
    }
  });
  it("rejeita inválidos", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });
  it("gera variações para busca externa", () => {
    expect(phoneVariants("+5543996036125")).toEqual(
      expect.arrayContaining(["5543996036125", "554396036125", "43996036125"]),
    );
  });
});

describe("parseMoneyBR", () => {
  it("interpreta valores brasileiros", () => {
    expect(parseMoneyBR("R$ 1.250,50")).toBe(1250.5);
    expect(parseMoneyBR("350")).toBe(350);
    expect(parseMoneyBR("uns 400 reais")).toBe(400);
    expect(parseMoneyBR(null)).toBeNull();
  });
});

describe("isGenericName", () => {
  it("detecta nomes placeholder", () => {
    expect(isGenericName("Cliente WhatsApp")).toBe(true);
    expect(isGenericName("Não informado")).toBe(true);
    expect(isGenericName("+55 43 99999-0000")).toBe(true);
    expect(isGenericName("Maria Souza")).toBe(false);
  });
});

describe("computeQualification", () => {
  const base = {
    id: "x",
    nome: "João",
    telefone_e164: "+5543999990000",
    cidade: "Londrina",
    valor_conta_num: 350,
    padrao_eletrico: null,
    produto_interesse: "energia solar",
    qualificacao_status: "novo",
  };
  it("qualifica com dados obrigatórios e marca tipo de ligação como pendência (nunca inventa)", () => {
    const q = computeQualification(base, rules);
    expect(q.status).toBe("qualificado");
    expect(q.pendentes).toContain("Tipo de ligação não informado");
  });
  it("sem cidade fica em qualificação", () => {
    expect(computeQualification({ ...base, cidade: null }, rules).status).toBe("em_qualificacao");
  });
  it("abaixo de R$ 200 desqualifica", () => {
    expect(computeQualification({ ...base, valor_conta_num: 150 }, rules).status).toBe(
      "desqualificado",
    );
  });
  it("regra mínima é editável", () => {
    expect(
      computeQualification({ ...base, valor_conta_num: 150 }, { ...rules, minFatura: 100 }).status,
    ).toBe("qualificado");
  });
  it("sem fatura quando exigida não qualifica", () => {
    const q = computeQualification({ ...base, fatura_url: null }, { ...rules, exigirFatura: true });
    expect(q.status).toBe("em_qualificacao");
    expect(q.pendentes).toContain("Fatura de energia não anexada");
  });
  it("recusa vai para humano", () => {
    expect(computeQualification(base, rules, { recusou: true }).status).toBe("humano");
  });
  it("sem nome fica em qualificação", () => {
    expect(computeQualification({ ...base, nome: "Cliente WhatsApp" }, rules).status).toBe(
      "em_qualificacao",
    );
  });
});

describe("classifyOrigin", () => {
  it("Meta Ads → tráfego pago", () => {
    const r = classifyOrigin({ origem_principal: "Meta Ads", utm_medium: "paid" });
    expect(r.paid).toBe(true);
    expect(r.captacaoId).toBe(600965618);
  });
  it("site orgânico não recebe captação inventada", () => {
    const r = classifyOrigin({ origem_principal: "Site" });
    expect(r.captacaoId).toBeNull();
    expect(r.contactOriginId).toBe(60001487);
  });
  it("respeita a escolha humana da SDR", () => {
    expect(classifyOrigin({ ploomes_captacao_id: 600965617 }).captacaoId).toBe(600965617);
  });
});
