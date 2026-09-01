/**
 * Utilidad para obtener las iniciales del usuario a partir de su perfil o correo electrónico.
 * Comentarios en español para facilitar la comprensión y verificación del código.
 */
export const getUserInitials = (user) => {
  // Si no hay usuario, retornar inicial por defecto
  if (!user) return 'U';

  // 1. Intentar obtener el nombre completo desde los metadatos de Supabase Auth
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.name;

  if (fullName && typeof fullName === 'string' && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      // Primera letra del primer nombre y primera letra del último apellido
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    // Si solo tiene una palabra, tomar las primeras 2 letras
    return fullName.slice(0, 2).toUpperCase();
  }

  // 2. Si no hay nombre, extraer las iniciales a partir del correo electrónico
  const email = user.email || '';
  if (email) {
    // Obtener la parte previa al arroba
    const namePart = email.split('@')[0];
    
    // Si contiene puntos o guiones (ej: lucas.fernandez o juan-perez)
    const nameSegments = namePart.split(/[\.\-_]/).filter(Boolean);
    if (nameSegments.length >= 2) {
      return (nameSegments[0][0] + nameSegments[1][0]).toUpperCase();
    }
    
    // Si es un solo término, tomar las dos primeras letras limpias
    const cleanName = namePart.replace(/[^a-zA-Z]/g, '');
    if (cleanName.length >= 2) {
      return cleanName.slice(0, 2).toUpperCase();
    }
    if (cleanName.length === 1) {
      return cleanName.toUpperCase();
    }
    return namePart.slice(0, 2).toUpperCase();
  }

  return 'U';
};
