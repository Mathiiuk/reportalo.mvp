import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppLoadingScreen } from '../components/common/AppLoadingScreen';

describe('Componente AppLoadingScreen', () => {
  it('UT-LS-01: Renderiza el contenedor con logo, título Reportalo y mensaje personalizado', () => {
    render(<AppLoadingScreen message="Conectando al servidor..." />);

    expect(screen.getByTestId('app-loading-screen')).toBeInTheDocument();
    expect(screen.getByAltText('Logo Reportalo')).toBeInTheDocument();
    expect(screen.getByText('Reportalo')).toBeInTheDocument();
    expect(screen.getByText('Conectando al servidor...')).toBeInTheDocument();
  });
});
