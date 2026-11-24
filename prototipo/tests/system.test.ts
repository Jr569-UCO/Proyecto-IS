import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/database.ts';
import { seedDatabase } from '../src/seed.ts';
import { CictSystem } from '../src/system.ts';
import { Auth, USER_COLUMNS } from '../src/auth.ts';
import { DAY, HOUR, parseLocalDateTime, localDateTime, overlaps } from '../src/time.ts';
import type { User, BookingInput, Booking } from '../src/model.ts';

const BASE = parseLocalDateTime('2026-11-24T09:00');
function fixture(t: TestContext) {
  const db = openDatabase(); let now = BASE;
  seedDatabase(db, now); t.after(() => db.close());
  const system = new CictSystem(db, () => now), auth = new Auth(db, () => now);
  const user = (id: number) => db.prepare('SELECT ' + USER_COLUMNS + ' FROM users WHERE id=?').get(id) as unknown as User;
  const input = (instrumentId = 4, days = 5, start = '10:00', end = '12:00'): BookingInput => ({ instrumentId,
    startsAt: localDateTime(BASE + days * DAY).slice(0,10) + 'T' + start,
    endsAt: localDateTime(BASE + days * DAY).slice(0,10) + 'T' + end, purpose: 'Experimento para verificar las reglas' });
  const booking = (id: number) => db.prepare('SELECT * FROM bookings WHERE id=?').get(id) as unknown as Booking;
  return { db, system, auth, user, input, booking, setNow: (value: number) => { now = value; } };
}

