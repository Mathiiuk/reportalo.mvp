-- ==============================================================================
-- 05_dev_fake_embeddings.sql — vectores SINTÉTICOS, SOLO para desarrollo local
-- ==============================================================================
--
-- Esto NO son embeddings reales de gemini-embedding-2 y NUNCA deben usarse para
-- medir calidad de recuperación (para eso está REP-2910, con el modelo real).
-- Sirven únicamente para poder ejecutar match_knowledge_fragments() de punta a
-- punta en este Postgres local y comprobar que la CASCADA JURISDICCIONAL, el
-- ORDEN por similitud y el LIMIT funcionan como espera el RPC — sin necesitar
-- GEMINI_API_KEY.
--
-- Genera un vector de 768 dimensiones por fragmento, determinístico (mismo
-- fragmento -> mismo vector siempre) a partir de un hash de su id, usando
-- setseed() + random(). No tiene ninguna relación semántica real con el texto.
-- ==============================================================================
do $$
declare
  frag record;
  dims int := 768;
  vec double precision[];
  i int;
begin
  for frag in select id from public.knowledge_fragments where is_current loop
    -- Semilla determinística por fragmento (hashtext da un int; lo llevamos a [-1, 1])
    perform setseed((hashtext(frag.id::text)::double precision / 2147483647.0));
    vec := array[]::double precision[];
    for i in 1..dims loop
      vec := array_append(vec, random() * 2 - 1);
    end loop;

    insert into public.fragment_embeddings (fragment_id, model_code, embedding)
    values (frag.id, 'gemini-embedding-2@768', vec::vector(768))
    on conflict (fragment_id, model_code) do update set embedding = excluded.embedding;
  end loop;
end $$;

-- Verificación rápida
select count(*) as fragmentos_con_vector, vector_dims(embedding) as dimensiones
from public.fragment_embeddings
where model_code = 'gemini-embedding-2@768'
group by vector_dims(embedding);
