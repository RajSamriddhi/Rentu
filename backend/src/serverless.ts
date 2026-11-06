import { createApp } from './app';

process.on('unhandledRejection', (reason) => {
  console.warn('[SERVERLESS UNHANDLED REJECTION]:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[SERVERLESS UNCAUGHT EXCEPTION]:', err);
});

const app = createApp();

const handler = (req: any, res: any) => {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('Fatal serverless function error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: err?.message || 'Server error occurred',
      });
    }
  }
};

export default handler;
