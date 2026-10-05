import type { Config } from 'tailwindcss';

export default {
  // `navegador/` entra aqui porque o modelo HTML da versão de arquivo único
  // usa estas classes. Fora da varredura, o Tailwind não geraria o CSS delas e
  // a página sairia sem formatação — sem erro nenhum, o que é pior.
  content: ['./src/**/*.{ts,tsx}', './navegador/**/*.{ts,tsx,html}'],
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
