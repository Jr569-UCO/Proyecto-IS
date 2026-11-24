import type { DatabaseSync } from 'node:sqlite';
import type { User, Instrument, Booking, BookingInput, BookingView, Incident, Notification, ReportRow, Snapshot, Role } from './model.ts';
import { DomainError } from './model.ts';
import { assertAccess, hashPassword, USER_COLUMNS } from './auth.ts';
import { DAY, HOUR, TIMEZONE, monthRange, parseLocalDateTime, validateSlot } from './time.ts';
import { transaction } from './database.ts';

const STAFF: Role[] = ['admin', 'tecnico', 'contable'];
export function requiredText(value: unknown, label: string, min = 1, max = 300): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new DomainError(label + ': escribe entre ' + min + ' y ' + max + ' caracteres.');
  }
  return value.trim();
}
export function positiveId(value: unknown): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new DomainError('El identificador no es válido.');
  return id;
}

/** Cada operación pública expresa una intención completa, independiente de HTTP y del HTML. */
export class CictSystem {
  db: DatabaseSync;
  now: () => number;
  constructor(db: DatabaseSync, now: () => number = Date.now) { this.db = db; this.now = now; }

  private allow(actor: User, roles: Role[]): void {
    assertAccess(actor, this.now());
    if (actor.role !== 'admin' && !roles.includes(actor.role)) throw new DomainError('Tu perfil no tiene permiso para esta operación.', 403);
  }
  private instrument(id: number): Instrument {
    const item = this.db.prepare('SELECT * FROM instruments WHERE id = ?').get(positiveId(id));
    if (!item) throw new DomainError('El instrumento no existe.', 404);
    return item as unknown as Instrument;
  }
  private booking(id: number): Booking {
    const item = this.db.prepare('SELECT * FROM bookings WHERE id = ?').get(positiveId(id));
    if (!item) throw new DomainError('La reserva no existe.', 404);
    return item as unknown as Booking;
  }
  private log(userId: number, description: string): void {
    this.db.prepare('INSERT INTO activity (userId, description, createdAt) VALUES (?, ?, ?)').run(userId, description, this.now());
  }
  private notify(userId: number, title: string, message: string): void {
    this.db.prepare('INSERT INTO notifications (userId, title, message, createdAt) VALUES (?, ?, ?, ?)').run(userId, title, message, this.now());
  }

  /** La consulta y la creación utilizan exactamente la misma validación. */
  private plan(actor: User, input: BookingInput) {
    const kind = input.kind ?? 'experimento';
    if (!['experimento', 'mantenimiento'].includes(kind)) throw new DomainError('Tipo de reserva no válido.');
    this.allow(actor, kind === 'mantenimiento' ? ['tecnico'] : ['uco', 'externo']);
    const [start, end] = validateSlot(input.startsAt, input.endsAt, this.now());
    if (['uco', 'externo'].includes(actor.role) && end > actor.contractEnd) {
      throw new DomainError('La reserva queda fuera de la vigencia de tu contrato.');
    }
    const item = this.instrument(input.instrumentId);
    if (item.state === 'averiado' && kind !== 'mantenimiento') throw new DomainError('El instrumento está averiado. Debe repararse antes de reservarlo.', 409);
    const conflicts = this.db.prepare("SELECT b.*, u.role AS ownerRole FROM bookings b JOIN users u ON u.id = b.userId WHERE instrumentId = ? AND startsAt < ? AND endsAt > ? AND status IN ('confirmada','en_uso')").all(item.id, end, start) as unknown as (Booking & { ownerRole: Role })[];
    // Decisión P-02: exactamente siete días también protege la reserva externa.
    const displaced = conflicts.filter(b => kind === 'experimento' && actor.role === 'uco'
      && b.ownerRole === 'externo' && b.kind === 'experimento' && b.status === 'confirmada'
      && b.startsAt - this.now() > 7 * DAY);
    if (displaced.length !== conflicts.length) {
      throw new DomainError(kind === 'mantenimiento'
        ? 'El mantenimiento coincide con una cita existente. Elige otra franja; las citas se conservan.'
        : 'La franja ya está ocupada y esa reserva está protegida frente a desplazamientos.', 409);
    }
    let technicianId: number | null = null;
    if (item.needsTechnician || kind === 'mantenimiento') {
      const technicians = this.db.prepare("SELECT id FROM users WHERE role = 'tecnico' AND active = 1 ORDER BY id").all() as { id: number }[];
      const available = technicians.find(t => {
        if (kind === 'mantenimiento' && actor.role === 'tecnico' && t.id !== actor.id) return false;
        const occupied = this.db.prepare("SELECT id FROM bookings WHERE technicianId = ? AND startsAt < ? AND endsAt > ? AND status IN ('confirmada','en_uso')").all(t.id, end, start) as { id: number }[];
        return occupied.every(b => displaced.some(d => d.id === b.id));
      });
      if (!available) throw new DomainError('No hay un técnico disponible en esa franja.', 409);
      technicianId = available.id;
    }
    return { item, start, end, kind: kind as Booking['kind'], technicianId, displaced };
  }

