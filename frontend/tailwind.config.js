/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Wildfire Games brand colors
        wildfire: {
          50: '#fff8f0',
          100: '#ffe8d6',
          200: '#ffd4b3',
          300: '#ffb880',
          400: '#ff9d4d',
          500: '#ff8c2f',
          600: '#e67e1f',
          700: '#cc6e18',
          800: '#b35e10',
          900: '#8a4808',
        },
      },
    },
  },
  plugins: [],
}
