import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

// Los colores viven solo en src/styles/tokens.css (spec §40.1).
// esquery no soporta '|' ni el límite de palabra en regex de selectores; se usa lookahead.
const HEX_COLOR = '/#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_-])/'
const HEX_MESSAGE =
  'No uses colores HEX sueltos: usa los tokens de src/styles/tokens.css (bg-surface, text-primary, ...).'

export default defineConfig([
  globalIgnores(['dist', '.claude', '.agents', 'supabase/.temp']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=${HEX_COLOR}]`, message: HEX_MESSAGE },
        { selector: `TemplateElement[value.raw=${HEX_COLOR}]`, message: HEX_MESSAGE },
      ],
    },
  },
  prettier,
])
