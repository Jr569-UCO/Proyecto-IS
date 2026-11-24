/** Comprueba sintaxis y construcción; NO sustituye al chequeo estático de tsc. */
import { readdirSync, readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createApplication } from '../src/server.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
let checked = 0;
for (const folder of ['src', 'public', 'tests', 'scripts']) {
  for (const file of readdirSync(resolve(root, folder)).filter(name => name.endsWith('.ts'))) {
    stripTypeScriptTypes(readFileSync(resolve(root, folder, file), 'utf8'), { mode: 'strip' });
    checked++;
  }
}
const app = createApplication({ databasePath: ':memory:' });
app.db.close();
console.log('Sintaxis válida en ' + checked + ' archivos TypeScript; esquema y aplicación construidos.');
console.log('Node elimina tipos; esta comprobación no ejecuta el compilador TypeScript.');
