import type { Snapshot, ReportRow, BookingInput } from '../src/model.ts';
import { icon, escape as e, date, time, dateKey, hours } from './ui.js';
import * as views from './views.js';
import type { Filters } from './views.js';

const root = document.querySelector<HTMLDivElement>('#app')!;
const modal = document.querySelector<HTMLDialogElement>('#modal')!;
const toastElement = document.querySelector<HTMLDivElement>('#toast')!;
let snapshot: Snapshot | null = null, csrf = '', reportRows: ReportRow[] | null = null;
let toastTimer = 0, opener: HTMLElement | null = null, reportRequest = 0;
const filters: Filters = { search: '', category: 'Todas', status: 'all', scope: 'all', month: dateKey(Date.now()).slice(0,7) };
const pageNames = ['overview','catalog','bookings','incidents','reports','users','inbox','guide','contact'];
const currentPage = () => pageNames.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'No se ha podido completar la operación.';

function toast(message: string, isError = false): void {
  window.clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.className = 'visible' + (isError ? ' toast-error' : '');
  toastTimer = window.setTimeout(() => { toastElement.className = ''; }, 6500);
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch('/api/' + path, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 && path !== 'login' && snapshot) {
        snapshot = null; csrf = ''; modal.close(); root.innerHTML = views.loginView();
      }
      throw new Error(data.error ?? 'La operación no está disponible.');
    }
    return data as T;
  } catch (error) {
    if (error instanceof TypeError) throw new Error('No se puede conectar con el servidor. Comprueba que sigue abierto en la terminal.');
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('El servidor ha tardado demasiado. Vuelve a intentarlo.');
    throw error;
  } finally { window.clearTimeout(timer); }
}
function renderPage(preserveFocus = false): void {
  if (!snapshot) return;
  const active = preserveFocus ? document.activeElement as HTMLInputElement | null : null;
  const focus = active?.id, selection = active?.selectionStart;
  const page = currentPage(), s = snapshot;
  const output: Record<string, () => string> = {
    overview: () => views.overview(s), catalog: () => views.catalog(s, filters),
    bookings: () => views.bookings(s, filters), incidents: () => views.incidents(s),
    reports: () => views.reports(s, filters, reportRows), users: () => views.users(s),
    inbox: () => views.inbox(s), guide: () => views.guide(), contact: () => views.contact(),
  };
  document.querySelector('#page')!.innerHTML = output[page]();
  document.title = 'SG-CICT · ' + ({overview:'Vista general',catalog:'Instrumentos',bookings:'Reservas',incidents:'Incidencias',reports:'Informes',users:'Usuarios',inbox:'Avisos',guide:'Documentación',contact:'Contacto'}[page] ?? 'Mi espacio');
  if (focus) {
    const element = document.getElementById(focus) as HTMLInputElement | null;
    element?.focus();
    if (selection !== null && selection !== undefined && ['search','text'].includes(element?.type ?? '')) element?.setSelectionRange(selection, selection);
  }
}
function renderShell(): void {
  if (!snapshot) { root.innerHTML = views.loginView(); return; }
  root.innerHTML = views.shell(snapshot, currentPage()); renderPage();
}
async function loadReport(): Promise<void> {
  if (!snapshot || !views.canReport(snapshot)) return;
  const number = ++reportRequest, month = filters.month;
  reportRows = null; renderPage();
  try {
    const rows = await request<ReportRow[]>('reports?month=' + encodeURIComponent(month));
    if (number !== reportRequest || currentPage() !== 'reports') return;
    reportRows = rows; renderPage();
  } catch (error) { if (number === reportRequest) toast(errorText(error), true); }
}
async function refresh(): Promise<void> {
  snapshot = await request<Snapshot>('state'); renderShell();
  if (currentPage() === 'reports') await loadReport();
}
function openDialog(title: string, subtitle: string, content: string): void {
  opener = document.activeElement as HTMLElement;
  modal.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">SG-CICT · TU ESPACIO</span><h2 id="dialog-title">${e(title)}</h2><p>${e(subtitle)}</p></div><button class="icon-button" type="button" data-action="close-dialog" aria-label="Cerrar diálogo">${icon('close')}</button></div>${content}`;
  modal.showModal();
}
const formEnd = (label: string) => `<p class="form-error" id="dialog-error" role="alert"></p><div class="dialog-actions"><button class="button secondary" type="button" data-action="close-dialog">Volver</button><button class="button primary" type="submit">${e(label)} ${icon('arrow')}</button></div></form>`;
function bookingDialog(id?: number, maintenance = false): void {
  if (!snapshot) return;
  const items = snapshot.instruments, tomorrow = dateKey(snapshot.now + 86_400_000);
  const selected = id ?? items.find(i => i.state === 'disponible')?.id ?? items[0].id;
  openDialog(maintenance ? 'Programar un mantenimiento' : 'Un espacio para tu experimento', maintenance ? 'Las citas existentes se conservan. Elige una franja libre.' : 'Selecciona instrumento y horario; nosotros comprobamos los recursos.', `
    <form id="operation-form" data-operation="booking"><input name="kind" type="hidden" value="${maintenance ? 'mantenimiento' : 'experimento'}"><label for="instrumentId">Instrumento</label><select id="instrumentId" name="instrumentId" required>${items.map(i => `<option value="${i.id}" ${i.id === selected ? 'selected' : ''} ${i.state === 'averiado' && !maintenance ? 'disabled' : ''}>${e(i.name)} · ${e(i.code)}${i.state === 'averiado' ? ' · Averiado' : ''}</option>`).join('')}</select>
    <label for="booking-date">Día del experimento</label><input id="booking-date" name="date" type="date" min="${dateKey(snapshot.now)}" value="${tomorrow}" required><div class="form-columns"><div><label for="start-time">Hora de inicio</label><input id="start-time" name="start" type="time" min="08:00" max="19:59" value="10:00" required></div><div><label for="end-time">Hora de fin</label><input id="end-time" name="end" type="time" min="08:01" max="20:00" value="11:00" required></div></div>
    <label for="purpose">${maintenance ? 'Trabajo previsto' : 'Motivo de la reserva'}</label><textarea id="purpose" name="purpose" minlength="5" maxlength="300" rows="3" placeholder="Cuéntanos brevemente qué necesitas realizar…" required></textarea>
    <div class="form-hint">${icon('clock')}Horario de 08:00 a 20:00 · Europe/Madrid. ${maintenance ? 'El mantenimiento ocupa también al técnico.' : 'El técnico se asigna automáticamente cuando es necesario.'}</div><button class="button secondary full" type="button" data-action="availability">${icon('search')}Comprobar disponibilidad</button><div id="availability-result" role="status"></div>${formEnd(maintenance ? 'Programar mantenimiento' : 'Confirmar reserva')}`);
}
function incidentDialog(): void {
  if (!snapshot) return;
  openDialog('Comunicar una incidencia', 'El instrumento quedará bloqueado y se avisará a las reservas afectadas.', `<form id="operation-form" data-operation="incident"><label for="incident-instrument">Instrumento afectado</label><select id="incident-instrument" name="instrumentId" required>${snapshot.instruments.map(i => `<option value="${i.id}">${e(i.name)}</option>`).join('')}</select><label for="description">¿Qué ha ocurrido?</label><textarea id="description" name="description" minlength="10" maxlength="1500" rows="5" placeholder="Describe el fallo y lo que observaste…" required></textarea><div class="form-hint">${icon('shield')}Los avisos de esta demostración se guardan en la bandeja de notificaciones.</div>${formEnd('Registrar incidencia')}`);
}
function resolveDialog(id: number): void {
  const item = snapshot?.incidents.find(i => i.id === id);
  if (!item) return;
  openDialog('Registrar una reparación', item.instrumentName, `<form id="operation-form" data-operation="resolve" data-id="${id}"><div class="dialog-context">${e(item.description)}</div><label for="resolution">Trabajo realizado</label><textarea id="resolution" name="resolution" minlength="10" maxlength="1500" rows="5" placeholder="Indica cómo se ha solucionado la avería…" required></textarea><div class="form-hint">${icon('check')}El equipo vuelve a estar disponible cuando se han resuelto todas sus incidencias abiertas.</div>${formEnd('Guardar resolución')}`);
}
function userDialog(): void {
  const start = dateKey(Date.now()), end = dateKey(Date.now() + 365 * 86_400_000);
  openDialog('Dar acceso a una cuenta externa', 'La cuenta podrá acceder durante la vigencia de su contrato.', `<form id="operation-form" data-operation="user"><label for="user-name">Nombre y apellidos</label><input id="user-name" name="name" minlength="3" maxlength="100" required autocomplete="off"><label for="user-email">Correo electrónico</label><input id="user-email" name="email" type="email" maxlength="150" required autocomplete="off"><label for="company">Empresa o entidad</label><input id="company" name="company" minlength="2" maxlength="100" required><label for="user-password">Contraseña inicial</label><input id="user-password" name="password" type="password" minlength="10" maxlength="128" required autocomplete="new-password"><div class="form-columns"><div><label for="contract-start">Inicio del contrato</label><input id="contract-start" name="contractStart" type="date" value="${start}" required></div><div><label for="contract-end">Fin del contrato</label><input id="contract-end" name="contractEnd" type="date" value="${end}" required></div></div><div class="form-hint">${icon('shield')}La contraseña necesita al menos 10 caracteres. Las credenciales se facilitan manualmente en este prototipo.</div>${formEnd('Crear cuenta externa')}`);
}
function contractDialog(id: number): void {
  const user = snapshot?.users.find(u => u.id === id);
  if (!user) return;
  openDialog('Actualizar contrato', user.name + ' · ' + user.company, `<form id="operation-form" data-operation="contract" data-id="${id}"><div class="form-columns"><div><label for="contract-start">Inicio del contrato</label><input id="contract-start" name="contractStart" type="date" value="${dateKey(user.contractStart)}" required></div><div><label for="contract-end">Fin del contrato</label><input id="contract-end" name="contractEnd" type="date" value="${dateKey(user.contractEnd)}" required></div></div><label class="checkbox-label" for="account-active"><input id="account-active" name="active" type="checkbox" ${user.active ? 'checked' : ''}> Cuenta habilitada</label><div class="form-hint">${icon('shield')}Se cerrarán las sesiones abiertas de esta cuenta para aplicar el cambio.</div>${formEnd('Guardar contrato')}`);
}
function confirmationDialog(operation: string, id: number): void {
  const b = snapshot?.bookings.find(b => b.id === id);
  if (!b || !snapshot) return;
  const cancel = operation === 'cancel', start = operation === 'start';
  const billable = cancel && b.kind === 'experimento' && b.startsAt - snapshot.now < 86_400_000;
  openDialog(cancel ? 'Cancelar esta reserva' : start ? 'Registrar inicio del uso' : 'Finalizar la sesión', b.instrumentName, `<form id="operation-form" data-operation="${e(operation)}" data-id="${id}"><div class="dialog-context"><strong>${e(date(b.startsAt, { year:'numeric' }))}</strong><p>${e(time(b.startsAt))} — ${e(time(b.endsAt))} · ${e(b.code)}</p></div><p class="dialog-explanation">${cancel ? billable ? 'Faltan menos de 24 horas. La cancelación quedará registrada como facturable por ' + hours((b.endsAt-b.startsAt)/3_600_000) + '.' : 'La franja se liberará. Esta cancelación no se registrará como facturable.' : 'Se guardará la fecha y hora actuales del servidor como ' + (start ? 'inicio' : 'fin') + ' del uso real.'}</p>${formEnd(cancel ? 'Confirmar cancelación' : start ? 'Registrar inicio' : 'Finalizar uso')}`);
}
function bookingInput(form: HTMLFormElement): BookingInput {
  const data = new FormData(form);
  return { instrumentId: Number(data.get('instrumentId')), startsAt: data.get('date') + 'T' + data.get('start'), endsAt: data.get('date') + 'T' + data.get('end'), purpose: String(data.get('purpose') ?? ''), kind: data.get('kind') as BookingInput['kind'] };
}

