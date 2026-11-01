import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Supabase responde así cuando el correo no tiene cuenta y no se permite crearla
const NO_ACCOUNT = /signups? not allowed|otp_disabled|user not found/i;

/**
 * REP-3747 · Pedido del enlace para entrar al panel (decisión 4A de Matías, 29/10). Lo usan /panel/ingresar y la
 * tarjeta de la landing de municipios (D40).
 *
 * Pide el enlace con shouldCreateUser: false, así un correo nuevo no crea cuenta. La respuesta es siempre la misma:
 * nadie puede averiguar qué correos son de un organismo. Si una cuenta sin organismo entra igual, OperatorRoute la
 * manda a /acceso-restringido (caso 6 de las reglas).
 */
export const usePanelSignIn = () => {
  const [email, setEmailState] = useState('');
  const [step, setStep] = useState('form');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const setEmail = (value) => {
    setEmailState(value);
    setError(null);
  };

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

  const reset = () => {
    setStep('form');
    setError(null);
  };

  return { email, setEmail, sentTo: email.trim().toLowerCase(), step, sending, error, submit, reset };
};
