import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { waHref } from "@/lib/site-settings";
import { getPersistedAttribution, trackLeadConversion } from "@/lib/tracking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function trackEvent(name: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[]; fbq?: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event: name, ...data });
  if (typeof w.fbq === "function") w.fbq("track", name, data);
}

type Props = {
  whatsapp: string;
  location: string;
  children: ReactNode;
  className?: string;
  /** quando true, renderiza um <button> puro (sem estilos do design system) */
  bare?: boolean;
  "aria-label"?: string;
};

/**
 * CTA de WhatsApp com captura de lead (mesmo fluxo já usado em produção):
 * grava em `leads`, dispara conversão e abre o WhatsApp oficial.
 */
export function WhatsAppGate({ whatsapp, location, children, className, bare, ...rest }: Props) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = telefone.replace(/\D/g, "");
    if (nome.trim().length < 2 || digits.length < 8) {
      toast.error("Informe seu nome e um WhatsApp válido.");
      return;
    }
    setSending(true);
    try {
      const attribution = getPersistedAttribution();
      const eventId = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { error } = await supabase.from("leads").insert({
        nome: nome.trim(),
        telefone: telefone.trim(),
        origem: `whatsapp_${location}`,
        utm_source: attribution.utm_source ?? null,
        utm_medium: attribution.utm_medium ?? null,
        utm_campaign: attribution.utm_campaign ?? null,
        utm_term: attribution.utm_term ?? null,
        utm_content: attribution.utm_content ?? null,
        gclid: attribution.gclid ?? null,
        fbclid: attribution.fbclid ?? null,
        fbp: attribution.fbp ?? null,
        fbc: attribution.fbc ?? null,
        page_url: attribution.page_url ?? null,
        referrer: attribution.referrer ?? null,
        user_agent: attribution.user_agent ?? null,
      });
      if (error) throw error;
      trackLeadConversion({ value: 50, currency: "BRL", eventId });
      trackEvent("generate_lead", { location: `whatsapp_${location}`, event_id: eventId });
      trackEvent("whatsapp_click", { location });
      window.open(
        waHref(whatsapp, `Olá! Quero um orçamento de energia solar. Meu nome é ${nome.trim()}.`),
        "_blank",
        "noopener,noreferrer",
      );
      setOpen(false);
      setNome("");
      setTelefone("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar agora.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        aria-label={rest["aria-label"]}
        data-bare={bare ? "true" : undefined}
      >
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Falar no WhatsApp</DialogTitle>
            <DialogDescription>
              Deixe seu contato para um especialista LZ7 continuar o atendimento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="wa-nome">Nome</Label>
              <Input
                id="wa-nome"
                name="name"
                autoComplete="name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="wa-tel">WhatsApp</Label>
              <Input
                id="wa-tel"
                name="tel"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(43) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={sending} className="bg-lzgreen text-navy-deep hover:bg-lzgreen-strong font-semibold">
                {sending ? "Enviando..." : "Abrir WhatsApp"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
