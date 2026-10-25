import React from 'react';
import { Building2 } from 'lucide-react';
import { useNoIndex } from '../../hooks/useNoIndex';
import { useOperator } from '../../components/panel/OperatorRoute';

/**
 * REP-3747 · Panel de organismos (escritorio). Muestra el organismo de prueba del operador.
 * La bandeja de reportes llega con REP-3000; mientras tanto, el estado vacío es veraz.
 */
export const PanelPage = () => {
  useNoIndex();
  const operador = useOperator();
  const organismo = operador?.agency;

  return (
    <div className="min-h-[100dvh] w-full bg-rep-bg font-manrope">
      <header className="flex items-center gap-3 border-b border-rep-divider bg-rep-surface px-6 py-4">
        <Building2 aria-hidden="true" className="h-6 w-6 text-rep-ink-label" strokeWidth={2.25} />
        <div className="min-w-0">
          <h1 className="m-0 text-rep-section-d text-rep-ink">Panel de organismos</h1>
          <p className="m-0 truncate text-rep-label font-semibold text-rep-ink-muted">{organismo?.name}</p>
        </div>
        {organismo?.is_test && (
          <span className="ml-auto rounded-full border border-rep-border px-3 py-1 text-rep-label font-bold text-rep-ink-label">
            Entorno de prueba
          </span>
        )}
      </header>

      <main className="mx-auto max-w-[960px] px-6 py-10">
        <section className="rounded-xl border border-rep-border bg-rep-surface px-6 py-10 text-center">
          <h2 className="m-0 text-rep-title text-rep-ink">Todavía no hay reportes en tu bandeja</h2>
          <p className="m-0 mt-2 text-rep-body text-rep-ink-muted">
            Acá vas a ver los reportes de tu jurisdicción que lleguen a este organismo de prueba. Ningún municipio real
            recibe estos reportes.
          </p>
        </section>
      </main>
    </div>
  );
};

export default PanelPage;
