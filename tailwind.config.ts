import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        superficie: { DEFAULT: '#ffffff', sutil: '#f6f7f9', forte: '#eceef2' },
        borda: { DEFAULT: '#d3d7de', forte: '#a8afba' },
        texto: { DEFAULT: '#14171c', sutil: '#4b5462', fraco: '#6b7482' },
        marca: { DEFAULT: '#12507a', escuro: '#0d3a59', claro: '#e6eff6' },
        alerta: { DEFAULT: '#8a5300', fundo: '#fdf3e3' },
        erro: { DEFAULT: '#a11212', fundo: '#fdecec' },
        ok: { DEFAULT: '#1c6b3a', fundo: '#e9f5ee' },
        ia: { DEFAULT: '#5b3a94', fundo: '#f1ecfa' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
