import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApplication } from '../src/server.ts';
import { parseLocalDateTime } from '../src/time.ts';
import { escape } from '../public/ui.ts';

test('HTTP: sesión, formularios, permisos, recursos y exportación', async t => {
  const app=createApplication({databasePath:':memory:',now:()=>parseLocalDateTime('2026-11-24T09:00')});
  await new Promise<void>((resolve,reject) => { app.server.once('error',reject); app.server.listen(0,'127.0.0.1',resolve); });
  t.after(() => new Promise<void>(resolve => app.server.close(() => resolve())));
  const address=app.server.address() as {port:number}, base='http://127.0.0.1:'+address.port;
  let cookie='', csrf='';
  const call=(path:string,body?:unknown,headers:Record<string,string>={}) => fetch(base+path,{
    method:body===undefined?'GET':'POST',headers:{...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf}),...headers},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  await t.test('Estado protegido y HTML público con política de contenido',async()=>{
    assert.equal((await call('/api/state')).status,401);
    const html=await call('/'); assert.equal(html.status,200);
    assert.match(html.headers.get('content-security-policy')!,/script-src 'self'/);
    assert.match(await html.text(),/lang="es"/);
  });
  await t.test('Login produce cookie HttpOnly y token CSRF',async()=>{
    const response=await call('/api/login',{email:'admin@demo.local',password:'Demo2026!'});
    assert.equal(response.status,200); assert.match(response.headers.get('set-cookie')!,/HttpOnly; SameSite=Strict/);
    cookie=response.headers.get('set-cookie')!.split(';')[0]; csrf=(await response.json()).csrf;
    assert.ok(csrf); assert.equal((await call('/api/state')).status,200);
  });
  await t.test('Mutaciones requieren CSRF y rechazan otro origen',async()=>{
    assert.equal((await call('/api/notifications/read',{}, {'X-CSRF-Token':'incorrecto'})).status,403);
    assert.equal((await call('/api/notifications/read',{}, {Origin:'https://otro.example.invalid'})).status,403);
  });
  await t.test('Se crea una reserva y el conflicto devuelve 409',async()=>{
    const payload={instrumentId:4,startsAt:'2026-11-29T10:00',endsAt:'2026-11-29T11:00',purpose:'Ensayo de extremo a extremo'};
    assert.equal((await call('/api/bookings',payload)).status,201);
    assert.equal((await call('/api/bookings',payload)).status,409);
  });
  await t.test('Errores de validación son 400, no fallos internos',async()=>{
    assert.equal((await call('/api/bookings',{})).status,400);
    assert.equal((await call('/api/incidents',{instrumentId:4})).status,400);
    assert.equal((await call('/api/reports?month=incorrecto')).status,400);
  });
  await t.test('CSV descargable; código y base de datos no son públicos',async()=>{
    const csv=await call('/api/reports.csv?month=2026-11'); assert.equal(csv.status,200);
    assert.match(csv.headers.get('content-disposition')!,/consumo-2026-11.csv/);
    assert.match(await csv.text(),/Microscopio electrónico/);
    for(const path of ['/src/server.ts','/data/prototipo.sqlite','/assets/../src/auth.ts']) assert.equal((await call(path)).status,404);
  });
  await t.test('JavaScript del navegador y escape de contenido',async()=>{
    for(const file of ['app','ui','views']) { const response=await call('/assets/'+file+'.js'); assert.equal(response.status,200); assert.match(response.headers.get('content-type')!,/javascript/); }
    assert.equal(escape('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });
  await t.test('Logout invalida la sesión',async()=>{
    assert.equal((await call('/api/logout',{})).status,200); assert.equal((await call('/api/state')).status,401);
  });
});
