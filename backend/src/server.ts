import { createApp } from './app';
import { ENV } from './config/env';
import { runMigrations } from './db/migrate';

export const app = createApp();

// Only listen on port in non-serverless environments (local dev or traditional VM)
if (!process.env.VERCEL) {
  const startServer = async () => {
    try {
      // Ensure migrations are in place
      await runMigrations().catch((err) => {
        console.warn('Migrations notice on startup:', err.message);
      });

      const server = app.listen(ENV.PORT, () => {
        console.log(`⚡ Rentu⁺ API Service listening on http://localhost:${ENV.PORT}`);
        console.log(`🌱 Environment: ${ENV.NODE_ENV}`);
        console.log(`📡 Ready for rental requests!`);
      });

      const shutdown = () => {
        console.log('\nShutting down Rentu⁺ API server gracefully...');
        server.close(() => {
          console.log('HTTP server closed.');
          process.exit(0);
        });
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    } catch (error) {
      console.error('Failed to start server:', error);
    }
  };

  startServer();
}

export default app;
