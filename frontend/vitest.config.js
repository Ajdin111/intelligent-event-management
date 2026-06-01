import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
    testTimeout: 15000,
    hookTimeout: 15000,
    maxWorkers: 1,
    minWorkers: 1,
    teardownTimeout: 2000,
    coverage: {
      provider: 'v8',
      include: [
        'src/context/AuthContext.jsx',
        'src/pages/BrowseEvents.jsx',
        'src/pages/EventDetail.jsx',
        'src/pages/NotFound.jsx',
        'src/pages/Login.jsx',
        'src/pages/Register.jsx',
        'src/pages/Dashboard.jsx',
        'src/pages/MyTickets.jsx',
        'src/pages/Feedback.jsx',
        'src/pages/organizer/CreateEvent.jsx',
        'src/components/ProtectedRoute.jsx',
        'src/services/api.js',
      ],
      all: true,
    },
  },
})
