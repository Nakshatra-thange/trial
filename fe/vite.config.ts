import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    react(),
    nodePolyfills({
      // Include buffer and other Node.js modules needed for Solana
      include: ['buffer', 'process', 'crypto', 'stream', 'util'],
      // Add globals
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Enable protocol imports (node:)
      protocolImports: true,
    })
  ],
  define: {
    // Ensure global is defined
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis'
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
})