  availability(actor: User, input: BookingInput) {
    const plan = this.plan(actor, input);
    return { available: true, technicianAssigned: plan.technicianId !== null, displacedCount: plan.displaced.length,
      message: plan.displaced.length ? 'Disponible por prioridad UCO. Se desplazarán ' + plan.displaced.length + ' reservas externas y se generarán avisos.' : 'Franja disponible. Todos los recursos necesarios están libres.' };
  }

  createBooking(actor: User, input: BookingInput): number {
    const purpose = requiredText(input.purpose, 'Motivo', 5, 300);
    return transaction(this.db, () => {
      const plan = this.plan(actor, input);
      for (const old of plan.displaced) {
        this.db.prepare("UPDATE bookings SET status = 'desplazada' WHERE id = ?").run(old.id);
        this.notify(old.userId, 'Reserva desplazada por prioridad UCO', 'La reserva #' + old.id + ' de ' + plan.item.name + ' ha sido desplazada al faltar más de siete días. Puedes elegir otra franja.');
      }
      const result = this.db.prepare("INSERT INTO bookings (userId,instrumentId,technicianId,startsAt,endsAt,status,kind,purpose,createdAt) VALUES (?,?,?,?,?,'confirmada',?,?,?)")
        .run(actor.id, plan.item.id, plan.technicianId, plan.start, plan.end, plan.kind, purpose, this.now());
      const id = Number(result.lastInsertRowid);
      this.notify(actor.id, 'Reserva confirmada', 'Tu reserva #' + id + ' de ' + plan.item.name + ' está confirmada.');
      this.log(actor.id, (plan.kind === 'mantenimiento' ? 'Mantenimiento programado · ' : 'Nueva reserva · ') + plan.item.name);
      return id;
    });
  }

  cancelBooking(actor: User, id: number): { billable: boolean } {
    assertAccess(actor, this.now());
    return transaction(this.db, () => {
      const b = this.booking(id);
      if (actor.role !== 'admin' && (b.userId !== actor.id || (b.kind === 'mantenimiento' && actor.role !== 'tecnico'))) {
        throw new DomainError('Solo puedes cancelar tus propias reservas.', 403);
      }
      if (b.status !== 'confirmada' || b.startsAt <= this.now()) throw new DomainError('Solo se pueden cancelar reservas confirmadas que aún no han comenzado.', 409);
      const billable = b.kind === 'experimento' && b.startsAt - this.now() < DAY;
      this.db.prepare("UPDATE bookings SET status='cancelada', cancelledAt=?, billableCancellation=? WHERE id=?").run(this.now(), Number(billable), b.id);
      this.notify(b.userId, 'Reserva cancelada', 'Reserva #' + b.id + (billable ? ': cancelación con menos de 24 horas; queda registrada como facturable.' : ': cancelación sin cargo por antelación.'));
      this.log(actor.id, 'Reserva #' + b.id + ' cancelada' + (billable ? ' · facturable' : ''));
      return { billable };
    });
  }

  recordUsage(actor: User, id: number, action: string): void {
    this.allow(actor, ['tecnico']);
    transaction(this.db, () => {
      const b = this.booking(id), now = this.now();
      if (actor.role !== 'admin' && b.technicianId !== actor.id) throw new DomainError('Esta reserva no está asignada a tu perfil técnico.', 403);
      if (b.kind !== 'experimento') throw new DomainError('El uso real se registra en reservas de experimento.');
      if (action === 'start') {
        if (b.status !== 'confirmada' || now < b.startsAt || now >= b.endsAt) throw new DomainError('El uso solo puede iniciarse durante la franja de una reserva confirmada.', 409);
        if (this.instrument(b.instrumentId).state === 'averiado') throw new DomainError('El instrumento está averiado.', 409);
        const running = this.db.prepare("SELECT id FROM bookings WHERE status='en_uso' AND (instrumentId=? OR (technicianId IS NOT NULL AND technicianId=?))").get(b.instrumentId, b.technicianId ?? actor.id);
        if (running) throw new DomainError('El instrumento o el técnico aún tienen un uso real en curso.', 409);
        this.db.prepare("UPDATE bookings SET status='en_uso', actualStart=? WHERE id=?").run(now, b.id);
      } else if (action === 'finish') {
        if (b.status !== 'en_uso' || b.actualStart === null || now <= b.actualStart) throw new DomainError('Primero debe existir un inicio de uso anterior al momento actual.', 409);
        this.db.prepare("UPDATE bookings SET status='finalizada', actualEnd=? WHERE id=?").run(now, b.id);
      } else throw new DomainError('Acción de uso desconocida.');
      this.log(actor.id, (action === 'start' ? 'Inicio' : 'Fin') + ' de uso real · reserva #' + b.id);
    });
  }

