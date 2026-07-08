create table if not exists public.liz_aprendizados (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('objecao','argumento','dado_tecnico','tarifa','regiao','dica_venda','outros')),
  titulo text not null,
  conteudo text not null,
  contexto text,
  tags text[] not null default '{}',
  criado_por uuid references auth.users(id) on delete set null,
  origem text default 'liz_chat',
  usos int not null default 0,
  ultima_utilizacao timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists liz_aprendizados_categoria_idx on public.liz_aprendizados(categoria);
create index if not exists liz_aprendizados_tags_idx on public.liz_aprendizados using gin(tags);
create index if not exists liz_aprendizados_created_at_idx on public.liz_aprendizados(created_at desc);

grant select, insert, update, delete on public.liz_aprendizados to authenticated;
grant all on public.liz_aprendizados to service_role;

alter table public.liz_aprendizados enable row level security;

create policy "Time logado le aprendizados"
  on public.liz_aprendizados for select
  to authenticated
  using (true);

create policy "Time logado grava aprendizados"
  on public.liz_aprendizados for insert
  to authenticated
  with check (true);

create policy "Time logado atualiza aprendizados"
  on public.liz_aprendizados for update
  to authenticated
  using (true)
  with check (true);

create policy "Admin apaga aprendizados"
  on public.liz_aprendizados for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.liz_aprendizados_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_liz_aprendizados_updated_at
  before update on public.liz_aprendizados
  for each row execute function public.liz_aprendizados_touch_updated_at();