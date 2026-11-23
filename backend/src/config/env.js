import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

// Carga .env desde la raíz de backend, no desde el cwd, para que funcione
// tanto con `npm start` como si se ejecuta el archivo desde otra carpeta.
dotenv.config({ path: path.join(backendRoot, '.env') });

export const PORT = Number(process.env.PORT) || 3000;
export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
export const MONGODB_URI = process.env.MONGODB_URI || '';
export const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'reservas';
export { backendRoot };

if (!JWT_SECRET) {
  throw new Error('La variable de entorno JWT_SECRET es obligatoria');
}
