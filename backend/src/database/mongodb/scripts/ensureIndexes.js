import { closeMongo, connectMongo } from '../client.js';
import { ensureIndexes } from '../indexes.js';

try {
  await connectMongo();
  const summary = await ensureIndexes();
  console.log(
    'Índices MongoDB asegurados:',
    summary.map((item) => ({ collection: item.collection, count: item.indexes.length }))
  );
} catch (error) {
  console.error('Error al asegurar índices MongoDB:', error.message);
  process.exitCode = 1;
} finally {
  await closeMongo();
}
