// ==============================================================================
// Contexto de Estado del Onboarding (OnboardingContext.jsx)
// ==============================================================================

import React, { createContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'reportalo_onboarding';

// Valores permitidos para el estado de onboarding
const VALID_STATUSES = ['new', 'registered', 'completed'];

const isValidStatus = (value) => VALID_STATUSES.includes(value);

export const OnboardingContext = createContext(null);

export const OnboardingProvider = ({ children }) => {
  // Estado local del onboarding ('new' | 'registered' | 'completed')
  const [onboardingStatus, setOnboardingStatus] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return isValidStatus(stored) ? stored : 'new';
    } catch {
      return 'new';
    }
  });

  // Guardar en localStorage cada vez que cambia el estado
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, onboardingStatus);
    } catch (err) {
      console.warn('Error al guardar estado de onboarding:', err);
    }
  }, [onboardingStatus]);

  // Funciones de actualización de estado
  const setRegistered = () => setOnboardingStatus('registered');
  const setCompleted = () => setOnboardingStatus('completed');
  const resetOnboarding = () => {
    setOnboardingStatus('new');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorar error
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        onboardingStatus,
        isNew: onboardingStatus === 'new',
        isRegistered: onboardingStatus === 'registered',
        isCompleted: onboardingStatus === 'completed',
        setOnboardingStatus,
        setRegistered,
        setCompleted,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};
