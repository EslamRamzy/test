import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console -- replaced by the pino logger in Phase 3
  console.log(`API listening on http://localhost:${String(env.PORT)} [${env.NODE_ENV}]`);
});

function shutdown(signal: string): void {
  // eslint-disable-next-line no-console -- replaced by the pino logger in Phase 3
  console.log(`${signal} received, closing server`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
