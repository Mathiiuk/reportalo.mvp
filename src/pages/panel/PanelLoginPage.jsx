import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Ms, PanelTopBar, useMaterialSymbols } from '../../components/panel/PanelShell';
import { useNoIndex } from '../../hooks/useNoIndex';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabaseClient';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Supabase responde así cuando el correo no tiene cuenta y no se permite crearla
const NO_ACCOUNT = /signups? not allowed|otp_disabled|user not found/i;

/**
 * REP-3747 · Ingreso del panel (diseño de Iván, D40; decisión 4A de Matías, 29/10).
 *
 * Pide el enlace con shouldCreateUser: false, así un correo nuevo no crea cuenta. La respuesta es siempre la misma:
 * nadie puede averiguar qué correos son de un organismo. Si una cuenta sin organismo entra igual, OperatorRoute la
 * manda a /acceso-restringido (caso 6 de las reglas).
 */
export const PanelLoginPage = () => {
  useNoIndex();
  useMaterialSymbols();
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('form');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  if (session) return <Navigate to="/panel" replace />;

  const submit = async (event) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!EMAIL.test(normalized)) {
      setError('Escribí un correo válido, por ejemplo nombre@organismo.gob.ar.');
      return;
    }
    setSending(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/panel` },
    });
    setSending(false);
    if (otpError && !NO_ACCOUNT.test(`${otpError.message ?? ''} ${otpError.code ?? ''}`)) {
      setError('No pudimos enviar el enlace. Probá de nuevo en unos minutos.');
      return;
    }
    setStep('sent');
  };

  return (
    <div className="op-panel">
      <PanelTopBar agency={null} />
      <main className="login">
        {step === 'sent' ? (
          <div className="login-card">
            <div className="sent-ic">
              <Ms name="mark_email_read" />
            </div>
            <h1>Revisá tu correo</h1>
            <p>
              Si el correo corresponde a un organismo, te llega el enlace a <b>{email.trim().toLowerCase()}</b>. Abrilo desde
              este dispositivo.
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => {
                setStep('form');
                setError(null);
              }}
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
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
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
