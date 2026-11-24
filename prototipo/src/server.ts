import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { openDatabase } from './database.ts';
import { Auth } from './auth.ts';
import { CictSystem, requiredText, positiveId } from './system.ts';
import { DomainError } from './model.ts';
import type { BookingInput } from './model.ts';
import { seedDatabase } from './seed.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const json = (response: ServerResponse, status: number, payload: unknown) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
};
async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new DomainError('Usa contenido JSON.', 415);
  let body = '';
  for await (const chunk of request) {
    body += chunk.toString();
    if (Buffer.byteLength(body) > 16_384) throw new DomainError('El formulario es demasiado grande.', 413);
  }
  try {
    const parsed = JSON.parse(body);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
    return parsed;
  } catch { throw new DomainError('El cuerpo JSON no es válido.'); }
}
function cookieToken(request: IncomingMessage): string {
  return request.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('cict_session='))?.slice(13) ?? '';
}
function csvCell(value: unknown): string {
  let text = String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function createApplication(options: { databasePath?: string; now?: () => number; seed?: boolean } = {}) {
  const path = options.databasePath ?? resolve(ROOT, 'data/prototipo.sqlite');
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = openDatabase(path), now = options.now ?? Date.now;
  if (options.seed !== false) seedDatabase(db, now());
  const auth = new Auth(db, now), system = new CictSystem(db, now);
  const scripts = new Map(['app', 'ui', 'views'].map(name => [
    '/assets/' + name + '.js', stripTypeScriptTypes(readFileSync(resolve(ROOT, 'public', name + '.ts'), 'utf8'), { mode: 'strip' }),
  ]));
  const attempts = new Map<string, { count: number; until: number }>();
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const method = req.method ?? 'GET', pathname = url.pathname;
      if (method === 'GET' && pathname === '/health') return json(res, 200, { ok: true });
      if (method === 'GET' && pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        return res.end(readFileSync(resolve(ROOT, 'public/index.html')));
      }
      if (method === 'GET' && scripts.has(pathname)) {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
        return res.end(scripts.get(pathname));
      }
      if (method === 'GET' && pathname === '/assets/styles.css') {
        res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-cache' });
        return res.end(readFileSync(resolve(ROOT, 'public/styles.css')));
      }
      if (method === 'GET' && pathname === '/favicon.svg') {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        return res.end(readFileSync(resolve(ROOT, 'public/favicon.svg')));
      }
      // Lista cerrada: nunca exponemos src/, SQLite, contraseñas o rutas arbitrarias.
      const manuals = ['README.md', 'ARQUITECTURA.md', 'MANUAL-USUARIO.md', 'API.md', 'PRUEBAS.md', 'REQUISITOS.md', 'DECISIONES.md', 'GUIA-CODIGO.md', 'PLAN-TRABAJO.md'];
      const manual = pathname.slice('/docs/'.length);
      if (method === 'GET' && pathname.startsWith('/docs/') && manuals.includes(manual)) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(readFileSync(resolve(ROOT, manual === 'README.md' ? '' : 'docs', manual)));
      }
      if (!pathname.startsWith('/api/')) throw new DomainError('La página no existe.', 404);
      const isWrite = !['GET', 'HEAD'].includes(method);
      if (isWrite && req.headers.origin && req.headers.origin !== 'http://' + req.headers.host) {
        throw new DomainError('El origen de la petición no está permitido.', 403);
      }
      if (method === 'POST' && pathname === '/api/login') {
        const body = await readBody(req), ip = req.socket.remoteAddress ?? 'local';
        for (const [key, attempt] of attempts) if (attempt.until <= now()) attempts.delete(key);
        const current = attempts.get(ip);
        if (current && current.count >= 8) throw new DomainError('Demasiados intentos. Espera un minuto y vuelve a probar.', 429);
        try {
          const result = auth.login(requiredText(body.email, 'Correo', 3, 150), requiredText(body.password, 'Contraseña', 1, 128));
          attempts.delete(ip);
          res.setHeader('Set-Cookie', 'cict_session=' + result.token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800');
          return json(res, 200, { user: result.user, csrf: result.csrf });
        } catch (error) {
          attempts.set(ip, { count: (current?.count ?? 0) + 1, until: current?.until ?? now() + 60_000 });
          throw error;
        }
      }
      const token = cookieToken(req), session = auth.session(token), actor = session.user;
      if (isWrite && req.headers['x-csrf-token'] !== session.csrf) throw new DomainError('El formulario ha caducado. Recarga la página.', 403);
      const body = isWrite ? await readBody(req) : {};
      if (method === 'GET' && pathname === '/api/session') return json(res, 200, session);
      if (method === 'GET' && pathname === '/api/state') return json(res, 200, system.snapshot(actor));
      if (method === 'POST' && pathname === '/api/logout') {
        auth.logout(token);
        res.setHeader('Set-Cookie', 'cict_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        return json(res, 200, { ok: true });
      }
      if (method === 'POST' && pathname === '/api/availability') return json(res, 200, system.availability(actor, body as unknown as BookingInput));
      if (method === 'POST' && pathname === '/api/bookings') return json(res, 201, { id: system.createBooking(actor, body as unknown as BookingInput) });
      const cancel = pathname.match(/^\/api\/bookings\/(\d+)\/cancel$/);
      if (method === 'POST' && cancel) return json(res, 200, system.cancelBooking(actor, positiveId(cancel[1])));
      const usage = pathname.match(/^\/api\/bookings\/(\d+)\/(start|finish)$/);
      if (method === 'POST' && usage) { system.recordUsage(actor, positiveId(usage[1]), usage[2]); return json(res, 200, { ok: true }); }
      if (method === 'POST' && pathname === '/api/incidents') return json(res, 201, { id: system.createIncident(actor, positiveId(body.instrumentId), body.description as string) });
      const incident = pathname.match(/^\/api\/incidents\/(\d+)\/resolve$/);
      if (method === 'POST' && incident) { system.resolveIncident(actor, positiveId(incident[1]), body.resolution as string); return json(res, 200, { ok: true }); }
      if (method === 'POST' && pathname === '/api/users') return json(res, 201, { id: system.createExternal(actor, body) });
      const contract = pathname.match(/^\/api\/users\/(\d+)\/contract$/);
      if (method === 'POST' && contract) { system.updateContract(actor, positiveId(contract[1]), body); return json(res, 200, { ok: true }); }
      if (method === 'POST' && pathname === '/api/notifications/read') { system.readNotifications(actor); return json(res, 200, { ok: true }); }
      if (method === 'GET' && pathname === '/api/reports') return json(res, 200, system.report(actor, url.searchParams.get('month') ?? ''));
      if (method === 'GET' && pathname === '/api/reports.csv') {
        const month = url.searchParams.get('month') ?? '', rows = system.report(actor, month);
        const cells = [['Cliente', 'Entidad', 'Instrumento', 'Horas de uso real', 'Horas de cancelación tardía', 'Total de horas'],
          ...rows.map(row => [row.userName, row.company, row.instrumentName, row.usageHours, row.cancellationHours, row.totalHours])];
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="consumo-' + month + '.csv"', 'Cache-Control': 'no-store' });
        return res.end('\ufeff' + cells.map(row => row.map(csvCell).join(';')).join('\r\n'));
      }
      throw new DomainError('La operación no existe.', 404);
    } catch (error) {
      if (error instanceof DomainError) return json(res, error.status, { error: error.message });
      console.error('[SG-CICT]', error);
      return json(res, 500, { error: 'No se ha podido completar la operación. Consulta la terminal del servidor.' });
    }
  });
  server.on('close', () => db.close());
  return { server, db, system, auth };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? '4173');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe ser un puerto entre 1 y 65535.');
  const app = createApplication({ databasePath: process.env.CICT_DB });
  app.server.on('error', error => { console.error('No se pudo iniciar SG-CICT:', error.message); process.exitCode = 1; app.db.close(); });
  app.server.listen(port, '127.0.0.1', () => {
    console.log('\n  SG-CICT · Prototipo educativo\n  http://localhost:' + port + '\n  Datos: ' + (process.env.CICT_DB ?? resolve(ROOT, 'data/prototipo.sqlite')) + '\n  Detener: Ctrl+C\n');
  });
  const stop = () => app.server.close();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