// Un único manejador de clics permite volver a renderizar sin acumular eventos.
document.addEventListener('click', async event => {
  const target = (event.target as Element).closest<HTMLElement>('[data-action]');
  if (!target) return;
  const action = target.dataset.action, id = Number(target.dataset.id);
  try {
    if (action === 'demo-login') {
      const form = document.querySelector<HTMLFormElement>('#login-form');
      if (!form || form.dataset.busy) return;
      (form.elements.namedItem('email') as HTMLInputElement).value = target.dataset.profile + '@demo.local';
      (form.elements.namedItem('password') as HTMLInputElement).value = 'Demo2026!';
      form.requestSubmit();
    } else if (action === 'logout') {
      await request('logout', {}); snapshot = null; csrf = ''; filters.scope = 'all';
      root.innerHTML = views.loginView(); location.hash = ''; toast('Has cerrado tu sesión.');
    } else if (action === 'book') bookingDialog(id || undefined);
    else if (action === 'maintenance') bookingDialog(undefined, true);
    else if (action === 'incident') incidentDialog();
    else if (action === 'resolve') resolveDialog(id);
    else if (action === 'user') userDialog();
    else if (action === 'contract') contractDialog(id);
    else if (['cancel','start','finish'].includes(action ?? '')) confirmationDialog(action!, id);
    else if (action === 'close-dialog') modal.close();
    else if (action === 'category') { filters.category = target.dataset.category!; renderPage(); }
    else if (action === 'scope') { filters.scope = target.dataset.scope!; renderPage(); }
    else if (action === 'read') { await request('notifications/read', {}); await refresh(); toast('Tus notificaciones están al día.'); }
    else if (action === 'menu') {
      const open = document.querySelector('.workspace')!.classList.toggle('sidebar-open');
      target.setAttribute('aria-expanded', String(open));
    } else if (action === 'availability') {
      const form = document.querySelector<HTMLFormElement>('#operation-form')!;
      const output = document.querySelector<HTMLDivElement>('#availability-result')!;
      const button = target as HTMLButtonElement;
      button.disabled = true; output.className = ''; output.textContent = 'Comprobando recursos…';
      try {
        const result = await request<{ message: string }>('availability', bookingInput(form));
        output.className = 'availability success'; output.textContent = result.message;
      } catch (error) { output.className = 'availability failure'; output.textContent = errorText(error); }
      finally { button.disabled = false; }
    }
  } catch (error) { toast(errorText(error), true); }
});

