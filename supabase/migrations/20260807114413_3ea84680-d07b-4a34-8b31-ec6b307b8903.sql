CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  saldo_inventario numeric,
  saldo_fisico numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'UNID',
  preco_venda numeric NOT NULL DEFAULT 0,
  preco_compra numeric NOT NULL DEFAULT 0,
  preco_compra_convertido numeric NOT NULL DEFAULT 0,
  prateleira text,
  ordem integer NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (codigo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_select" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_insert" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "inventory_update" ON public.inventory_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inventory_delete" ON public.inventory_items FOR DELETE TO authenticated USING (public.is_admin_or_coord());

CREATE OR REPLACE FUNCTION public.inventory_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_items_touch
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.inventory_touch_updated_at();