  createIncident(actor: User, instrumentId: number, description: string): number {
    this.allow(actor, ['uco', 'externo', 'tecnico']);
    const detail = requiredText(description, 'Descripción', 10, 1500);
    return transaction(this.db, () => {
      const instrument = this.instrument(instrumentId);
      const result = this.db.prepare('INSERT INTO incidents (instrumentId,userId,description,createdAt) VALUES (?,?,?,?)').run(instrument.id, actor.id, detail, this.now());
      this.db.prepare("UPDATE instruments SET state='averiado' WHERE id=?").run(instrument.id);
      const affected = this.db.prepare("SELECT DISTINCT userId FROM bookings WHERE instrumentId=? AND endsAt>? AND status IN ('confirmada','en_uso')").all(instrument.id, this.now()) as { userId: number }[];
      for (const user of affected) this.notify(user.userId, 'Una avería afecta a tu reserva', instrument.name + ': ' + detail + ' Las citas se conservan; revisa el estado antes de acudir.');
      this.log(actor.id, 'Incidencia registrada · ' + instrument.name);
      return Number(result.lastInsertRowid);
    });
  }

  resolveIncident(actor: User, id: number, resolution: string): void {
    this.allow(actor, ['tecnico']);
    const text = requiredText(resolution, 'Resolución', 10, 1500);
    transaction(this.db, () => {
      const incident = this.db.prepare('SELECT * FROM incidents WHERE id=?').get(positiveId(id)) as unknown as Incident | undefined;
      if (!incident) throw new DomainError('La incidencia no existe.', 404);
      if (incident.resolvedAt !== null) throw new DomainError('La incidencia ya está resuelta.', 409);
      this.db.prepare('UPDATE incidents SET resolution=?, resolvedAt=? WHERE id=?').run(text, this.now(), incident.id);
      const stillOpen = this.db.prepare('SELECT id FROM incidents WHERE instrumentId=? AND resolvedAt IS NULL').get(incident.instrumentId);
      if (!stillOpen) {
        this.db.prepare("UPDATE instruments SET state='disponible' WHERE id=?").run(incident.instrumentId);
        const affected = this.db.prepare("SELECT DISTINCT userId FROM bookings WHERE instrumentId=? AND endsAt>? AND status='confirmada'").all(incident.instrumentId, this.now()) as { userId: number }[];
        for (const user of affected) this.notify(user.userId, 'Instrumento reparado', this.instrument(incident.instrumentId).name + ' vuelve a estar disponible.');
      }
      this.log(actor.id, 'Incidencia #' + incident.id + ' resuelta');
    });
  }

  createExternal(actor: User, input: Record<string, unknown>): number {
    this.allow(actor, []);
    const name = requiredText(input.name, 'Nombre', 3, 100), email = requiredText(input.email, 'Correo', 5, 150).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError('El correo no tiene un formato válido.');
    const password = requiredText(input.password, 'Contraseña', 10, 128), company = requiredText(input.company, 'Empresa', 2, 100);
    const [start, end] = this.contractDates(input.contractStart, input.contractEnd);
    if (this.db.prepare('SELECT id FROM users WHERE email=?').get(email)) throw new DomainError('Ya existe una cuenta con ese correo.', 409);
    return transaction(this.db, () => {
      const result = this.db.prepare("INSERT INTO users (name,email,role,company,passwordHash,contractStart,contractEnd) VALUES (?,?,'externo',?,?,?,?)").run(name, email, company, hashPassword(password), start, end);
      this.log(actor.id, 'Alta de una cuenta externa');
      return Number(result.lastInsertRowid);
    });
  }
  private contractDates(startValue: unknown, endValue: unknown): [number, number] {
    const start = parseLocalDateTime(requiredText(startValue, 'Inicio de contrato', 10, 10) + 'T00:00');
    const end = parseLocalDateTime(requiredText(endValue, 'Fin de contrato', 10, 10) + 'T23:59') + 59_999;
    if (end < start) throw new DomainError('El fin del contrato debe ser posterior al inicio.');
    return [start, end];
  }
  updateContract(actor: User, id: number, input: Record<string, unknown>): void {
    this.allow(actor, []);
    const user = this.db.prepare('SELECT role FROM users WHERE id=?').get(positiveId(id)) as { role: Role } | undefined;
    if (!user || !['externo', 'uco'].includes(user.role)) throw new DomainError('Selecciona una cuenta de investigación.', 400);
    const [start, end] = this.contractDates(input.contractStart, input.contractEnd);
    if (typeof input.active !== 'boolean') throw new DomainError('El estado de la cuenta no es válido.');
    transaction(this.db, () => {
      this.db.prepare('UPDATE users SET contractStart=?,contractEnd=?,active=? WHERE id=?').run(start, end, Number(input.active), id);
      this.db.prepare('DELETE FROM sessions WHERE userId=?').run(id);
      this.log(actor.id, 'Contrato actualizado · cuenta #' + id);
    });
  }

