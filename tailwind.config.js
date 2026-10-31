/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#080808',
        card: '#121212',
        cardHover: '#181818',
        cardBorder: '#222222',
        pumpkin: {
          DEFAULT: '#ff7a1a',
          hover: '#e5680d',
          glow: 'rgba(255, 122, 26, 0.15)',
        },
      },
    },
  },
  plugins: [],
};
