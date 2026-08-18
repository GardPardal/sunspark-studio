create unique index if not exists editorial_topic_sources_topic_item_uidx
  on public.editorial_topic_sources (topic_id, item_id);

insert into public.editorial_topic_sources (topic_id, source_id, item_id, peso, papel)
select i.topic_id, i.source_id, i.id, coalesce(s.autoridade, 50),
       case when s.tipo = 'oficial' then 'primaria' else 'contexto' end
from public.editorial_items i
left join public.editorial_sources s on s.id = i.source_id
where i.topic_id is not null
on conflict (topic_id, item_id) do nothing;

update public.editorial_topics t
set quantidade_fontes = greatest(1, (
  select count(distinct ts.source_id) from public.editorial_topic_sources ts where ts.topic_id = t.id
));