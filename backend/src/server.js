import { PORT } from './config/env.js';
import { getDb } from './database/connection.js';
import app from './app.js';

getDb();

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
