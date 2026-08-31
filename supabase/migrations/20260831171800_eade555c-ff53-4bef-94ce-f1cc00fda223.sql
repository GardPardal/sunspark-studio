create table if not exists public.hub_estado (
  id int primary key,
  estado jsonb not null default '{"trat":{},"notas":[],"msgs":[]}'::jsonb,
  atualizado_em timestamptz not null default now()
);
create table if not exists public.hub_estado_hist (
  n bigserial primary key, id int not null,
  estado jsonb not null, em timestamptz not null default now()
);
create table if not exists public.hub_dados (
  id int primary key,
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

insert into public.hub_estado (id) values (1) on conflict (id) do nothing;
insert into public.hub_dados  (id) values (1) on conflict (id) do nothing;

create or replace function public.hub_estado_bak() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.hub_estado_hist(id, estado) values (old.id, old.estado);
  delete from public.hub_estado_hist where n <= (select max(n) - 200 from public.hub_estado_hist);
  new.atualizado_em = now();
  return new;
end $$;
drop trigger if exists hub_estado_bak_t on public.hub_estado;
create trigger hub_estado_bak_t before update on public.hub_estado
  for each row execute function public.hub_estado_bak();

create or replace function public.hub_dados_bak() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.hub_dados_hist(dados, origem) values (old.dados, 'auto');
  delete from public.hub_dados_hist
   where id <= (select max(id) - 60 from public.hub_dados_hist);
  new.atualizado_em = now();
  return new;
end $$;
drop trigger if exists hub_dados_bak_t on public.hub_dados;
create trigger hub_dados_bak_t before update on public.hub_dados
  for each row execute function public.hub_dados_bak();

alter table public.hub_estado      enable row level security;
alter table public.hub_estado_hist enable row level security;
alter table public.hub_dados       enable row level security;
alter table public.hub_dados_hist  enable row level security;

drop policy if exists hub_estado_le           on public.hub_estado;
drop policy if exists hub_estado_escreve      on public.hub_estado;
drop policy if exists hub_le                  on public.hub_estado;
drop policy if exists hub_escreve             on public.hub_estado;
drop policy if exists hub_estado_read_priv    on public.hub_estado;
drop policy if exists hub_estado_update_priv  on public.hub_estado;
create policy hub_estado_le      on public.hub_estado for select to anon, authenticated using (id = 1);
create policy hub_estado_escreve on public.hub_estado for update to anon, authenticated using (id = 1) with check (id = 1);

drop policy if exists "Admins podem ler os dados do hub"    on public.hub_dados;
drop policy if exists "Admins podem gravar os dados do hub" on public.hub_dados;
drop policy if exists hub_dados_le    on public.hub_dados;
drop policy if exists hub_dados_admin on public.hub_dados;
create policy hub_dados_admin on public.hub_dados
  for all to authenticated
  using (public.is_admin_or_coord())
  with check (public.is_admin_or_coord());

drop policy if exists "Admins leem historico do hub"          on public.hub_dados_hist;
drop policy if exists "Admins gravam historico do hub"        on public.hub_dados_hist;
drop policy if exists "Sem acesso público ao histórico do hub" on public.hub_dados_hist;
drop policy if exists hub_dados_hist_admin on public.hub_dados_hist;
create policy hub_dados_hist_admin on public.hub_dados_hist
  for all to authenticated
  using (public.is_admin_or_coord())
  with check (public.is_admin_or_coord());

grant usage on schema public to anon, authenticated;
grant select, update on public.hub_estado to anon, authenticated;
grant select, insert, update on public.hub_dados to authenticated;
grant select, insert on public.hub_dados_hist to authenticated;
grant all on public.hub_estado to service_role;
grant all on public.hub_estado_hist to service_role;
grant all on public.hub_dados to service_role;
grant all on public.hub_dados_hist to service_role;

revoke all on public.hub_estado_hist from anon, authenticated;
revoke insert, delete on public.hub_estado from anon, authenticated;
revoke delete on public.hub_dados from anon, authenticated;
revoke all on public.hub_dados from anon;
revoke all on public.hub_dados_hist from anon;