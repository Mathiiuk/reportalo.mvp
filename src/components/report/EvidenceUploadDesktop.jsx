import React, { useEffect, useRef, useState } from 'react';
import { FileUp, Shield, LocateFixed, Plus, X, AlertCircle } from 'lucide-react';
import { ReportFlowHeader } from './ReportFlowHeader';
import { getFriendlyLocationLabel } from '../../services/locationService';

const MAX_PHOTOS = 4;

const readLatLng = (coords) => {
  if (Array.isArray(coords)) return { lng: coords[0], lat: coords[1] };
  if (coords && typeof coords === 'object') {
    return { lat: coords.lat ?? coords.latitude, lng: coords.lng ?? coords.longitude };
  }
  return { lat: null, lng: null };
};

/**
 * Paso 1 del alta de reporte en escritorio: la captura se vuelve carga de archivo.
 * UJ v3.3 · D10 «Subir la foto» (REP-3791 Bloque 1-D). Recibe las mismas props que
 * EvidenceCaptureStep, que decide cuál de los dos mostrar según el ancho de pantalla.
 *
 * Varios archivos (selector o arrastre) se entregan de a uno a onCaptureFile mediante una cola,
 * para que cada llamada use la lista de evidencias ya actualizada por useEvidenceCapture.
 */
