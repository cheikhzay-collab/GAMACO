import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { handleApiRequest, initMySQL } from './server.js'

function apiServerPlugin() {
  let isDbInit = false;
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        if (parsedUrl.pathname === '/ping' || parsedUrl.pathname.startsWith('/api/')) {
          if (!isDbInit) {
            isDbInit = true;
            await initMySQL().catch(() => {});
          }
          await handleApiRequest(req, res, next);
          return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [
      react(),
      apiServerPlugin(),
    VitePWA({
      selfDestroying: true,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
      },
      includeAssets: ['favicon.svg', 'icons/*.png'],

      manifest: {
        name: "L'CONQ — Concours Médecine",
        short_name: "L'CONQ",
        description: "La plateforme SRS gamifiée pour préparer les concours de médecine au Maroc.",
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0D1117',
        theme_color: '#5254F0',
        lang: 'fr',
        categories: ['education', 'medical', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
          { name: 'Réviser maintenant', short_name: 'Réviser', url: '/study' },
          { name: 'Tableau de bord', short_name: 'Dashboard', url: '/dashboard' },
        ],
      },

      devOptions: { enabled: false },
    }),
  ],

  build: {
    // Vite 8 uses Oxc by default (faster than esbuild, no extra install needed)
    // minify: 'oxc' is the default — no need to specify

    // Target modern browsers — drops legacy polyfills
    target: 'es2020',

    // Warn only on truly large chunks (admin pages can be big)
    chunkSizeWarningLimit: 800,

    // Inline small assets (< 4KB) directly — saves round-trips
    assetsInlineLimit: 4096,

    // Split CSS per chunk — only load styles for the active route
    cssCodeSplit: true,

    rollupOptions: {
      output: {
        // Stable file names for better CDN/browser caching
        entryFileNames:  'assets/[name]-[hash].js',
        chunkFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash].[ext]',

        // Inject modulepreload links for all chunks → browser prefetches before navigation
        generatedCode: { preset: 'es2015' },

        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // ── Core React ────────────────────────────────────────────
          if (id.includes('react/') || id.includes('react-dom/') || id.includes('scheduler/') || id.includes('react-is')) {
            return 'vendor-react';
          }
          // ── Router ────────────────────────────────────────────────
          if (id.includes('react-router')) {
            return 'vendor-router';
          }
          // ── Math rendering (heavy, KaTeX) ─────────────────────────
          if (id.includes('katex')) {
            return 'vendor-katex';
          }
          // ── PDF generation (heavy, jsPDF + html2canvas) ───────────
          if (id.includes('jspdf') || id.includes('html2canvas')) {
            return 'vendor-pdf';
          }
          // ── PDF.js viewer ─────────────────────────────────────────
          if (id.includes('pdfjs-dist')) {
            return 'vendor-pdfjs';
          }
          // ── Charts ────────────────────────────────────────────────
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) {
            return 'vendor-charts';
          }
          // ── Spreadsheet parsing ───────────────────────────────────
          if (id.includes('xlsx') || id.includes('papaparse')) {
            return 'vendor-sheets';
          }
          // ── Icons (lucide-react is large) ─────────────────────────
          if (id.includes('lucide')) {
            return 'vendor-icons';
          }
          // ── QR & barcode ──────────────────────────────────────────
          if (id.includes('qrcode') || id.includes('jsqr') || id.includes('zxing')) {
            return 'vendor-qr';
          }
          // ── All remaining node_modules → shared vendor chunk ──────
          return 'vendor-misc';
        },
      },
    },
  },

  // Dev server on port 3000 with host 0.0.0.0
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    warmup: {
      // Pre-bundle these on server start to avoid first-request lag
      clientFiles: [
        './src/App.jsx',
        './src/context/AuthContext.jsx',
        './src/services/queryCache.js',
        './src/services/lessonService.js',
        './src/services/classService.js',
      ],
    },
  },

  // Dependency pre-bundling — prevents waterfall on first load
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-is',
      'react-router-dom',
      'lucide-react',
      'recharts',
      'es-toolkit/compat/get',
    ],
    exclude: [
      // These are loaded lazily — don't prebundle
      'katex',
      'jspdf',
      'html2canvas',
      'pdfjs-dist',
      'xlsx',
    ],
  },
  };
});
