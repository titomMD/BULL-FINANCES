/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Las fuentes nunca se incrustan como data: (la CSP de vercel.json solo permite
    // font-src 'self'); el resto de assets pequeños sigue el límite por defecto.
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    rolldownOptions: {
      output: {
        // Librerías en chunks propios: cambian poco y el navegador las mantiene en caché
        // entre despliegues de la app.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[/\\](react|react-dom|react-router|scheduler)[/\\]/,
            },
            { name: 'supabase', test: /node_modules[/\\]@supabase[/\\]/ },
            { name: 'forms', test: /node_modules[/\\](zod|react-hook-form|@hookform)[/\\]/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
