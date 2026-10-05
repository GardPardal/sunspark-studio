-- Rastreamento Meta: guarda no lead o IP e o ID anônimo do visitante (o mesmo external_id
-- do Pixel no navegador). Os eventos de funil (qualificação, visita, venda) enviados pela
-- CAPI dias depois reaproveitam esses dados para a Meta ligar a venda ao clique no anúncio.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS client_ip text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS visitor_id text;
