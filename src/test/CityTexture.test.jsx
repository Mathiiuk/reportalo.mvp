import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CityTexture } from '../components/common/CityTexture';

describe('REP-3802 · CityTexture animada', () => {
  it('UT-CT-01: con animated aplica la deriva', () => {
    const { container } = render(<CityTexture animated />);
    expect(container.querySelector('svg')).toHaveClass('rep-city-drift');
  });

  it('UT-CT-02: por defecto queda estática (M23 «Tu sesión venció»)', () => {
    const { container } = render(<CityTexture />);
    expect(container.querySelector('svg')).not.toHaveClass('rep-city-drift');
  });
});
