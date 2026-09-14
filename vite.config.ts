import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // L'enregistrement est réalisé par le composant PwaManager
        // (virtual:pwa-register/react) : pas d'injection automatique pour
        // éviter un double enregistrement du service worker.
        injectRegister: null,
        registerType: 'prompt',
        includeAssets: ['icon.svg', 'icon-maskable.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
        manifest: {
          id: './',
          name: 'Bielles & Tirants — Eurocode 2',
          short_name: 'MBT',
          description: "Calcul, vérification Eurocode 2 et optimisation d'énergie de Schlaich des modèles bielles-tirants (zones D) en 2D et 3D.",
          lang: 'fr',
          dir: 'ltr',
          categories: ['productivity', 'utilities', 'education'],
          start_url: './',
          scope: './',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'any',
          background_color: '#ffffff',
          theme_color: '#0f172a',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // Le bundle applicatif (three.js + React) dépasse la limite Workbox
          // par défaut de 2 MiB : sans ce relèvement, le JS principal serait
          // exclu du précache et l'application ne démarrerait pas hors-ligne.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          navigateFallback: 'index.html',
          // L'application est entièrement locale : aucune requête réseau
          // externe n'est à mettre en cache à l'exécution.
          runtimeCaching: [],
        },
        devOptions: {
          // Permet de tester l'installation et le mode hors-ligne avec
          // `npm run dev`, sans passer par un build de production.
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
