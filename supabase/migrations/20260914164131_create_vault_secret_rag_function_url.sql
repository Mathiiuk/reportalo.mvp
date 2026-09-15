select vault.create_secret(
  'https://yryuhyiujyignkdhiyua.supabase.co/functions/v1/analizar-reporte',
  'rag_analizar_reporte_url',
  'URL de la Edge Function analizar-reporte, usada por dispatch_rag_analysis_queue() via pg_net'
);
