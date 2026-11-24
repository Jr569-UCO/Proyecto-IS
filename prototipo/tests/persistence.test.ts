import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.ts';
import { seedDatabase } from '../src/seed.ts';
import { CictSystem } from '../src/system.ts';
import { Auth } from '../src/auth.ts';
import { parseLocalDateTime } from '../src/time.ts';

test('Persistencia: reserva y sesión sobreviven al cierre y reapertura de SQLite', t => {
  const folder=mkdtempSync(join(tmpdir(),'sg-cict-test-')), path=join(folder,'demo.sqlite');
  t.after(() => rmSync(folder,{recursive:true,force:true}));
  const now=()=>parseLocalDateTime('2026-11-24T09:00');
  const first=openDatabase(path); seedDatabase(first,now());
  const auth=new Auth(first,now), session=auth.login('uco@demo.local','Demo2026!');
  const id=new CictSystem(first,now).createBooking(session.user,{instrumentId:4,startsAt:'2026-11-29T10:00',endsAt:'2026-11-29T11:00',purpose:'Comprobación de persistencia entre arranques'});
  first.close();
  const second=openDatabase(path);
  try {
    seedDatabase(second,now());
    assert.equal(second.prepare('SELECT COUNT(*) AS n FROM users').get()!.n,8);
    assert.equal(new Auth(second,now).session(session.token).user.id,2);
    assert.equal(new CictSystem(second,now).snapshot(session.user).bookings.find(b=>b.id===id)?.purpose,'Comprobación de persistencia entre arranques');
  } finally { second.close(); }
});