  report(actor: User, month: string): ReportRow[] {
    this.allow(actor, ['contable']);
    const [start, end] = monthRange(month);
    const rows = this.db.prepare("SELECT b.*, u.name AS userName, u.company, i.name AS instrumentName FROM bookings b JOIN users u ON u.id=b.userId JOIN instruments i ON i.id=b.instrumentId WHERE kind='experimento' AND ((status='finalizada' AND actualStart<? AND actualEnd>?) OR (status='cancelada' AND billableCancellation=1 AND startsAt>=? AND startsAt<?))").all(end, start, start, end) as unknown as (Booking & { userName: string; company: string; instrumentName: string })[];
    const groups = new Map<string, ReportRow>();
    for (const b of rows) {
      const key = String(b.userId) + ':' + b.instrumentId;
      const row = groups.get(key) ?? { userId: b.userId, userName: b.userName, company: b.company, instrumentName: b.instrumentName, usageHours: 0, cancellationHours: 0, totalHours: 0 };
      if (b.status === 'finalizada') row.usageHours += (Math.min(b.actualEnd!, end) - Math.max(b.actualStart!, start)) / HOUR;
      else row.cancellationHours += (b.endsAt - b.startsAt) / HOUR;
      groups.set(key, row);
    }
    return [...groups.values()].map(row => ({ ...row, usageHours: Math.round(row.usageHours * 100) / 100,
      cancellationHours: Math.round(row.cancellationHours * 100) / 100, totalHours: Math.round((row.usageHours + row.cancellationHours) * 100) / 100 }));
  }

  readNotifications(actor: User): void {
    assertAccess(actor, this.now());
    this.db.prepare('UPDATE notifications SET readAt=? WHERE userId=? AND readAt IS NULL').run(this.now(), actor.id);
  }

  snapshot(actor: User): Snapshot {
    assertAccess(actor, this.now());
    const staff = STAFF.includes(actor.role);
    const bookings = this.db.prepare('SELECT b.*, i.name AS instrumentName, i.room, i.code, u.name AS userName, u.company, t.name AS technicianName FROM bookings b JOIN instruments i ON i.id=b.instrumentId JOIN users u ON u.id=b.userId LEFT JOIN users t ON t.id=b.technicianId ORDER BY b.startsAt DESC').all() as unknown as BookingView[];
    const safeBookings = bookings.map(b => {
      const own = b.userId === actor.id;
      if (staff || own) return { ...b, own };
      const { userName, company, ...safe } = b;
      return { ...safe, userId: 0, purpose: '', own };
    });
    const incidents = this.db.prepare('SELECT n.*, i.name AS instrumentName, i.code FROM incidents n JOIN instruments i ON i.id=n.instrumentId ORDER BY n.createdAt DESC').all() as unknown as Incident[];
    return { user: actor, instruments: this.db.prepare('SELECT * FROM instruments ORDER BY id').all() as unknown as Instrument[],
      bookings: safeBookings, incidents: incidents.map(n => ({ ...n, userId: staff || n.userId === actor.id ? n.userId : 0 })),
      notifications: this.db.prepare('SELECT * FROM notifications WHERE userId=? ORDER BY createdAt DESC, id DESC').all(actor.id) as unknown as Notification[],
      users: actor.role === 'admin' ? this.db.prepare('SELECT ' + USER_COLUMNS + ' FROM users ORDER BY id').all() as unknown as User[] : [],
      activity: this.db.prepare('SELECT id,description,createdAt FROM activity WHERE (?=1 OR userId=?) ORDER BY createdAt DESC, id DESC LIMIT 8').all(Number(staff), actor.id) as Snapshot['activity'],
      now: this.now(), timezone: TIMEZONE };
  }
}
