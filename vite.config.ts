/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'app',
  // Base relative : le site fonctionne aussi bien a la racine d'un domaine
  // que dans le sous-chemin /MBT/ de GitHub Pages.
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Deux pages, une seule compilation : la version anglaise vit dans `en/`
    // et charge le meme script, qui lit la langue sur `<html lang>`.
    rollupOptions: {
      input: {
        fr: fileURLToPath(new URL('./app/index.html', import.meta.url)),
        en: fileURLToPath(new URL('./app/en/index.html', import.meta.url)),
      },
    },
  },
  plugins: [
    VitePWA({
      // Enregistrement explicite dans pwa.ts : `injectRegister: null` evite
      // un second enregistrement du service worker par le plugin.
      injectRegister: null,
      // Une nouvelle version attend l'accord de l'utilisateur : un calcul en
      // cours ne doit pas etre recharge sous ses yeux.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-maskable.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        // Identifiant, depart et portee RELATIFS : le site vit dans un
        // sous-chemin de GitHub Pages.
        id: './',
        start_url: './',
        scope: './',
        name: 'Bielles et tirants — EN 1992-1-1',
        short_name: 'MBT',
        description: 'Calcul et vérification des modèles bielles et tirants (zones D) selon l’EN 1992-1-1, §6.5, en 2D et en 3D.',
        lang: 'fr',
        display: 'standalone',
        background_color: '#f7f7f6',
        theme_color: '#f7f7f6',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
        // Application entierement locale : rien a mettre en cache au vol.
        // three.js part dans un morceau a part, charge par la vue 3D.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [],
      },
      // Pour tester l'installation en `npm run dev`.
      devOptions: { enabled: true },
    }),
  ],
  server: { port: 3000, host: '0.0.0.0' },
  preview: { port: 3000, host: '0.0.0.0' },
  // Vitest reutilise ce fichier : sans ce champ, le `root: 'app'` ci-dessus
  // s'appliquerait aussi aux tests, qui vivent hors de `app/`.
  test: {
    root: '.',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '.worktrees/**'],
  },
});
