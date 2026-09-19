import {FlatCompat} from '@eslint/eslintrc'

const compat = new FlatCompat({baseDirectory: import.meta.dirname})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {ignores: ['.next/**', 'node_modules/**', 'tests/**']},
  {
    // The codebase predates this config and has ~650 pre-existing `any`
    // usages. Keep the rule visible as a warning rather than failing every
    // lint run until those are cleaned up incrementally.
    rules: {'@typescript-eslint/no-explicit-any': 'warn'},
  },
]

export default eslintConfig
