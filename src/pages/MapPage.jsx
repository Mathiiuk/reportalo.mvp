import React from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { CitizenMap } from '../components/map/CitizenMap';

export const MapPage = () => {
  return (
    <AppLayout activeTab="mapa">
      <CitizenMap />
    </AppLayout>
  );
};
