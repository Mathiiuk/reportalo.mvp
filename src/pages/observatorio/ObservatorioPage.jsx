import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ObsLayout } from '../../components/observatorio/ObsLayout';
import { MetodologiaPage } from './MetodologiaPage';
import { MiBarrioPage } from './MiBarrioPage';
import { MapaPage } from './MapaPage';
import { CompararPage } from './CompararPage';

/**
 * OBS · Observatorio del vecino: /observatorio/*.
 * Mi barrio (F2), Mapa (F3), Comparar (F4) y Metodología (F1).
 */
export const ObservatorioPage = () => (
  <ObsLayout>
    <Routes>
      <Route index element={<Navigate to="mi-barrio" replace />} />
      <Route path="mi-barrio" element={<MiBarrioPage />} />
      <Route path="mapa" element={<MapaPage />} />
      <Route path="comparar" element={<CompararPage />} />
      <Route path="metodologia" element={<MetodologiaPage />} />
      <Route path="*" element={<Navigate to="mi-barrio" replace />} />
    </Routes>
  </ObsLayout>
);

export default ObservatorioPage;
