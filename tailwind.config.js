/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1E6FCB',
          'blue-light': '#2A7BD6',
          'blue-dark': '#15539E',
          'blue-soft': '#9FD0FF',
          'blue-bg': '#EEF5FC',
          'blue-border': '#D4E6F8',
          gray: '#5B6A7A',
          'gray-dark': '#243447',
          'gray-text': '#46566B',
          'gray-muted': '#8593A2',
          'gray-light': '#DDE4EC',
          'gray-border': '#EEF1F5',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
      },
      boxShadow: {
        'btn-white': '0px 8px 18px rgba(0, 0, 0, 0.14)',
        'btn-blue': '0px 8px 18px rgba(30, 111, 203, 0.3)',
        'input-focus': '0px 0px 0px 3px rgba(30, 111, 203, 0.12)',
      },
    },
  },
  plugins: [],
};
