/** Solo las cadenas del catálogo de iconos contienen SVG; los datos se escapan. */
const paths: Record<string, string> = {
  atom: '<ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  microscope: '<path d="m9 3 5 5-4 4-5-5zM12 10l3 3M5 13a7 7 0 0 0 14 0 5 5 0 0 0-3-5M6 21h14M3 14h8M10 19v2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
  alert: '<path d="m10 4-8 14a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 4a2.3 2.3 0 0 0-4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  chart: '<path d="M4 3v17h17M8 15v-4M13 15V6M18 15v-7"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 6"/>',
  book: '<path d="M12 6c-3-3-7-3-10-2v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2ZM12 6v15"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  logout: '<path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4"/>',
  pin: '<path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  shield: '<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
  filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  flask: '<path d="M9 3h6M10 3v7L4 20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1l-6-10V3M7 16h10"/>',
  spectrum: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m5 15 3-1 2-6 3 9 2-6 4-1M7 7h.01"/>',
  scale: '<path d="M12 3v18M5 21h14M4 7h16M5 7l-3 7h6L5 7ZM19 7l-3 7h6l-3-7Z"/>',
  centrifuge: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="12" cy="12" r="5"/><path d="m12 7 2 4 3 1-4 2-1 3-2-4-3-1 4-2 1-3Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 6 9 7 9-7"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
  leaf: '<path d="M20 3C6 1 1 13 7 18s18-3 13-15ZM6 19 17 8"/>',
};
export const icon = (name: string, cls = '') => '<svg class="icon ' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] ?? paths.atom) + '</svg>';
export const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
export const date = (timestamp: number, options: Intl.DateTimeFormatOptions = {}) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', ...options }).format(timestamp);
export const time = (timestamp: number) => date(timestamp, { day: undefined, month: undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const dateKey = (timestamp: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp);
export const hours = (value: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value) + ' h';
export const initials = (name: string) => name.split(' ').slice(0, 2).map(n => n[0]).join('');
export const roleName: Record<string, string> = { admin: 'Administración', uco: 'Investigador UCO', externo: 'Investigador externo', tecnico: 'Personal técnico', contable: 'Contabilidad', consulta: 'Personal de consulta' };
export const statusName: Record<string, string> = { confirmada: 'Confirmada', cancelada: 'Cancelada', desplazada: 'Desplazada', en_uso: 'En uso', finalizada: 'Finalizada', disponible: 'Disponible', averiado: 'Averiado', mantenimiento: 'Mantenimiento' };
export const badge = (status: string, label = statusName[status] ?? status) => '<span class="badge badge-' + escape(status) + '"><span></span>' + escape(label) + '</span>';
export const empty = (title: string, detail: string, button = '') => '<div class="empty-state">' + icon('leaf') + '<h3>' + escape(title) + '</h3><p>' + escape(detail) + '</p>' + button + '</div>';
export const button = (label: string, action: string, id?: number, kind = 'primary', glyph = 'plus') => '<button class="button ' + kind + '" data-action="' + escape(action) + '"' + (id ? ' data-id="' + id + '"' : '') + '>' + icon(glyph) + escape(label) + '</button>';
