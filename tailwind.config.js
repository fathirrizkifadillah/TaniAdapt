/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./dashboard.html",
    "./app.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // TaniAdapt Anti-Slop Agritech Palette:
        // Deep peat, forest moss, sunbaked clay, crisp parchment
        moss: {
          50: '#f2f7f4',
          100: '#e1ede6',
          200: '#c5dcd0',
          300: '#9ec2b1',
          400: '#71a38c',
          500: '#4e856e',
          600: '#396b56',
          700: '#2d5444',
          800: '#244337',
          900: '#1b332a',
          950: '#0f1d18',
        },
        clay: {
          50: '#faf6f3',
          100: '#f4ede6',
          200: '#e8d9cc',
          300: '#d9bfab',
          400: '#c69f84',
          500: '#b58364',
          600: '#a36d4f',
          700: '#87563f',
          800: '#6f4736',
          900: '#5c3c2f',
        },
        field: {
          surface: '#f9f9f7',
          card: '#ffffff',
          darkSurface: '#0d1410',
          darkCard: '#131e17',
          darkBorder: '#1f2f25',
          border: '#e3e6e1',
        },
        risk: {
          low: '#2e7d32',
          lowBg: '#e8f5e9',
          lowBorder: '#a5d6a7',
          med: '#c05621',
          medBg: '#feebc8',
          medBorder: '#fbd38d',
          high: '#9b2c2c',
          highBg: '#fed7d7',
          highBorder: '#feb2b2',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        display: ['Plus Jakarta Sans', 'sans-serif'],
      },
      boxShadow: {
        'tactile': '0 1px 3px 0 rgba(18, 30, 23, 0.06), 0 1px 2px -1px rgba(18, 30, 23, 0.06)',
        'tactile-lg': '0 4px 6px -1px rgba(18, 30, 23, 0.08), 0 2px 4px -2px rgba(18, 30, 23, 0.05)',
      }
    },
  },
  plugins: [],
}
