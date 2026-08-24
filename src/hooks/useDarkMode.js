import { useContext } from 'react';
import { DarkModeContext } from '../context/DarkModeContext';

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode debe ser utilizado dentro de un DarkModeProvider');
  }
  return context;
};
