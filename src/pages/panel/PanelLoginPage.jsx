import React from 'react';
import { Navigate } from 'react-router-dom';
import { Ms, PanelTopBar, useMaterialSymbols, usePanelTheme } from '../../components/panel/PanelShell';
import { usePanelSignIn } from '../../components/panel/usePanelSignIn';
import { useNoIndex } from '../../hooks/useNoIndex';
import { useAuth } from '../../hooks/useAuth';

/** REP-3747 · Ingreso del panel (diseño de Iván, D40). El pedido del enlace vive en usePanelSignIn. */
export const PanelLoginPage = () => {
  useNoIndex();
  useMaterialSymbols();
  const { session } = useAuth();
  const { email, setEmail, sentTo, step, sending, error, submit, reset } = usePanelSignIn();
  const [theme, toggleTheme] = usePanelTheme();

  if (session) return <Navigate to="/panel" replace />;

  return (
    <div className="op-panel" data-theme={theme}>
      <PanelTopBar agency={null} theme={theme} onToggleTheme={toggleTheme} />
      <main className="login">
        {step === 'sent' ? (
          <div className="login-card">
            <div className="sent-ic">
              <Ms name="mark_email_read" />
            </div>
            <h1>Revisá tu correo</h1>
            <p>
              Si el correo corresponde a un organismo, te llega el enlace a <b>{sentTo}</b>. Abrilo desde
              este dispositivo.
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={reset}
            >
              Usar otro correo
            </button>
          </div>
        ) : (
          <div className="login-card">
            <span className="lbl">Acceso para organismos</span>
            <h1>Ingresar al panel</h1>
            <p>Usá el correo de tu organismo. Te llega un enlace para entrar, sin contraseña.</p>
            <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label className="field-l" htmlFor="f-email">
                  Correo del organismo
                </label>
                <div className="input-ic">
                  <Ms name="alternate_email" />
                  <input
                    id="f-email"
                    className="input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="nombre@organismo.gob.ar"
                    aria-describedby="login-msg"
                    aria-invalid={error ? 'true' : undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div id="login-msg">
                  {error && (
                    <div className="field-err" role="alert">
                      <Ms name="error" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={sending}>
                {sending ? <span className="spin" aria-hidden="true" /> : null}
                <span>{sending ? 'Enviando…' : 'Enviarme el enlace'}</span>
                {!sending && <Ms name="arrow_forward" />}
              </button>
            </form>
            <div className="login-alt">
              <Ms name="domain" />
              <span>
                ¿Tu organismo todavía no tiene acceso? Escribinos a <a href="mailto:info@reportalo.com.ar">info@reportalo.com.ar</a>.
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PanelLoginPage;
