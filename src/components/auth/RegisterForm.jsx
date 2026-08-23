// ==============================================================================
// Formulario de Registro Ciudadano Pulido y Accesible (RegisterForm.jsx)
// ==============================================================================

// Importación de React y hooks de estado
import React, { useState } from 'react';
// Hook de gestión de formularios
import { useForm } from 'react-hook-form';
// Hook de navegación de React Router
import { useNavigate } from 'react-router-dom';
// Notificaciones Toast de Sonner
import { toast } from 'sonner';
// Hooks de autenticación y estado de onboarding
import { useAuth } from '../../hooks/useAuth';
import { useOnboarding } from '../../hooks/useOnboarding';
// Componentes UI comunes
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Modal } from '../ui/Modal';

export const RegisterForm = ({ onSwitchToLogin }) => {
  const { signUp, signInWithGoogle } = useAuth();
  const { setRegistered } = useOnboarding();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Inicialización de react-hook-form
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  // Observar la contraseña para validar la confirmación
  const passwordValue = watch('password');

  // Envío del formulario de Registro con Supabase
  const onSubmit = async (data) => {
    if (!acceptedTerms) {
      toast.warning('Debes aceptar los Términos y Condiciones para continuar.');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(data.email, data.password, {
        full_name: data.fullName,
      });

      // Actualizar estado de onboarding a 'registered'
      setRegistered();
      toast.success('¡Cuenta creada con éxito! Continuemos con los permisos.');

      // Redirección a la pantalla de permisos
      navigate('/permisos');
    } catch (error) {
      console.error('Error al registrar usuario:', error);
      const errorMsg =
        error.message?.includes('User already registered')
          ? 'Este email ya está registrado. Por favor iniciá sesión.'
          : error.message || 'Ocurrió un error al crear tu cuenta. Intentá nuevamente.';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Registro con Google OAuth (requiere aceptar Términos y Condiciones)
  const handleGoogleRegister = async () => {
    if (!acceptedTerms) {
      toast.warning('Debés aceptar los Términos y Condiciones para registrarte con Google.');
      return;
    }
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Error con Google OAuth:', error);
      toast.error('No se pudo registrar con Google.');
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 text-left">
        {/* Cabecera del formulario */}
        <div className="mb-0.5">
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Crear cuenta</h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Sumate para reportar y transformar el espacio público de tu ciudad.
          </p>
        </div>

        {/* Campo Nombre Completo */}
        <Input
          label="Nombre completo"
          type="text"
          placeholder="Ej. Martín Gómez"
          autoComplete="name"
          autoCapitalize="words"
          disabled={isLoading}
          error={errors.fullName?.message}
          {...register('fullName', {
            required: 'Ingresá tu nombre.',
            minLength: {
              value: 3,
              message: 'El nombre debe tener al menos 3 caracteres.',
            },
          })}
        />

        {/* Campo Email optimizado para móvil */}
        <Input
          label="Email"
          type="email"
          placeholder="tu@email.com"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck="false"
          disabled={isLoading}
          error={errors.email?.message}
          {...register('email', {
            required: 'El email es obligatorio.',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Ingresá un email válido.',
            },
          })}
        />

        {/* Campo Contraseña reforzada */}
        <Input
          label="Contraseña"
          type="password"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          disabled={isLoading}
          error={errors.password?.message}
          {...register('password', {
            required: 'La contraseña es obligatoria.',
            minLength: {
              value: 8,
              message: 'La contraseña debe tener al menos 8 caracteres.',
            },
          })}
        />

        {/* Campo Confirmar Contraseña */}
        <Input
          label="Confirmar contraseña"
          type="password"
          placeholder="Repetí tu contraseña"
          autoComplete="new-password"
          disabled={isLoading}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword', {
            required: 'Confirmá tu contraseña.',
            validate: (value) =>
              value === passwordValue || 'Las contraseñas no coinciden.',
          })}
        />

        {/* Checkbox Obligatorio de Términos y Condiciones */}
        <div className="flex items-start gap-2.5 mt-0.5 bg-slate-50/70 p-2.5 rounded-2xl border border-slate-200/60">
          <input
            id="terms-checkbox"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="w-4.5 h-4.5 mt-0.5 rounded-md border-slate-300 text-primary focus:ring-primary/30 cursor-pointer accent-primary"
          />
          <label htmlFor="terms-checkbox" className="text-xs text-slate-600 leading-snug cursor-pointer font-medium select-none">
            Acepto los{' '}
            <button
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="text-primary font-bold hover:underline cursor-pointer"
            >
              Términos y Condiciones
            </button>{' '}
            y la Política de Privacidad de Reportalo.
          </label>
        </div>

        {/* Botón de Registro (Color Accent #F88F37) */}
        <div className="mt-1">
          <Button
            type="submit"
            variant="accent"
            size="lg"
            isLoading={isLoading}
            disabled={!acceptedTerms}
          >
            Registrarse
          </Button>
        </div>

        {/* Separador elegante */}
        <div className="relative flex items-center justify-center my-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <span className="relative bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            o registrarse con
          </span>
        </div>

        {/* Botón Registrarse con Google (Deshabilitado sin T&C) */}
        <Button
          type="button"
          variant="google"
          size="md"
          onClick={handleGoogleRegister}
          disabled={!acceptedTerms}
          icon={
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          }
        >
          Registrarse con Google
        </Button>

        {/* Conmutador a Login */}
        {onSwitchToLogin && (
          <div className="text-center mt-1 text-xs text-slate-600 font-medium">
            ¿Ya tenés una cuenta?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-bold text-primary hover:text-primary-dark cursor-pointer underline-offset-2 hover:underline"
            >
              Iniciá sesión acá
            </button>
          </div>
        )}
      </form>

      {/* Modal de Términos y Condiciones */}
      <Modal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="Términos y Condiciones de Reportalo"
      >
        <p className="font-semibold text-content-primary">
          1. Compromiso y Protección Ciudadana
        </p>
        <p>
          Reportalo es una plataforma comunitaria diseñada para facilitar la fiscalización y reporte de incidentes en el espacio público. Los datos personales de los ciudadanos se encuentran protegidos bajo la Ley Nacional de Protección de Datos Personales N° 25.326.
        </p>
        <p className="font-semibold text-content-primary">
          2. Difuminado de Evidencia y Privacidad
        </p>
        <p>
          Toda fotografía o registro capturado a través de Reportalo es sometido a un proceso automático de difuminado facial y de placas de patentes para resguardar la identidad de terceros antes de su derivación a los organismos receptores correspondientes.
        </p>
        <p className="font-semibold text-content-primary">
          3. Uso Responsable
        </p>
        <p>
          El usuario se compromete a emitir reportes con información verídica y verificable, evitando la carga de contenido malicioso, difamatorio o ajeno a incidentes del ámbito público urbano.
        </p>
      </Modal>
    </>
  );
};
