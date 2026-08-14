import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const configuracao = [
  // `next-env.d.ts` é gerado pelo Next a cada build e usa referência de barra
  // tripla, que a própria regra do Next reprova. Fica de fora da verificação.
  { ignores: ['.next/**', 'node_modules/**', 'dados/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default configuracao;
