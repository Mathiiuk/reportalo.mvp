// ==============================================================================
// Componente Acordeón / Colapso Animado (AuthCollapse.jsx)
// ==============================================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export const AuthCollapse = ({ activeForm, onSwitchForm, onClose }) => {
  return (
    <AnimatePresence initial={false}>
      {activeForm && (
        <motion.div
          key="auth-collapse"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden w-full"
        >
          <div className="p-5 md:p-6 bg-white rounded-3xl border border-slate-100 shadow-xl my-4 text-left">
            {activeForm === 'login' ? (
              <LoginForm onSwitchToRegister={() => onSwitchForm('register')} />
            ) : (
              <RegisterForm onSwitchToLogin={() => onSwitchForm('login')} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
