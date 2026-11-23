import { PORT } from './config/env.js';
import { closeMongo, connectMongo } from './database/mongodb/client.js';
import { ensureIndexes } from './database/mongodb/indexes.js';
import app from './app.js';

let server = null;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closeMongo();
    process.exit(0);
  } catch (error) {
    console.error(`Error durante el cierre (${signal}):`, error.message);
    process.exit(1);
  }
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

try {
  await connectMongo();
  await ensureIndexes();

  server = app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
} catch (error) {
  console.error('Error fatal al iniciar el servidor (MongoDB):', error.message);
  await closeMongo().catch(() => {});
  process.exit(1);
}
