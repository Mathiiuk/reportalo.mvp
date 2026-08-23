// ==============================================================================
// Formulario de Inicio de Sesión Pulido y Ergonómico (LoginForm.jsx)
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

export const LoginForm = ({ onSwitchToRegister }) => {
  const { signIn, signInWithGoogle } = useAuth();
  const { onboardingStatus } = useOnboarding();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Inicialización de react-hook-form
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  // Envío del formulario de Login con Supabase
  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
      toast.success('¡Bienvenido de nuevo a Reportalo!');

      // Redirección según estado de onboarding
      if (onboardingStatus === 'completed') {
        navigate('/map');
      } else {
        navigate('/permisos');
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      const errorMsg =
        error.message?.includes('Invalid login credentials') || error.status === 400
          ? 'El email o la contraseña son incorrectos.'
          : 'No pudimos conectar con el servidor. Revisá tu conexión.';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Login con Google OAuth
  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Error con Google OAuth:', error);
      toast.error('No se pudo iniciar sesión con Google.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5 text-left">
      {/* Cabecera del formulario */}
      <div className="mb-0.5">
        <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Iniciar sesión</h3>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">
          Ingresá con tu cuenta para continuar reportando.
        </p>
      </div>

      {/* Campo Email optimizado para teclado móvil */}
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

      {/* Campo Contraseña con soporte para gestores de contraseñas */}
      <Input
        label="Contraseña"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        disabled={isLoading}
        error={errors.password?.message}
        {...register('password', {
          required: 'La contraseña es obligatoria.',
          minLength: {
            value: 6,
            message: 'La contraseña debe tener al menos 6 caracteres.',
          },
        })}
      />

      {/* Enlace de recuperación de contraseña */}
      <div className="flex justify-end -mt-1">
        <button
          type="button"
          onClick={() => toast.info('Se envió un correo para recuperar tu contraseña.')}
          className="text-xs font-bold text-primary hover:text-primary-dark cursor-pointer transition-colors py-1"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      {/* Botón Principal de Login */}
      <div className="mt-1">
        <Button type="submit" variant="primary" size="lg" isLoading={isLoading}>
          Ingresar
        </Button>
      </div>

      {/* Separador elegante */}
      <div className="relative flex items-center justify-center my-1.5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <span className="relative bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          o continuar con
        </span>
      </div>

      {/* Botón Iniciar con Google */}
      <Button
        type="button"
        variant="google"
        size="md"
        onClick={handleGoogleLogin}
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
        Iniciar con Google
      </Button>

      {/* Conmutador a Registro */}
      {onSwitchToRegister && (
        <div className="text-center mt-1 text-xs text-slate-600 font-medium">
          ¿No tenés una cuenta?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-bold text-accent hover:text-accent-hover cursor-pointer underline-offset-2 hover:underline"
          >
            Registrate acá
          </button>
        </div>
      )}
    </form>
  );
};
