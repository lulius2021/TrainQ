import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Plugin: Prevents Vite's SharedWorker from throwing a cross-origin error in iOS WKWebView
const capacitorSharedWorkerFix = {
  name: 'capacitor-shared-worker-fix',
  transformIndexHtml: {
    order: 'pre' as const,
    handler() {
      return [{
        tag: 'script',
        attrs: { type: 'text/javascript' },
        children: `;(function(){var S=window.SharedWorker;if(!S)return;window.SharedWorker=function(u,o){try{return new S(u,o)}catch(e){console.warn('[TrainQ] SharedWorker suppressed:',e.message);return{port:{start:function(){},addEventListener:function(){},postMessage:function(){}}}}};window.SharedWorker.prototype=S.prototype})();`,
        injectTo: 'head-prepend' as const,
      }];
    }
  }
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), capacitorSharedWorkerFix],
  server: {
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
  },
  build: {
    minify: 'oxc',
    assetsInlineLimit: 8192,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) return 'vendor';
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'charts';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
          }
        },
      },
    },
  },
})
