insert into public.editorial_jobs (topic_id, tipo, status)
select id, 'artigo', 'queued' from public.editorial_topics
where status in ('identificada','verificando');

update public.editorial_topics set status = 'coletando'
where status in ('identificada','verificando');

update public.editorial_settings set modo_publicacao = 'automatica', max_artigos_dia = 50, pausar_publicacao = false;

update public.site_posts set status = 'publicado', published_at = coalesce(published_at, now())
where status in ('revisao','rascunho');