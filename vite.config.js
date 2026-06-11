import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split large, independently-cacheable vendors into their own chunks.
        // mapbox-gl is only reached via dynamic import (MapView), so this stays a
        // lazy chunk loaded on demand.
        //
        // NOTE: antd is intentionally NOT forced into a single chunk. Doing so pulls
        // every antd component used anywhere (incl. DatePicker/Table used only by the
        // lazy Dashboard/WarehouseForm) into one eager chunk. Letting Rollup split it
        // by static-vs-dynamic reachability keeps lazy-only antd out of the initial load.
        manualChunks: {
          mapbox: ['mapbox-gl'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})
