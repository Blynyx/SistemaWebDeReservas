import { closeMongo, connectMongo } from '../client.js';

try {
  const { db } = await connectMongo();
  const ping = await db.command({ ping: 1 });
  const hello = await db.admin().command({ hello: 1 });

  console.log('MongoDB conectado:', {
    ok: ping.ok,
    database: db.databaseName,
    replicaSet: hello.setName || null,
    isWritablePrimary: Boolean(hello.isWritablePrimary),
  });
} catch (error) {
  console.error('Error al comprobar conexión MongoDB:', error.message);
  process.exitCode = 1;
} finally {
  await closeMongo();
}
