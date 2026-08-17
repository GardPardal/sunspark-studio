CREATE TABLE public.finance_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor text NOT NULL,
  projeto text NOT NULL,
  cidade text,
  metodo_pagamento text,
  valor numeric NOT NULL DEFAULT 0,
  faturado boolean NOT NULL DEFAULT false,
  recebido numeric NOT NULL DEFAULT 0,
  a_receber numeric NOT NULL DEFAULT 0,
  previsto text,
  faturado_em date,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_sales TO authenticated;
GRANT ALL ON public.finance_sales TO service_role;

ALTER TABLE public.finance_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver vendas" ON public.finance_sales
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados podem registrar vendas" ON public.finance_sales
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Gestores podem editar vendas" ON public.finance_sales
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Gestores podem excluir vendas" ON public.finance_sales
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_finance_sales_updated_at BEFORE UPDATE ON public.finance_sales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_finance_sales_vendedor ON public.finance_sales (vendedor);
CREATE INDEX idx_finance_sales_faturado ON public.finance_sales (faturado);

INSERT INTO public.finance_sales (vendedor, projeto, cidade, metodo_pagamento, valor, faturado, recebido, a_receber, previsto) VALUES
('BEATRIZ','WB260360COL - ARADIA GOUVEIA (13.2 KWp)','QUATIGUA','REFORMA BRASIL',33900.00,false,0.00,33900.00,'AGOSTO'),
('EDUARDA JURASKI','WB260351COL - ROBERTO BARBOSA (7.8 KWp)','SIQUEIRA CAMPOS','REFORMA BRASIL',20671.22,false,0.00,20671.22,'AGOSTO'),
('LUIZ HENRIQUE','WB260359SGL - JUSCELINO FURQUIM DE JESUS (90.28 KWp)','WENCESLAU BRAZ','LEASING',165829.63,false,0.00,165829.63,NULL),
('ADEMIR SILVA','LD260361COL - GEISA CARLA / DANILO (10.8 KWp)','BARBOSA FERRAZ','SOLFACIL',31700.00,false,0.00,31700.00,'AGOSTO'),
('EDUARDA JURASKI','LD260363COL - MARIA ISABEL PEDROSO ROBERTO (4.2 KWp)','JAPIRA','SOLFACIL',11939.32,false,0.00,11939.32,'AGOSTO'),
('PAMELA MARTINS','WB260362SGL - JOEL ANTONIO DE LIMA (8.4 KWp)','SAO JOSE DA BOA VISTA','RECURSO PROPRIO',23056.45,true,14000.00,9056.45,'SETEMBRO'),
('GUILHERME PAIVA','LD260356FMA - DEVANIR VILATORO (8 DE ABRIL) (4.2 KWp)','JARDIM ALEGRE','SOLFACIL',12300.00,false,0.00,12300.00,'AGOSTO'),
('JOAO GABRIEL MACEDO','LD260354FMA - IVONETE/VILSON (3 KWp)','JARDIM ALEGRE','SOLFACIL',9100.00,true,8190.00,910.00,'SETEMBRO'),
('CARLOS MUNHOZ','WB260353SGL - TRANSPORTADORA FURQUIM (21.6 KWp)','SENGES','RECURSO PROPRIO',53377.33,false,10000.00,43377.33,'SETEMBRO'),
('EDUARDA JURASKI','WB260355FMA - DILVANE LOPES (4.2 KWp)','ARAPOTI','RECURSO PROPRIO',11210.81,false,3736.93,7473.88,'SETEMBRO'),
('CARLOS MUNHOZ','WB260357COL - EMERSON GABRIEL NOGARI (4.2 KWp)','WENCESLAU BRAZ','RECURSO PROPRIO',11900.00,false,0.00,11900.00,'SETEMBRO'),
('NELTON SHISHITO','WB260358SGL - FRANGOS PIONEIRO - COMPOSTAGEM (14.4 KWp)','JOAQUIM TAVORA','RECURSO PROPRIO',25750.00,false,0.00,25750.00,'SETEMBRO');