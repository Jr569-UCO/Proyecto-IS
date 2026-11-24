/** Reinicio explícito y con copia previa, destinado solo a los datos ficticios. */
import { backup } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../src/database.ts';
import { seedDatabase } from '../src/seed.ts';
import { transaction } from '../src/database.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const path = process.env.CICT_DB ?? resolve(root, 'data/prototipo.sqlite');
if (!process.argv.includes('--confirmar')) {
  console.log('Detén primero el servidor. Para reiniciar los datos ficticios con una copia previa:');
  console.log('node scripts/reset.ts --confirmar');
  process.exit(0);
}
mkdirSync(dirname(path), { recursive: true });
const existed = existsSync(path), db = openDatabase(path);
try {
  if (existed) {
    const folder = resolve(root, 'data/backups'); mkdirSync(folder, { recursive: true });
    const destination = resolve(folder, 'prototipo-' + new Date().toISOString().replaceAll(':','-') + '.sqlite');
    await backup(db, destination); console.log('Copia guardada en ' + destination);
  }
  transaction(db, () => {
    for (const table of ['sessions','notifications','activity','incidents','bookings','instruments','users']) db.exec('DELETE FROM ' + table);
  });
  seedDatabase(db); console.log('Datos ficticios reiniciados. Puedes volver a arrancar el servidor.');
} finally { db.close(); }
