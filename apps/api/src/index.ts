/**
 * Entry point — boot del servidor Fastify.
 */
import { loadEnv } from './config/env.js';
import { buildServer } from './server.js';
import { disconnect } from '@brasa/db';

async function main() {
  const env = loadEnv();
  const app = await buildServer(env);

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutdown signal received');
    try {
      await app.close();
      await disconnect();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
    app.log.info(`📚 OpenAPI docs: ${env.API_PUBLIC_URL}/docs`);
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

void main();
