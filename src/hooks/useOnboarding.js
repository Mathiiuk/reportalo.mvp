// ==============================================================================
// Hook Personalizado: useOnboarding (useOnboarding.js)
// ==============================================================================

import { useContext } from 'react';
import { OnboardingContext } from '../context/OnboardingContext';

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding debe ser utilizado dentro de un OnboardingProvider');
  }
  return context;
};
