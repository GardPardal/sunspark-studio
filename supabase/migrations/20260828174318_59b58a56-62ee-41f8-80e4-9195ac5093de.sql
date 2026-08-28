create table if not exists public.hub_estado (
  id             int primary key,
  estado         jsonb       not null default '{"trat":{},"notas":[],"msgs":[]}'::jsonb,
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.hub_estado_hist (
  n      bigserial primary key,
  id     int         not null,
  estado jsonb       not null,
  em     timestamptz not null default now()
);

create or replace function public.hub_estado_bak() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.hub_estado_hist(id, estado) values (old.id, old.estado);
  delete from public.hub_estado_hist
   where n <= (select max(n) - 200 from public.hub_estado_hist);
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists hub_estado_bak_t on public.hub_estado;
create trigger hub_estado_bak_t before update on public.hub_estado
  for each row execute function public.hub_estado_bak();

insert into public.hub_estado (id) values (1) on conflict (id) do nothing;

alter table public.hub_estado      enable row level security;
alter table public.hub_estado_hist enable row level security;

drop policy if exists hub_le      on public.hub_estado;
drop policy if exists hub_escreve on public.hub_estado;

create policy hub_le      on public.hub_estado for select to anon, authenticated
  using (id = 1);
create policy hub_escreve on public.hub_estado for update to anon, authenticated
  using (id = 1) with check (id = 1);

grant select, update on public.hub_estado to anon, authenticated;
grant all on public.hub_estado to service_role;
grant all on public.hub_estado_hist to service_role;
revoke all on public.hub_estado_hist from anon, authenticated;