import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const configuracao = [
  { ignores: ['.next/**', 'node_modules/**', 'dados/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default configuracao;
