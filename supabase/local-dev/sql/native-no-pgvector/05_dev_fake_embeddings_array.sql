-- ==============================================================================
-- 05_dev_fake_embeddings_array.sql — vectores SINTÉTICOS (double precision[]),
-- SOLO para desarrollo local sin pgvector. Ver advertencia completa en
-- supabase/local-dev/sql/05_dev_fake_embeddings.sql (misma idea, otro tipo de columna).
-- ==============================================================================
do $$
declare
  frag record;
  dims int := 768;
  vec double precision[];
  i int;
begin
  for frag in select id from public.knowledge_fragments where is_current loop
    perform setseed((hashtext(frag.id::text)::double precision / 2147483647.0));
    vec := array[]::double precision[];
    for i in 1..dims loop
      vec := array_append(vec, random() * 2 - 1);
    end loop;

    insert into public.fragment_embeddings (fragment_id, model_code, embedding)
    values (frag.id, 'gemini-embedding-2@768', vec)
    on conflict (fragment_id, model_code) do update set embedding = excluded.embedding;
  end loop;
end $$;

select count(*) as fragmentos_con_vector, array_length(embedding, 1) as dimensiones
from public.fragment_embeddings
where model_code = 'gemini-embedding-2@768'
group by array_length(embedding, 1);
