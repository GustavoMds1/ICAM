import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // As três cores do slide 13, iguais às do modelo enviado.
        raiz: '#FF0000',
        contribuinte: '#FFFF00',
        constatado: '#FFFFFF',
        borda: '#d4d4d8',
        texto: '#181818',
        sutil: '#585858',
      },
    },
  },
  plugins: [],
} satisfies Config;
