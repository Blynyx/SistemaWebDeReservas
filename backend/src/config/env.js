import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

// Carga .env desde la raíz de backend, no desde el cwd, para que funcione
// tanto con `npm start` como si se ejecuta el archivo desde otra carpeta.
dotenv.config({ path: path.join(backendRoot, '.env') });

export const PORT = Number(process.env.PORT) || 3000;
export const DB_PATH = process.env.DB_PATH || './data/reservas.db';
export { backendRoot };