test('Acceso: contraseña incorrecta y contrato vencido se rechazan', t => {
  const f=fixture(t);
  assert.throws(() => f.auth.login('uco@demo.local','incorrecta'), /no son correctos/);
  assert.throws(() => f.auth.login('caducado@demo.local','Demo2026!'), /no está vigente/);
});
test('Sesión: datos públicos, token resumido, caducidad y cierre', t => {
  const f=fixture(t), session=f.auth.login('uco@demo.local','Demo2026!');
  assert.equal(f.auth.session(session.token).user.id,2);
  assert.equal('passwordHash' in session.user,false);
  assert.notEqual(f.db.prepare('SELECT tokenHash FROM sessions').get()!.tokenHash,session.token);
  f.auth.logout(session.token); assert.throws(() => f.auth.session(session.token), /Inicia sesión/);
  const next=f.auth.login('uco@demo.local','Demo2026!'); f.setNow(BASE+8*HOUR);
  assert.throws(() => f.auth.session(next.token), /Inicia sesión/);
});
test('Fechas: Madrid resuelve verano, invierno y fechas inexistentes', () => {
  assert.equal(new Date(parseLocalDateTime('2026-07-15T10:00')).toISOString(),'2026-07-15T08:00:00.000Z');
  assert.equal(new Date(parseLocalDateTime('2026-12-15T10:00')).toISOString(),'2026-12-15T09:00:00.000Z');
  assert.throws(() => parseLocalDateTime('2026-02-30T10:00'), /no existe/);
});
test('Intervalos: franjas adyacentes no se solapan', () => {
  assert.equal(overlaps(8,10,10,12),false); assert.equal(overlaps(8,11,10,12),true);
});
test('Reservas: 08:00–20:00 es válido; se rechazan horario nocturno e intervalos invertidos', t => {
  const f=fixture(t); assert.ok(f.system.createBooking(f.user(2),f.input(4,5,'08:00','20:00')));
  assert.throws(() => f.system.createBooking(f.user(2),f.input(4,6,'07:59','10:00')), /horario permitido/);
  assert.throws(() => f.system.createBooking(f.user(2),f.input(4,6,'12:00','10:00')), /posterior/);
});
test('Reservas: se rechazan pasado, cambio de día y fechas fuera del contrato', t => {
  const f=fixture(t);
  assert.throws(() => f.system.createBooking(f.user(2),f.input(4,-1)), /futuro/);
  assert.throws(() => f.system.createBooking(f.user(2),f.input(4,367)), /vigencia/);
  const data=f.input(); data.endsAt=localDateTime(BASE+6*DAY).slice(0,10)+'T10:00';
  assert.throws(() => f.system.createBooking(f.user(2),data), /mismo día/);
});
test('Reservas: franjas consecutivas sin límite artificial de reservas', t => {
  const f=fixture(t);
  for (const [start,end] of [['10:00','11:00'],['11:00','12:00'],['12:00','13:00']]) f.system.createBooking(f.user(2),f.input(4,5,start,end));
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE instrumentId=4 AND startsAt>=?').get(parseLocalDateTime(f.input().startsAt))!.n,3);
});
test('Reservas: prevalece la primera reserva UCO', t => {
  const f=fixture(t); f.system.createBooking(f.user(2),f.input());
  assert.throws(() => f.system.createBooking(f.user(2),f.input()), /ocupada/);
});
test('Prioridad: a más de siete días se desplaza la reserva externa y se genera aviso', t => {
  const f=fixture(t); f.system.createBooking(f.user(2),f.input(1,10));
  assert.equal(f.booking(4).status,'desplazada');
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE userId=3 AND title LIKE '%desplazada%'").get()!.n,1);
});
test('Prioridad: exactamente siete días protege la reserva externa', t => {
  const f=fixture(t); f.setNow(f.booking(4).startsAt-7*DAY);
  assert.throws(() => f.system.createBooking(f.user(2),f.input(1,10)), /protegida/);
  assert.equal(f.booking(4).status,'confirmada');
});
test('Prioridad: menos de siete días tampoco permite desplazar', t => {
  const f=fixture(t); f.setNow(f.booking(4).startsAt-6*DAY);
  assert.throws(() => f.system.createBooking(f.user(2),f.input(1,10)), /protegida/);
});
test('Técnicos: asignación automática y rechazo cuando ambos están ocupados', t => {
  const f=fixture(t), first=f.system.createBooking(f.user(2),f.input(1)), second=f.system.createBooking(f.user(2),f.input(2));
  assert.notEqual(f.booking(first).technicianId,f.booking(second).technicianId);
  assert.throws(() => f.system.createBooking(f.user(2),f.input(3)), /técnico disponible/);
});
test('Sala compartida: instrumentos autónomos distintos admiten el mismo horario', t => {
  const f=fixture(t); f.system.resolveIncident(f.user(4),1,'Rotor revisado y equilibrado correctamente.');
  f.system.createBooking(f.user(2),f.input(4)); assert.ok(f.system.createBooking(f.user(3),f.input(6)));
});
test('Atomicidad: un fallo del aviso revierte reserva y desplazamiento', t => {
  const f=fixture(t), count=f.db.prepare('SELECT COUNT(*) AS n FROM bookings').get()!.n;
  f.db.exec("CREATE TRIGGER fallo_aviso BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT,'fallo simulado'); END");
  assert.throws(() => f.system.createBooking(f.user(2),f.input(1,10)), /fallo simulado/);
  assert.equal(f.booking(4).status,'confirmada'); assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bookings').get()!.n,count);
});
test('Cancelación: exactamente 24 horas es gratuita; menos tiempo es facturable', t => {
  const f=fixture(t), first=f.system.createBooking(f.user(2),f.input());
  f.setNow(f.booking(first).startsAt-DAY); assert.equal(f.system.cancelBooking(f.user(2),first).billable,false);
  const second=f.system.createBooking(f.user(2),f.input(4,6));
  f.setNow(f.booking(second).startsAt-DAY+1); assert.equal(f.system.cancelBooking(f.user(2),second).billable,true);
});
test('Cancelación: no se puede cancelar la reserva de otro usuario', t => {
  const f=fixture(t), id=f.system.createBooking(f.user(2),f.input());
  assert.throws(() => f.system.cancelBooking(f.user(3),id), /propias reservas/);
});
test('Incidencias: bloqueo, conservación de citas y aviso a cada usuario afectado', t => {
  const f=fixture(t), before=f.booking(1).status;
  f.system.createIncident(f.user(2),1,'Vibraciones intensas al iniciar la observación.');
  assert.throws(() => f.system.createBooking(f.user(2),f.input(1,6)), /averiado/);
  assert.equal(f.booking(1).status,before);
  assert.equal(f.db.prepare("SELECT COUNT(DISTINCT userId) AS n FROM notifications WHERE title='Una avería afecta a tu reserva'").get()!.n,2);
});
test('Incidencias: resolver una de dos averías no libera el instrumento', t => {
  const f=fixture(t), first=f.system.createIncident(f.user(2),4,'El panel presenta un fallo persistente.'), second=f.system.createIncident(f.user(2),4,'El sensor necesita una calibración completa.');
  f.system.resolveIncident(f.user(4),first,'Panel sustituido y verificado correctamente.');
  assert.throws(() => f.system.createBooking(f.user(2),f.input()), /averiado/);
  f.system.resolveIncident(f.user(4),second,'Sensor calibrado y lectura verificada.');
  assert.ok(f.system.createBooking(f.user(2),f.input()));
});
test('Incidencias: un investigador no puede registrar la reparación', t => {
  const f=fixture(t); assert.throws(() => f.system.resolveIncident(f.user(2),1,'Todo reparado y comprobado.'), /permiso/);
});
test('Mantenimiento: se rechazan conflictos y se reserva el técnico sin desplazar citas', t => {
  const f=fixture(t);
  assert.throws(() => f.system.createBooking(f.user(4),{...f.input(1,1,'09:00','11:00'),kind:'mantenimiento'}), /citas se conservan/);
  const id=f.system.createBooking(f.user(4),{...f.input(4,6),kind:'mantenimiento'});
  assert.equal(f.booking(id).technicianId,4);
  assert.throws(() => f.system.createBooking(f.user(2),f.input(4,6)), /ocupada/);
});
test('Mantenimiento: programar una reparación no declara reparado el equipo', t => {
  const f=fixture(t); assert.ok(f.system.createBooking(f.user(4),{...f.input(6,6),kind:'mantenimiento'}));
  assert.throws(() => f.system.createBooking(f.user(2),f.input(6,7)), /averiado/);
});
test('Uso real: técnico asignado, inicio dentro de la franja y fin posterior', t => {
  const f=fixture(t), id=f.system.createBooking(f.user(2),f.input(1));
  // Cerramos la sesión de ejemplo antes de avanzar el reloj cinco días.
  const running=f.db.prepare("SELECT id FROM bookings WHERE status='en_uso'").get() as {id:number};
  f.system.recordUsage(f.user(4),running.id,'finish');
  assert.throws(() => f.system.recordUsage(f.user(4),id,'start'), /durante la franja/);
  assert.throws(() => f.system.recordUsage(f.user(4),id,'finish'), /Primero/);
  f.setNow(f.booking(id).startsAt); assert.throws(() => f.system.recordUsage(f.user(5),id,'start'), /no está asignada/);
  f.system.recordUsage(f.user(4),id,'start'); f.setNow(f.booking(id).startsAt+HOUR);
  f.system.recordUsage(f.user(4),id,'finish'); assert.equal(f.booking(id).status,'finalizada');
});
test('Informes: prorrateo por mes de una sesión prolongada', t => {
  const f=fixture(t), start=parseLocalDateTime('2026-10-31T19:50'), end=parseLocalDateTime('2026-11-01T00:30');
  f.db.prepare("INSERT INTO bookings (userId,instrumentId,technicianId,startsAt,endsAt,status,kind,purpose,actualStart,actualEnd,createdAt) VALUES (3,4,NULL,?,?,'finalizada','experimento','Sesión extendida',?,?,?)").run(start-10*60_000,start+10*60_000,start,end,BASE);
  const row=f.system.report(f.user(6),'2026-11').find(r => r.userId===3 && r.instrumentName==='Balanza analítica');
  assert.equal(row?.usageHours,.5); assert.equal(row?.cancellationHours,0);
});
test('Informes: cancelaciones tardías separadas del uso real', t => {
  const f=fixture(t), id=f.system.createBooking(f.user(2),f.input());
  f.setNow(f.booking(id).startsAt-HOUR); f.system.cancelBooking(f.user(2),id);
  const row=f.system.report(f.user(6),'2026-11').find(r => r.instrumentName==='Balanza analítica');
  assert.equal(row?.usageHours,0); assert.equal(row?.cancellationHours,2);
});
test('Permisos: consulta no reserva; investigación no ve informes ni crea cuentas', t => {
  const f=fixture(t); assert.throws(() => f.system.createBooking(f.user(7),f.input()), /permiso/);
  assert.throws(() => f.system.report(f.user(2),'2026-11'), /permiso/);
  assert.throws(() => f.system.createExternal(f.user(2),{}), /permiso/);
});
test('Privacidad: reserva ajena sin identidad, entidad, motivo ni lista de usuarios', t => {
  const f=fixture(t), state=f.system.snapshot(f.user(2)), external=state.bookings.find(b => b.id===2)!;
  assert.equal(external.userId,0); assert.equal(external.userName,undefined); assert.equal(external.company,undefined);
  assert.equal(external.purpose,''); assert.equal(state.users.length,0);
  assert.equal(JSON.stringify(state).includes('passwordHash'),false);
});
test('Usuarios: alta externa utilizable y cambio de contrato que invalida sesiones', t => {
  const f=fixture(t), id=f.system.createExternal(f.user(1),{name:'Persona de prueba',email:'persona@example.invalid',company:'Laboratorio de prueba',password:'UnaClaveLarga2026!',contractStart:'2026-11-01',contractEnd:'2027-11-01'});
  const session=f.auth.login('persona@example.invalid','UnaClaveLarga2026!'); assert.equal(session.user.id,id);
  f.system.updateContract(f.user(1),id,{contractStart:'2026-11-01',contractEnd:'2027-11-01',active:true});
  assert.throws(() => f.auth.session(session.token), /Inicia sesión/);
});
test('Validación: campos ausentes y números inválidos son errores de dominio', t => {
  const f=fixture(t); assert.throws(() => f.system.createBooking(f.user(2),{...f.input(),instrumentId:NaN}), /identificador/);
  assert.throws(() => f.system.createIncident(f.user(2),1,undefined as unknown as string), /Descripción/);
  assert.throws(() => f.system.createBooking(f.user(2),{...f.input(),startsAt:undefined as unknown as string}), /formato/);
});
