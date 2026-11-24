/** Revisión real en Firefox vía WebDriver BiDi, sin instalar bibliotecas. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApplication } from '../src/server.ts';

test('Navegador: acceso, pantallas, formularios, permisos y móvil', async t => {
  const app = createApplication({ databasePath: ':memory:' });
  await new Promise<void>((done, reject) => { app.server.once('error', reject); app.server.listen(0, '127.0.0.1', done); });
  t.after(() => new Promise<void>(done => { app.server.closeAllConnections(); app.server.close(() => done()); }));
  const address = app.server.address() as { port: number };
  const ws = new WebSocket(process.env.BIDI_URL ?? 'ws://127.0.0.1:9223/session');
  await new Promise<void>((done, reject) => { ws.addEventListener('open', () => done(), { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let sessionCreated = false;
  t.after(async () => {
    try { if (sessionCreated && ws.readyState === WebSocket.OPEN) await send('session.end'); }
    finally { ws.close(); }
  });
  let sequence = 0;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const browserErrors: string[] = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (message.method === 'log.entryAdded' && message.params.level === 'error') browserErrors.push(message.params.text);
    const handler = pending.get(message.id);
    if (!handler) return;
    clearTimeout(handler.timer); pending.delete(message.id);
    if (message.type === 'error') { console.error('BiDi:', message.error, message.message); handler.reject(new Error(message.error + ': ' + message.message)); }
    else handler.resolve(message.result);
  });
  const send = (method: string, params: object = {}): Promise<any> => new Promise((resolve, reject) => {
    if (ws.readyState !== WebSocket.OPEN) { reject(new Error('El navegador ha cerrado la conexión.')); return; }
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Tiempo agotado: ' + method)); }, 15_000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
  await send('session.new', { capabilities: { alwaysMatch: { browserName: 'firefox' } } });
  sessionCreated = true;
  await send('session.subscribe', { events: ['log.entryAdded'] });
  const { context } = await send('browsingContext.create', { type: 'tab' });
  const evaluate = async (expression: string): Promise<any> => {
    const result = await send('script.evaluate', { expression: '(async()=>JSON.stringify(await (' + expression + ')))()', target: { context }, awaitPromise: true });
    if (result.type === 'exception') throw new Error(result.exceptionDetails.text);
    return result.result.value === undefined ? undefined : JSON.parse(result.result.value);
  };
  const wait = async (condition: string) => evaluate('(async()=>{for(let n=0;n<100;n++){if(' + condition + ')return true;await new Promise(r=>setTimeout(r,70))}throw new Error(' + JSON.stringify('No se cumplió: ' + condition) + ')})()');
  const click = async (selector: string) => evaluate('(()=>{const x=document.querySelector(' + JSON.stringify(selector) + ');if(!x)throw new Error("Elemento ausente");x.click();return true})()');
  const fill = async (selector: string, value: string) => evaluate('(()=>{const x=document.querySelector(' + JSON.stringify(selector) + ');x.value=' + JSON.stringify(value) + ';x.dispatchEvent(new Event("input",{bubbles:true}));return true})()');
  const go = async (page: string) => { await evaluate('(()=>{location.hash=' + JSON.stringify(page) + ';return true})()'); await wait('!!document.querySelector(' + JSON.stringify('a[href="#' + page + '"].active') + ')'); };
  const folder = fileURLToPath(new URL('../docs/capturas/', import.meta.url)); mkdirSync(folder, { recursive: true });
  const capture = async (name: string) => {
    const result = await send('browsingContext.captureScreenshot', { context, origin: 'viewport', format: { type: 'image/png' } });
    writeFileSync(folder + name + '.png', Buffer.from(result.data, 'base64'));
  };
  await send('browsingContext.setViewport', { context, viewport: { width: 1440, height: 1080 }, devicePixelRatio: 1 });
  await send('browsingContext.navigate', { context, url: 'http://127.0.0.1:' + address.port, wait: 'complete' });
  await wait('!!document.querySelector("#login-form")'); await capture('01-acceso');
  await click('[data-profile="admin"]'); await wait('!!document.querySelector(".workspace")'); await capture('02-panel');
  assert.equal(await evaluate('document.querySelectorAll(".stat-card").length'), 4);
  await go('catalog'); await wait('document.querySelectorAll(".instrument-card").length===6');
  await fill('#catalog-search', 'balanza'); assert.equal(await evaluate('document.querySelectorAll(".instrument-card").length'), 1);
  await fill('#catalog-search', ''); await capture('03-catalogo');
  await click('[data-action="book"][data-id="4"]'); await wait('document.querySelector("#modal").open');
  await fill('#purpose', 'Reserva creada desde la verificación del navegador');
  await click('[data-action="availability"]'); await wait('!!document.querySelector(".availability.success")');
  await click('#operation-form button[type="submit"]'); await wait('!document.querySelector("#modal").open');
  const id = await evaluate('(async()=>{const s=await(await fetch("/api/state")).json();return Math.max(...s.bookings.filter(b=>b.own).map(b=>b.id))})()');
  await go('bookings'); await wait('!!document.querySelector(' + JSON.stringify('[data-action="cancel"][data-id="' + id + '"]') + ')');
  await click('[data-action="cancel"][data-id="' + id + '"]'); await click('#operation-form button[type="submit"]'); await wait('!document.querySelector("#modal").open');
  await go('incidents'); await click('[data-action="incident"]'); await fill('#incident-instrument', '4');
  await fill('#description', 'Prueba visual: el sensor de la balanza no responde correctamente.');
  await click('#operation-form button[type="submit"]'); await wait('!document.querySelector("#modal").open');
  const incidentId = await evaluate('(async()=>{const s=await(await fetch("/api/state")).json();return Math.max(...s.incidents.map(i=>i.id))})()');
  await click('[data-action="resolve"][data-id="' + incidentId + '"]');
  await fill('#resolution', 'Sensor sustituido y lectura de control verificada correctamente.');
  await click('#operation-form button[type="submit"]'); await wait('!document.querySelector("#modal").open');
  assert.ok(await evaluate('document.querySelector("#page").textContent.includes("Resuelta")'));
  await go('users'); await click('[data-action="user"]');
  for (const [selector,value] of [['#user-name','Persona de prueba visual'],['#user-email','visual@demo.local'],['#company','Laboratorio de demostración'],['#user-password','PruebaVisual2026!']]) await fill(selector,value);
  await click('#operation-form button[type="submit"]'); await wait('!document.querySelector("#modal").open');
  assert.ok(await evaluate('document.querySelector("#page").textContent.includes("visual@demo.local")'));
  await go('reports'); await wait('!!document.querySelector("#report-month")');
  // También funciona el primer día del mes, cuando las sesiones de ejemplo están en el anterior.
  const reportMonth = await evaluate('(async()=>{const s=await(await fetch("/api/state")).json();const b=s.bookings.find(b=>b.status==="finalizada");return new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit"}).format(b.actualStart)})()');
  await fill('#report-month', reportMonth);
  await evaluate('(()=>{document.querySelector("#report-month").dispatchEvent(new Event("change",{bubbles:true}));return true})()');
  await wait('!!document.querySelector("tbody tr")'); await capture('04-informes');
  await go('guide'); await wait('document.querySelectorAll(".guide-card").length===8');
  assert.equal(await evaluate('(async()=> (await fetch("/docs/API.md")).status)()'), 200);
  await go('overview'); await send('browsingContext.setViewport', { context, viewport: { width: 390, height: 844 }, devicePixelRatio: 1 });
  await wait('document.querySelector(".sidebar").getBoundingClientRect().right <= 1');
  await evaluate('(()=>{document.querySelector("#toast").className="";return true})()');
  await wait('Number(getComputedStyle(document.querySelector("#toast")).opacity) < 0.01');
  const layout = await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll("body *")].map(x=>({tag:x.tagName,cls:x.className,right:x.getBoundingClientRect().right,width:x.getBoundingClientRect().width})).filter(x=>x.right>innerWidth+1&&x.width>0).slice(0,12)})');
  assert.ok(layout.scroll<=layout.width, JSON.stringify(layout));
  await capture('05-movil');
  await click('[data-action="menu"]'); assert.ok(await evaluate('document.querySelector(".workspace").classList.contains("sidebar-open")'));
  await click('[data-action="logout"]'); await wait('!!document.querySelector("#login-form")');
  await click('[data-profile="uco"]'); await wait('!!document.querySelector(".workspace")');
  assert.equal(await evaluate('document.querySelector(' + JSON.stringify('nav a[href="#users"]') + ')===null'), true);
  assert.equal(await evaluate('document.querySelector(' + JSON.stringify('nav a[href="#reports"]') + ')===null'), true);
  await click('[data-action="logout"]'); await wait('!!document.querySelector("#login-form")');
  await fill('#email','caducado@demo.local'); await fill('#password','Demo2026!'); await click('#login-form button[type="submit"]');
  await wait('document.querySelector("#login-error").textContent.includes("no está vigente")');
  assert.deepEqual(browserErrors, []);
  console.log('Verificados: acceso, búsqueda, reserva, cancelación, incidencia, reparación, alta, informe, documentación, móvil, permisos y contrato vencido.');
  console.log('Cinco capturas guardadas en docs/capturas/. Base de prueba en memoria; datos de la aplicación intactos.');
});
