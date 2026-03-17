import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#f472b6',
          foreground: '#ffffff',
          hover: '#ec4899',
        },
      },
    },
  },
  plugins: [],
}

export default config
