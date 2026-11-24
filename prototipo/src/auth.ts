import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { User } from './model.ts';
import { DomainError } from './model.ts';
import { HOUR } from './time.ts';

export const USER_COLUMNS = 'id, name, email, role, company, contractStart, contractEnd, active';
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const actual = scryptSync(password, salt, 64), expected = Buffer.from(hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export function assertAccess(user: User, now: number): void {
  if (!user.active) throw new DomainError('Esta cuenta está desactivada.', 403);
  if (['uco', 'externo'].includes(user.role)
      && (user.contractStart > now || user.contractEnd < now)) {
    throw new DomainError('El contrato no está vigente. Contacta con administración.', 403);
  }
}

export class Auth {
  db: DatabaseSync;
  now: () => number;
  constructor(db: DatabaseSync, now: () => number = Date.now) { this.db = db; this.now = now; }

  login(email: string, password: string): { token: string; csrf: string; user: User } {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as (User & { passwordHash: string }) | undefined;
    // También calculamos scrypt para una cuenta inexistente: respuesta y coste similares.
    const dummy = '00000000000000000000000000000000:' + '0'.repeat(128);
    const valid = verifyPassword(password, row?.passwordHash ?? dummy);
    if (!row || !valid) throw new DomainError('El correo o la contraseña no son correctos.', 401);
    assertAccess(row, this.now());
    const user = this.db.prepare('SELECT ' + USER_COLUMNS + ' FROM users WHERE id = ?').get(row.id) as unknown as User;
    const token = randomBytes(32).toString('hex'), csrf = randomBytes(24).toString('hex');
    this.db.prepare('DELETE FROM sessions WHERE expiresAt < ?').run(this.now());
    this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run(digest(token), user.id, csrf, this.now() + 8 * HOUR);
    return { token, csrf, user };
  }

  session(token: string): { user: User; csrf: string } {
    const row = this.db.prepare('SELECT userId, csrf FROM sessions WHERE tokenHash = ? AND expiresAt > ?').get(digest(token), this.now()) as { userId: number; csrf: string } | undefined;
    if (!row) throw new DomainError('Inicia sesión para continuar.', 401);
    const user = this.db.prepare('SELECT ' + USER_COLUMNS + ' FROM users WHERE id = ?').get(row.userId) as unknown as User;
    assertAccess(user, this.now());
    return { user, csrf: row.csrf };
  }
  logout(token: string): void { this.db.prepare('DELETE FROM sessions WHERE tokenHash = ?').run(digest(token)); }
}
