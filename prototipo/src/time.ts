import { DomainError } from './model.ts';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const TIMEZONE = 'Europe/Madrid';
const clock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function localDateTime(timestamp: number): string {
  return clock.format(new Date(timestamp)).replace(' ', 'T').slice(0, 16);
}

/** Interpreta el formulario en Madrid, independientemente de la zona del navegador. */
export function parseLocalDateTime(value: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new DomainError('La fecha debe tener formato AAAA-MM-DDTHH:mm.');
  }
  const [year, month, day, hour, minute] = value.match(/\d+/g)!.map(Number);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || hour > 23 || minute > 59) {
    throw new DomainError('La fecha o la hora no son válidas.');
  }
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = localDateTime(candidate).match(/\d+/g)!.map(Number);
    const displayed = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]);
    candidate += target - displayed;
  }
  if (localDateTime(candidate) !== value) throw new DomainError('La fecha no existe en Europe/Madrid.');
  return candidate;
}

/** Intervalos semiabiertos: acabar a las 11 permite que otro empiece a las 11. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function validateSlot(startsAt: string, endsAt: string, now: number): [number, number] {
  const start = parseLocalDateTime(startsAt), end = parseLocalDateTime(endsAt);
  if (start < now) throw new DomainError('La reserva debe comenzar en el futuro.');
  if (end <= start) throw new DomainError('La hora de fin debe ser posterior al inicio.');
  if (startsAt.slice(0, 10) !== endsAt.slice(0, 10)
      || startsAt.slice(11) < '08:00' || endsAt.slice(11) > '20:00') {
    throw new DomainError('El horario permitido es de 08:00 a 20:00 en un mismo día.');
  }
  return [start, end];
}

export function monthRange(month: string): [number, number] {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new DomainError('Selecciona un mes válido.');
  const [year, n] = month.split('-').map(Number);
  const next = n === 12 ? String(year + 1) + '-01' : String(year) + '-' + String(n + 1).padStart(2, '0');
  return [parseLocalDateTime(month + '-01T00:00'), parseLocalDateTime(next + '-01T00:00')];
}
