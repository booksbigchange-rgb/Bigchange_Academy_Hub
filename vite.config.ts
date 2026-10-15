import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build two independent HTML entrypoints: fictional demo and adult-only identity pilot.
export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: ['index.html', 'pilot.html'] } }
});
