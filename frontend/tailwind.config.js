/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          50: '#eef3f8',
          100: '#d6e1ec',
          200: '#adc2d8',
          300: '#7f9cbd',
          400: '#56779c',
          500: '#3c5b7f',
          600: '#2a4565',
          700: '#1c3350',
          800: '#12253c',
          900: '#0b1a2c',
          950: '#06111e',
        },
        gold: {
          50: '#fbf6ea',
          100: '#f5e9c8',
          200: '#ecd697',
          300: '#e0bf64',
          400: '#d4a845',
          500: '#c08f2e',
          600: '#a17424',
          700: '#7e5a1f',
          800: '#5e431a',
          900: '#3f2d12',
        },
        sand: {
          50: '#fcfaf6',
          100: '#f6f1e7',
          200: '#ece3d1',
          300: '#ddd0b5',
          400: '#c4b28e',
          500: '#a8936b',
        },
        palm: { 50: '#ecf8f2', 100: '#d1efe0', 500: '#1f9d6b', 600: '#167f56', 700: '#11633f' },
        clay: { 50: '#fdf1ec', 100: '#fadccf', 500: '#d0603a', 600: '#b24a28', 700: '#8b391f' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        arabic: ['"Noto Kufi Arabic"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 26, 44, 0.04), 0 8px 24px -12px rgba(11, 26, 44, 0.12)',
        gold: '0 10px 30px -10px rgba(192, 143, 46, 0.55)',
      },
    },
  },
  plugins: [],
}
