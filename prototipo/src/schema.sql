PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('admin','uco','externo','tecnico','contable','consulta')),
  company TEXT NOT NULL, passwordHash TEXT NOT NULL,
  contractStart INTEGER NOT NULL, contractEnd INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), CHECK(contractEnd >= contractStart)
);
CREATE TABLE IF NOT EXISTS instruments (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, category TEXT NOT NULL,
  room TEXT NOT NULL, description TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('disponible','averiado')),
  needsTechnician INTEGER NOT NULL CHECK(needsTechnician IN (0,1)), accent TEXT NOT NULL, icon TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY, userId INTEGER NOT NULL REFERENCES users(id),
  instrumentId INTEGER NOT NULL REFERENCES instruments(id), technicianId INTEGER REFERENCES users(id),
  startsAt INTEGER NOT NULL, endsAt INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('confirmada','cancelada','desplazada','en_uso','finalizada')),
  kind TEXT NOT NULL CHECK(kind IN ('experimento','mantenimiento')),
  purpose TEXT NOT NULL, actualStart INTEGER, actualEnd INTEGER,
  cancelledAt INTEGER, billableCancellation INTEGER NOT NULL DEFAULT 0 CHECK(billableCancellation IN (0,1)),
  createdAt INTEGER NOT NULL, CHECK(endsAt > startsAt),
  CHECK(actualEnd IS NULL OR (actualStart IS NOT NULL AND actualEnd > actualStart))
);
CREATE INDEX IF NOT EXISTS bookings_instrument_time ON bookings(instrumentId, startsAt, endsAt);
CREATE INDEX IF NOT EXISTS bookings_technician_time ON bookings(technicianId, startsAt, endsAt);
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY, instrumentId INTEGER NOT NULL REFERENCES instruments(id),
  userId INTEGER NOT NULL REFERENCES users(id), description TEXT NOT NULL,
  createdAt INTEGER NOT NULL, resolvedAt INTEGER, resolution TEXT
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY, userId INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL, message TEXT NOT NULL, createdAt INTEGER NOT NULL, readAt INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  tokenHash TEXT PRIMARY KEY, userId INTEGER NOT NULL REFERENCES users(id),
  csrf TEXT NOT NULL, expiresAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY, userId INTEGER NOT NULL REFERENCES users(id),
  description TEXT NOT NULL, createdAt INTEGER NOT NULL
);
