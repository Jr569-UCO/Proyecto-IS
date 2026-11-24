/** Contratos compartidos. Los import type desaparecen al servir el navegador. */
export type Role = 'admin' | 'uco' | 'externo' | 'tecnico' | 'contable' | 'consulta';
export type BookingStatus = 'confirmada' | 'cancelada' | 'desplazada' | 'en_uso' | 'finalizada';
export interface User {
  id: number; name: string; email: string; role: Role;
  company: string; contractStart: number; contractEnd: number; active: number;
}
export interface Instrument {
  id: number; name: string; code: string; category: string; room: string;
  description: string; state: 'disponible' | 'averiado'; needsTechnician: number;
  accent: string; icon: string;
}
export interface Booking {
  id: number; userId: number; instrumentId: number; technicianId: number | null;
  startsAt: number; endsAt: number; status: BookingStatus; kind: 'experimento' | 'mantenimiento';
  purpose: string; actualStart: number | null; actualEnd: number | null;
  cancelledAt: number | null; billableCancellation: number; createdAt: number;
}
export interface BookingView extends Booking {
  instrumentName: string; room: string; code: string; own: boolean;
  userName?: string; company?: string; technicianName: string | null;
}
export interface Incident {
  id: number; instrumentId: number; userId: number; description: string;
  createdAt: number; resolvedAt: number | null; resolution: string | null;
  instrumentName: string; code: string;
}
export interface Notification {
  id: number; userId: number; title: string; message: string; createdAt: number; readAt: number | null;
}
export interface ReportRow {
  userId: number; userName: string; company: string; instrumentName: string;
  usageHours: number; cancellationHours: number; totalHours: number;
}
export interface Snapshot {
  user: User; instruments: Instrument[]; bookings: BookingView[];
  incidents: Incident[]; notifications: Notification[]; users: User[];
  activity: { id: number; description: string; createdAt: number }[];
  now: number; timezone: string;
}
export interface BookingInput {
  instrumentId: number; startsAt: string; endsAt: string; purpose: string;
  kind?: 'experimento' | 'mantenimiento';
}
export class DomainError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
