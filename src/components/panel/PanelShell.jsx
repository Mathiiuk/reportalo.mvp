import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/panelOrganismos.css';

/*
 * REP-3747 · Piezas comunes del panel con el diseño de Iván: íconos, cabecera, franja de prueba y avisos.
 */

const SYMBOLS_ID = 'op-panel-material-symbols';
const SYMBOLS_URL =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..24,400,0..1,0&display=block';

/**
 * Íconos Material Symbols solo en el panel (decisión 5B de Matías). Se cargan al abrir el panel, sin bloquear la app
 * del vecino: index.html no usa hojas externas porque con poca señal dejaban la pantalla en negro.
 */
export const useMaterialSymbols = () => {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(SYMBOLS_ID)) return;
    const link = document.createElement('link');
    link.id = SYMBOLS_ID;
    link.rel = 'stylesheet';
    link.href = SYMBOLS_URL;
    document.head.appendChild(link);
  }, []);
};

/** Ícono decorativo: el texto de la ligadura no se lee (aria-hidden). */
export const Ms = ({ name, fill = false, className = '' }) => (
  <span className={`ms${fill ? ' fill' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true">
    {name}
  </span>
);

/** Cabecera del panel: marca, sección, organismo (con PRUEBA si es de prueba) y menú de la cuenta. */
export const PanelTopBar = ({ agency, email, onSignOut, inboxHref = '/panel' }) => {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!wrap.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const initials = (email || 'OP')
    .split('@')[0]
    .replace(/[^a-z]/gi, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="top">
      <Link className="brand" to={agency ? inboxHref : '/panel/ingresar'} aria-label="Reportalo, panel de organismos">
        <img src="/logo-icon.webp" alt="" />
        <b>
          Reportalo<span className="tm">™</span>
        </b>
        <span className="tag">ORGANISMO</span>
      </Link>
      {agency && (
        <nav className="nav" aria-label="Secciones">
          <Link to={inboxHref} aria-current="page">
            Bandeja
          </Link>
        </nav>
      )}
      <div className="top-right">
        {agency && (
          <div className="acct-slot">
            <span className="acct">
              <Ms name={agency.is_test ? 'science' : 'account_balance'} />
              <span>{agency.name}</span>
              {agency.is_test && <span className="pill-test">PRUEBA</span>}
            </span>
          </div>
        )}
        {agency && (
          <div className="menu-wrap" ref={wrap}>
            <button
              type="button"
              className="avatar-btn"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={`Cuenta: ${email ?? ''}`}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="avatar">{initials}</span>
            </button>
            {open && (
              <div className="menu" role="menu" aria-label="Cuenta">
                <div className="menu-item" style={{ cursor: 'default' }}>
                  <Ms name="account_circle" />
                  <span>
                    {email}
                    <small>{agency.name}</small>
                  </span>
                </div>
                <hr />
                <button type="button" className="menu-item" role="menuitem" onClick={onSignOut}>
                  <Ms name="logout" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

/** Franja de staging: solo para organismos marcados de prueba en la base (agencies.is_test). */
export const TestBanner = ({ agency, className = '' }) =>
  agency?.is_test ? (
    <div className={`banner${className ? ` ${className}` : ''}`} role="note">
      <Ms name="science" />
      <span>
        Organismo de prueba en staging.<span className="long"> Ningún reporte de este panel se envía a un municipio real.</span>
      </span>
    </div>
  ) : null;

/** Avisos abajo a la derecha, en una región aria-live; se van solos a los 6 segundos. */
export const useToasts = () => {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);
  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (message, kind = 'ok') => {
      seq.current += 1;
      const id = seq.current;
      setToasts((list) => [...list, { id, message, kind }]);
      setTimeout(() => dismiss(id), 6000);
    },
    [dismiss]
  );
  return { toasts, toast, dismiss };
};

export const ToastRegion = ({ toasts, onDismiss }) => (
  <div className="toast-region" role="status" aria-live="polite">
    {toasts.map((t) => (
      <div key={t.id} className={`toast${t.kind === 'err' ? ' err' : ''}`}>
        <Ms name={t.kind === 'err' ? 'error' : 'check_circle'} fill />
        <span>{t.message}</span>
        <button type="button" aria-label="Cerrar aviso" onClick={() => onDismiss(t.id)}>
          <Ms name="close" />
        </button>
      </div>
    ))}
  </div>
);