document.addEventListener('submit', async event => {
  const form = event.target as HTMLFormElement;
  if (!['login-form','operation-form'].includes(form.id)) return;
  event.preventDefault();
  if (form.dataset.busy) return;
  form.dataset.busy = 'true';
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const original = submit.innerHTML; submit.disabled = true; submit.textContent = 'Un momento…';
  const output = document.getElementById(form.id === 'login-form' ? 'login-error' : 'dialog-error')!;
  output.textContent = '';
  try {
    if (form.id === 'login-form') {
      const data = Object.fromEntries(new FormData(form));
      const session = await request<{ csrf: string }>('login', data);
      csrf = session.csrf; location.hash = '#overview'; await refresh();
      document.querySelector<HTMLElement>('#main')?.focus();
    } else {
      const data = Object.fromEntries(new FormData(form));
      const operation = form.dataset.operation!, id = form.dataset.id;
      let message = 'Los cambios se han guardado.';
      if (operation === 'booking') {
        const result = await request<{ id: number }>('bookings', bookingInput(form));
        message = 'Reserva #' + result.id + ' confirmada. Encontrarás el aviso en tu bandeja.';
      } else if (operation === 'incident') {
        await request('incidents', { instrumentId: Number(data.instrumentId), description: data.description });
        message = 'Incidencia registrada. El instrumento queda bloqueado para nuevas reservas.';
      } else if (operation === 'resolve') {
        await request('incidents/' + id + '/resolve', data); message = 'La resolución se ha registrado correctamente.';
      } else if (operation === 'user') {
        await request('users', data); message = 'La cuenta externa ya está creada.';
      } else if (operation === 'contract') {
        await request('users/' + id + '/contract', { ...data, active: data.active === 'on' });
        message = 'Contrato actualizado. Se han cerrado las sesiones de esa cuenta.';
      } else if (operation === 'cancel') {
        const result = await request<{ billable: boolean }>('bookings/' + id + '/cancel', {});
        message = result.billable ? 'Reserva cancelada y registrada como facturable.' : 'Reserva cancelada sin cargo por antelación.';
      } else if (operation === 'start' || operation === 'finish') {
        await request('bookings/' + id + '/' + operation, {}); message = operation === 'start' ? 'Inicio de uso registrado.' : 'Sesión finalizada. El uso real aparecerá en el informe mensual.';
      }
      modal.close(); await refresh(); toast(message);
    }
  } catch (error) { output.textContent = errorText(error); }
  finally { delete form.dataset.busy; submit.disabled = false; submit.innerHTML = original; }
});

document.addEventListener('input', event => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.filter === 'search') { filters.search = input.value; renderPage(true); }
  if (modal.open && input.closest('#operation-form')) {
    const result = document.querySelector('#availability-result');
    if (result) { result.textContent = ''; result.className = ''; }
  }
});
document.addEventListener('change', async event => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.filter === 'status') { filters.status = input.value; renderPage(); }
  if (input.dataset.filter === 'month' && input.value) { filters.month = input.value; await loadReport(); }
});
modal.addEventListener('close', () => {
  if (opener?.isConnected) opener.focus(); else document.querySelector<HTMLElement>('#main')?.focus();
});
modal.addEventListener('click', event => { if (event.target === modal) { const r = modal.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) modal.close(); } });
window.addEventListener('hashchange', () => { renderShell(); if (currentPage() === 'reports') void loadReport(); });

try {
  const session = await request<{ csrf: string }>('session'); csrf = session.csrf; await refresh();
} catch (error) { root.innerHTML = views.loginView(); if (!errorText(error).includes('Inicia sesión')) toast(errorText(error), true); }
