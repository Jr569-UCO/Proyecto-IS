import type { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './auth.ts';
import { localDateTime, parseLocalDateTime, DAY, HOUR } from './time.ts';
import { transaction } from './database.ts';

/** Exclusivamente datos ficticios. Las fechas se calculan al crear una BD vacía. */
export function seedDatabase(db: DatabaseSync, now = Date.now()): void {
  if ((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n) return;
  transaction(db, () => {
    const accounts = [
      ['Administración CICT', 'admin', 'admin', 'CICT'],
      ['Elena Martín', 'uco', 'uco', 'Universidad de Córdoba'],
      ['Daniel Ruiz', 'externa', 'externo', 'BioNova Investigación'],
      ['Lucía Torres', 'tecnico', 'tecnico', 'CICT · Unidad de microscopía'],
      ['Pablo Vega', 'tecnico2', 'tecnico', 'CICT · Análisis instrumental'],
      ['Carmen Gil', 'contable', 'contable', 'CICT · Administración'],
      ['Personal de consulta', 'consulta', 'consulta', 'CICT'],
      ['Cuenta con contrato vencido', 'caducado', 'externo', 'Contrato de ejemplo'],
    ];
    for (const [name, login, role, company] of accounts) {
      db.prepare('INSERT INTO users (name,email,role,company,passwordHash,contractStart,contractEnd) VALUES (?,?,?,?,?,?,?)')
        .run(name, login + '@demo.local', role, company, hashPassword('Demo2026!'), now - 365 * DAY, login === 'caducado' ? now - DAY : now + 365 * DAY);
    }
    const instruments = [
      ['Microscopio electrónico', 'MIC-001', 'Microscopía', 'Sala 01', 'Imagen de alta resolución para estudiar la estructura y superficie de tus muestras.', 1, 'mint', 'microscope'],
      ['Espectrómetro de masas', 'ESP-002', 'Espectrometría', 'Sala 02', 'Identificación y caracterización de compuestos con apoyo técnico especializado.', 1, 'lavender', 'spectrum'],
      ['Cromatógrafo HPLC', 'CRO-003', 'Cromatografía', 'Sala 02', 'Separación y cuantificación de los componentes de mezclas complejas.', 1, 'peach', 'flask'],
      ['Balanza analítica', 'BAL-004', 'Análisis', 'Sala 03', 'Mediciones precisas para la preparación y el control de tus experimentos.', 0, 'blue', 'scale'],
      ['Difractómetro de rayos X', 'DIF-005', 'Difracción', 'Sala 04', 'Caracterización de materiales cristalinos y estudio de estructuras.', 1, 'rose', 'atom'],
      ['Centrífuga refrigerada', 'CEN-006', 'Preparación', 'Sala 03', 'Separación de muestras biológicas con control de temperatura.', 0, 'sand', 'centrifuge'],
    ];
    for (const [name, code, category, room, description, needs, accent, icon] of instruments) {
      db.prepare('INSERT INTO instruments (name,code,category,room,description,state,needsTechnician,accent,icon) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(name, code, category, room, description, code === 'CEN-006' ? 'averiado' : 'disponible', needs, accent, icon);
    }
    const slot = (days: number, hour: string) => {
      const date = localDateTime(now + days * DAY).slice(0, 10);
      return parseLocalDateTime(date + 'T' + hour);
    };
    const insert = (user: number, instrument: number, tech: number | null, days: number, from: string, to: string, purpose: string, completed = false) => {
      const start = slot(days, from), end = slot(days, to);
      db.prepare('INSERT INTO bookings (userId,instrumentId,technicianId,startsAt,endsAt,status,kind,purpose,actualStart,actualEnd,createdAt) VALUES (?,?,?,?,?,?,\'experimento\',?,?,?,?)')
        .run(user, instrument, tech, start, end, completed ? 'finalizada' : 'confirmada', purpose,
          completed ? start + 5 * 60_000 : null, completed ? end - 5 * 60_000 : null, now - 3 * DAY);
    };
    insert(2, 1, 4, 1, '09:00', '11:00', 'Caracterización de superficies');
    insert(3, 2, 5, 1, '10:00', '12:00', 'Identificación de compuestos');
    insert(2, 4, null, 2, '12:00', '13:00', 'Preparación de muestras');
    insert(3, 1, 4, 10, '10:00', '12:00', 'Reserva para demostrar la prioridad UCO');
    insert(2, 5, 5, 3, '09:00', '11:00', 'Análisis de estructura cristalina');
    insert(2, 1, 4, -2, '09:00', '12:00', 'Sesión finalizada de demostración', true);
    insert(3, 2, 5, -1, '10:00', '12:00', 'Sesión finalizada de demostración', true);
    // Una sesión en curso permite probar «Finalizar uso» inmediatamente con el técnico.
    const madridHour = Number(localDateTime(now).slice(11, 13));
    if (madridHour >= 8 && madridHour < 20) {
      db.prepare("INSERT INTO bookings (userId,instrumentId,technicianId,startsAt,endsAt,status,kind,purpose,actualStart,createdAt) VALUES (2,3,4,?,?,'en_uso','experimento','Sesión en curso de demostración',?,?)")
        .run(slot(0, '08:00'), slot(0, '20:00'), now - 15 * 60_000, now - HOUR);
    }
    db.prepare('INSERT INTO incidents (instrumentId,userId,description,createdAt) VALUES (6,4,?,?)')
      .run('El rotor presenta vibraciones anómalas. Equipo pendiente de revisión técnica.', now - DAY);
    db.prepare('INSERT INTO notifications (userId,title,message,createdAt) VALUES (2,?,?,?)')
      .run('Bienvenida al SG-CICT', 'Tu entorno de trabajo está preparado. Puedes consultar el catálogo y gestionar tus reservas.', now - HOUR);
    for (const [user, description] of [[2, 'Nueva reserva · Microscopio electrónico'], [4, 'Incidencia registrada · Centrífuga refrigerada'], [3, 'Uso finalizado · Espectrómetro de masas']] as const) {
      db.prepare('INSERT INTO activity (userId,description,createdAt) VALUES (?,?,?)').run(user, description, now - 2 * HOUR);
    }
  });
}
