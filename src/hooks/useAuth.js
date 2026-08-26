import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

// Hook personalizado para acceder fácilmente al contexto de autenticación
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