export const EvidenceUploadDesktop = ({
  evidenceList = [],
  error,
  isProcessing = false,
  geolocation = null,
  onCaptureFile,
  onRemovePhoto,
  onCancel,
  onContinue,
}) => {
  const fileInputRef = useRef(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const photoCount = evidenceList.length;
  const isFull = photoCount >= MAX_PHOTOS;
  const isBusy = isProcessing || pendingFiles.length > 0;

  // Cola de archivos: uno por render, con la función de captura más reciente
  useEffect(() => {
    if (pendingFiles.length === 0 || isProcessing || !onCaptureFile) return;
    const [nextFile, ...rest] = pendingFiles;
    setPendingFiles(rest);
    onCaptureFile(nextFile);
  }, [pendingFiles, isProcessing, onCaptureFile]);

  const enqueueFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length > 0) setPendingFiles((queue) => [...queue, ...files]);
  };

  const openFilePicker = () => {
    if (!isFull) fileInputRef.current?.click();
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (!isFull) setIsDragging(true);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (!isFull) enqueueFiles(event.dataTransfer?.files);
  };

  const { lat, lng } = readLatLng(geolocation);
  const hasCoords = typeof lat === 'number' && typeof lng === 'number';
  const friendlyLabel = getFriendlyLocationLabel(geolocation);
  const zoneLabel = friendlyLabel.includes(' · ') ? friendlyLabel.split(' · ')[0] : null;

  return (
    <div data-testid="evidence-capture-step" className="flex h-full w-full flex-col bg-rep-bg">
      <ReportFlowHeader step={1} onBack={onCancel} backLabel="Cancelar y volver al mapa" />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        data-testid="gallery-file-input"
        onChange={(event) => {
          enqueueFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] gap-6 px-10 py-8">
          {/* Zona de arrastre */}
          <div
            data-testid="evidence-dropzone"
            onDragOver={handleDragOver}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex min-h-[440px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-8 text-center transition-colors duration-120 ${
              isDragging ? 'border-rep-accent bg-rep-accent-soft' : 'border-rep-track bg-rep-surface'
            } ${isFull ? 'opacity-45' : ''}`}
          >
            <FileUp className="h-12 w-12 text-rep-accent" strokeWidth={1.75} aria-hidden="true" />
            <h2 className="m-0 text-rep-section-d text-rep-ink">Arrastrá las fotos acá</h2>
            <p className="m-0 text-rep-label-d text-rep-ink-muted">JPG o PNG · máx. {MAX_PHOTOS} archivos</p>
            <button
              type="button"
              onClick={openFilePicker}
              disabled={isFull}
              className="rep-focus mt-2 inline-flex min-h-touch items-center justify-center rounded-xl border border-rep-border bg-rep-surface px-6 text-rep-body-d font-bold text-rep-accent transition-[transform,filter] duration-120 hover:brightness-[.96] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 dark:hover:brightness-[1.06]"
            >
              Elegir archivos
            </button>
          </div>

          {/* Panel lateral */}
          <aside className="flex flex-col gap-4" aria-label="Datos de la evidencia">
            <section className="rounded-2xl border border-rep-border bg-rep-surface p-5">
              <div className="flex items-center gap-2 text-rep-success">
                <Shield className="h-5 w-5 fill-current" aria-hidden="true" />
                <h3 className="m-0 text-[15px] font-extrabold">Privacidad activada</h3>
              </div>
              <p className="m-0 mt-2 text-rep-label-d font-medium text-rep-ink-body">
                Subí la foto normal. Los rostros y patentes se difuminan al procesarla, antes de guardarse.
              </p>
            </section>

            <section className="rounded-2xl border border-rep-border bg-rep-surface p-5">
              <div className="flex items-center gap-2">
                <LocateFixed className="h-5 w-5 shrink-0 text-rep-accent" strokeWidth={2.25} aria-hidden="true" />
                <span className="text-[15px] font-extrabold text-rep-ink">
                  {hasCoords ? `${lat.toFixed(3)}, ${lng.toFixed(3)}` : friendlyLabel}
                </span>
              </div>
              {hasCoords && (
                <p className="m-0 mt-1.5 text-rep-label-d text-rep-ink-muted">
                  {zoneLabel ? `${zoneLabel} · ` : ''}tomada del navegador
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-rep-border bg-rep-surface p-5" aria-labelledby="evidence-files-title">
              <h3
                id="evidence-files-title"
                className="m-0 text-rep-label-d font-bold uppercase tracking-wide text-rep-ink-muted"
              >
                {photoCount} de {MAX_PHOTOS} archivos
              </h3>
              <ul className="m-0 mt-3 flex list-none flex-wrap gap-3 p-0">
                {evidenceList.map((item, idx) => (
                  <li key={item.id} className="relative h-[72px] w-[72px]">
                    <img
                      src={item.previewUrl}
                      alt={`Foto ${idx + 1}`}
                      className="h-full w-full rounded-xl border border-rep-border object-cover"
                    />
                    {onRemovePhoto && (
                      <button
                        type="button"
                        onClick={() => onRemovePhoto(item.id)}
                        aria-label={`Eliminar foto ${idx + 1}`}
                        className="rep-focus absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rep-ink text-rep-surface shadow-md before:absolute before:-inset-2.5 before:content-['']"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
                {!isFull && (
                  <li>
                    <button
                      type="button"
                      onClick={openFilePicker}
                      aria-label="Agregar fotos"
                      className="rep-focus flex h-[72px] w-[72px] items-center justify-center rounded-xl border-2 border-dashed border-rep-track text-rep-ink-faint transition-colors duration-120 hover:border-rep-accent hover:text-rep-accent"
                    >
                      <Plus className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </li>
                )}
              </ul>
            </section>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-2xl border border-rep-danger/30 bg-rep-danger-soft p-4 text-rep-label-d font-semibold text-rep-danger"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
          </aside>

          {/* Acciones */}
          <div className="col-span-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rep-focus inline-flex min-h-touch items-center rounded-xl px-4 text-rep-body-d font-bold text-rep-ink-muted transition-colors duration-120 hover:text-rep-ink"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onContinue}
              disabled={photoCount === 0 || isBusy}
              className="rep-focus inline-flex min-h-[52px] min-w-[180px] items-center justify-center rounded-2xl bg-rep-accent px-8 text-rep-button text-rep-on-accent shadow-rep-accent transition-[transform,background-color] duration-120 hover:bg-rep-accent-strong active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:bg-rep-accent disabled:active:scale-100"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceUploadDesktop;
