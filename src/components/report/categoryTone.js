/**
 * Tono visual de cada categoría del MVP (UJ v3.3 · REP-3791 Bloque 1).
 *
 * Es solo presentación: no modifica los datos que devuelve categoriesService. Resuelve la
 * categoría por id o nombre (sin tildes) y devuelve colores basados en los tokens de
 * src/styles/tokens.css, así la tarjeta, el check y la ayuda cambian solos con el tema.
 * Si la categoría no es una de las cuatro del MVP (p. ej. «Vulnerabilidad social» en una
 * base de datos vieja), usa los colores que trae el dato.
 */
const TONE_BY_KEY = [
  ['infraestructura', 'infra'],
  ['transito', 'transito'],
  ['ambiente', 'ambiente'],
  ['comercioirregular', 'comercio'],
];

const normalize = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const toneFromToken = (key) => ({
  base: `rgb(var(--rep-cat-${key}))`,
  soft: `rgb(var(--rep-cat-${key}-soft))`,
  ink: `rgb(var(--rep-cat-${key}-ink))`,
});

export const getCategoryTone = (category) => {
  const candidates = [category?.id, category?.name].map(normalize).filter(Boolean);
  for (const candidate of candidates) {
    const match = TONE_BY_KEY.find(([needle]) => candidate.includes(needle));
    if (match) return toneFromToken(match[1]);
  }
  return {
    base: category?.color || 'rgb(var(--rep-accent))',
    soft: category?.bgLight || 'rgb(var(--rep-accent-soft))',
    ink: category?.color || 'rgb(var(--rep-ink-body))',
  };
};

export default getCategoryTone;
