import { createApp } from './app';
import { ENV } from './config/env';
import { runMigrations } from './db/migrate';

export const app = createApp();

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

// Only listen on port when executed directly as standalone process
if (require.main === module && !process.env.VERCEL) {
  startServer();
}

// Export for both ESM and CJS compatibility in serverless environments
// @ts-ignore
if (typeof module !== 'undefined' && module.exports) {
  // @ts-ignore
  module.exports = app;
  // @ts-ignore
  module.exports.default = app;
  // @ts-ignore
  module.exports.app = app;
}

export default app;
