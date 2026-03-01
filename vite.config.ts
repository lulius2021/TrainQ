import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) return 'vendor';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('framer-motion')) return 'utils';
          }
        },
      },
    },
  },
})
