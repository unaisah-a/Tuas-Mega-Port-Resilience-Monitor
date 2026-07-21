/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef2f8', 100: '#d4dde9', 200: '#a8bbd3', 300: '#7d99bd',
          400: '#5277a7', 500: '#345689', 600: '#27426b', 700: '#1d3252',
          800: '#142239', 900: '#0b1626', 950: '#070f1c'
        },
        sea: {
          400: '#5fb0d8', 500: '#3a93c2', 600: '#2a7aa3'
        },
        accent: {
          500: '#f58220', 600: '#e06a10'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
}
