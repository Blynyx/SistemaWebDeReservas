import { MongoClient } from 'mongodb';
import { MONGODB_URI } from '../../../config/env.js';

if (!MONGODB_URI.trim()) {
  console.error('La variable de entorno MONGODB_URI es obligatoria.');
  process.exit(1);
}

const directUrl = new URL(MONGODB_URI);
directUrl.searchParams.delete('replicaSet');
directUrl.searchParams.set('directConnection', 'true');

const client = new MongoClient(directUrl.toString());

try {
  await client.connect();
  const admin = client.db('admin');
  const hello = await admin.command({ hello: 1 });

  if (hello.setName) {
    console.log(`Replica Set ya inicializado: ${hello.setName}`);
  } else {
    const result = await admin.command({
      replSetInitiate: {
        _id: 'rs0',
        members: [{ _id: 0, host: '127.0.0.1:27017' }],
      },
    });
    console.log('Replica Set rs0 inicializado:', { ok: result.ok });
  }
} catch (error) {
  console.error('No se pudo inicializar el Replica Set:', error.message);
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
