import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ObsLayout } from '../../components/observatorio/ObsLayout';
import { EnConstruccion } from '../../components/observatorio/ObsEstados';
import { MetodologiaPage } from './MetodologiaPage';

/**
 * OBS · Observatorio del vecino: /observatorio/*.
 * F1 deja el marco, la Metodología y los estados; Mi barrio (F2), Mapa (F3) y Comparar (F4) llegan después.
 */
export const ObservatorioPage = () => (
  <ObsLayout>
    <Routes>
      <Route index element={<Navigate to="mi-barrio" replace />} />
      <Route
        path="mi-barrio"
        element={
          <EnConstruccion
            seccion="Mi barrio"
            queVaATener="Vas a elegir tu barrio o localidad y ver qué parte de lo reportado se resolvió, en cuántos días y qué es lo que más se reporta, comparado con tu comuna o partido."
          />
        }
      />
      <Route
        path="mapa"
        element={
          <EnConstruccion
            seccion="Mapa"
            queVaATener="Un mapa del país al barrio: un círculo por zona según la cantidad de reportes. Tocás un círculo y bajás un nivel."
          />
        }
      />
      <Route
        path="comparar"
        element={
          <EnConstruccion
            seccion="Comparar"
            queVaATener="Hasta tres zonas lado a lado, con el mismo criterio. Comparar no es rankear."
          />
        }
      />
      <Route path="metodologia" element={<MetodologiaPage />} />
      <Route path="*" element={<Navigate to="mi-barrio" replace />} />
    </Routes>
  </ObsLayout>
);

export default ObservatorioPage;
