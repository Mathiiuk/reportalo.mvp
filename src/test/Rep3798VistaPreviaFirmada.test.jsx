/**
 * @file Rep3798VistaPreviaFirmada.test.jsx
 * @description REP-3798: el bucket de evidencias es privado, así que la vista previa muestra la URL firmada y
 * temporal (previewUrl) y no la canónica (sanitizedUrl), que no se abre sin sesión.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidencePreviewScreen } from '../components/report/EvidencePreviewScreen';

const evidence = [
  {
    id: 'e1',
    sanitizedUrl: 'https://x.supabase.co/storage/v1/object/public/report-evidences/csid/1_sanitized.jpg',
    previewUrl: 'https://x.supabase.co/storage/v1/object/sign/report-evidences/csid/1_sanitized.jpg?token=abc',
    detectedZones: [{ x: '25%', y: '30%', width: '50px', height: '50px', type: 'face' }],
  },
];

describe('REP-3798 · vista previa con URL firmada', () => {
  it('UT-PRV-08: muestra la URL firmada y no la canónica del bucket privado', () => {
    const { container } = render(
      <EvidencePreviewScreen evidenceList={evidence} categoryName="Tránsito" onConfirm={vi.fn()} onRetake={vi.fn()} />
    );
    const html = container.innerHTML;
    expect(html).toContain('/object/sign/report-evidences/');
    expect(html).not.toContain('/object/public/report-evidences/');
    expect(screen.getByText('Evidencia protegida')).toBeInTheDocument();
  });
});
